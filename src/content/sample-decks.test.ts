import { describe, expect, it } from 'vitest'

import { SAMPLE_DECK_LIST } from './sample-decks'
import { validateDeck } from '../shared/decks'

describe('sample decks', () => {
  it('provides five valid 20-card decks', () => {
    expect(SAMPLE_DECK_LIST).toHaveLength(5)

    for (const deck of SAMPLE_DECK_LIST) {
      expect(deck.cardIds).toHaveLength(20)
      expect(validateDeck(deck.cardIds, {
        formatId: deck.formatId,
        selectedSetIds: [],
        draftPool: null,
      })).toEqual({ valid: true, errors: [] })
    }
  })

  it('uses at most two copies of each card', () => {
    for (const deck of SAMPLE_DECK_LIST) {
      const counts = new Map<string, number>()
      for (const cardId of deck.cardIds) {
        counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
      }
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2)
    }
  })
})
