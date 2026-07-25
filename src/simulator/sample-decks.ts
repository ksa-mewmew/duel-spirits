import { SAMPLE_DECK_LIST } from '../content/sample-decks'
import { normalizeDeckFormatSelection, validateDeck } from '../shared/decks'
import { createBaselineBotContestant } from './bots'
import { runGenerationTournament } from './tournament'

import type { BotProfileId, GenerationReport, MatchSimulationConfig } from './types'

export interface SampleDeckTournamentOptions {
  seed: string
  gamesPerPair: number
  botProfiles: BotProfileId[]
  maxTurns: number
  maxActions: number
}

export const DEFAULT_SAMPLE_DECK_TOURNAMENT_OPTIONS: SampleDeckTournamentOptions = {
  seed: 'duel-spirits-sample-decks',
  gamesPerPair: 12,
  botProfiles: ['aggressive', 'value', 'control'],
  maxTurns: 80,
  maxActions: 500,
}

export function runSampleDeckTournament(
  options: SampleDeckTournamentOptions = DEFAULT_SAMPLE_DECK_TOURNAMENT_OPTIONS,
): GenerationReport {
  const formatIds = new Set(SAMPLE_DECK_LIST.map((deck) => deck.formatId))
  if (formatIds.size !== 1) {
    throw new Error('All sample decks must use the same format.')
  }

  const selection = normalizeDeckFormatSelection({
    formatId: SAMPLE_DECK_LIST[0]!.formatId,
    selectedSetIds: [],
    draftPool: null,
  })
  const decks = SAMPLE_DECK_LIST.map((deck) => {
    const validation = validateDeck(deck.cardIds, selection)
    if (!validation.valid) {
      throw new Error(`${deck.id}: ${validation.errors.join(' ')}`)
    }
    return {
      id: deck.id,
      name: deck.name,
      cardIds: [...deck.cardIds],
      generation: 0,
      parentId: null,
      tags: ['sample'],
      source: 'seed' as const,
    }
  })
  const config: MatchSimulationConfig = {
    gamesPerPair: options.gamesPerPair,
    botProfiles: [...options.botProfiles],
    maxTurns: options.maxTurns,
    maxActions: options.maxActions,
    legalActionLimits: {
      maxPaymentVariantsPerCard: 48,
      maxGeneratedActions: 400,
      maxChoiceCombinations: 160,
    },
  }
  const bots = options.botProfiles.map(createBaselineBotContestant)
  return runGenerationTournament(decks, selection, config, bots, options.seed, 0)
}
