import type { GameAction } from './actions'
import { CONTENT_VERSION, RULES_VERSION } from '../content/sets'
import { getFormat, isGameFormatId } from '../content/formats'
import type { LoggedAction, LoggedActionDetail, MatchRecord } from './match-log'
import { applyAction, createGame } from './rules'
import type { CreateGameOptions } from './rules'
import type { CardId } from './cards'
import type { GameState, PlayerId } from './types'
import { createGameView } from './views'
import type { GameView } from './views'

export interface MatchHostSnapshot {
  game: GameState
  actionLog: LoggedAction[]
}

export interface MatchDispatchOptions {
  createdAt: number
}

function findCardId(game: GameState, instanceId: string | undefined): CardId | undefined {
  if (!instanceId) return undefined
  for (const player of Object.values(game.players)) {
    const cards = [
      ...player.deck, ...player.hand, ...player.life, ...player.mana, ...player.field, ...player.discard,
      ...player.field.flatMap((unit) => unit.evolutionStack ?? []),
    ]
    const found = cards.find((card) => card.instanceId === instanceId)
    if (found) return found.cardId
  }
  for (const pending of game.pendingChoices) {
    if ('sourceCard' in pending && pending.sourceCard?.instanceId === instanceId) return pending.sourceCard.cardId
    if ('revealedCard' in pending && pending.revealedCard.instanceId === instanceId) return pending.revealedCard.cardId
    if ('revealedCards' in pending && pending.revealedCards) {
      const found = pending.revealedCards.find((card) => card.instanceId === instanceId)
      if (found) return found.cardId
    }
  }
  return undefined
}

function createActionDetail(before: GameState, after: GameState, action: GameAction): LoggedActionDetail {
  const sourceInstanceId =
    action.type === 'PLACE_MANA' || action.type === 'PLAY_CARD' || action.type === 'SUMMON_FROM_MANA'
      ? action.cardInstanceId
      : action.type === 'ATTACK_UNIT' || action.type === 'ATTACK_PLAYER'
        ? action.attackerId
        : undefined
  const targetInstanceIds = action.type === 'ATTACK_UNIT' ? [action.defenderId]
    : action.type === 'PLAY_CARD' ? [
        action.selection?.unitId, action.selection?.effectManaId, action.selection?.discardId,
        ...(action.selection?.discardIds ?? []), action.selection?.evolutionUnitId,
      ].filter((id): id is string => Boolean(id))
    : action.type === 'RESOLVE_CHOICE' ? action.choiceIds
    : []
  const beforeFields = new Map(
    (['P1', 'P2'] as const).flatMap((id) => before.players[id].field)
      .map((unit) => [unit.instanceId, unit.cardId] as const),
  )
  const afterFieldIds = new Set((['P1', 'P2'] as const).flatMap((id) => after.players[id].field).map((unit) => unit.instanceId))
  const beforeFieldIds = new Set(beforeFields.keys())
  const summonedCardIds = (['P1', 'P2'] as const).flatMap((id) => after.players[id].field)
    .filter((unit) => !beforeFieldIds.has(unit.instanceId)).map((unit) => unit.cardId)
  const lifeLost: LoggedActionDetail['lifeLost'] = {}
  const cardsDrawn: LoggedActionDetail['cardsDrawn'] = {}
  for (const id of ['P1', 'P2'] as const) {
    const lost = before.players[id].life.length - after.players[id].life.length
    const previousHandIds = new Set(before.players[id].hand.map((card) => card.instanceId))
    const drawn = after.players[id].hand.filter((card) => !previousHandIds.has(card.instanceId)).length
    if (lost > 0) lifeLost[id] = lost
    if (drawn > 0) cardsDrawn[id] = drawn
  }
  const pending = before.pendingChoices[0]
  const choiceSourceCardId = action.type === 'RESOLVE_CHOICE' && pending
    ? ('sourceCard' in pending ? pending.sourceCard?.cardId
      : 'sourceUnitId' in pending ? findCardId(before, pending.sourceUnitId) : undefined)
    : undefined
  return {
    sourceCardId: findCardId(before, sourceInstanceId) ?? choiceSourceCardId,
    targetCardIds: targetInstanceIds.map((id) => findCardId(before, id)).filter((id): id is CardId => Boolean(id)),
    destroyedCardIds: [...beforeFields].filter(([id]) => !afterFieldIds.has(id)).map(([, cardId]) => cardId),
    lifeLost,
    cardsDrawn,
    summonedCardIds,
  }
}

function validateAndMigrateSnapshot(snapshot: MatchHostSnapshot): MatchHostSnapshot {
  const migrated = structuredClone(snapshot)
  const { game, actionLog } = migrated
  if (!isGameFormatId(game.matchConfig?.formatId)) {
    throw new Error('저장된 게임의 포맷이 유효하지 않습니다.')
  }
  if (
    game.matchConfig.rulesVersion !== RULES_VERSION
    || game.matchConfig.contentVersion !== CONTENT_VERSION
  ) {
    throw new Error('현재 규칙 또는 카드 버전과 호환되지 않는 저장 상태입니다.')
  }

  const format = getFormat(game.matchConfig.formatId)
  const instanceIds = new Set<string>()
  const entrySequences = new Set<number>()
  let nextEntrySequence = Number.isInteger(game.nextBattlefieldEntrySeq)
    ? game.nextBattlefieldEntrySeq
    : 0

  const registerCard = (instanceId: string): void => {
    if (!instanceId || instanceIds.has(instanceId)) {
      throw new Error('저장 상태에 중복되거나 비어 있는 카드 인스턴스 ID가 있습니다.')
    }
    instanceIds.add(instanceId)
  }

  for (const playerId of ['P1', 'P2'] as const) {
    const player = game.players[playerId]
    const occupiedSlots = new Set<number>()
    for (const card of [...player.deck, ...player.hand, ...player.life, ...player.mana, ...player.discard]) {
      registerCard(card.instanceId)
    }
    for (const unit of player.field) {
      registerCard(unit.instanceId)
      for (const material of unit.evolutionStack ?? []) registerCard(material.instanceId)
      if (
        !Number.isInteger(unit.slotIndex)
        || unit.slotIndex < 0
        || unit.slotIndex >= format.fieldSlots
        || occupiedSlots.has(unit.slotIndex)
      ) {
        throw new Error('저장 상태의 전장 슬롯이 중복되었거나 범위를 벗어났습니다.')
      }
      occupiedSlots.add(unit.slotIndex)

      if (!Number.isInteger(unit.battlefieldEntrySeq) || unit.battlefieldEntrySeq <= 0) {
        unit.battlefieldEntrySeq = ++nextEntrySequence
      }
      if (entrySequences.has(unit.battlefieldEntrySeq)) {
        throw new Error('저장 상태에 중복된 전장 진입 순서가 있습니다.')
      }
      entrySequences.add(unit.battlefieldEntrySeq)
      nextEntrySequence = Math.max(nextEntrySequence, unit.battlefieldEntrySeq)
    }
  }
  for (const pending of game.pendingChoices ?? []) {
    if ('sourceCard' in pending && pending.sourceCard) registerCard(pending.sourceCard.instanceId)
  }
  if (instanceIds.size !== format.deckSize * 2) {
    throw new Error('저장 상태의 전체 카드 수가 포맷의 덱 구성과 일치하지 않습니다.')
  }
  game.nextBattlefieldEntrySeq = nextEntrySequence

  const expectedSequences = actionLog.map((_, index) => index + 1)
  if (
    actionLog.length !== game.actionSequence
    || actionLog.some((entry, index) => entry.sequence !== expectedSequences[index])
  ) {
    throw new Error('저장 상태의 행동 로그와 행동 순번이 일치하지 않습니다.')
  }

  return migrated
}

/**
 * A transport-independent authority boundary for one match.
 *
 * A Worker, a local game, or a future room-host adapter can own this contract
 * without moving game rules into the transport layer.
 */
export interface MatchAuthority {
  dispatch(
    playerId: PlayerId,
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState
  getView(playerId: PlayerId): GameView
  getSnapshot(): MatchHostSnapshot
}

export class MatchHost implements MatchAuthority {
  private game: GameState
  private actionLog: LoggedAction[]

  private constructor(snapshot: MatchHostSnapshot) {
    this.game = structuredClone(snapshot.game)
    this.actionLog = structuredClone(snapshot.actionLog)
  }

  static create(options: CreateGameOptions = {}): MatchHost {
    return new MatchHost({
      game: createGame(options),
      actionLog: [],
    })
  }

  static restore(snapshot: MatchHostSnapshot): MatchHost {
    return new MatchHost(validateAndMigrateSnapshot(snapshot))
  }

  dispatch(
    playerId: PlayerId,
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState {
    const previousGame = this.game
    const nextGame = applyAction(this.game, playerId, action)

    this.game = nextGame
    this.actionLog.push({
      sequence: nextGame.actionSequence,
      playerId,
      action: structuredClone(action),
      createdAt: options.createdAt,
      detail: createActionDetail(previousGame, nextGame, action),
    })

    return structuredClone(nextGame)
  }

  getState(): GameState {
    return structuredClone(this.game)
  }

  getView(playerId: PlayerId): GameView {
    return createGameView(this.game, playerId)
  }

  getActionLog(): LoggedAction[] {
    return structuredClone(this.actionLog)
  }

  getSnapshot(): MatchHostSnapshot {
    return {
      game: this.getState(),
      actionLog: this.getActionLog(),
    }
  }

  getRecord(): MatchRecord {
    return {
      randomSeed: this.game.matchConfig.randomSeed,
      rulesVersion: this.game.matchConfig.rulesVersion,
      contentVersion: this.game.matchConfig.contentVersion,
      actions: this.getActionLog(),
    }
  }
}
