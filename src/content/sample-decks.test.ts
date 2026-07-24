import { describe, expect, it } from 'vitest'

import { CARDS } from './cards'
import { SAMPLE_DECK_LIST } from './sample-decks'
import { validateDeck } from '../shared/decks'

describe('sample decks', () => {
  it('provides three valid 20-card play-style decks', () => {
    expect(SAMPLE_DECK_LIST).toHaveLength(3)
    expect(SAMPLE_DECK_LIST.map((deck) => deck.style)).toEqual(['aggro', 'control', 'cycle'])

    for (const deck of SAMPLE_DECK_LIST) {
      expect(deck.cardIds).toHaveLength(20)
      expect(validateDeck(deck.cardIds, {
        formatId: deck.formatId,
        selectedSetIds: [],
        draftPool: null,
      })).toEqual({ valid: true, errors: [] })
    }
  })

  it('uses at most three copies of each card and exercises the three-copy limit', () => {
    for (const deck of SAMPLE_DECK_LIST) {
      const counts = new Map<string, number>()
      for (const cardId of deck.cardIds) {
        counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
      }
      expect(Math.max(...counts.values())).toBe(3)
    }
  })

  it('mixes attributes and includes cards from both released sets', () => {
    for (const deck of SAMPLE_DECK_LIST) {
      expect(deck.attributes.length).toBeGreaterThan(1)
      const setIds = new Set(deck.cardIds.map((cardId) => CARDS[cardId].setId))
      expect(setIds).toEqual(new Set(['foundations-001', 'evolution-begins-001']))
    }
  })
})
