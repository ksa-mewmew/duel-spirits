import { CONTENT_VERSION, RULES_VERSION } from '../content/sets'
import { DEFAULT_FORMAT_ID, getFormat } from '../content/formats'
import { createRandomSeed } from './random'

import type { GameFormatId, SetId } from '../content/schema'

export interface MatchConfig {
  mode: 'pvp' | 'campaign'
  formatId: GameFormatId
  selectedSetIds: SetId[]
  scenarioId?: string
  rulesVersion: string
  contentVersion: string
  randomSeed: string
  createdAt: number
}

export interface CreateMatchConfigOptions {
  formatId?: GameFormatId
  selectedSetIds?: SetId[]
  scenarioId?: string
  randomSeed?: string
  createdAt?: number
}

export function createMatchConfig(
  options: CreateMatchConfigOptions = {},
): MatchConfig {
  const format = getFormat(options.formatId ?? DEFAULT_FORMAT_ID)
  const selectedSetIds = format.cardPool.type === 'selected-sets'
    ? options.selectedSetIds?.length
      ? [...options.selectedSetIds]
      : [...format.cardPool.defaultSetIds]
    : options.selectedSetIds
      ? [...options.selectedSetIds]
      : []

  return {
    mode: format.mode,
    formatId: format.id,
    selectedSetIds,
    scenarioId: options.scenarioId ?? format.scenarioId,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    randomSeed: options.randomSeed ?? createRandomSeed(),
    createdAt: options.createdAt ?? Date.now(),
  }
}
