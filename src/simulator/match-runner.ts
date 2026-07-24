import { createMatchConfig } from '../shared/match-config'
import { createSeededRandom } from '../shared/random'
import { createGame } from '../shared/rules'
import { createGameView } from '../shared/views'
import { actionKey } from './utils'
import { enumerateLegalActions, getActingPlayer } from './legal-actions'

import type { CardId } from '../shared/cards'
import type { DeckFormatSelection } from '../content/schema'
import type { GameAction } from '../shared/actions'
import type { GameState, PlayerId } from '../shared/types'
import type {
  BotPolicy,
  MatchParticipant,
  MatchSimulationConfig,
  PlayerMatchTelemetry,
  SimulatedMatchResult,
} from './types'

interface RunMatchInput {
  seed: string
  startingPlayer: PlayerId
  selection: DeckFormatSelection<CardId>
  participants: Record<PlayerId, MatchParticipant>
  policies: Record<PlayerId, BotPolicy>
  config: MatchSimulationConfig
}

interface MutableTelemetry {
  seenCardIds: Set<CardId>
  playedCardIds: Set<CardId>
  summonedCardIds: Set<CardId>
  manaCardIds: Set<CardId>
  attackedWithCardIds: Set<CardId>
}

function createTelemetry(state: GameState, playerId: PlayerId): MutableTelemetry {
  return {
    seenCardIds: new Set(state.players[playerId].hand.map((card) => card.cardId)),
    playedCardIds: new Set(),
    summonedCardIds: new Set(),
    manaCardIds: new Set(),
    attackedWithCardIds: new Set(),
  }
}

function cardIdForAction(state: GameState, actor: PlayerId, action: GameAction): CardId | null {
  const player = state.players[actor]
  switch (action.type) {
    case 'PLAY_CARD':
    case 'PLACE_MANA':
      return player.hand.find((card) => card.instanceId === action.cardInstanceId)?.cardId ?? null
    case 'SUMMON_FROM_MANA':
      return player.mana.find((card) => card.instanceId === action.cardInstanceId)?.cardId ?? null
    case 'ATTACK_UNIT':
    case 'ATTACK_PLAYER':
      return player.field.find((unit) => unit.instanceId === action.attackerId)?.cardId ?? null
    case 'RESOLVE_CHOICE':
    case 'END_TURN':
    case 'SURRENDER':
      return null
  }
}

function updateTelemetry(
  before: GameState,
  after: GameState,
  actor: PlayerId,
  action: GameAction,
  telemetry: Record<PlayerId, MutableTelemetry>,
): void {
  const actionCardId = cardIdForAction(before, actor, action)
  if (actionCardId) {
    if (action.type === 'PLAY_CARD' || action.type === 'SUMMON_FROM_MANA') {
      telemetry[actor].playedCardIds.add(actionCardId)
    } else if (action.type === 'PLACE_MANA') {
      telemetry[actor].manaCardIds.add(actionCardId)
    } else if (action.type === 'ATTACK_UNIT' || action.type === 'ATTACK_PLAYER') {
      telemetry[actor].attackedWithCardIds.add(actionCardId)
    }
  }

  for (const playerId of ['P1', 'P2'] as const) {
    const oldHand = new Set(before.players[playerId].hand.map((card) => card.instanceId))
    for (const card of after.players[playerId].hand) {
      if (!oldHand.has(card.instanceId)) telemetry[playerId].seenCardIds.add(card.cardId)
    }

    const oldField = new Set(before.players[playerId].field.map((unit) => unit.instanceId))
    for (const unit of after.players[playerId].field) {
      if (!oldField.has(unit.instanceId)) telemetry[playerId].summonedCardIds.add(unit.cardId)
    }
  }
}

function freezeTelemetry(value: MutableTelemetry): PlayerMatchTelemetry {
  return {
    seenCardIds: [...value.seenCardIds],
    playedCardIds: [...value.playedCardIds],
    summonedCardIds: [...value.summonedCardIds],
    manaCardIds: [...value.manaCardIds],
    attackedWithCardIds: [...value.attackedWithCardIds],
  }
}

export function runSimulatedMatch(input: RunMatchInput): SimulatedMatchResult {
  const matchConfig = createMatchConfig({
    formatId: input.selection.formatId,
    selectedSetIds: input.selection.selectedSetIds,
    randomSeed: input.seed,
    createdAt: 0,
  })
  let idSequence = 0
  let state = createGame({
    decks: {
      P1: input.participants.P1.cardIds,
      P2: input.participants.P2.cardIds,
    },
    startingPlayer: input.startingPlayer,
    matchConfig,
    deckSelections: {
      P1: input.selection,
      P2: input.selection,
    },
    idSource: () => `${input.seed}:card:${idSequence += 1}`,
  })
  const telemetry: Record<PlayerId, MutableTelemetry> = {
    P1: createTelemetry(state, 'P1'),
    P2: createTelemetry(state, 'P2'),
  }
  const botRandom = {
    P1: createSeededRandom(`${input.seed}:bot:P1`).next,
    P2: createSeededRandom(`${input.seed}:bot:P2`).next,
  }

  let actionCount = 0
  let termination: SimulatedMatchResult['termination'] = 'win'
  let failureDiagnostic: SimulatedMatchResult['failureDiagnostic']

  while (state.status === 'playing') {
    if (state.turnNumber > input.config.maxTurns) {
      termination = 'turn-limit'
      break
    }
    if (actionCount >= input.config.maxActions) {
      termination = 'action-limit'
      break
    }

    const actor = getActingPlayer(state)
    const options = enumerateLegalActions(state, actor, input.config.legalActionLimits)
    if (options.length === 0) {
      termination = 'no-legal-actions'
      const pending = createGameView(state, actor).pendingChoice
      failureDiagnostic = {
        actor,
        currentPlayer: state.currentPlayer,
        turnNumber: state.turnNumber,
        pendingChoiceType: pending?.type ?? null,
        pendingChoiceEffect: pending && 'effect' in pending ? String(pending.effect) : null,
      }
      break
    }
    const view = createGameView(state, actor)
    const legalActions = options.map((option) => option.action)
    const policy = input.policies[actor]
    const selected = policy.chooseAction({
      actor,
      view,
      legalActions,
      legalOptions: options.map((option) => ({
        action: option.action,
        nextView: createGameView(option.nextState, actor),
      })),
      deckCardIds: input.participants[actor].cardIds,
      random: botRandom[actor],
    })
    const selectedKey = actionKey(selected)
    const option = options.find((candidate) => actionKey(candidate.action) === selectedKey)
    if (!option) throw new Error(`${policy.name}이 합법 행동 목록에 없는 행동을 선택했습니다.`)

    const before = state
    state = option.nextState
    updateTelemetry(before, state, actor, selected, telemetry)
    actionCount += 1
  }

  return {
    seed: input.seed,
    startingPlayer: input.startingPlayer,
    winner: state.status === 'finished' ? state.winner : null,
    termination,
    turns: state.turnNumber,
    actions: actionCount,
    participants: input.participants,
    telemetry: {
      P1: freezeTelemetry(telemetry.P1),
      P2: freezeTelemetry(telemetry.P2),
    },
    ...(failureDiagnostic ? { failureDiagnostic } : {}),
  }
}
