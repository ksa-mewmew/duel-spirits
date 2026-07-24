import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import { getCardCopyLimit, validateDeck } from '../shared/decks'
import { getFormat } from '../content/formats'
import { createSeededRandom } from '../shared/random'
import { sampleOne, shuffled, weightedSample } from './utils'

import type { CardAttributeId, CardId } from '../shared/cards'
import type { DeckFormatSelection } from '../content/schema'
import type { DeckCandidate, DeckGenerationConfig } from './types'

interface DeckPlan {
  attributes: CardAttributeId[]
  unitTarget: number
  curveBias: 'low' | 'balanced' | 'high'
}

const ATTRIBUTE_IDS = Object.keys(CARD_ATTRIBUTES) as CardAttributeId[]

function deckKey(cardIds: readonly CardId[]): string {
  const counts = new Map<CardId, number>()
  for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cardId, count]) => `${cardId}:${count}`)
    .join('|')
}

function createPlans(pool: readonly CardId[], config: DeckGenerationConfig): DeckPlan[] {
  const present = ATTRIBUTE_IDS.filter((attribute) => (
    pool.some((cardId) => CARDS[cardId].attributes.includes(attribute))
  ))
  const plans: DeckPlan[] = []
  const unitTargets = [config.minUnits, Math.round((config.minUnits + config.maxUnits) / 2), config.maxUnits]
  const biases: DeckPlan['curveBias'][] = ['low', 'balanced', 'high']

  for (const attribute of present) {
    for (const unitTarget of unitTargets) {
      for (const curveBias of biases) plans.push({ attributes: [attribute], unitTarget, curveBias })
    }
  }
  for (let left = 0; left < present.length; left += 1) {
    for (let right = left + 1; right < present.length; right += 1) {
      plans.push({
        attributes: [present[left]!, present[right]!],
        unitTarget: unitTargets[(left + right) % unitTargets.length]!,
        curveBias: biases[(left * 2 + right) % biases.length]!,
      })
    }
  }
  plans.push({
    attributes: present,
    unitTarget: Math.round((config.minUnits + config.maxUnits) / 2),
    curveBias: 'balanced',
  })
  return plans.length > 0 ? plans : [{ attributes: [], unitTarget: config.minUnits, curveBias: 'balanced' }]
}

function createPlanSchedule(
  pool: readonly CardId[],
  config: DeckGenerationConfig,
  random: () => number,
): DeckPlan[] {
  const plans = createPlans(pool, config)
  const present = ATTRIBUTE_IDS.filter((attribute) => (
    pool.some((cardId) => CARDS[cardId].attributes.includes(attribute))
  ))
  const middleUnits = Math.round((config.minUnits + config.maxUnits) / 2)

  // 작은 population에서도 불→물 순서만 뽑히지 않도록 각 속성의 균형형 단색
  // 계획을 먼저 한 번씩 배치합니다. 그 뒤 나머지 계획은 시드 기반으로 섞습니다.
  const coverage = shuffled(
    present.map((attribute) => ({
      attributes: [attribute],
      unitTarget: middleUnits,
      curveBias: 'balanced' as const,
    })),
    random,
  )
  const remaining = shuffled(plans.filter((plan) => !(
    plan.attributes.length === 1
    && plan.unitTarget === middleUnits
    && plan.curveBias === 'balanced'
  )), random)
  return [...coverage, ...remaining]
}

function curveWeight(cost: number, bias: DeckPlan['curveBias']): number {
  if (bias === 'low') return Math.max(0.3, 3.8 - cost * 0.52)
  if (bias === 'high') return Math.max(0.4, 0.8 + cost * 0.48)
  const target = 2.7
  return Math.max(0.45, 3.2 - Math.abs(cost - target) * 0.72)
}

function cardWeight(
  cardId: CardId,
  plan: DeckPlan,
  deck: readonly CardId[],
  unitCount: number,
): number {
  const card = CARDS[cardId]
  const attributeMatches = card.attributes.filter((attribute) => plan.attributes.includes(attribute)).length
  const offPlan = plan.attributes.length > 0 && attributeMatches === 0
  const wantsUnit = unitCount < plan.unitTarget
  const typeWeight = card.type === 'unit'
    ? wantsUnit ? 2.4 : 0.82
    : wantsUnit ? 0.55 : 1.8
  const familyMatches = card.families.reduce((count, family) => (
    count + deck.filter((selectedId) => CARDS[selectedId].families.includes(family)).length
  ), 0)
  const multiAttributeBonus = card.attributes.length > 1 && attributeMatches > 0 ? 1.15 : 1
  return typeWeight
    * curveWeight(card.cost, plan.curveBias)
    * (offPlan ? 0.22 : 1 + attributeMatches * 0.75)
    * (1 + Math.min(0.75, familyMatches * 0.08))
    * multiAttributeBonus
}

function buildDeck(
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  plan: DeckPlan,
  random: () => number,
): CardId[] {
  const format = getFormat(selection.formatId)
  const deck: CardId[] = []
  const counts = new Map<CardId, number>()

  while (deck.length < format.deckSize) {
    const eligible = pool.filter((cardId) => (
      (counts.get(cardId) ?? 0) < getCardCopyLimit(cardId, selection)
    ))
    if (eligible.length === 0) {
      throw new Error(`현재 카드 풀의 허용 매수만으로 ${format.deckSize}장 덱을 만들 수 없습니다.`)
    }
    const unitCount = deck.filter((cardId) => CARDS[cardId].type === 'unit').length
    const chosen = weightedSample(
      eligible,
      (cardId) => cardWeight(cardId, plan, deck, unitCount),
      random,
    )
    deck.push(chosen)
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1)
  }

  return shuffled(deck, random)
}

function describeDeck(cardIds: readonly CardId[]): string[] {
  const attributeCounts = new Map<CardAttributeId, number>()
  for (const cardId of cardIds) {
    for (const attribute of CARDS[cardId].attributes) {
      attributeCounts.set(attribute, (attributeCounts.get(attribute) ?? 0) + 1)
    }
  }
  return [...attributeCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([attribute]) => CARD_ATTRIBUTES[attribute].name)
}

export function generateDeckPopulation(
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  config: DeckGenerationConfig,
  seed: string,
  seedDecks: readonly DeckCandidate[] = [],
  generation = 0,
): DeckCandidate[] {
  const random = createSeededRandom(`${seed}:decks:${generation}`).next
  const planSchedule = createPlanSchedule(pool, config, random)
  const output: DeckCandidate[] = []
  const keys = new Set<string>()

  for (const candidate of seedDecks) {
    const validation = validateDeck(candidate.cardIds, selection)
    if (!validation.valid) continue
    const key = deckKey(candidate.cardIds)
    if (keys.has(key)) continue
    keys.add(key)
    output.push({ ...candidate, generation })
  }

  let attempts = 0
  let generatedCount = 0
  while (output.length < config.populationSize && attempts < config.maxAttemptsPerDeck * config.populationSize) {
    attempts += 1
    const plan = planSchedule[generatedCount % planSchedule.length] ?? sampleOne(planSchedule, random)
    const cardIds = buildDeck(pool, selection, plan, random)
    const validation = validateDeck(cardIds, selection)
    if (!validation.valid) continue
    const key = deckKey(cardIds)
    if (keys.has(key)) continue
    keys.add(key)
    const tags = describeDeck(cardIds)
    output.push({
      id: `g${generation}-deck-${String(output.length + 1).padStart(3, '0')}`,
      name: `${tags.join('·') || '혼합'} 실험 덱 ${output.length + 1}`,
      cardIds,
      generation,
      parentId: null,
      tags,
    })
    generatedCount += 1
  }

  if (output.length < 2) {
    throw new Error('서로 다른 합법 덱을 두 개 이상 만들지 못했습니다. 카드 풀과 매수 제한을 확인해 주세요.')
  }
  return output
}

export function mutateDeck(
  parent: DeckCandidate,
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  mutationCount: number,
  seed: string,
  childId: string,
  generation: number,
): DeckCandidate {
  const random = createSeededRandom(`${seed}:mutate:${parent.id}:${childId}`).next
  let cardIds = [...parent.cardIds]

  for (let mutation = 0; mutation < mutationCount; mutation += 1) {
    const removeIndex = Math.floor(random() * cardIds.length)
    const removed = cardIds[removeIndex]!
    const counts = new Map<CardId, number>()
    for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
    counts.set(removed, (counts.get(removed) ?? 1) - 1)
    const alternatives = pool.filter((cardId) => (
      cardId !== removed
      && (counts.get(cardId) ?? 0) < getCardCopyLimit(cardId, selection)
    ))
    if (alternatives.length === 0) continue

    const removedDefinition = CARDS[removed]
    const replacement = weightedSample(alternatives, (cardId) => {
      const candidate = CARDS[cardId]
      const sharedAttributes = candidate.attributes.filter((attribute) => (
        removedDefinition.attributes.includes(attribute)
      )).length
      const sameType = candidate.type === removedDefinition.type ? 1.6 : 0.55
      const similarCost = Math.max(0.35, 2.2 - Math.abs(candidate.cost - removedDefinition.cost) * 0.45)
      return sameType * similarCost * (1 + sharedAttributes * 0.8)
    }, random)
    cardIds[removeIndex] = replacement
  }

  const validation = validateDeck(cardIds, selection)
  if (!validation.valid) cardIds = [...parent.cardIds]
  const tags = describeDeck(cardIds)
  return {
    id: childId,
    name: `${tags.join('·') || '혼합'} 변이 덱`,
    cardIds,
    generation,
    parentId: parent.id,
    tags,
  }
}

export function createNextGeneration(
  elites: readonly DeckCandidate[],
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  config: DeckGenerationConfig,
  seed: string,
  generation: number,
): DeckCandidate[] {
  if (elites.length === 0) throw new Error('다음 세대를 만들 엘리트 덱이 없습니다.')
  const output: DeckCandidate[] = elites.map((deck, index) => ({
    ...deck,
    id: `g${generation}-elite-${String(index + 1).padStart(3, '0')}`,
    generation,
    parentId: deck.id,
  }))
  const seen = new Set(output.map((deck) => deckKey(deck.cardIds)))
  let attempts = 0

  while (output.length < config.populationSize && attempts < config.maxAttemptsPerDeck * config.populationSize) {
    const parent = elites[attempts % elites.length]!
    const childId = `g${generation}-deck-${String(output.length + 1).padStart(3, '0')}`
    const child = mutateDeck(
      parent,
      pool,
      selection,
      config.mutationsPerChild + (attempts % 2),
      seed,
      childId,
      generation,
    )
    attempts += 1
    const key = deckKey(child.cardIds)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(child)
  }

  if (output.length < config.populationSize) {
    const fillers = generateDeckPopulation(
      pool,
      selection,
      { ...config, populationSize: config.populationSize - output.length },
      `${seed}:fillers`,
      [],
      generation,
    )
    for (const filler of fillers) {
      const key = deckKey(filler.cardIds)
      if (seen.has(key)) continue
      seen.add(key)
      output.push({ ...filler, id: `g${generation}-deck-${String(output.length + 1).padStart(3, '0')}` })
      if (output.length >= config.populationSize) break
    }
  }

  return output.slice(0, config.populationSize)
}
