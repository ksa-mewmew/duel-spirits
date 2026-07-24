import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import { getCardCopyLimit, validateDeck } from '../shared/decks'
import { getFormat } from '../content/formats'
import { createSeededRandom } from '../shared/random'
import {
  analyzeCardForDeck,
  analyzeDeckProfile,
  createArchetypePlans,
  derivePlanFromDeck,
  strategyRoleTargets,
  strategyRoleWeight,
} from './deck-intelligence'
import { sampleOne, shuffled, weightedSample } from './utils'

import type { CardAttributeId, CardId } from '../shared/cards'
import type { DeckFormatSelection } from '../content/schema'
import type {
  DeckCandidate,
  DeckGenerationConfig,
  DeckRole,
} from './types'
import type { DeckArchetypePlan } from './deck-intelligence'

function deckKey(cardIds: readonly CardId[]): string {
  const counts = new Map<CardId, number>()
  for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cardId, count]) => `${cardId}:${count}`)
    .join('|')
}

function toCounts(cardIds: readonly CardId[]): Map<CardId, number> {
  const counts = new Map<CardId, number>()
  for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  return counts
}

function fromCounts(counts: ReadonlyMap<CardId, number>): CardId[] {
  const output: CardId[] = []
  for (const [cardId, count] of counts) {
    for (let index = 0; index < count; index += 1) output.push(cardId)
  }
  return output
}

function randomInteger(minimum: number, maximum: number, random: () => number): number {
  if (maximum <= minimum) return minimum
  return minimum + Math.floor(random() * (maximum - minimum + 1))
}

function curveWeight(cost: number, bias: DeckArchetypePlan['curveBias']): number {
  if (bias === 'low') return Math.max(0.18, 4.2 - cost * 0.62)
  if (bias === 'high') return Math.max(0.35, 0.75 + cost * 0.43)
  const target = 2.7
  return Math.max(0.38, 3.3 - Math.abs(cost - target) * 0.7)
}

function attributeWeight(cardId: CardId, plan: DeckArchetypePlan): number {
  if (plan.attributes.length === 0) return 1
  const card = CARDS[cardId]
  const matches = card.attributes.filter((attribute) => plan.attributes.includes(attribute)).length
  if (matches === 0) return plan.exploratory ? 0.55 : 0.1
  return 1 + matches * 0.78 + (card.attributes.length > 1 ? 0.18 : 0)
}

function isOnPlan(cardId: CardId, plan: DeckArchetypePlan): boolean {
  return plan.exploratory
    || plan.attributes.length === 0
    || CARDS[cardId].attributes.some((attribute) => plan.attributes.includes(attribute))
}

function roleCounts(cardIds: readonly CardId[]): Partial<Record<DeckRole, number>> {
  const output: Partial<Record<DeckRole, number>> = {}
  for (const cardId of cardIds) {
    for (const role of analyzeCardForDeck(cardId).roles) output[role] = (output[role] ?? 0) + 1
  }
  return output
}

function packageCounts(cardIds: readonly CardId[]): Map<string, number> {
  const output = new Map<string, number>()
  for (const cardId of cardIds) {
    for (const packageId of analyzeCardForDeck(cardId).packages) {
      output.set(packageId, (output.get(packageId) ?? 0) + 1)
    }
  }
  return output
}

function cardPlanScore(
  cardId: CardId,
  plan: DeckArchetypePlan,
  deck: readonly CardId[],
  unitTarget: number,
  affinity: ReadonlyMap<CardId, number> | null = null,
): number {
  const card = CARDS[cardId]
  const analysis = analyzeCardForDeck(cardId)
  const roles = roleCounts(deck)
  const packages = packageCounts(deck)
  const targets = strategyRoleTargets(plan.strategy)
  const unitCount = deck.filter((selectedId) => CARDS[selectedId].type === 'unit').length

  let roleScore = 1
  for (const role of analysis.roles) {
    roleScore += strategyRoleWeight(plan.strategy, role) * 0.34
    const target = targets[role] ?? 0
    const current = roles[role] ?? 0
    if (target > current) roleScore += Math.min(1.8, (target - current) * 0.22)
  }

  let packageScore = 1
  for (const packageId of analysis.packages) {
    if (plan.packageIds.includes(packageId)) packageScore += 0.34
    packageScore += Math.min(0.7, (packages.get(packageId) ?? 0) * 0.07)
  }

  const wantsUnit = unitCount < unitTarget
  const typeScore = card.type === 'unit'
    ? wantsUnit ? 2.4 : 0.72
    : wantsUnit ? 0.48 : 1.8
  const affinityScore = affinity ? 1 + Math.min(2.4, (affinity.get(cardId) ?? 0) * 0.45) : 1

  return Math.max(0.0001,
    analysis.basePower
    * attributeWeight(cardId, plan)
    * curveWeight(card.cost, plan.curveBias)
    * roleScore
    * packageScore
    * typeScore
    * affinityScore
  )
}

function preferredCopies(
  cardId: CardId,
  plan: DeckArchetypePlan,
  maximumCopies: number,
): number {
  const card = CARDS[cardId]
  const analysis = analyzeCardForDeck(cardId)
  const strategyImportance = analysis.roles.reduce((sum, role) => (
    sum + strategyRoleWeight(plan.strategy, role)
  ), 0)

  let preferred = 2
  if (analysis.copyClass === 'core' || strategyImportance >= 4.2) preferred = 3
  if (analysis.copyClass === 'tech') preferred = 1
  if (analysis.copyClass === 'finisher') preferred = card.cost >= 6 ? 1 : 2
  if (card.cost >= 5 && preferred >= 3) preferred = 2
  if (plan.strategy === 'aggro' && card.cost <= 2 && card.type === 'unit') preferred = 3
  if (plan.strategy === 'evolution' && analysis.roles.includes('evolution')) preferred = 2
  return Math.max(1, Math.min(maximumCopies, preferred))
}

function targetDistinctCount(
  poolSize: number,
  deckSize: number,
  config: DeckGenerationConfig,
  exploratory: boolean,
  minimumRequired: number,
  random: () => number,
): number {
  const humanMinimum = Math.min(poolSize, deckSize, Math.max(config.minDistinctCards, minimumRequired))
  const humanMaximum = Math.min(poolSize, deckSize, config.maxDistinctCards)
  if (!exploratory) return randomInteger(humanMinimum, humanMaximum, random)
  const minimum = Math.min(poolSize, deckSize, Math.max(humanMaximum, config.minDistinctCards + 2))
  const maximum = Math.min(poolSize, deckSize, Math.max(minimum, config.maxDistinctCards + 4))
  return randomInteger(minimum, maximum, random)
}

function buildDeck(
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  plan: DeckArchetypePlan,
  config: DeckGenerationConfig,
  random: () => number,
  affinity: ReadonlyMap<CardId, number> | null = null,
): CardId[] {
  const format = getFormat(selection.formatId)
  const deck: CardId[] = []
  const counts = new Map<CardId, number>()
  const plannedPool = plan.exploratory || plan.attributes.length === 0
    ? [...pool]
    : pool.filter((cardId) => CARDS[cardId].attributes.some((attribute) => plan.attributes.includes(attribute)))
  const plannedCapacity = plannedPool.reduce((sum, cardId) => sum + getCardCopyLimit(cardId, selection), 0)
  const usablePool = plannedPool.length >= config.minDistinctCards && plannedCapacity >= format.deckSize
    ? plannedPool
    : [...pool]
  const maximumCopies = Math.max(1, ...usablePool.map((cardId) => getCardCopyLimit(cardId, selection)))
  const minimumRequired = Math.ceil(format.deckSize / maximumCopies)
  const distinctTarget = targetDistinctCount(
    usablePool.length,
    format.deckSize,
    config,
    plan.exploratory,
    minimumRequired,
    random,
  )

  while (deck.length < format.deckSize) {
    const distinctCount = counts.size
    const slotsRemaining = format.deckSize - deck.length
    const uniqueStillNeeded = Math.max(0, distinctTarget - distinctCount)
    const baseEligible = usablePool.filter((cardId) => {
      const current = counts.get(cardId) ?? 0
      if (current >= getCardCopyLimit(cardId, selection)) return false
      if (current === 0 && distinctCount >= distinctTarget) return false
      if (current > 0 && slotsRemaining <= uniqueStillNeeded) return false
      return true
    })
    const preferredEligible = plan.exploratory
      ? baseEligible
      : baseEligible.filter((cardId) => {
        const current = counts.get(cardId) ?? 0
        return current === 0 || current < preferredCopies(cardId, plan, getCardCopyLimit(cardId, selection))
      })
    const expansionEligible = !plan.exploratory && preferredEligible.length === 0 && distinctCount < config.maxDistinctCards
      ? usablePool.filter((cardId) => !counts.has(cardId))
      : []
    const eligible = preferredEligible.length > 0
      ? preferredEligible
      : expansionEligible.length > 0
        ? expansionEligible
        : baseEligible
    if (eligible.length === 0) {
      throw new Error(`현재 카드 풀의 허용 매수만으로 ${format.deckSize}장 덱을 만들 수 없습니다.`)
    }

    const chosen = weightedSample(eligible, (cardId) => {
      const current = counts.get(cardId) ?? 0
      const maximum = getCardCopyLimit(cardId, selection)
      const preferred = preferredCopies(cardId, plan, maximum)
      let copyWeight = 1
      if (current > 0) {
        copyWeight = current < preferred ? 4.1 - current * 0.45 : 0.14
      } else if (uniqueStillNeeded > 0 && slotsRemaining <= uniqueStillNeeded + 1) {
        copyWeight = 5
      } else {
        copyWeight = plan.exploratory ? 1.55 : 0.82
      }
      return cardPlanScore(cardId, plan, deck, plan.unitTarget, affinity) * copyWeight
    }, random)

    deck.push(chosen)
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1)
  }

  return repairDeckShape(deck, usablePool, selection, config, plan, random)
}

function bestReceiver(
  counts: ReadonlyMap<CardId, number>,
  plan: DeckArchetypePlan,
  selection: DeckFormatSelection<CardId>,
  random: () => number,
  excluded: CardId | null = null,
  respectPreferredCopies = false,
): CardId | null {
  const deck = fromCounts(counts)
  const eligible = [...counts.keys()].filter((cardId) => {
    if (cardId === excluded) return false
    const current = counts.get(cardId) ?? 0
    const maximum = getCardCopyLimit(cardId, selection)
    if (current >= maximum) return false
    return !respectPreferredCopies || current < preferredCopies(cardId, plan, maximum)
  })
  if (eligible.length === 0) return null
  return weightedSample(eligible, (cardId) => {
    const current = counts.get(cardId) ?? 0
    const preferred = preferredCopies(cardId, plan, getCardCopyLimit(cardId, selection))
    const room = Math.max(0.15, preferred - current + 0.5)
    return cardPlanScore(cardId, plan, deck, plan.unitTarget) * room
  }, random)
}

function bestNewCard(
  counts: ReadonlyMap<CardId, number>,
  pool: readonly CardId[],
  plan: DeckArchetypePlan,
  random: () => number,
  requiredType: 'unit' | 'spell' | null = null,
  preferredPackages: readonly string[] = [],
): CardId | null {
  const deck = fromCounts(counts)
  const eligible = pool.filter((cardId) => (
    !counts.has(cardId)
    && isOnPlan(cardId, plan)
    && (requiredType === null || CARDS[cardId].type === requiredType)
  ))
  if (eligible.length === 0) return null
  return weightedSample(eligible, (cardId) => {
    const analysis = analyzeCardForDeck(cardId)
    const packageBonus = preferredPackages.some((packageId) => analysis.packages.includes(packageId)) ? 2.4 : 1
    return cardPlanScore(cardId, plan, deck, plan.unitTarget) * packageBonus
  }, random)
}

function transferCopy(
  counts: Map<CardId, number>,
  donor: CardId,
  receiver: CardId,
): boolean {
  if (donor === receiver) return false
  const donorCount = counts.get(donor) ?? 0
  if (donorCount <= 0) return false
  counts.set(donor, donorCount - 1)
  if ((counts.get(donor) ?? 0) <= 0) counts.delete(donor)
  counts.set(receiver, (counts.get(receiver) ?? 0) + 1)
  return true
}

function repairUnitRange(
  counts: Map<CardId, number>,
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  config: DeckGenerationConfig,
  plan: DeckArchetypePlan,
  random: () => number,
): void {
  let deck = fromCounts(counts)
  let unitCount = deck.filter((cardId) => CARDS[cardId].type === 'unit').length
  let guard = 0

  while (unitCount < config.minUnits && guard < 100) {
    guard += 1
    const donors = deck.filter((cardId) => CARDS[cardId].type === 'spell')
    const receiver = bestNewCard(counts, pool, plan, random, 'unit')
      ?? pool.find((cardId) => isOnPlan(cardId, plan) && CARDS[cardId].type === 'unit' && (counts.get(cardId) ?? 0) < getCardCopyLimit(cardId, selection))
      ?? null
    if (donors.length === 0 || !receiver) break
    const donor = donors.sort((left, right) => cardPlanScore(left, plan, deck, plan.unitTarget) - cardPlanScore(right, plan, deck, plan.unitTarget))[0]!
    if (!transferCopy(counts, donor, receiver)) break
    deck = fromCounts(counts)
    unitCount += 1
  }

  guard = 0
  while (unitCount > config.maxUnits && guard < 100) {
    guard += 1
    const donors = deck.filter((cardId) => CARDS[cardId].type === 'unit')
    const receiver = bestNewCard(counts, pool, plan, random, 'spell')
      ?? pool.find((cardId) => isOnPlan(cardId, plan) && CARDS[cardId].type === 'spell' && (counts.get(cardId) ?? 0) < getCardCopyLimit(cardId, selection))
      ?? null
    if (donors.length === 0 || !receiver) break
    const donor = donors.sort((left, right) => cardPlanScore(left, plan, deck, plan.unitTarget) - cardPlanScore(right, plan, deck, plan.unitTarget))[0]!
    if (!transferCopy(counts, donor, receiver)) break
    deck = fromCounts(counts)
    unitCount -= 1
  }
}

function repairDistinctRange(
  counts: Map<CardId, number>,
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  config: DeckGenerationConfig,
  plan: DeckArchetypePlan,
  random: () => number,
): void {
  let guard = 0
  while (counts.size > config.maxDistinctCards && guard < 100) {
    guard += 1
    const deck = fromCounts(counts)
    const donors = [...counts.keys()].sort((left, right) => {
      const countDifference = (counts.get(left) ?? 0) - (counts.get(right) ?? 0)
      if (countDifference !== 0) return countDifference
      return cardPlanScore(left, plan, deck, plan.unitTarget) - cardPlanScore(right, plan, deck, plan.unitTarget)
    })
    const donor = donors[0]
    if (!donor) break
    const donorCount = counts.get(donor) ?? 0
    let moved = 0
    for (let index = 0; index < donorCount; index += 1) {
      const receiver = bestReceiver(counts, plan, selection, random, donor, true)
      if (!receiver || !transferCopy(counts, donor, receiver)) break
      moved += 1
    }
    if (moved === 0) break
  }

  guard = 0
  while (
    [...counts.values()].filter((count) => count === 1).length > config.maxSingletonCards
    && counts.size > config.minDistinctCards
    && guard < 100
  ) {
    guard += 1
    const donor = pickLowValueDonor(counts, plan, random, true)
    const receiver = donor ? bestReceiver(counts, plan, selection, random, donor, true) : null
    if (!donor || !receiver || !transferCopy(counts, donor, receiver)) break
  }

  guard = 0
  while (counts.size < config.minDistinctCards && guard < 100) {
    guard += 1
    const deck = fromCounts(counts)
    const donors = [...counts.keys()]
      .filter((cardId) => (counts.get(cardId) ?? 0) >= 2)
      .sort((left, right) => (
        (counts.get(right) ?? 0) - (counts.get(left) ?? 0)
        || cardPlanScore(left, plan, deck, plan.unitTarget) - cardPlanScore(right, plan, deck, plan.unitTarget)
      ))
    const donor = donors[0]
    const receiver = bestNewCard(counts, pool, plan, random)
    if (!donor || !receiver || !transferCopy(counts, donor, receiver)) break
  }
}

function repairDeckShape(
  cardIds: readonly CardId[],
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  config: DeckGenerationConfig,
  plan: DeckArchetypePlan,
  random: () => number,
): CardId[] {
  const counts = toCounts(cardIds)
  repairUnitRange(counts, pool, selection, config, plan, random)
  if (!plan.exploratory) repairDistinctRange(counts, pool, selection, config, plan, random)
  const output = fromCounts(counts)
  return shuffled(output, random)
}

function describeDeck(cardIds: readonly CardId[], plan?: DeckArchetypePlan): string[] {
  const profile = analyzeDeckProfile(cardIds)
  const attributeTags = profile.attributes.slice(0, 2).map((attribute) => CARD_ATTRIBUTES[attribute].name)
  const strategyTag = plan?.name.split(' ').at(-1) ?? profile.strategy
  return [...attributeTags, strategyTag].filter((tag, index, values) => tag && values.indexOf(tag) === index)
}

function planSchedule(
  pool: readonly CardId[],
  config: DeckGenerationConfig,
  random: () => number,
): DeckArchetypePlan[] {
  const plans = createArchetypePlans(pool, config.minUnits, config.maxUnits)
  const coverage: DeckArchetypePlan[] = []
  for (const attribute of Object.keys(CARD_ATTRIBUTES) as CardAttributeId[]) {
    const plan = plans.find((candidate) => candidate.attributes.length === 1 && candidate.attributes[0] === attribute)
    if (plan) coverage.push(plan)
  }
  const used = new Set(coverage.map((plan) => plan.id))
  const remaining = shuffled(plans.filter((plan) => !used.has(plan.id)), random)
  return [...coverage, ...remaining]
}

function createCandidate(
  id: string,
  cardIds: CardId[],
  generation: number,
  plan: DeckArchetypePlan,
  source: DeckCandidate['source'],
  parentIds: string[] = [],
): DeckCandidate {
  const tags = describeDeck(cardIds, plan)
  return {
    id,
    name: source === 'exploratory'
      ? `${plan.name} 덱`
      : `${plan.name} ${source === 'crossover' ? '교차 덱' : source === 'mutation' ? '변이 덱' : '원형 덱'}`,
    cardIds,
    generation,
    parentId: parentIds[0] ?? null,
    parentIds,
    tags,
    archetypeId: plan.id,
    archetypeName: plan.name,
    strategy: plan.strategy,
    source,
  }
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
  const plans = planSchedule(pool, config, random)
  const output: DeckCandidate[] = []
  const keys = new Set<string>()

  for (const candidate of seedDecks) {
    const validation = validateDeck(candidate.cardIds, selection)
    if (!validation.valid) continue
    const key = deckKey(candidate.cardIds)
    if (keys.has(key)) continue
    keys.add(key)
    output.push({ ...candidate, generation, source: candidate.source ?? 'seed' })
  }

  const mandatoryHumanCount = Math.min(
    config.populationSize,
    (Object.keys(CARD_ATTRIBUTES) as CardAttributeId[]).filter((attribute) => (
      pool.some((cardId) => CARDS[cardId].attributes.includes(attribute))
    )).length,
  )
  let attempts = 0
  let generatedCount = 0
  while (output.length < config.populationSize && attempts < config.maxAttemptsPerDeck * config.populationSize) {
    attempts += 1
    const scheduled = plans[generatedCount % plans.length] ?? sampleOne(plans, random)
    const useHumanPlan = generatedCount < mandatoryHumanCount || random() < config.humanDeckRatio
    const exploratoryPlan = plans.find((plan) => plan.exploratory) ?? scheduled
    const plan = useHumanPlan ? scheduled : exploratoryPlan
    const cardIds = buildDeck(pool, selection, plan, config, random)
    const validation = validateDeck(cardIds, selection)
    if (!validation.valid) continue
    const key = deckKey(cardIds)
    if (keys.has(key)) continue
    keys.add(key)
    output.push(createCandidate(
      `g${generation}-deck-${String(output.length + 1).padStart(3, '0')}`,
      cardIds,
      generation,
      plan,
      plan.exploratory ? 'exploratory' : 'archetype',
    ))
    generatedCount += 1
  }

  if (output.length < 2) {
    throw new Error('서로 다른 합법 덱을 두 개 이상 만들지 못했습니다. 카드 풀과 매수 제한을 확인해 주세요.')
  }
  return output
}

function pickLowValueDonor(
  counts: ReadonlyMap<CardId, number>,
  plan: DeckArchetypePlan,
  random: () => number,
  singletonOnly = false,
): CardId | null {
  const deck = fromCounts(counts)
  const eligible = [...counts.keys()].filter((cardId) => !singletonOnly || (counts.get(cardId) ?? 0) === 1)
  if (eligible.length === 0) return null
  const ordered = eligible.sort((left, right) => (
    cardPlanScore(left, plan, deck, plan.unitTarget) - cardPlanScore(right, plan, deck, plan.unitTarget)
  ))
  const slice = ordered.slice(0, Math.max(1, Math.ceil(ordered.length / 3)))
  return sampleOne(slice, random)
}

function mutateCounts(
  counts: Map<CardId, number>,
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  plan: DeckArchetypePlan,
  config: DeckGenerationConfig,
  random: () => number,
): void {
  const roll = random()

  if (roll < config.compressionChance) {
    const donor = pickLowValueDonor(counts, plan, random, true)
    const receiver = donor ? bestReceiver(counts, plan, selection, random, donor) : null
    if (donor && receiver && transferCopy(counts, donor, receiver)) return
  }

  if (roll < config.compressionChance + config.packageMutationChance) {
    const profile = analyzeDeckProfile(fromCounts(counts))
    const preferredPackages = [...new Set([...plan.packageIds, ...profile.topPackages])]
    const donor = pickLowValueDonor(counts, plan, random)
    const receiver = bestNewCard(counts, pool, plan, random, null, preferredPackages)
      ?? (donor ? bestReceiver(counts, plan, selection, random, donor) : null)
    if (donor && receiver && (counts.get(receiver) ?? 0) < getCardCopyLimit(receiver, selection) && transferCopy(counts, donor, receiver)) return
  }

  const donor = pickLowValueDonor(counts, plan, random)
  if (!donor) return
  const donorAnalysis = analyzeCardForDeck(donor)
  const donorCard = CARDS[donor]
  const deck = fromCounts(counts)
  const alternatives = pool.filter((cardId) => (
    cardId !== donor
    && isOnPlan(cardId, plan)
    && (counts.get(cardId) ?? 0) < getCardCopyLimit(cardId, selection)
  ))
  if (alternatives.length === 0) return
  const receiver = weightedSample(alternatives, (cardId) => {
    const analysis = analyzeCardForDeck(cardId)
    const sharedRoles = analysis.roles.filter((role) => donorAnalysis.roles.includes(role)).length
    const sharedPackages = analysis.packages.filter((packageId) => donorAnalysis.packages.includes(packageId)).length
    const sameType = CARDS[cardId].type === donorCard.type ? 1.7 : 0.55
    const similarCost = Math.max(0.35, 2.2 - Math.abs(CARDS[cardId].cost - donorCard.cost) * 0.42)
    const existingBonus = counts.has(cardId) ? 1.65 : 1
    return cardPlanScore(cardId, plan, deck, plan.unitTarget)
      * sameType
      * similarCost
      * (1 + sharedRoles * 0.35 + sharedPackages * 0.18)
      * existingBonus
  }, random)
  transferCopy(counts, donor, receiver)
}

export function mutateDeck(
  parent: DeckCandidate,
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  config: DeckGenerationConfig,
  mutationCount: number,
  seed: string,
  childId: string,
  generation: number,
): DeckCandidate {
  const random = createSeededRandom(`${seed}:mutate:${parent.id}:${childId}`).next
  const plan = derivePlanFromDeck(parent, config.minUnits, config.maxUnits)
  const counts = toCounts(parent.cardIds)

  for (let mutation = 0; mutation < mutationCount; mutation += 1) {
    mutateCounts(counts, pool, selection, plan, config, random)
  }

  let cardIds = repairDeckShape(fromCounts(counts), pool, selection, config, plan, random)
  const validation = validateDeck(cardIds, selection)
  if (!validation.valid) cardIds = [...parent.cardIds]
  return createCandidate(childId, cardIds, generation, plan, 'mutation', [parent.id])
}

function crossoverDeck(
  left: DeckCandidate,
  right: DeckCandidate,
  pool: readonly CardId[],
  selection: DeckFormatSelection<CardId>,
  config: DeckGenerationConfig,
  seed: string,
  childId: string,
  generation: number,
): DeckCandidate {
  const random = createSeededRandom(`${seed}:crossover:${left.id}:${right.id}:${childId}`).next
  const plan = derivePlanFromDeck(random() < 0.5 ? left : right, config.minUnits, config.maxUnits)
  const affinity = new Map<CardId, number>()
  for (const cardId of left.cardIds) affinity.set(cardId, (affinity.get(cardId) ?? 0) + 1)
  for (const cardId of right.cardIds) affinity.set(cardId, (affinity.get(cardId) ?? 0) + 1)
  const cardIds = buildDeck(pool, selection, plan, config, random, affinity)
  return createCandidate(childId, cardIds, generation, plan, 'crossover', [left.id, right.id])
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
  const random = createSeededRandom(`${seed}:next-generation:${generation}`).next
  const output: DeckCandidate[] = elites.map((deck, index) => ({
    ...deck,
    id: `g${generation}-elite-${String(index + 1).padStart(3, '0')}`,
    generation,
    parentId: deck.id,
    parentIds: [deck.id],
    source: 'elite',
  }))
  const seen = new Set(output.map((deck) => deckKey(deck.cardIds)))
  let attempts = 0

  const evolvedTarget = Math.max(elites.length, config.populationSize - config.immigrantCount)
  while (output.length < evolvedTarget && attempts < config.maxAttemptsPerDeck * config.populationSize) {
    const parent = elites[attempts % elites.length]!
    const childId = `g${generation}-deck-${String(output.length + 1).padStart(3, '0')}`
    let child: DeckCandidate
    if (elites.length > 1 && random() < config.crossoverChance) {
      const alternatives = elites.filter((candidate) => candidate.id !== parent.id)
      const secondParent = sampleOne(alternatives, random)
      child = crossoverDeck(parent, secondParent, pool, selection, config, seed, childId, generation)
    } else {
      child = mutateDeck(
        parent,
        pool,
        selection,
        config,
        config.mutationsPerChild + (attempts % 2),
        seed,
        childId,
        generation,
      )
    }
    attempts += 1
    const key = deckKey(child.cardIds)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(child)
  }

  if (output.length < config.populationSize) {
    const immigrants = generateDeckPopulation(
      pool,
      selection,
      { ...config, populationSize: Math.max(2, config.populationSize - output.length) },
      `${seed}:immigrants:${generation}`,
      [],
      generation,
    )
    for (const immigrant of immigrants) {
      const key = deckKey(immigrant.cardIds)
      if (seen.has(key)) continue
      seen.add(key)
      output.push({
        ...immigrant,
        id: `g${generation}-deck-${String(output.length + 1).padStart(3, '0')}`,
        name: `${immigrant.archetypeName ?? '혼합'} 신규 원형 덱`,
      })
      if (output.length >= config.populationSize) break
    }
  }

  return output.slice(0, config.populationSize)
}
