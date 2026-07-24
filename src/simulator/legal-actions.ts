import { CARDS } from '../shared/cards'
import { applyAction, GameRuleError, getOpenFieldSlots } from '../shared/rules'
import { createGameView } from '../shared/views'
import { combinations, actionKey, uniqueBy } from './utils'

import type { CardPlaySelection, GameAction } from '../shared/actions'
import type { CardInstance, GameState, PlayerId } from '../shared/types'
import type { GameView, PendingChoiceView } from '../shared/views'
import type { LegalActionLimits, LegalActionOption } from './types'



const DEFAULT_LIMITS: LegalActionLimits = {
  maxPaymentVariantsPerCard: 96,
  maxGeneratedActions: 600,
  maxChoiceCombinations: 240,
}

function effectiveCost(card: CardInstance, view: GameView, actor: PlayerId): number {
  if (
    card.cardId === 'coffin_warrior'
    && view.players[actor].darkCardsDiscardedThisTurn >= 2
  ) return 0
  return Math.max(0, CARDS[card.cardId].cost - (card.costReduction ?? 0))
}

function paymentSignature(manaIds: readonly string[], view: GameView, actor: PlayerId): string {
  const manaById = new Map(view.players[actor].mana.map((mana) => [mana.instanceId, mana]))
  const attributes = new Set<string>()
  for (const manaId of manaIds) {
    const mana = manaById.get(manaId)
    if (!mana) continue
    for (const attribute of CARDS[mana.cardId].attributes) attributes.add(attribute)
  }
  // 현재 규칙에서 지불 마나가 효과에 주는 정보는 개별 카드 정체가 아니라
  // 공명에 포함된 속성 집합입니다. 같은 속성 집합의 지불법은 하나만 남겨
  // 시뮬레이션 분기를 크게 줄입니다.
  return [...attributes].sort().join('+')
}

function enumeratePayments(
  view: GameView,
  actor: PlayerId,
  cost: number,
  limit: number,
): string[][] {
  if (cost === 0) return [[]]
  const ready = view.players[actor].mana.filter((mana) => !mana.exhausted)
  if (ready.length < cost) return []

  const raw = combinations(ready, cost, Math.max(limit * 16, limit))
    .map((group) => group.map((mana) => mana.instanceId))

  const diverse: string[][] = []
  const seenSignatures = new Set<string>()
  for (const manaIds of raw) {
    const signature = paymentSignature(manaIds, view, actor)
    if (seenSignatures.has(signature)) continue
    seenSignatures.add(signature)
    diverse.push(manaIds)
    if (diverse.length >= limit) break
  }
  return diverse
}

function cartesianSelections(
  dimensions: Array<{ field: keyof CardPlaySelection; values: Array<string | number | undefined> }>,
  limit: number,
): Array<CardPlaySelection | undefined> {
  if (dimensions.length === 0) return [undefined]
  const output: CardPlaySelection[] = []
  const current: CardPlaySelection = {}

  const visit = (index: number): void => {
    if (output.length >= limit) return
    if (index >= dimensions.length) {
      const cleaned = Object.fromEntries(
        Object.entries(current).filter(([, value]) => value !== undefined),
      ) as CardPlaySelection
      output.push(cleaned)
      return
    }
    const dimension = dimensions[index]!
    for (const value of dimension.values) {
      if (value === undefined) delete current[dimension.field]
      else Object.assign(current, { [dimension.field]: value })
      visit(index + 1)
      if (output.length >= limit) return
    }
    delete current[dimension.field]
  }

  visit(0)
  return output.map((selection) => (
    Object.keys(selection).length === 0 ? undefined : selection
  ))
}

function playSelections(
  state: GameState,
  view: GameView,
  actor: PlayerId,
  card: CardInstance,
  limit: number,
): Array<CardPlaySelection | undefined> {
  const definition = CARDS[card.cardId]
  const dimensions: Array<{
    field: keyof CardPlaySelection
    values: Array<string | number | undefined>
  }> = []

  if (definition.type === 'unit') {
    if (definition.evolutionAttribute) {
      dimensions.push({
        field: 'evolutionUnitId',
        values: view.players[actor].field.map((unit) => unit.instanceId),
      })
    } else {
      dimensions.push({
        field: 'fieldSlot',
        values: getOpenFieldSlots(state, actor),
      })
    }
  }

  const hintedFields = definition.simulationHints?.playSelectionFields ?? []
  const own = view.players[actor]
  const enemyId: PlayerId = actor === 'P1' ? 'P2' : 'P1'
  const enemy = view.players[enemyId]

  for (const field of hintedFields) {
    if (field === 'unitId') {
      dimensions.push({
        field,
        values: [
          undefined,
          ...own.field.map((unit) => unit.instanceId),
          ...enemy.field.map((unit) => unit.instanceId),
        ],
      })
    } else if (field === 'lifeIndex') {
      const maximum = Math.max(own.lifeCount, enemy.lifeCount)
      dimensions.push({
        field,
        values: [undefined, ...Array.from({ length: maximum }, (_, index) => index)],
      })
    } else if (field === 'effectManaId') {
      dimensions.push({
        field,
        values: [undefined, ...own.mana.map((mana) => mana.instanceId)],
      })
    } else if (field === 'fieldSlot' && definition.type === 'spell') {
      dimensions.push({
        field,
        values: [undefined, ...getOpenFieldSlots(state, actor)],
      })
    }
  }

  if (dimensions.some((dimension) => dimension.values.length === 0)) return []
  return cartesianSelections(dimensions, limit)
}

function assignmentChoices(
  ids: readonly string[],
  slots: readonly number[],
  maximum: number,
  prefix: string,
  limit: number,
): string[][] {
  const output: string[][] = [[]]
  const maxCount = Math.min(maximum, ids.length, slots.length)
  for (let count = 1; count <= maxCount; count += 1) {
    const idGroups = combinations(ids, count, limit)
    const slotGroups = combinations(slots, count, limit)
    for (const idGroup of idGroups) {
      for (const slotGroup of slotGroups) {
        const permutations = count === 2
          ? [slotGroup, [slotGroup[1]!, slotGroup[0]!]]
          : [slotGroup]
        for (const assignedSlots of permutations) {
          output.push(idGroup.map((id, index) => `${prefix}${id}@${assignedSlots[index]}`))
          if (output.length >= limit) return output
        }
      }
    }
  }
  return output
}

function pendingChoiceCandidates(
  state: GameState,
  view: GameView,
  actor: PlayerId,
  pending: PendingChoiceView,
  limit: number,
): GameAction[] {
  const own = view.players[actor]
  const enemyId: PlayerId = actor === 'P1' ? 'P2' : 'P1'
  const enemy = view.players[enemyId]
  const resolve = (choiceIds: string[]): GameAction => ({ type: 'RESOLVE_CHOICE', choiceIds })
  const candidates = (pending.type === 'SOF_CHOICE' ? pending.candidateIds : [])
  const openSlots = getOpenFieldSlots(state, actor)

  switch (pending.type) {
    case 'TEMPLE_PROSPECT_LIFE':
      return Array.from({ length: own.lifeCount }, (_, index) => resolve([`life:${index}`]))
    case 'TEMPLE_PROSPECT_HAND':
      return [resolve([]), ...own.hand.map((card) => resolve([card.instanceId]))]
    case 'WAVE_READER_TOP':
      return [resolve(['keep']), resolve(['discard'])]
    case 'SURGING_WAVE_TOP':
      return [
        resolve(['bottom:normal']),
        resolve(['bottom:reverse']),
        ...pending.revealedCards.flatMap((card) => (
          openSlots.map((slot) => resolve([`summon:${card.instanceId}@${slot}`]))
        )),
      ]
    case 'BURNING_PROCESSION':
      return assignmentChoices(
        pending.revealedCards.map((card) => card.instanceId),
        openSlots,
        pending.maxSummons,
        '',
        limit,
      ).map(resolve)
    case 'GRAVE_DIGGING_RETURN': {
      const output: GameAction[] = [resolve([])]
      for (let count = 1; count <= Math.min(pending.maxCards, own.discard.length); count += 1) {
        output.push(...combinations(own.discard.map((card) => card.instanceId), count, limit).map(resolve))
        if (output.length >= limit) break
      }
      return output.slice(0, limit)
    }
    case 'DEMON_FINGER_DISCARD':
      return own.hand.length === 0
        ? [resolve([])]
        : own.hand.map((card) => resolve([card.instanceId]))
    case 'DEMON_BREATH_TARGET':
      return pending.candidateUnitIds.map((id) => resolve([id]))
    case 'HOLY_MIRROR_LIFE':
      return Array.from({ length: enemy.lifeCount }, (_, index) => resolve([`life:${index}`]))
    case 'AWAKEN_SUMMON_SLOT':
      return openSlots.map((slot) => resolve([`slot:${slot}`]))
    case 'SOF_CHOICE':
      break
  }

  switch (pending.effect) {
    case 'BOMB_MOUSE_DAMAGE':
      // 연쇄 사망 처리 중 처음 잡힌 후보가 선택 시점 전에 사라질 수 있습니다.
      // 빈 선택도 함께 검증해 두면 규칙 엔진이 현재 상태에 맞는 쪽만 통과시킵니다.
      return [resolve([]), ...candidates.map((id) => resolve([id]))]
    case 'UNDERWATER_OBSERVER_TOP':
      return [
        resolve(['keep:normal']),
        resolve(['keep:reverse']),
        ...pending.revealedCards.map((card) => resolve([`discard:${card.instanceId}`])),
      ]
    case 'ICE_MIRROR_FREEZE':
    case 'WAVE_FIN_BOTTOM':
    case 'MANA_FLIP_PLACE':
    case 'GRAVE_MERCHANT_RETURN':
    case 'MASS_BURIAL_ENEMY_FIRST':
    case 'MASS_BURIAL_ENEMY_SECOND':
    case 'MOURNER_DESTROY':
      return candidates.map((id) => resolve([id]))
    case 'WAVE_FIN_BOUNCE':
    case 'CRYSTAL_TSUNAMI_BOUNCE':
    case 'TREE_FAIRY_HAND_MANA':
    case 'MANA_FLIP_RETURN':
    case 'BLACKWING_RETURN':
    case 'MASS_BURIAL_SELF':
    case 'MOURNER_SACRIFICE':
    case 'SKY_KNIGHT_READY':
    case 'STONE_PRIEST_HAND_MANA':
    case 'COFFIN_KEEPER_BOTTOM':
      return [resolve([]), ...candidates.map((id) => resolve([id]))]
    case 'WAVE_FIN_DRAW':
      return [resolve(['draw']), resolve(['skip'])]
    case 'EARTH_GUARDIAN_SUMMON':
      return assignmentChoices(candidates, openSlots, pending.maxChoices, '', limit).map(resolve)
    case 'MOURNER_LAST_WORDS':
      return [
        resolve([]),
        ...candidates.flatMap((id) => openSlots.map((slot) => resolve([`${id}@${slot}`]))),
      ]
    case 'STONE_PRIEST_LIFE': {
      const stage = String(pending.data.stage ?? 'choose')
      return stage === 'revealed'
        ? [resolve(['keep']), resolve(['take'])]
        : [resolve([]), ...candidates.map((id) => resolve([id]))]
    }
    case 'MIRROR_LAKE_RESOLVE': {
      const stage = String(pending.data.stage ?? '')
      if (stage === 'choose-life') return candidates.map((id) => resolve([id]))
      if (stage === 'water-only') return [resolve(['keep']), resolve(['discard'])]
      if (stage === 'both') return [resolve(['keep']), resolve(['discard']), resolve(['swap'])]
      return [resolve(['close'])]
    }
    case 'COFFIN_KEEPER_TOP':
      return [resolve(['keep']), resolve(['discard'])]
  }
}

function rawTurnActions(
  state: GameState,
  view: GameView,
  actor: PlayerId,
  limits: LegalActionLimits,
): GameAction[] {
  const own = view.players[actor]
  const enemyId: PlayerId = actor === 'P1' ? 'P2' : 'P1'
  const enemy = view.players[enemyId]

  const manaActions: GameAction[] = !own.manaPlacedThisTurn
    ? own.hand.map((card) => ({
        type: 'PLACE_MANA' as const,
        cardInstanceId: card.instanceId,
      }))
    : []

  const openSlots = getOpenFieldSlots(state, actor)
  const summonActions: GameAction[] = []
  for (const mana of own.mana) {
    for (const fieldSlot of openSlots) {
      summonActions.push({
        type: 'SUMMON_FROM_MANA',
        cardInstanceId: mana.instanceId,
        fieldSlot,
      })
    }
  }

  const attackActions: GameAction[] = []
  for (const attacker of own.field) {
    for (const defender of enemy.field) {
      attackActions.push({
        type: 'ATTACK_UNIT',
        attackerId: attacker.instanceId,
        defenderId: defender.instanceId,
      })
    }
    if (enemy.lifeCount === 0) {
      attackActions.push({ type: 'ATTACK_PLAYER', attackerId: attacker.instanceId, lifeSlotIndices: [] })
    } else {
      for (const lifeSlots of combinations(enemy.lifeSlotIndices, 1)) {
        attackActions.push({ type: 'ATTACK_PLAYER', attackerId: attacker.instanceId, lifeSlotIndices: lifeSlots })
      }
      for (const lifeSlots of combinations(enemy.lifeSlotIndices, 2)) {
        attackActions.push({ type: 'ATTACK_PLAYER', attackerId: attacker.instanceId, lifeSlotIndices: lifeSlots })
      }
    }
  }

  // 복잡한 대상 선택 카드 하나가 전체 후보 상한을 독점하면 뒤쪽 손 카드와 공격이
  // 사라집니다. 각 손 카드에 최소한의 독립 예산을 주고, 공격·마나·턴 종료 후보는
  // 별도로 보존합니다.
  const playActions: GameAction[] = []
  const playBudget = Math.max(
    own.hand.length * 4,
    limits.maxGeneratedActions - manaActions.length - summonActions.length - attackActions.length - 1,
  )
  const perCardBudget = Math.max(4, Math.floor(playBudget / Math.max(1, own.hand.length)))

  for (const card of own.hand) {
    const cost = effectiveCost(card, view, actor)
    const payments = enumeratePayments(
      view,
      actor,
      cost,
      Math.min(limits.maxPaymentVariantsPerCard, perCardBudget),
    )
    const selections = playSelections(
      state,
      view,
      actor,
      card,
      perCardBudget,
    )
    let generatedForCard = 0
    for (const manaIds of payments) {
      for (const selection of selections) {
        playActions.push({
          type: 'PLAY_CARD',
          cardInstanceId: card.instanceId,
          manaIds,
          ...(selection ? { selection } : {}),
        })
        generatedForCard += 1
        if (generatedForCard >= perCardBudget) break
      }
      if (generatedForCard >= perCardBudget) break
    }
  }

  const endTurn: GameAction = { type: 'END_TURN' }
  return [
    ...manaActions,
    ...playActions,
    ...summonActions,
    ...attackActions,
    endTurn,
  ]
}

export function getActingPlayer(state: GameState): PlayerId {
  return state.pendingChoices[0]?.playerId ?? state.currentPlayer
}

export function enumerateLegalActions(
  state: GameState,
  actor = getActingPlayer(state),
  rawLimits: Partial<LegalActionLimits> = {},
): LegalActionOption[] {
  const limits: LegalActionLimits = { ...DEFAULT_LIMITS, ...rawLimits }
  if (state.status !== 'playing') return []
  const view = createGameView(state, actor)
  const pending = view.pendingChoice
  const raw = pending
    ? pendingChoiceCandidates(state, view, actor, pending, limits.maxChoiceCombinations)
    : state.currentPlayer === actor
      ? rawTurnActions(state, view, actor, limits)
      : []

  const actions = uniqueBy<GameAction>(raw, (action) => actionKey(action))
  const legal: LegalActionOption[] = []
  for (const action of actions) {
    try {
      legal.push({ action, nextState: applyAction(state, actor, action) })
    } catch (error) {
      if (!(error instanceof GameRuleError)) throw error
    }
  }
  return legal
}
