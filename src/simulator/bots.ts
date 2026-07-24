import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import { actionKey, sampleOne } from './utils'

import type { CardAttributeId, CardId } from '../shared/cards'
import type { CardInstance, PlayerId, UnitInstance } from '../shared/types'
import type { GameAction } from '../shared/actions'
import type { GameView, PlayerView } from '../shared/views'
import type {
  BehaviorCandidate,
  BotDecisionContext,
  BotPolicy,
  BotProfileId,
  HeuristicBotProfileId,
  HeuristicWeights,
} from './types'

interface DeckStrategy {
  attributeCounts: Record<CardAttributeId, number>
  dominantAttributes: CardAttributeId[]
  graveyardAffinity: number
  lifeAffinity: number
  manaAffinity: number
  waterAffinity: number
}

const ATTRIBUTE_IDS = Object.keys(CARD_ATTRIBUTES) as CardAttributeId[]

export const BASELINE_PROFILE_WEIGHTS: Record<HeuristicBotProfileId, HeuristicWeights> = {
  aggressive: {
    directAttack: 190,
    unitAttack: 20,
    playUnit: 42,
    playSpell: 34,
    placeMana: 40,
    endTurn: -8,
    attackStat: 22,
    healthStat: 5,
    handValue: 4,
    highCostBias: 4,
    favorableTrade: 50,
    lifeValue: 175,
    manaValue: 8,
    readyManaValue: 5,
    readyUnitValue: 12,
    stateDelta: 1.05,
  },
  value: {
    directAttack: 155,
    unitAttack: 30,
    playUnit: 38,
    playSpell: 44,
    placeMana: 48,
    endTurn: -4,
    attackStat: 14,
    healthStat: 12,
    handValue: 11,
    highCostBias: 5,
    favorableTrade: 85,
    lifeValue: 160,
    manaValue: 11,
    readyManaValue: 8,
    readyUnitValue: 15,
    stateDelta: 1.3,
  },
  control: {
    directAttack: 135,
    unitAttack: 42,
    playUnit: 34,
    playSpell: 54,
    placeMana: 54,
    endTurn: 0,
    attackStat: 10,
    healthStat: 18,
    handValue: 9,
    highCostBias: 6,
    favorableTrade: 110,
    lifeValue: 165,
    manaValue: 13,
    readyManaValue: 10,
    readyUnitValue: 18,
    stateDelta: 1.5,
  },
}

function enemyOf(actor: PlayerId): PlayerId {
  return actor === 'P1' ? 'P2' : 'P1'
}

function createDeckStrategy(cardIds: readonly CardId[]): DeckStrategy {
  const attributeCounts = Object.fromEntries(
    ATTRIBUTE_IDS.map((attribute) => [attribute, 0]),
  ) as Record<CardAttributeId, number>
  for (const cardId of cardIds) {
    for (const attribute of CARDS[cardId].attributes) attributeCounts[attribute] += 1
  }
  const maximum = Math.max(0, ...ATTRIBUTE_IDS.map((attribute) => attributeCounts[attribute]))
  const dominantAttributes = ATTRIBUTE_IDS.filter((attribute) => (
    maximum > 0 && attributeCounts[attribute] >= maximum * 0.75
  ))
  const denominator = Math.max(1, cardIds.length)
  return {
    attributeCounts,
    dominantAttributes,
    graveyardAffinity: attributeCounts.dark / denominator,
    lifeAffinity: attributeCounts.light / denominator,
    manaAffinity: attributeCounts.earth / denominator,
    waterAffinity: attributeCounts.water / denominator,
  }
}

function cardKeepValue(card: CardInstance, weights: HeuristicWeights): number {
  const definition = CARDS[card.cardId]
  if (definition.type === 'spell') {
    return weights.playSpell
      + definition.cost * (weights.highCostBias + 4)
      + Math.min(18, definition.rulesText.length * 0.04)
  }
  const keywordBonus = (definition.keywords?.length ?? 0) * 13
    + (definition.evolutionAttribute ? 22 : 0)
  return weights.playUnit
    + definition.attack * weights.attackStat
    + definition.health * weights.healthStat
    + definition.cost * weights.highCostBias
    + keywordBonus
}

function cardScore(card: CardInstance, weights: HeuristicWeights): number {
  return cardKeepValue(card, weights)
}

function remainingHealth(unit: UnitInstance): number {
  const definition = CARDS[unit.cardId]
  return definition.type === 'unit'
    ? definition.health + unit.temporaryHealthModifier - unit.damage
    : 0
}

function unitPublicValue(unit: UnitInstance, weights: HeuristicWeights): number {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return 0
  const attack = Math.max(0, definition.attack + unit.temporaryAttackModifier)
  const health = Math.max(0, remainingHealth(unit))
  const keywordBonus = (definition.keywords?.length ?? 0) * 12
    + (definition.evolutionAttribute ? 16 : 0)
    + (unit.evolutionStack?.length ?? 0) * 10
  return attack * weights.attackStat
    + health * weights.healthStat
    + definition.cost * 3
    + keywordBonus
    + (unit.exhausted ? 0 : weights.readyUnitValue)
    - (unit.skipNextReady ? 16 : 0)
}

function playerPublicValue(player: PlayerView, weights: HeuristicWeights): number {
  const readyMana = player.mana.filter((mana) => !mana.exhausted).length
  return player.lifeCount * weights.lifeValue
    + player.handCount * weights.handValue
    + player.mana.length * weights.manaValue
    + readyMana * weights.readyManaValue
    + player.field.reduce((sum, unit) => sum + unitPublicValue(unit, weights), 0)
}

/**
 * 행동 후보의 nextState는 규칙 엔진이 이미 계산하지만, 봇은 숨은 카드 정체를
 * 이용하면 안 됩니다. 그래서 손·덱·라이프의 내용은 보지 않고 공개 수량과
 * 전장 상태만 평가합니다. 직접 공격은 각성 내용을 미리 볼 수 있으므로 별도로
 * 처리하고 이 델타를 사용하지 않습니다.
 */
function publicStateScore(view: GameView, actor: PlayerId, weights: HeuristicWeights): number {
  if (view.status === 'finished') {
    if (view.winner === actor) return 100000
    if (view.winner === enemyOf(actor)) return -100000
  }
  return playerPublicValue(view.players[actor], weights)
    - playerPublicValue(view.players[enemyOf(actor)], weights)
}

function combatScore(
  attacker: UnitInstance,
  defender: UnitInstance,
  weights: HeuristicWeights,
): number {
  const attackerDefinition = CARDS[attacker.cardId]
  const defenderDefinition = CARDS[defender.cardId]
  if (attackerDefinition.type !== 'unit' || defenderDefinition.type !== 'unit') return weights.unitAttack
  const attackerPower = attackerDefinition.attack + attacker.temporaryAttackModifier
  const defenderPower = defenderDefinition.attack + defender.temporaryAttackModifier
  const killsDefender = attackerPower >= remainingHealth(defender)
  const survives = remainingHealth(attacker) > defenderPower
  return weights.unitAttack
    + (killsDefender ? weights.favorableTrade + defenderDefinition.cost * 12 : -18)
    + (survives ? weights.favorableTrade * 0.35 : -weights.favorableTrade * 0.3)
}

function allVisibleCards(view: GameView): CardInstance[] {
  return [
    ...view.players.P1.hand,
    ...view.players.P1.mana,
    ...view.players.P1.field,
    ...view.players.P1.discard,
    ...view.players.P2.hand,
    ...view.players.P2.mana,
    ...view.players.P2.field,
    ...view.players.P2.discard,
    ...(view.pendingChoice?.type === 'SOF_CHOICE' ? view.pendingChoice.revealedCards : []),
    ...(view.pendingChoice?.type === 'SURGING_WAVE_TOP' ? view.pendingChoice.revealedCards : []),
    ...(view.pendingChoice?.type === 'BURNING_PROCESSION' ? view.pendingChoice.revealedCards : []),
    ...(view.pendingChoice?.type === 'WAVE_READER_TOP' && view.pendingChoice.revealedCard
      ? [view.pendingChoice.revealedCard]
      : []),
  ]
}

function selectedInstanceIds(action: Extract<GameAction, { type: 'RESOLVE_CHOICE' }>): string[] {
  return action.choiceIds.flatMap((rawChoice) => {
    if (
      rawChoice === 'draw'
      || rawChoice === 'take'
      || rawChoice === 'swap'
      || rawChoice === 'discard'
      || rawChoice === 'keep'
      || rawChoice === 'skip'
      || rawChoice === 'close'
      || rawChoice.includes(':normal')
      || rawChoice.includes(':reverse')
      || rawChoice.startsWith('life:')
      || rawChoice.startsWith('slot:')
    ) return []
    const withoutPrefix = rawChoice
      .replace(/^summon:/, '')
      .replace(/^discard:/, '')
    const instanceId = withoutPrefix.includes('@')
      ? withoutPrefix.slice(0, withoutPrefix.lastIndexOf('@'))
      : withoutPrefix
    return instanceId ? [instanceId] : []
  })
}

function selectedCardValue(
  action: Extract<GameAction, { type: 'RESOLVE_CHOICE' }>,
  view: GameView,
  weights: HeuristicWeights,
): number {
  const visible = new Map(allVisibleCards(view).map((card) => [card.instanceId, card]))
  return selectedInstanceIds(action).reduce((sum, instanceId) => {
    const card = visible.get(instanceId)
    return sum + (card ? cardKeepValue(card, weights) : 0)
  }, 0)
}

function selectedUnitValue(
  action: Extract<GameAction, { type: 'RESOLVE_CHOICE' }>,
  view: GameView,
  weights: HeuristicWeights,
): number {
  const units = new Map(
    [...view.players.P1.field, ...view.players.P2.field]
      .map((unit) => [unit.instanceId, unit] as const),
  )
  return selectedInstanceIds(action).reduce((sum, instanceId) => {
    const unit = units.get(instanceId)
    return sum + (unit ? unitPublicValue(unit, weights) : 0)
  }, 0)
}

function topCardChoiceScore(
  action: Extract<GameAction, { type: 'RESOLVE_CHOICE' }>,
  context: BotDecisionContext,
  weights: HeuristicWeights,
  strategy: DeckStrategy,
): number {
  const pending = context.view.pendingChoice
  if (!pending) return 0

  if (pending.type === 'WAVE_READER_TOP') {
    const card = pending.revealedCard
    if (!card) return 0
    const value = cardKeepValue(card, weights)
    return action.choiceIds[0] === 'keep'
      ? value * 0.3
      : -value * 0.22 + strategy.graveyardAffinity * 35
  }

  if (pending.type !== 'SOF_CHOICE') return 0
  if (pending.effect === 'UNDERWATER_OBSERVER_TOP') {
    const [first, second] = pending.revealedCards
    const firstValue = first ? cardKeepValue(first, weights) : 0
    const secondValue = second ? cardKeepValue(second, weights) : 0
    const choice = action.choiceIds[0] ?? ''
    if (choice === 'keep:normal') return firstValue * 0.34 + secondValue * 0.11
    if (choice === 'keep:reverse') return secondValue * 0.34 + firstValue * 0.11
    if (choice.startsWith('discard:')) {
      const discardId = choice.slice('discard:'.length)
      const discardedValue = first?.instanceId === discardId ? firstValue : secondValue
      const keptValue = first?.instanceId === discardId ? secondValue : firstValue
      return keptValue * 0.3 - discardedValue * 0.18 + strategy.graveyardAffinity * 28
    }
  }

  if (pending.effect === 'COFFIN_KEEPER_TOP') {
    const card = pending.revealedCards[0]
    if (!card) return 0
    const value = cardKeepValue(card, weights)
    return action.choiceIds[0] === 'keep'
      ? value * 0.28
      : -value * 0.12 + strategy.graveyardAffinity * 42
  }

  if (pending.effect === 'MIRROR_LAKE_RESOLVE') {
    const stage = String(pending.data.stage ?? '')
    const choice = action.choiceIds[0] ?? ''
    const [lifeCard, topCard] = pending.revealedCards
    if (stage === 'water-only' && lifeCard) {
      const value = cardKeepValue(lifeCard, weights)
      return choice === 'keep'
        ? value * 0.28
        : -value * 0.18 + strategy.graveyardAffinity * 30
    }
    if (stage === 'both' && lifeCard && topCard) {
      const lifeValue = cardKeepValue(lifeCard, weights)
      const topValue = cardKeepValue(topCard, weights)
      if (choice === 'swap') return (lifeValue - topValue) * 0.35 + strategy.lifeAffinity * 12
      if (choice === 'discard') return -topValue * 0.18 + strategy.graveyardAffinity * 30
      return topValue * 0.24
    }
  }

  return 0
}

function choiceScore(
  action: Extract<GameAction, { type: 'RESOLVE_CHOICE' }>,
  context: BotDecisionContext,
  weights: HeuristicWeights,
  strategy: DeckStrategy,
): number {
  const pending = context.view.pendingChoice
  if (!pending) return 0
  const selectedCards = selectedCardValue(action, context.view, weights)
  const selectedUnits = selectedUnitValue(action, context.view, weights)
  const choice = action.choiceIds[0] ?? ''
  let score = topCardChoiceScore(action, context, weights, strategy)

  if (pending.type === 'TEMPLE_PROSPECT_HAND') {
    // 라이프 회복 자체는 공개 상태 델타가 평가합니다. 여기서는 무엇을 묻을지만 결정합니다.
    return score - selectedCards * 0.32
  }
  if (pending.type === 'DEMON_FINGER_DISCARD') {
    return score - selectedCards * 0.5
  }
  if (pending.type === 'GRAVE_DIGGING_RETURN') {
    return score + selectedCards * 0.45
  }
  if (pending.type === 'SURGING_WAVE_TOP' || pending.type === 'BURNING_PROCESSION') {
    return score + selectedCards * 0.28
  }
  if (pending.type !== 'SOF_CHOICE') {
    if (choice === 'draw' || choice === 'take') score += 28
    if (choice === 'skip' || choice === 'close') score -= 2
    return score
  }

  switch (pending.effect) {
    case 'WAVE_FIN_BOTTOM':
    case 'TREE_FAIRY_HAND_MANA':
    case 'MANA_FLIP_PLACE':
    case 'STONE_PRIEST_HAND_MANA':
      return score - selectedCards * 0.3 + strategy.manaAffinity * 10
    case 'MANA_FLIP_RETURN':
      return score + selectedCards * 0.3
    case 'GRAVE_MERCHANT_RETURN':
    case 'BLACKWING_RETURN':
    case 'COFFIN_KEEPER_BOTTOM':
      return score + selectedCards * 0.36
    case 'MASS_BURIAL_ENEMY_FIRST':
    case 'MASS_BURIAL_ENEMY_SECOND':
      return score - selectedUnits * 0.48
    case 'MASS_BURIAL_SELF':
    case 'MOURNER_SACRIFICE':
      return score - selectedUnits * 0.38
    case 'MOURNER_DESTROY':
    case 'ICE_MIRROR_FREEZE':
    case 'WAVE_FIN_BOUNCE':
    case 'CRYSTAL_TSUNAMI_BOUNCE':
      return score + selectedUnits * 0.28
    case 'BOMB_MOUSE_DAMAGE':
      return score + selectedUnits * 0.14
    case 'MOURNER_LAST_WORDS':
    case 'EARTH_GUARDIAN_SUMMON':
      return score + selectedCards * 0.25
    case 'STONE_PRIEST_LIFE':
      return score + (choice === 'take' ? 42 : 0)
    case 'WAVE_FIN_DRAW':
      return score + (choice === 'draw' ? 32 : -2)
    case 'SKY_KNIGHT_READY':
    case 'UNDERWATER_OBSERVER_TOP':
    case 'MIRROR_LAKE_RESOLVE':
    case 'COFFIN_KEEPER_TOP':
      return score
  }
}

function manaPlacementScore(
  action: Extract<GameAction, { type: 'PLACE_MANA' }>,
  context: BotDecisionContext,
  weights: HeuristicWeights,
  strategy: DeckStrategy,
): number {
  const actorState = context.view.players[context.actor]
  const card = actorState.hand.find((candidate) => candidate.instanceId === action.cardInstanceId)
  if (!card) return -1000
  const definition = CARDS[card.cardId]
  const manaCount = actorState.mana.length
  const duplicateCount = actorState.hand.filter((candidate) => candidate.cardId === card.cardId).length
  const currentAttributeCounts = Object.fromEntries(
    ATTRIBUTE_IDS.map((attribute) => [
      attribute,
      actorState.mana.filter((mana) => CARDS[mana.cardId].attributes.includes(attribute)).length,
    ]),
  ) as Record<CardAttributeId, number>
  const totalDeckAttributeCount = Math.max(
    1,
    ATTRIBUTE_IDS.reduce((sum, attribute) => sum + strategy.attributeCounts[attribute], 0),
  )
  const desiredManaCount = Math.max(1, Math.min(6, manaCount + 1))
  const attributeNeed = definition.attributes.reduce((sum, attribute) => {
    const target = strategy.attributeCounts[attribute] / totalDeckAttributeCount * desiredManaCount
    return sum + Math.max(0, target - currentAttributeCounts[attribute])
  }, 0)
  const dominantBonus = definition.attributes.some((attribute) => (
    strategy.dominantAttributes.includes(attribute)
  )) ? 12 : 0
  const keepValue = cardKeepValue(card, weights)

  return weights.placeMana
    + Math.max(0, 5 - manaCount) * (20 + strategy.manaAffinity * 12)
    + Math.max(0, duplicateCount - 1) * 18
    + attributeNeed * 24
    + dominantBonus
    + Math.max(0, definition.attributes.length - 1) * 9
    - keepValue * 0.16
}

function publicDeltaForAction(
  action: GameAction,
  context: BotDecisionContext,
  weights: HeuristicWeights,
): number {
  // 직접 공격의 nextState에는 공격 전에는 알 수 없는 라이프 각성 결과가 포함됩니다.
  if (action.type === 'ATTACK_PLAYER') return 0
  const option = context.legalOptions.find((candidate) => (
    actionKey(candidate.action) === actionKey(action)
  ))
  if (!option) return 0
  return (
    publicStateScore(option.nextView, context.actor, weights)
    - publicStateScore(context.view, context.actor, weights)
  ) * weights.stateDelta
}

function scoreAction(
  action: GameAction,
  context: BotDecisionContext,
  weights: HeuristicWeights,
  strategy: DeckStrategy,
): number {
  const own = context.view.players[context.actor]
  const enemy = context.view.players[enemyOf(context.actor)]
  const stateDelta = publicDeltaForAction(action, context, weights)

  switch (action.type) {
    case 'PLACE_MANA':
      return manaPlacementScore(action, context, weights, strategy) + stateDelta * 0.45
    case 'PLAY_CARD': {
      const card = own.hand.find((candidate) => candidate.instanceId === action.cardInstanceId)
      if (!card) return -1000
      const paidAttributes = new Set(action.manaIds.flatMap((manaId) => {
        const mana = own.mana.find((candidate) => candidate.instanceId === manaId)
        return mana ? CARDS[mana.cardId].attributes : []
      }))
      return cardScore(card, weights) * 0.72
        + paidAttributes.size * 10
        - action.manaIds.length * 3
        + stateDelta
    }
    case 'SUMMON_FROM_MANA': {
      const card = own.mana.find((candidate) => candidate.instanceId === action.cardInstanceId)
      return card ? cardScore(card, weights) * 0.55 + 30 + stateDelta : -1000
    }
    case 'ATTACK_UNIT': {
      const attacker = own.field.find((unit) => unit.instanceId === action.attackerId)
      const defender = enemy.field.find((unit) => unit.instanceId === action.defenderId)
      return attacker && defender
        ? combatScore(attacker, defender, weights) + stateDelta * 1.25
        : -1000
    }
    case 'ATTACK_PLAYER': {
      const lifeLoss = action.lifeSlotIndices?.length ?? 0
      const lethal = enemy.lifeCount <= lifeLoss ? 100000 : 0
      return weights.directAttack * Math.max(1, lifeLoss) + lethal
    }
    case 'RESOLVE_CHOICE':
      return choiceScore(action, context, weights, strategy) + stateDelta * 1.35
    case 'END_TURN':
      return weights.endTurn + own.handCount * weights.handValue * 0.12 + stateDelta * 0.18
    case 'SURRENDER':
      return -100000
  }
}

class RandomBot implements BotPolicy {
  readonly id = 'random' as const
  readonly name = '무작위 봇'

  chooseAction(context: BotDecisionContext): GameAction {
    return sampleOne(context.legalActions, context.random)
  }
}

class HeuristicBot implements BotPolicy {
  readonly id: string
  readonly name: string
  private readonly weights: HeuristicWeights

  constructor(id: string, name: string, weights: HeuristicWeights) {
    this.id = id
    this.name = name
    this.weights = { ...weights }
  }

  chooseAction(context: BotDecisionContext): GameAction {
    const strategy = createDeckStrategy(context.deckCardIds)
    let best = Number.NEGATIVE_INFINITY
    const candidates: GameAction[] = []
    for (const action of context.legalActions) {
      const score = scoreAction(action, context, this.weights, strategy)
      if (score > best + 0.0001) {
        best = score
        candidates.length = 0
        candidates.push(action)
      } else if (Math.abs(score - best) <= 0.0001) {
        candidates.push(action)
      }
    }
    return sampleOne(candidates, context.random)
  }
}

const POLICIES: Record<BotProfileId, BotPolicy> = {
  random: new RandomBot(),
  aggressive: new HeuristicBot('aggressive', '공격형 봇', BASELINE_PROFILE_WEIGHTS.aggressive),
  value: new HeuristicBot('value', '가치형 봇', BASELINE_PROFILE_WEIGHTS.value),
  control: new HeuristicBot('control', '제어형 봇', BASELINE_PROFILE_WEIGHTS.control),
}

export function getBotPolicy(profile: BotProfileId): BotPolicy {
  return POLICIES[profile]
}


export interface BotContestant {
  id: string
  name: string
  profile: BotProfileId | 'evolved'
  weights: HeuristicWeights | null
  policy: BotPolicy
}

export function getBaselineWeights(profile: HeuristicBotProfileId): HeuristicWeights {
  return { ...BASELINE_PROFILE_WEIGHTS[profile] }
}

export function createHeuristicBotPolicy(
  id: string,
  name: string,
  weights: HeuristicWeights,
): BotPolicy {
  return new HeuristicBot(id, name, weights)
}

export function createBaselineBotContestant(profile: BotProfileId): BotContestant {
  return {
    id: profile,
    name: POLICIES[profile].name,
    profile,
    weights: profile === 'random' ? null : getBaselineWeights(profile),
    policy: POLICIES[profile],
  }
}

export function createEvolvedBotContestant(candidate: BehaviorCandidate): BotContestant {
  return {
    id: candidate.id,
    name: candidate.name,
    profile: 'evolved',
    weights: { ...candidate.weights },
    policy: createHeuristicBotPolicy(candidate.id, candidate.name, candidate.weights),
  }
}
