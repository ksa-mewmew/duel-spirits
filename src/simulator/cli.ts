import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeMetaSimulationConfig, DEFAULT_META_SIMULATION_CONFIG } from './config'
import { runMetaSimulation } from './experiment'
import {
  createAttributesCsv,
  createBotsCsv,
  createCardsCsv,
  createDecksCsv,
  createMatchupsCsv,
  createSummaryMarkdown,
} from './report'

function argumentValue(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function loadConfig(): ReturnType<typeof normalizeMetaSimulationConfig> {
  const configArgument = argumentValue('--config')
  const defaultPath = resolve(process.cwd(), 'simulator.config.json')
  const configPath = configArgument ? resolve(process.cwd(), configArgument) : defaultPath
  const raw = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, 'utf8')) as unknown
    : DEFAULT_META_SIMULATION_CONFIG
  const config = normalizeMetaSimulationConfig(raw)
  const seed = argumentValue('--seed')
  const output = argumentValue('--out')
  if (seed) config.seed = seed
  if (output) config.outputDirectory = output
  return config
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function leastCommonMultiple(left: number, right: number): number {
  return Math.abs(left * right) / Math.max(1, greatestCommonDivisor(left, right))
}

function main(): void {
  const config = loadConfig()
  console.log(`[meta] 카드 풀과 덱을 준비합니다. seed=${config.seed}`)
  console.log(
    `[meta] 덱 탐색: ${config.deckGeneration.populationSize}개 × ${config.deckGeneration.generations}세대, `
    + `아키타입 기반 ${Math.round(config.deckGeneration.humanDeckRatio * 100)}%, `
    + `${config.deckGeneration.minDistinctCards}~${config.deckGeneration.maxDistinctCards}종, `
    + `1장 카드 최대 ${config.deckGeneration.maxSingletonCards}종`,
  )
  if (config.behaviorEvolution.enabled) {
    console.log(
      `[meta] 행동 진화: ${config.behaviorEvolution.populationSize}개 정책 × `
      + `${config.behaviorEvolution.generations}세대, 훈련 덱 ${config.behaviorEvolution.trainingDeckCount}개`,
    )
  }
  const finalBotCount = config.behaviorEvolution.enabled
    ? config.behaviorEvolution.finalBotCount
    : config.matches.botProfiles.length
  const balanceCycle = leastCommonMultiple(4, finalBotCount)
  if (config.matches.gamesPerPair % balanceCycle !== 0) {
    console.log(`[meta] 참고: 좌석·행동 봇을 대진마다 정확히 같은 횟수로 비교하려면 gamesPerPair를 ${balanceCycle}의 배수로 두십시오.`)
  }
  if (config.behaviorEvolution.enabled && config.behaviorEvolution.gamesPerPairPerDeck % 2 !== 0) {
    console.log('[meta] 참고: 행동 가중치 미러전의 선공 균형을 위해 gamesPerPairPerDeck를 2의 배수로 두십시오.')
  }
  const report = runMetaSimulation(config, (message) => console.log(`[meta] ${message}`))
  const outputDirectory = resolve(process.cwd(), config.outputDirectory)
  mkdirSync(outputDirectory, { recursive: true })

  writeFileSync(resolve(outputDirectory, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
  writeFileSync(resolve(outputDirectory, 'summary.md'), createSummaryMarkdown(report), 'utf8')
  writeFileSync(resolve(outputDirectory, 'bots.csv'), createBotsCsv(report), 'utf8')
  writeFileSync(resolve(outputDirectory, 'attributes.csv'), createAttributesCsv(report), 'utf8')
  writeFileSync(resolve(outputDirectory, 'decks.csv'), createDecksCsv(report), 'utf8')
  writeFileSync(resolve(outputDirectory, 'cards.csv'), createCardsCsv(report), 'utf8')
  writeFileSync(resolve(outputDirectory, 'matchups.csv'), createMatchupsCsv(report), 'utf8')

  const best = report.finalStandings[0]
  console.log(`[meta] 완료: ${outputDirectory}`)
  const bestBot = report.finalBehaviors[0]
  if (bestBot) console.log(`[meta] 최종 행동 봇: ${bestBot.name}`)
  if (best) console.log(`[meta] 1위 덱: ${best.deckName} (${(best.winRate * 100).toFixed(1)}%)`)
  console.log(`[meta] 우선 검토 카드: ${report.cardStandings.slice(0, 5).map((card) => card.cardName).join(', ')}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
}
