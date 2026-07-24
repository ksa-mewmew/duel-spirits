import { DEFAULT_FORMAT_ID, getFormat, isGameFormatId } from '../content/formats'
import { isCardId } from '../shared/cards'
import { normalizeDeckFormatSelection } from '../shared/decks'
import { SET_IDS } from '../content/schema'

import type { CardId } from '../shared/cards'
import type { SetId } from '../content/schema'
import type {
  BotProfileId,
  HeuristicBotProfileId,
  MetaSimulationConfig,
} from './types'

const BOT_PROFILES: readonly BotProfileId[] = ['random', 'aggressive', 'value', 'control']
const HEURISTIC_BOT_PROFILES: readonly HeuristicBotProfileId[] = ['aggressive', 'value', 'control']

export const DEFAULT_META_SIMULATION_CONFIG: MetaSimulationConfig = {
  seed: 'duel-spirits-meta',
  formatId: DEFAULT_FORMAT_ID,
  selectedSetIds: [],
  cardPool: {},
  deckGeneration: {
    populationSize: 8,
    generations: 2,
    eliteCount: 3,
    mutationsPerChild: 2,
    minUnits: 10,
    maxUnits: 17,
    maxAttemptsPerDeck: 300,
  },
  behaviorEvolution: {
    enabled: true,
    populationSize: 8,
    generations: 3,
    eliteCount: 3,
    mutationsPerChild: 4,
    mutationScale: 0.08,
    trainingDeckCount: 5,
    gamesPerPairPerDeck: 2,
    hallOfFameCount: 3,
    finalBotCount: 3,
    drawScore: 0.15,
    seedProfiles: ['aggressive', 'value', 'control'],
  },
  matches: {
    gamesPerPair: 4,
    botProfiles: ['aggressive', 'value', 'control'],
    maxTurns: 80,
    maxActions: 500,
    legalActionLimits: {
      maxPaymentVariantsPerCard: 48,
      maxGeneratedActions: 400,
      maxChoiceCombinations: 160,
    },
  },
  outputDirectory: 'simulation-results/latest',
  seedDecks: [],
}

const asRecord = (value: unknown): Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const positiveInteger = (value: unknown, fallback: number, minimum = 1): number => (
  Number.isInteger(value) && Number(value) >= minimum ? Number(value) : fallback
)


const finiteNumber = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
)

const booleanValue = (value: unknown, fallback: boolean): boolean => (
  typeof value === 'boolean' ? value : fallback
)

const validSetIds = (value: unknown, label: string): SetId[] => {
  if (!Array.isArray(value)) return []
  const invalid = value.filter((item) => (
    typeof item !== 'string' || !SET_IDS.includes(item as SetId)
  ))
  if (invalid.length > 0) {
    throw new Error(`${label}: 알 수 없는 세트 ID ${invalid.map(String).join(', ')}`)
  }
  return [...new Set(value as SetId[])]
}

const validCardIds = (value: unknown, label: string): CardId[] => {
  if (!Array.isArray(value)) return []
  const invalid = value.filter((item) => !isCardId(item))
  if (invalid.length > 0) {
    throw new Error(`${label}: 알 수 없는 카드 ID ${invalid.map(String).join(', ')}`)
  }
  return [...new Set(value as CardId[])]
}

const validBotProfiles = (value: unknown, fallback: BotProfileId[]): BotProfileId[] => {
  if (!Array.isArray(value)) return [...fallback]
  const profiles = value.filter((item): item is BotProfileId => (
    typeof item === 'string' && BOT_PROFILES.includes(item as BotProfileId)
  ))
  return profiles.length > 0 ? [...new Set(profiles)] : [...fallback]
}


const validHeuristicProfiles = (
  value: unknown,
  fallback: HeuristicBotProfileId[],
): HeuristicBotProfileId[] => {
  if (!Array.isArray(value)) return [...fallback]
  const profiles = value.filter((item): item is HeuristicBotProfileId => (
    typeof item === 'string'
    && HEURISTIC_BOT_PROFILES.includes(item as HeuristicBotProfileId)
  ))
  return profiles.length > 0 ? [...new Set(profiles)] : [...fallback]
}

export function normalizeMetaSimulationConfig(value: unknown): MetaSimulationConfig {
  const root = asRecord(value)
  const defaults = DEFAULT_META_SIMULATION_CONFIG
  const rawFormatId = root.formatId
  const formatId = isGameFormatId(rawFormatId) ? rawFormatId : defaults.formatId
  const selection = normalizeDeckFormatSelection({
    formatId,
    selectedSetIds: validSetIds(root.selectedSetIds, 'selectedSetIds'),
    draftPool: null,
  })
  const format = getFormat(selection.formatId)

  const rawPool = asRecord(root.cardPool)
  const rawGeneration = asRecord(root.deckGeneration)
  const rawBehavior = asRecord(root.behaviorEvolution)
  const rawMatches = asRecord(root.matches)
  const rawLimits = asRecord(rawMatches.legalActionLimits)
  const rawSeedDecks = Array.isArray(root.seedDecks) ? root.seedDecks : []

  const minUnits = Math.min(
    format.deckSize,
    positiveInteger(rawGeneration.minUnits, defaults.deckGeneration.minUnits, 0),
  )
  const maxUnits = Math.max(
    minUnits,
    Math.min(
      format.deckSize,
      positiveInteger(rawGeneration.maxUnits, defaults.deckGeneration.maxUnits, 0),
    ),
  )
  const populationSize = positiveInteger(
    rawGeneration.populationSize,
    defaults.deckGeneration.populationSize,
    2,
  )
  const eliteCount = Math.min(
    populationSize,
    positiveInteger(rawGeneration.eliteCount, defaults.deckGeneration.eliteCount),
  )
  const behaviorPopulationSize = positiveInteger(
    rawBehavior.populationSize,
    defaults.behaviorEvolution.populationSize,
    2,
  )
  const behaviorEliteCount = Math.min(
    behaviorPopulationSize,
    positiveInteger(rawBehavior.eliteCount, defaults.behaviorEvolution.eliteCount),
  )
  const behaviorSeedProfiles = validHeuristicProfiles(
    rawBehavior.seedProfiles,
    defaults.behaviorEvolution.seedProfiles,
  )

  return {
    seed: typeof root.seed === 'string' && root.seed.trim()
      ? root.seed.trim().slice(0, 160)
      : defaults.seed,
    formatId: selection.formatId,
    selectedSetIds: [...selection.selectedSetIds],
    cardPool: {
      cardIds: validCardIds(rawPool.cardIds, 'cardPool.cardIds'),
      includeSetIds: validSetIds(rawPool.includeSetIds, 'cardPool.includeSetIds'),
      excludeCardIds: validCardIds(rawPool.excludeCardIds, 'cardPool.excludeCardIds'),
    },
    deckGeneration: {
      populationSize,
      generations: positiveInteger(rawGeneration.generations, defaults.deckGeneration.generations),
      eliteCount,
      mutationsPerChild: positiveInteger(
        rawGeneration.mutationsPerChild,
        defaults.deckGeneration.mutationsPerChild,
      ),
      minUnits,
      maxUnits,
      maxAttemptsPerDeck: positiveInteger(
        rawGeneration.maxAttemptsPerDeck,
        defaults.deckGeneration.maxAttemptsPerDeck,
      ),
    },
    behaviorEvolution: {
      enabled: booleanValue(rawBehavior.enabled, defaults.behaviorEvolution.enabled),
      populationSize: behaviorPopulationSize,
      generations: positiveInteger(
        rawBehavior.generations,
        defaults.behaviorEvolution.generations,
      ),
      eliteCount: behaviorEliteCount,
      mutationsPerChild: positiveInteger(
        rawBehavior.mutationsPerChild,
        defaults.behaviorEvolution.mutationsPerChild,
      ),
      mutationScale: finiteNumber(
        rawBehavior.mutationScale,
        defaults.behaviorEvolution.mutationScale,
        0.001,
        0.5,
      ),
      trainingDeckCount: positiveInteger(
        rawBehavior.trainingDeckCount,
        defaults.behaviorEvolution.trainingDeckCount,
        2,
      ),
      gamesPerPairPerDeck: positiveInteger(
        rawBehavior.gamesPerPairPerDeck,
        defaults.behaviorEvolution.gamesPerPairPerDeck,
        2,
      ),
      hallOfFameCount: Math.min(
        behaviorPopulationSize,
        positiveInteger(
          rawBehavior.hallOfFameCount,
          defaults.behaviorEvolution.hallOfFameCount,
          0,
        ),
      ),
      finalBotCount: Math.min(
        behaviorPopulationSize,
        positiveInteger(rawBehavior.finalBotCount, defaults.behaviorEvolution.finalBotCount),
      ),
      drawScore: finiteNumber(
        rawBehavior.drawScore,
        defaults.behaviorEvolution.drawScore,
        0,
        0.5,
      ),
      seedProfiles: behaviorSeedProfiles,
    },
    matches: {
      gamesPerPair: positiveInteger(rawMatches.gamesPerPair, defaults.matches.gamesPerPair, 2),
      botProfiles: validBotProfiles(rawMatches.botProfiles, defaults.matches.botProfiles),
      maxTurns: positiveInteger(rawMatches.maxTurns, defaults.matches.maxTurns, 5),
      maxActions: positiveInteger(rawMatches.maxActions, defaults.matches.maxActions, 20),
      legalActionLimits: {
        maxPaymentVariantsPerCard: positiveInteger(
          rawLimits.maxPaymentVariantsPerCard,
          defaults.matches.legalActionLimits.maxPaymentVariantsPerCard,
        ),
        maxGeneratedActions: positiveInteger(
          rawLimits.maxGeneratedActions,
          defaults.matches.legalActionLimits.maxGeneratedActions,
          20,
        ),
        maxChoiceCombinations: positiveInteger(
          rawLimits.maxChoiceCombinations,
          defaults.matches.legalActionLimits.maxChoiceCombinations,
          10,
        ),
      },
    },
    outputDirectory: typeof root.outputDirectory === 'string' && root.outputDirectory.trim()
      ? root.outputDirectory.trim()
      : defaults.outputDirectory,
    seedDecks: rawSeedDecks.flatMap((item, index) => {
      const record = asRecord(item)
      const cardIds = validCardIds(record.cardIds, `seedDecks[${index}].cardIds`)
      if (cardIds.length === 0) return []
      return [{
        id: typeof record.id === 'string' && record.id.trim()
          ? record.id.trim().slice(0, 80)
          : `seed-${index + 1}`,
        name: typeof record.name === 'string' && record.name.trim()
          ? record.name.trim().slice(0, 80)
          : `입력 덱 ${index + 1}`,
        cardIds,
      }]
    }),
  }
}
