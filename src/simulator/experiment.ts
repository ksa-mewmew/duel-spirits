import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import { normalizeDeckFormatSelection, validateDeck } from '../shared/decks'
import { createBaselineBotContestant, createEvolvedBotContestant } from './bots'
import { evolveBehaviors } from './behavior-evolution'
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
  const output: DeckCandidate[] = []
  const selected = new Set<string>()

  // 각 속성의 가장 높은 순위 대표를 먼저 한 번씩 남겨, 초기 통계 노이즈만으로
  // 한 속성이 다음 세대에서 완전히 사라지는 일을 막습니다.
  for (const attribute of ATTRIBUTE_IDS) {
    const representative = ranked.find((deck) => primaryAttributes(deck).includes(attribute))
    if (!representative || selected.has(representative.id)) continue
    selected.add(representative.id)
    output.push(representative)
  }

  for (const deck of ranked) {
    if (output.length >= Math.max(requestedCount, 1) && output.length >= Math.min(ATTRIBUTE_IDS.length, decks.length)) break
    if (selected.has(deck.id)) continue
    selected.add(deck.id)
    output.push(deck)
  }

  // population 전체가 부모로 고정되면 변이를 만들 수 없으므로 최소 한 자리는 비웁니다.
  return output.slice(0, Math.max(1, decks.length - 1))
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
