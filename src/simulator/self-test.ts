import { normalizeMetaSimulationConfig } from './config'
import { runMetaSimulation } from './experiment'
import { analyzeDeckProfile } from './deck-intelligence'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SELF TEST FAILED: ${message}`)
}

const config = normalizeMetaSimulationConfig({
  seed: 'self-test',
  formatId: 'open-v1',
  deckGeneration: {
    populationSize: 4,
    generations: 1,
    eliteCount: 2,
    mutationsPerChild: 1,
    minUnits: 11,
    maxUnits: 16,
    maxAttemptsPerDeck: 100,
  },
  behaviorEvolution: {
    enabled: true,
    populationSize: 3,
    generations: 2,
    eliteCount: 2,
    mutationsPerChild: 3,
    mutationScale: 0.06,
    trainingDeckCount: 2,
    gamesPerPairPerDeck: 2,
    hallOfFameCount: 0,
    finalBotCount: 2,
    drawScore: 0.15,
    seedProfiles: ['aggressive', 'value', 'control'],
  },
  matches: {
    gamesPerPair: 2,
    botProfiles: ['aggressive', 'value'],
    maxTurns: 35,
    maxActions: 240,
    legalActionLimits: {
      maxPaymentVariantsPerCard: 48,
      maxGeneratedActions: 400,
      maxChoiceCombinations: 160,
    },
  },
  outputDirectory: 'simulation-results/self-test',
})

const report = runMetaSimulation(config)
const matches = report.generations[0]?.matches ?? []
assert(report.cardPool.length > 0, '카드 풀이 비었습니다.')
assert(report.behaviorGenerations.length === 2, '행동 가중치 진화가 두 세대 실행되지 않았습니다.')
assert(report.finalBehaviors.length === 2, '최종 행동 봇 두 개가 생성되지 않았습니다.')
assert(report.finalBehaviorStandings.every((standing) => standing.games > 0), '행동 봇 평가 경기가 없습니다.')
assert(report.finalBehaviors.every((bot) => bot.generation === 1), '최종 행동 봇이 다음 세대에서 선택되지 않았습니다.')
assert(report.finalBehaviors.some((bot) => bot.parentIds.length > 0), '행동 가중치 계보가 기록되지 않았습니다.')
assert(report.finalDecks.length === 4, '덱 네 개가 생성되지 않았습니다.')
const humanDeckProfiles = report.finalDecks
  .filter((deck) => deck.source !== 'exploratory')
  .map((deck) => analyzeDeckProfile(deck.cardIds))
assert(humanDeckProfiles.every((profile) => profile.distinctCards <= config.deckGeneration.maxDistinctCards), '인간형 덱의 카드 종류 수가 상한을 넘었습니다.')
assert(humanDeckProfiles.every((profile) => profile.singletonCount <= config.deckGeneration.maxSingletonCards), '인간형 덱에 1장 카드가 지나치게 많습니다.')
assert(humanDeckProfiles.every((profile) => profile.doubletonCount + profile.tripletonCount >= 3), '2장·3장 채용이 충분히 생성되지 않았습니다.')
assert(matches.length === 12, '라운드로빈 경기 수가 예상과 다릅니다.')
assert(matches.every((match) => match.termination !== 'no-legal-actions'), '합법 행동을 찾지 못한 경기가 있습니다.')
assert(report.finalStandings.every((standing) => standing.games === 6), '각 덱의 경기 수가 맞지 않습니다.')
assert(report.cardStandings.length === report.cardPool.length, '카드 통계가 카드 풀 전체를 덮지 못했습니다.')

const behaviorMatches = report.behaviorGenerations.reduce((sum, generation) => sum + generation.matches.length, 0)
console.log(`SELF TEST OK: ${behaviorMatches} behavior matches, ${matches.length} deck matches, ${report.cardPool.length} cards`)
