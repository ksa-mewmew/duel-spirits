import { CARDS, isCardId } from '../shared/cards'
import { getFormatCardPool, normalizeDeckFormatSelection } from '../shared/decks'

import type { CardId } from '../shared/cards'
import type { DeckFormatSelection } from '../content/schema'
import type { CardPoolConfig } from './types'

export function resolveCardPool(
  selection: DeckFormatSelection<CardId>,
  config: CardPoolConfig,
): CardId[] {
  const normalized = normalizeDeckFormatSelection(selection)
  const formatPool = new Set(getFormatCardPool(normalized))
  const explicit = config.cardIds?.length ? config.cardIds : [...formatPool]
  const includeSets = new Set(config.includeSetIds ?? [])
  const excluded = new Set(config.excludeCardIds ?? [])

  return [...new Set(explicit)]
    .filter(isCardId)
    .filter((cardId) => formatPool.has(cardId))
    .filter((cardId) => includeSets.size === 0 || includeSets.has(CARDS[cardId].setId))
    .filter((cardId) => !excluded.has(cardId))
}
