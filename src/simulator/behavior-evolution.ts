import { createSeededRandom } from '../shared/random'
import {
  createEvolvedBotContestant,
  getBaselineWeights,
} from './bots'
import { runSimulatedMatch } from './match-runner'
import { clamp, mean, shuffled, wilsonInterval } from './utils'

import type { CardId } from '../shared/cards'
import type { PlayerId } from '../shared/types'
import type { DeckFormatSelection } from '../content/schema'
import type { BotContestant } from './bots'
import type {
  BehaviorCandidate,
  BehaviorEvolutionConfig,
  BehaviorGenerationReport,
  BehaviorStanding,
  DeckCandidate,
  HeuristicWeightKey,
  HeuristicWeights,
  MatchParticipant,
  MatchSimulationConfig,
  SimulatedMatchResult,
} from './types'

export const HEURISTIC_WEIGHT_KEYS: readonly HeuristicWeightKey[] = [
  'directAttack',
  'unitAttack',
  'playUnit',
  'playSpell',
  'placeMana',
  'endTurn',
  'attackStat',
  'healthStat',
  'handValue',
  'highCostBias',
  'favorableTrade',
  'lifeValue',
  'manaValue',
  'readyManaValue',
  'readyUnitValue',
  'stateDelta',
]

const WEIGHT_LIMITS: Record<HeuristicWeightKey, readonly [number, number]> = {
  directAttack: [20, 400],
  unitAttack: [-40, 160],
  playUnit: [-20, 140],
  playSpell: [-20, 160],
  placeMana: [-20, 160],
  endTurn: [-80, 80],
  attackStat: [1, 48],
  healthStat: [1, 48],
  handValue: [0, 40],
  highCostBias: [-10, 24],
  favorableTrade: [0, 260],
  lifeValue: [40, 360],
  manaValue: [0, 44],
  readyManaValue: [0, 40],
  readyUnitValue: [0, 56],
  stateDelta: [0.1, 4],
}

function rounded(value: number): number {
  return Math.round(value * 10000) / 10000
}

function gaussian(random: () => number): number {
  const left = Math.max(Number.EPSILON, random())
  const right = Math.max(Number.EPSILON, random())
  return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right)
}

function weightsKey(weights: HeuristicWeights): string {
  return HEURISTIC_WEIGHT_KEYS.map((key) => `${key}:${weights[key].toFixed(4)}`).join('|')
}

function mutateWeights(
  source: HeuristicWeights,
  mutationCount: number,
  mutationScale: number,
  random: () => number,
): HeuristicWeights {
  const output = { ...source }
  const keys = shuffled(HEURISTIC_WEIGHT_KEYS, random)
  const count = Math.max(1, Math.min(keys.length, mutationCount))
  for (const key of keys.slice(0, count)) {
    const [minimum, maximum] = WEIGHT_LIMITS[key]
    const span = maximum - minimum
    const delta = gaussian(random) * span * mutationScale
    output[key] = rounded(clamp(output[key] + delta, minimum, maximum))
  }
  return output
}

function crossoverWeights(
  left: HeuristicWeights,
  right: HeuristicWeights,
  random: () => number,
): HeuristicWeights {
  return Object.fromEntries(HEURISTIC_WEIGHT_KEYS.map((key) => {
    const roll = random()
    const value = roll < 0.4
      ? left[key]
      : roll < 0.8
        ? right[key]
        : (left[key] + right[key]) / 2
    return [key, rounded(value)]
  })) as unknown as HeuristicWeights
}

function behaviorLabel(index: number): string {
  return `진화 행동 봇 ${String(index + 1).padStart(2, '0')}`
}

export function createInitialBehaviorPopulation(
  config: BehaviorEvolutionConfig,
  seed: string,
): BehaviorCandidate[] {
  const random = createSeededRandom(`${seed}:behavior:initial`).next
  const output: BehaviorCandidate[] = config.seedProfiles
    .slice(0, config.populationSize)
    .map((profile) => ({
      id: `b0-${profile}`,
      name: `${profile} 기준 행동 봇`,
      weights: getBaselineWeights(profile),
      generation: 0,
      parentIds: [],
      tags: ['기준', profile],
    }))
  const seen = new Set(output.map((candidate) => weightsKey(candidate.weights)))
  let attempts = 0

  while (output.length < config.populationSize && attempts < config.populationSize * 100) {
    const parent = output[attempts % Math.max(1, output.length)]
      ?? {
        id: 'fallback',
        name: 'fallback',
        weights: getBaselineWeights('value'),
        generation: 0,
        parentIds: [],
        tags: [],
      }
    const weights = mutateWeights(
      parent.weights,
      config.mutationsPerChild + (attempts % 3),
      config.mutationScale,
      random,
    )
    attempts += 1
    const key = weightsKey(weights)
    if (seen.has(key)) continue
    seen.add(key)
    output.push({
      id: `b0-evolved-${String(output.length + 1).padStart(3, '0')}`,
      name: behaviorLabel(output.length),
      weights,
      generation: 0,
      parentIds: [parent.id],
      tags: ['초기 변이'],
    })
  }

  if (output.length < 2) throw new Error('행동 가중치 집단을 두 개 이상 만들지 못했습니다.')
  return output.slice(0, config.populationSize)
}

function seatBehaviorPair(
  left: BotContestant,
  right: BotContestant,
  deck: DeckCandidate,
  gameIndex: number,
): {
  participants: Record<PlayerId, MatchParticipant>
  policies: Record<PlayerId, BotContestant['policy']>
  startingPlayer: PlayerId
} {
  const condition = gameIndex % 4
  const leftIsP1 = condition === 0 || condition === 2
  const startingPlayer: PlayerId = condition === 0 || condition === 1 ? 'P1' : 'P2'
  const participant = (bot: BotContestant): MatchParticipant => ({
    deckId: deck.id,
    deckName: deck.name,
    cardIds: deck.cardIds,
    botId: bot.id,
    botName: bot.name,
    botProfile: bot.profile,
  })
  return {
    participants: leftIsP1
      ? { P1: participant(left), P2: participant(right) }
      : { P1: participant(right), P2: participant(left) },
    policies: leftIsP1
      ? { P1: left.policy, P2: right.policy }
      : { P1: right.policy, P2: left.policy },
    startingPlayer,
  }
}

interface MutableBehaviorStanding {
  candidate: BehaviorCandidate
  games: number
  wins: number
  losses: number
  draws: number
  normalFinishes: number
  turns: number[]
}

function buildBehaviorStandings(
  candidates: readonly BehaviorCandidate[],
  matches: readonly SimulatedMatchResult[],
  drawScore: number,
): BehaviorStanding[] {
  const records = new Map<string, MutableBehaviorStanding>(candidates.map((candidate) => [
    candidate.id,
    {
      candidate,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      normalFinishes: 0,
      turns: [],
    },
  ]))

  for (const match of matches) {
    for (const playerId of ['P1', 'P2'] as const) {
      const participant = match.participants[playerId]
      const record = records.get(participant.botId)
      if (!record) continue
      record.games += 1
      record.turns.push(match.turns)
      if (match.termination === 'win') record.normalFinishes += 1
      if (match.winner === playerId) record.wins += 1
      else if (match.winner === null) record.draws += 1
      else record.losses += 1
    }
  }

  return [...records.values()].map((record) => {
    const normalFinishRate = record.games > 0 ? record.normalFinishes / record.games : 0
    const points = record.wins + record.draws * drawScore
    const rawFitness = record.games > 0 ? points / record.games : 0
    const stalledPenalty = (1 - normalFinishRate) * 0.25
    const [confidenceLow, confidenceHigh] = wilsonInterval(record.wins, record.games)
    return {
      botId: record.candidate.id,
      botName: record.candidate.name,
      generation: record.candidate.generation,
      games: record.games,
      wins: record.wins,
      losses: record.losses,
      draws: record.draws,
      winRate: record.games > 0 ? record.wins / record.games : 0,
      fitness: rawFitness - stalledPenalty,
      normalFinishes: record.normalFinishes,
      normalFinishRate,
      averageTurns: mean(record.turns),
      confidenceLow,
      confidenceHigh,
    }
  }).sort((left, right) => (
    right.fitness - left.fitness
    || right.winRate - left.winRate
    || right.normalFinishRate - left.normalFinishRate
    || left.averageTurns - right.averageTurns
  ))
}

export function runBehaviorGenerationTournament(
  population: readonly BehaviorCandidate[],
  hallOfFame: readonly BehaviorCandidate[],
  trainingDecks: readonly DeckCandidate[],
  selection: DeckFormatSelection<CardId>,
  matchConfig: MatchSimulationConfig,
  evolutionConfig: BehaviorEvolutionConfig,
  seed: string,
  generation: number,
): BehaviorGenerationReport {
  const currentIds = new Set(population.map((candidate) => candidate.id))
  const candidates = [
    ...population,
    ...hallOfFame.filter((candidate) => !currentIds.has(candidate.id)),
  ]
  const contestants = candidates.map(createEvolvedBotContestant)
  const matches: SimulatedMatchResult[] = []

  for (let left = 0; left < contestants.length; left += 1) {
    for (let right = left + 1; right < contestants.length; right += 1) {
      const botA = contestants[left]!
      const botB = contestants[right]!
      for (const deck of trainingDecks) {
        for (let gameIndex = 0; gameIndex < evolutionConfig.gamesPerPairPerDeck; gameIndex += 1) {
          const seats = seatBehaviorPair(botA, botB, deck, gameIndex)
          matches.push(runSimulatedMatch({
            seed: `${seed}:behavior:g${generation}:${botA.id}:${botB.id}:${deck.id}:pair${Math.floor(gameIndex / 2)}`,
            startingPlayer: seats.startingPlayer,
            selection,
            participants: seats.participants,
            policies: seats.policies,
            config: matchConfig,
          }))
        }
      }
    }
  }

  return {
    generation,
    behaviors: [...population],
    hallOfFame: [...hallOfFame],
    trainingDecks: [...trainingDecks],
    standings: buildBehaviorStandings(candidates, matches, evolutionConfig.drawScore),
    matches,
  }
}

function rankedPopulation(
  population: readonly BehaviorCandidate[],
  standings: readonly BehaviorStanding[],
): BehaviorCandidate[] {
  const byId = new Map(population.map((candidate) => [candidate.id, candidate]))
  return standings
    .map((standing) => byId.get(standing.botId))
    .filter((candidate): candidate is BehaviorCandidate => candidate !== undefined)
}

export function updateBehaviorHallOfFame(
  population: readonly BehaviorCandidate[],
  hallOfFame: readonly BehaviorCandidate[],
  standings: readonly BehaviorStanding[],
  maximum: number,
): BehaviorCandidate[] {
  if (maximum <= 0) return []
  const candidateById = new Map(
    [...population, ...hallOfFame].map((candidate) => [candidate.id, candidate]),
  )
  const output: BehaviorCandidate[] = []
  const seenWeights = new Set<string>()
  for (const standing of standings) {
    const candidate = candidateById.get(standing.botId)
    if (!candidate) continue
    const key = weightsKey(candidate.weights)
    if (seenWeights.has(key)) continue
    seenWeights.add(key)
    output.push(candidate)
    if (output.length >= maximum) break
  }
  return output
}

export function createNextBehaviorGeneration(
  population: readonly BehaviorCandidate[],
  standings: readonly BehaviorStanding[],
  config: BehaviorEvolutionConfig,
  seed: string,
  generation: number,
): BehaviorCandidate[] {
  const ranked = rankedPopulation(population, standings)
  const elites = ranked.slice(0, Math.max(1, Math.min(config.eliteCount, ranked.length)))
  if (elites.length === 0) throw new Error('다음 행동 세대를 만들 엘리트가 없습니다.')
  const random = createSeededRandom(`${seed}:behavior:next:${generation}`).next
  const output: BehaviorCandidate[] = elites.map((candidate, index) => ({
    ...candidate,
    id: `b${generation}-elite-${String(index + 1).padStart(3, '0')}`,
    name: `${candidate.name} 계승`,
    generation,
    parentIds: [candidate.id],
    tags: [...candidate.tags, '엘리트 계승'],
  }))
  const seen = new Set(output.map((candidate) => weightsKey(candidate.weights)))
  let attempts = 0

  while (output.length < config.populationSize && attempts < config.populationSize * 120) {
    const left = elites[attempts % elites.length]!
    const right = elites[(attempts * 2 + 1) % elites.length]!
    const crossed = crossoverWeights(left.weights, right.weights, random)
    const weights = mutateWeights(
      crossed,
      config.mutationsPerChild + (attempts % 2),
      config.mutationScale,
      random,
    )
    attempts += 1
    const key = weightsKey(weights)
    if (seen.has(key)) continue
    seen.add(key)
    output.push({
      id: `b${generation}-evolved-${String(output.length + 1).padStart(3, '0')}`,
      name: behaviorLabel(output.length),
      weights,
      generation,
      parentIds: left.id === right.id ? [left.id] : [left.id, right.id],
      tags: ['교차', '가중치 변이'],
    })
  }

  return output.slice(0, config.populationSize)
}

export interface BehaviorEvolutionResult {
  generations: BehaviorGenerationReport[]
  finalBehaviors: BehaviorCandidate[]
  finalStandings: BehaviorStanding[]
}

export function evolveBehaviors(
  trainingDecks: readonly DeckCandidate[],
  selection: DeckFormatSelection<CardId>,
  matchConfig: MatchSimulationConfig,
  config: BehaviorEvolutionConfig,
  seed: string,
  onProgress: (message: string) => void = () => undefined,
): BehaviorEvolutionResult {
  let population = createInitialBehaviorPopulation(config, seed)
  let hallOfFame: BehaviorCandidate[] = []
  const generations: BehaviorGenerationReport[] = []

  for (let generation = 0; generation < config.generations; generation += 1) {
    onProgress(`행동 세대 ${generation + 1}/${config.generations}: ${population.length}개 정책을 ${trainingDecks.length}개 미러 덱에서 평가합니다.`)
    const report = runBehaviorGenerationTournament(
      population,
      hallOfFame,
      trainingDecks,
      selection,
      matchConfig,
      config,
      seed,
      generation,
    )
    generations.push(report)
    const completed = report.matches.filter((match) => match.termination === 'win').length
    const currentRanking = rankedPopulation(population, report.standings)
    const best = currentRanking[0]
    onProgress(`행동 세대 ${generation + 1}: ${report.matches.length}경기 완료 (정상 종료 ${completed})${best ? `, 선두 ${best.name}` : ''}`)
    hallOfFame = updateBehaviorHallOfFame(
      population,
      hallOfFame,
      report.standings,
      config.hallOfFameCount,
    )
    if (generation + 1 >= config.generations) break
    population = createNextBehaviorGeneration(
      population,
      report.standings,
      config,
      seed,
      generation + 1,
    )
  }

  const last = generations[generations.length - 1]
  if (!last) throw new Error('행동 진화 결과가 생성되지 않았습니다.')
  const ranking = rankedPopulation(population, last.standings)
  const finalBehaviors = ranking.slice(0, Math.max(1, Math.min(config.finalBotCount, ranking.length)))
  const finalIds = new Set(finalBehaviors.map((candidate) => candidate.id))
  const finalStandings = last.standings.filter((standing) => finalIds.has(standing.botId))

  return { generations, finalBehaviors, finalStandings }
}
