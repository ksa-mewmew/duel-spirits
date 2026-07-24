import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import { normalizeDeckFormatSelection, validateDeck } from '../shared/decks'
import { createBaselineBotContestant, createEvolvedBotContestant } from './bots'
import { evolveBehaviors } from './behavior-evolution'
import { analyzeDeckProfile } from './deck-intelligence'
import { createNextGeneration, generateDeckPopulation } from './deck-generator'
import { resolveCardPool } from './card-pool'
import { runGenerationTournament } from './tournament'
import { buildCardStandings } from './statistics'

import type { CardAttributeId } from '../shared/cards'
import type { BotContestant } from './bots'
import type {
  BehaviorCandidate,
  BehaviorStanding,
  DeckCandidate,
  DeckStanding,
  MetaSimulationConfig,
  MetaSimulationReport,
} from './types'

const ATTRIBUTE_IDS = Object.keys(CARD_ATTRIBUTES) as CardAttributeId[]

function primaryAttributes(deck: DeckCandidate): CardAttributeId[] {
  const counts = new Map<CardAttributeId, number>(ATTRIBUTE_IDS.map((attribute) => [attribute, 0]))
  for (const cardId of deck.cardIds) {
    for (const attribute of CARDS[cardId].attributes) {
      counts.set(attribute, (counts.get(attribute) ?? 0) + 1)
    }
  }
  const maximum = Math.max(0, ...counts.values())
  return ATTRIBUTE_IDS.filter((attribute) => maximum > 0 && (counts.get(attribute) ?? 0) >= maximum * 0.8)
}

function selectDiverseElites(
  decks: readonly DeckCandidate[],
  standings: readonly DeckStanding[],
  requestedCount: number,
): DeckCandidate[] {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]))
  const ranked = standings
    .map((standing) => deckById.get(standing.deckId))
    .filter((deck): deck is DeckCandidate => deck !== undefined)
  const target = Math.max(1, Math.min(requestedCount, Math.max(1, decks.length - 1)))
  const output: DeckCandidate[] = []
  const selected = new Set<string>()
  const coveredAttributes = new Set<CardAttributeId>()
  const coveredStrategies = new Set<string>()

  while (output.length < target) {
    const remaining = ranked.filter((deck) => !selected.has(deck.id))
    if (remaining.length === 0) break
    const novel = remaining.find((deck) => (
      primaryAttributes(deck).some((attribute) => !coveredAttributes.has(attribute))
      || (deck.strategy !== undefined && !coveredStrategies.has(deck.strategy))
    ))
    const chosen = novel ?? remaining[0]!
    selected.add(chosen.id)
    output.push(chosen)
    for (const attribute of primaryAttributes(chosen)) coveredAttributes.add(attribute)
    if (chosen.strategy) coveredStrategies.add(chosen.strategy)
  }

  return output
}

interface BehaviorSetup {
  generations: MetaSimulationReport['behaviorGenerations']
  finalBehaviors: BehaviorCandidate[]
  finalStandings: BehaviorStanding[]
  tournamentBots: BotContestant[]
}

function prepareBehaviorBots(
  config: MetaSimulationConfig,
  cardPool: MetaSimulationReport['cardPool'],
  selection: MetaSimulationReport['selection'],
  seedDecks: readonly DeckCandidate[],
  onProgress: (message: string) => void,
): BehaviorSetup {
  if (!config.behaviorEvolution.enabled) {
    return {
      generations: [],
      finalBehaviors: [],
      finalStandings: [],
      tournamentBots: config.matches.botProfiles.map(createBaselineBotContestant),
    }
  }

  const trainingDecks = generateDeckPopulation(
    cardPool,
    selection,
    {
      ...config.deckGeneration,
      populationSize: config.behaviorEvolution.trainingDeckCount,
      generations: 1,
      eliteCount: Math.min(
        config.behaviorEvolution.trainingDeckCount,
        config.deckGeneration.eliteCount,
      ),
    },
    `${config.seed}:behavior-training`,
    seedDecks.slice(0, config.behaviorEvolution.trainingDeckCount),
    0,
  ).slice(0, config.behaviorEvolution.trainingDeckCount)

  onProgress(`행동 훈련 원형: ${trainingDecks.map((deck) => {
    const profile = analyzeDeckProfile(deck.cardIds)
    return `${deck.archetypeName ?? deck.name}(${profile.distinctCards}종)`
  }).join(', ')}`)

  const evolved = evolveBehaviors(
    trainingDecks,
    selection,
    config.matches,
    config.behaviorEvolution,
    config.seed,
    onProgress,
  )
  const tournamentBots = evolved.finalBehaviors.map(createEvolvedBotContestant)
  if (tournamentBots.length === 0) {
    throw new Error('행동 진화 뒤 최종 봇이 생성되지 않았습니다.')
  }
  return {
    generations: evolved.generations,
    finalBehaviors: evolved.finalBehaviors,
    finalStandings: evolved.finalStandings,
    tournamentBots,
  }
}

export function runMetaSimulation(
  config: MetaSimulationConfig,
  onProgress: (message: string) => void = () => undefined,
): MetaSimulationReport {
  const selection = normalizeDeckFormatSelection({
    formatId: config.formatId,
    selectedSetIds: config.selectedSetIds,
    draftPool: null,
  })
  const cardPool = resolveCardPool(selection, config.cardPool)
  if (cardPool.length === 0) throw new Error('시뮬레이션에 사용할 카드가 없습니다.')

  const seedDecks: DeckCandidate[] = config.seedDecks.map((deck, index) => {
    const validation = validateDeck(deck.cardIds, selection)
    if (!validation.valid) {
      throw new Error(`${deck.name}: ${validation.errors.join(' ')}`)
    }
    if (deck.cardIds.some((cardId) => !cardPool.includes(cardId))) {
      throw new Error(`${deck.name}: 입력한 카드 풀 밖의 카드가 포함되어 있습니다.`)
    }
    return {
      id: deck.id ?? `seed-${index + 1}`,
      name: deck.name,
      cardIds: [...deck.cardIds],
      generation: 0,
      parentId: null,
      tags: ['입력'],
      source: 'seed',
      parentIds: [],
    }
  })

  const behavior = prepareBehaviorBots(
    config,
    cardPool,
    selection,
    seedDecks,
    onProgress,
  )

  let decks = generateDeckPopulation(
    cardPool,
    selection,
    config.deckGeneration,
    config.seed,
    seedDecks,
    0,
  )
  onProgress(`초기 덱 원형: ${decks.map((deck) => {
    const profile = analyzeDeckProfile(deck.cardIds)
    return `${deck.archetypeName ?? deck.name}(${profile.distinctCards}종, 3장 ${profile.tripletonCount}종)`
  }).join(', ')}`)
  const generations: MetaSimulationReport['generations'] = []

  for (let generation = 0; generation < config.deckGeneration.generations; generation += 1) {
    onProgress(`덱 세대 ${generation + 1}/${config.deckGeneration.generations}: ${decks.length}개 덱 대전을 시작합니다.`)
    const report = runGenerationTournament(
      decks,
      selection,
      config.matches,
      behavior.tournamentBots,
      config.seed,
      generation,
    )
    generations.push(report)
    const completed = report.matches.filter((match) => match.termination === 'win').length
    onProgress(`덱 세대 ${generation + 1}: ${report.matches.length}경기 완료 (정상 종료 ${completed})`)
    if (generation + 1 >= config.deckGeneration.generations) break

    const elites = selectDiverseElites(
      decks,
      report.standings,
      config.deckGeneration.eliteCount,
    )
    decks = createNextGeneration(
      elites,
      cardPool,
      selection,
      config.deckGeneration,
      config.seed,
      generation + 1,
    )
    const sourceCounts = new Map<string, number>()
    for (const deck of decks) sourceCounts.set(deck.source ?? 'unknown', (sourceCounts.get(deck.source ?? 'unknown') ?? 0) + 1)
    onProgress(`다음 덱 세대 구성: ${[...sourceCounts.entries()].map(([source, count]) => `${source} ${count}`).join(', ')}`)
  }

  const finalGeneration = generations[generations.length - 1]
  if (!finalGeneration) throw new Error('시뮬레이션 세대 결과가 생성되지 않았습니다.')
  const topDeckCount = Math.max(1, Math.min(
    config.deckGeneration.eliteCount,
    Math.ceil(finalGeneration.decks.length / 4),
  ))

  return {
    createdAt: new Date().toISOString(),
    seed: config.seed,
    selection,
    cardPool,
    config,
    behaviorGenerations: behavior.generations,
    finalBehaviors: behavior.finalBehaviors,
    finalBehaviorStandings: behavior.finalStandings,
    generations,
    finalDecks: finalGeneration.decks,
    finalStandings: finalGeneration.standings,
    finalMatchups: finalGeneration.matchups,
    cardStandings: buildCardStandings(
      cardPool,
      finalGeneration.decks,
      finalGeneration.standings,
      finalGeneration.matches,
      topDeckCount,
    ),
  }
}
