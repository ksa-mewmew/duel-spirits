import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'

import type { CardAttributeId, CardId } from '../shared/cards'
import type { DeckCandidate, DeckProfileSummary, DeckRole, DeckStrategy } from './types'

export interface CardDeckAnalysis {
  cardId: CardId
  roles: DeckRole[]
  packages: string[]
  basePower: number
  copyClass: 'core' | 'support' | 'tech' | 'finisher'
}

export interface DeckArchetypePlan {
  id: string
  name: string
  attributes: CardAttributeId[]
  strategy: DeckStrategy
  unitTarget: number
  curveBias: 'low' | 'balanced' | 'high'
  packageIds: string[]
  exploratory: boolean
}

const ATTRIBUTE_IDS = Object.keys(CARD_ATTRIBUTES) as CardAttributeId[]
const CARD_ANALYSIS_CACHE = new Map<CardId, CardDeckAnalysis>()

const ROLE_ORDER: DeckRole[] = [
  'early_unit',
  'pressure',
  'defender',
  'tempo',
  'removal',
  'board_clear',
  'draw',
  'ramp',
  'mana_payoff',
  'graveyard_enabler',
  'graveyard_payoff',
  'recursion',
  'life_control',
  'lockdown',
  'awakening',
  'evolution',
  'resonance',
  'finisher',
  'utility',
]

const STRATEGY_ROLE_WEIGHTS: Record<DeckStrategy, Partial<Record<DeckRole, number>>> = {
  aggro: {
    early_unit: 3.2,
    pressure: 3,
    tempo: 1.7,
    draw: 0.8,
    finisher: 1.2,
    removal: 1,
  },
  value: {
    draw: 3,
    recursion: 2.5,
    tempo: 2.1,
    defender: 1.3,
    utility: 1.5,
    removal: 1.3,
  },
  control: {
    removal: 3,
    board_clear: 3.2,
    defender: 2.4,
    draw: 1.7,
    life_control: 1.6,
    lockdown: 2.7,
    finisher: 1.4,
  },
  ramp: {
    ramp: 3.4,
    mana_payoff: 3.1,
    defender: 1.5,
    finisher: 2.5,
    evolution: 1.35,
    pressure: 0.65,
    draw: 0.9,
  },
  graveyard: {
    graveyard_enabler: 3.4,
    graveyard_payoff: 3.6,
    recursion: 2.8,
    removal: 1.2,
    pressure: 0.8,
  },
  life: {
    life_control: 3.5,
    lockdown: 2.6,
    awakening: 3,
    defender: 2,
    pressure: 1.1,
    tempo: 1.2,
    evolution: 1.4,
    draw: 1,
    finisher: 1.4,
  } as Partial<Record<DeckRole, number>>,
  evolution: {
    evolution: 4,
    early_unit: 1.7,
    pressure: 1.2,
    ramp: 1,
    finisher: 1.5,
  },
  midrange: {
    early_unit: 1.2,
    pressure: 1.6,
    defender: 1.4,
    removal: 1.3,
    draw: 1,
    finisher: 1.2,
    utility: 0.8,
  },
}

const ROLE_COPY_TARGETS: Record<DeckStrategy, Partial<Record<DeckRole, number>>> = {
  aggro: { early_unit: 7, pressure: 8, tempo: 3, finisher: 2 },
  value: { draw: 4, recursion: 3, tempo: 4, defender: 4, utility: 2 },
  control: { removal: 5, board_clear: 2, lockdown: 4, defender: 6, draw: 3, finisher: 2 },
  ramp: { ramp: 5, mana_payoff: 5, defender: 4, evolution: 2, finisher: 3 },
  graveyard: { graveyard_enabler: 5, graveyard_payoff: 6, recursion: 3, removal: 2 },
  life: { life_control: 5, lockdown: 4, awakening: 4, defender: 5, pressure: 4, evolution: 2, finisher: 2 },
  evolution: { evolution: 5, early_unit: 7, pressure: 4, finisher: 2 },
  midrange: { early_unit: 5, pressure: 5, defender: 4, removal: 3, finisher: 2 },
}

function addRole(output: Set<DeckRole>, condition: boolean, role: DeckRole): void {
  if (condition) output.add(role)
}

function includesAny(text: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => text.includes(fragment))
}

export function analyzeCardForDeck(cardId: CardId): CardDeckAnalysis {
  const cached = CARD_ANALYSIS_CACHE.get(cardId)
  if (cached) return cached
  const card = CARDS[cardId]
  const text = card.rulesText.replaceAll(/\s+/g, ' ')
  const roles = new Set<DeckRole>()
  const packages = new Set<string>()
  const cannotAttack = text.includes('이 몬스터는 공격할 수 없다')
  const cannotDirectAttack = text.includes('직접 공격할 수 없다')
  const hasPressureKeyword = card.type === 'unit' && card.keywords?.some((keyword) => (
    ['rush', 'charge', 'flying', 'stealth', 'assassination', 'windfury'].includes(keyword)
  )) === true
  const hasLockText = includesAny(text, [
    '공격받지 않는다',
    '한 번만 공격할 수 있다',
    '최대 두 번만 공격할 수 있다',
    '각성은 발동하지 않는다',
    '다음 턴에 준비되지 않는다',
    '이 몬스터부터 공격해야 한다',
  ]) || (text.includes('상대') && text.includes('공격할 수 없다'))

  if (card.type === 'unit') {
    addRole(roles, card.cost <= 2, 'early_unit')
    addRole(roles, !cannotAttack && !cannotDirectAttack && (
      card.attack >= Math.max(2, card.cost) || hasPressureKeyword
    ), 'pressure')
    addRole(roles, card.health >= Math.max(3, card.cost + 1) || hasLockText, 'defender')
    addRole(roles, card.cost >= 5 || card.attack >= 5 || card.keywords?.includes('windfury') === true, 'finisher')
    addRole(roles, card.evolutionAttribute !== undefined, 'evolution')
  }

  addRole(roles, includesAny(text, ['카드 1장을 뽑', '카드 2장을 뽑', '카드를 1장 뽑', '카드를 2장 뽑']), 'draw')
  addRole(roles, includesAny(text, [
    '손으로 가져온다', '손으로 되돌', '준비되지 않는다', '덱 맨 아래',
    '자신의 다른 소진된 몬스터 하나를 준비', '자신의 모든 몬스터를 준비',
  ]), 'tempo')

  const opponentRemoval = text.includes('상대') && includesAny(text, [
    '몬스터 하나에게 피해',
    '모든 몬스터에게 피해',
    '몬스터 하나를 묘지로',
    '몬스터 하나를 선택해 묘지로',
    '몬스터 하나를 골라 묘지로',
    '소진된 몬스터 하나를 그 소유자의 손으로',
    '몬스터 하나를 소진된 상태로 그 소유자의 마나에',
  ])
  addRole(roles, opponentRemoval, 'removal')
  addRole(roles, (
    includesAny(text, ['전장의 모든 몬스터', '상대의 모든 몬스터', '모든 소진된 몬스터'])
    && includesAny(text, ['피해', '묘지', '손으로', '소진'])
  ), 'board_clear')

  const rampsFromDeck = includesAny(text, [
    '덱 맨 위 카드를 소진된 상태로 자신의 마나',
    '덱 맨 위 카드 한 장을 소진된 상태로 자신의 마나',
  ])
  const rampsFromHand = includesAny(text, [
    '손에서 마나에 카드를 한 장 놓을 수 있다',
    '손에서 카드 한 장을 소진된 상태로 마나에 놓',
  ])
  const readiesMana = text.includes('자신의 소진된 마나 하나를 준비')
  addRole(roles, rampsFromDeck || rampsFromHand || readiesMana, 'ramp')
  addRole(roles, includesAny(text, [
    '마나에 땅 카드가',
    '마나에서 비용',
    '마나에 있는 이 카드',
    '자신의 마나에서 비용',
    '자신의 마나에 카드가',
  ]), 'mana_payoff')

  const ownGraveyardEnabler = includesAny(text, [
    '자신의 덱 맨 위 카드를 묘지로',
    '자신의 덱 맨 위 카드 한 장을 묘지로',
    '자신의 손에서 카드 한 장을 묘지로',
    '자신의 준비된 마나 하나를 묘지로',
    '자신의 몬스터 하나를 묘지로',
    '자신의 다른 몬스터 하나를 묘지로',
    '나머지는 묘지로 보낸다',
  ])
  addRole(roles, ownGraveyardEnabler, 'graveyard_enabler')
  addRole(roles, includesAny(text, [
    '자신의 묘지에',
    '묘지로 보내진 턴',
    '묘지에서 비용',
    '자신의 묘지에서',
    '자신의 묘지 카드',
  ]), 'graveyard_payoff')
  addRole(roles, includesAny(text, ['자신의 묘지에서', '묘지의 카드']) && text.includes('손으로'), 'recursion')

  addRole(roles, includesAny(text, [
    '자신의 라이프',
    '자신의 라이프 영역',
    '라이프에 뒷면으로',
  ]), 'life_control')
  addRole(roles, hasLockText, 'lockdown')
  addRole(roles, text.includes('각성'), 'awakening')
  addRole(roles, text.includes('진화') || card.type === 'unit' && card.evolutionAttribute !== undefined, 'evolution')
  addRole(roles, text.includes('공명'), 'resonance')
  addRole(roles, roles.size === 0 || text === '없음.', 'utility')
  for (const hintedRole of card.deckHints?.roles ?? []) roles.add(hintedRole)

  for (const attribute of card.attributes) packages.add(`attribute:${attribute}`)
  for (const packageId of card.deckHints?.packageIds ?? []) packages.add(packageId)
  for (const family of card.families) packages.add(`family:${family}`)
  if (roles.has('graveyard_enabler') || roles.has('graveyard_payoff') || roles.has('recursion')) packages.add('theme:graveyard')
  if (roles.has('ramp') || roles.has('mana_payoff')) packages.add('theme:mana')
  if (roles.has('life_control') || roles.has('awakening')) packages.add('theme:life')
  if (roles.has('lockdown')) packages.add('theme:lockdown')
  if (roles.has('evolution')) packages.add(`theme:evolution:${card.type === 'unit' && card.evolutionAttribute ? card.evolutionAttribute : card.attributes[0] ?? 'mixed'}`)
  if (roles.has('resonance')) packages.add('theme:resonance')
  if (roles.has('draw') || roles.has('tempo')) packages.add('theme:value')
  if (roles.has('removal') || roles.has('board_clear')) packages.add('theme:control')
  if (card.type === 'unit' && card.cost <= 2) packages.add('theme:low-cost-units')
  if (card.type === 'unit' && card.keywords?.includes('flying')) packages.add('theme:flying')
  if (text.includes('유언')) packages.add('theme:last-words')

  let basePower = 1
  if (card.type === 'unit') {
    basePower += (card.attack + card.health) / Math.max(2, card.cost + 1) * 0.55
    basePower += (card.keywords?.length ?? 0) * 0.18
    if (cannotAttack) basePower -= 0.35
    else if (cannotDirectAttack) basePower -= 0.12
    if (roles.has('lockdown')) basePower += 0.18
  } else {
    basePower += 0.6 + Math.min(1.2, roles.size * 0.16)
  }

  let copyClass: CardDeckAnalysis['copyClass'] = card.deckHints?.copyClass ?? 'support'
  if (!card.deckHints?.copyClass) {
    if (roles.has('finisher') || card.cost >= 5) copyClass = 'finisher'
    else if (roles.has('early_unit') || roles.has('draw') || roles.has('ramp') || roles.has('graveyard_enabler')) copyClass = 'core'
    else if (roles.has('board_clear') || roles.has('life_control') || roles.has('lockdown') || roles.has('utility')) copyClass = 'tech'
  }

  const analysis: CardDeckAnalysis = {
    cardId,
    roles: ROLE_ORDER.filter((role) => roles.has(role)),
    packages: [...packages],
    basePower: Math.max(0.35, basePower),
    copyClass,
  }
  CARD_ANALYSIS_CACHE.set(cardId, analysis)
  return analysis
}

export function strategyRoleWeight(strategy: DeckStrategy, role: DeckRole): number {
  return STRATEGY_ROLE_WEIGHTS[strategy][role] ?? 0
}

export function strategyRoleTargets(strategy: DeckStrategy): Partial<Record<DeckRole, number>> {
  return ROLE_COPY_TARGETS[strategy]
}

const DISCOVERY_ROLE_WEIGHTS: Record<DeckStrategy, Partial<Record<DeckRole, number>>> = {
  aggro: { early_unit: 0.7, pressure: 1.7, tempo: 0.35, finisher: 0.4 },
  value: { draw: 2.6, recursion: 1.8, tempo: 1.1, utility: 0.4 },
  control: { removal: 2.2, board_clear: 3.1, lockdown: 2.0, defender: 0.9, draw: 0.5 },
  ramp: { ramp: 3.2, mana_payoff: 2.5, evolution: 0.7, finisher: 0.8 },
  graveyard: { graveyard_enabler: 2.7, graveyard_payoff: 2.8, recursion: 1.7 },
  life: { life_control: 2.7, lockdown: 1.8, awakening: 2.1, evolution: 0.7, pressure: 0.35, defender: 0.5 },
  evolution: { evolution: 3.2, early_unit: 0.25 },
  midrange: { pressure: 0.55, defender: 0.7, removal: 0.55, draw: 0.35, finisher: 0.45 },
}

function strategyScore(cardIds: readonly CardId[], strategy: DeckStrategy): number {
  const weights = DISCOVERY_ROLE_WEIGHTS[strategy]
  let score = 0
  let matchingCards = 0
  for (const cardId of cardIds) {
    const analysis = analyzeCardForDeck(cardId)
    const cardScore = analysis.roles.reduce((sum, role) => sum + (weights[role] ?? 0), 0)
    if (cardScore > 0) matchingCards += 1
    score += Math.min(4.5, cardScore)
    const card = CARDS[cardId]
    if (strategy === 'aggro' && card.type === 'unit' && card.cost <= 2 && analysis.roles.includes('pressure')) score += 0.45
    if ((strategy === 'control' || strategy === 'ramp') && card.cost >= 5) score += 0.15
  }
  return score + Math.min(4, matchingCards * 0.12)
}

function bestStrategies(cardIds: readonly CardId[]): DeckStrategy[] {
  const strategies: DeckStrategy[] = ['aggro', 'value', 'control', 'ramp', 'graveyard', 'life', 'evolution', 'midrange']
  return strategies.sort((left, right) => strategyScore(cardIds, right) - strategyScore(cardIds, left))
}

function packageDensity(cardIds: readonly CardId[], attributes: readonly CardAttributeId[]): string[] {
  const counts = new Map<string, number>()
  for (const cardId of cardIds) {
    const card = CARDS[cardId]
    if (attributes.length > 0 && !card.attributes.some((attribute) => attributes.includes(attribute))) continue
    for (const packageId of analyzeCardForDeck(cardId).packages) {
      if (packageId.startsWith('attribute:')) continue
      counts.set(packageId, (counts.get(packageId) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([packageId]) => packageId)
}

function strategyLabel(strategy: DeckStrategy): string {
  const labels: Record<DeckStrategy, string> = {
    aggro: '공격',
    value: '가치',
    control: '제어',
    ramp: '성장',
    graveyard: '묘지',
    life: '라이프',
    evolution: '진화',
    midrange: '균형',
  }
  return labels[strategy]
}

function defaultUnitTarget(strategy: DeckStrategy, minimum: number, maximum: number): number {
  const midpoint = Math.round((minimum + maximum) / 2)
  if (strategy === 'aggro' || strategy === 'evolution') return Math.min(maximum, midpoint + 2)
  if (strategy === 'control') return Math.max(minimum, midpoint - 2)
  if (strategy === 'ramp' || strategy === 'midrange') return Math.min(maximum, midpoint + 1)
  return midpoint
}

function defaultCurveBias(strategy: DeckStrategy): DeckArchetypePlan['curveBias'] {
  if (strategy === 'aggro') return 'low'
  if (strategy === 'control' || strategy === 'ramp') return 'high'
  return 'balanced'
}

const ATTRIBUTE_STRATEGY_BONUS: Record<CardAttributeId, Partial<Record<DeckStrategy, number>>> = {
  fire: { aggro: 4.2, midrange: 1.2 },
  water: { value: 4.2, control: 1.8 },
  earth: { ramp: 4.8, midrange: 1.4 },
  dark: { graveyard: 5.2, midrange: 1.2 },
  light: { life: 4.8, control: 2.2 },
}

function bestStrategiesForAttribute(cardIds: readonly CardId[], attribute: CardAttributeId): DeckStrategy[] {
  const strategies: DeckStrategy[] = ['aggro', 'value', 'control', 'ramp', 'graveyard', 'life', 'evolution', 'midrange']
  return strategies.sort((left, right) => (
    strategyScore(cardIds, right) + (ATTRIBUTE_STRATEGY_BONUS[attribute][right] ?? 0)
    - strategyScore(cardIds, left) - (ATTRIBUTE_STRATEGY_BONUS[attribute][left] ?? 0)
  ))
}

export function createArchetypePlans(
  pool: readonly CardId[],
  minUnits: number,
  maxUnits: number,
): DeckArchetypePlan[] {
  const present = ATTRIBUTE_IDS.filter((attribute) => pool.some((cardId) => CARDS[cardId].attributes.includes(attribute)))
  const output: DeckArchetypePlan[] = []

  for (const attribute of present) {
    const cards = pool.filter((cardId) => CARDS[cardId].attributes.includes(attribute))
    const [primary = 'midrange', secondary = 'midrange'] = bestStrategiesForAttribute(cards, attribute)
    for (const strategy of [...new Set<DeckStrategy>([primary, secondary])]) {
      output.push({
        id: `${attribute}-${strategy}`,
        name: `${CARD_ATTRIBUTES[attribute].name} ${strategyLabel(strategy)}`,
        attributes: [attribute],
        strategy,
        unitTarget: defaultUnitTarget(strategy, minUnits, maxUnits),
        curveBias: defaultCurveBias(strategy),
        packageIds: packageDensity(pool, [attribute]),
        exploratory: false,
      })
    }
  }

  for (let left = 0; left < present.length; left += 1) {
    for (let right = left + 1; right < present.length; right += 1) {
      const attributes = [present[left]!, present[right]!]
      const cards = pool.filter((cardId) => CARDS[cardId].attributes.some((attribute) => attributes.includes(attribute)))
      const [strategy = 'midrange'] = bestStrategies(cards)
      output.push({
        id: `${attributes.join('-')}-${strategy}`,
        name: `${attributes.map((attribute) => CARD_ATTRIBUTES[attribute].name).join('·')} ${strategyLabel(strategy)}`,
        attributes,
        strategy,
        unitTarget: defaultUnitTarget(strategy, minUnits, maxUnits),
        curveBias: defaultCurveBias(strategy),
        packageIds: packageDensity(pool, attributes),
        exploratory: false,
      })
    }
  }

  output.push({
    id: 'mixed-exploration',
    name: '혼합 탐색',
    attributes: present,
    strategy: 'midrange',
    unitTarget: Math.round((minUnits + maxUnits) / 2),
    curveBias: 'balanced',
    packageIds: packageDensity(pool, []),
    exploratory: true,
  })
  return output
}

export function inferDeckStrategy(cardIds: readonly CardId[]): DeckStrategy {
  return bestStrategies(cardIds)[0] ?? 'midrange'
}

export function inferDeckAttributes(cardIds: readonly CardId[]): CardAttributeId[] {
  const counts = new Map<CardAttributeId, number>(ATTRIBUTE_IDS.map((attribute) => [attribute, 0]))
  for (const cardId of cardIds) {
    for (const attribute of CARDS[cardId].attributes) counts.set(attribute, (counts.get(attribute) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1])
  const maximum = ranked[0]?.[1] ?? 0
  return ranked
    .filter(([, count], index) => count > 0 && (index === 0 || count >= maximum * 0.55))
    .slice(0, 2)
    .map(([attribute]) => attribute)
}

export function derivePlanFromDeck(deck: DeckCandidate, minUnits: number, maxUnits: number): DeckArchetypePlan {
  const attributes = inferDeckAttributes(deck.cardIds)
  const strategy = deck.strategy ?? inferDeckStrategy(deck.cardIds)
  return {
    id: deck.archetypeId ?? `${attributes.join('-') || 'mixed'}-${strategy}`,
    name: deck.archetypeName ?? `${attributes.map((attribute) => CARD_ATTRIBUTES[attribute].name).join('·') || '혼합'} ${strategyLabel(strategy)}`,
    attributes,
    strategy,
    unitTarget: defaultUnitTarget(strategy, minUnits, maxUnits),
    curveBias: defaultCurveBias(strategy),
    packageIds: packageDensity(deck.cardIds, attributes),
    exploratory: deck.source === 'exploratory',
  }
}

export function analyzeDeckProfile(cardIds: readonly CardId[]): DeckProfileSummary {
  const counts = new Map<CardId, number>()
  const roleCounts: Partial<Record<DeckRole, number>> = {}
  const packageCounts = new Map<string, number>()
  let unitCount = 0
  let totalCost = 0

  for (const cardId of cardIds) {
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
    const card = CARDS[cardId]
    if (card.type === 'unit') unitCount += 1
    totalCost += card.cost
    const analysis = analyzeCardForDeck(cardId)
    for (const role of analysis.roles) roleCounts[role] = (roleCounts[role] ?? 0) + 1
    for (const packageId of analysis.packages) packageCounts.set(packageId, (packageCounts.get(packageId) ?? 0) + 1)
  }

  const values = [...counts.values()]
  const topPackages = [...packageCounts.entries()]
    .filter(([packageId]) => !packageId.startsWith('attribute:'))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([packageId]) => packageId)

  return {
    distinctCards: counts.size,
    singletonCount: values.filter((count) => count === 1).length,
    doubletonCount: values.filter((count) => count === 2).length,
    tripletonCount: values.filter((count) => count >= 3).length,
    unitCount,
    spellCount: cardIds.length - unitCount,
    averageCost: cardIds.length > 0 ? totalCost / cardIds.length : 0,
    strategy: inferDeckStrategy(cardIds),
    attributes: inferDeckAttributes(cardIds),
    roleCounts,
    topPackages,
  }
}
