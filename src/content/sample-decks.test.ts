import { describe, expect, it } from 'vitest'

import { CARDS } from './cards'
import { SAMPLE_DECK_LIST } from './sample-decks'
import { validateDeck } from '../shared/decks'

describe('sample decks', () => {
  it('provides five valid 20-card sample decks', () => {
    expect(SAMPLE_DECK_LIST).toHaveLength(5)
    expect(SAMPLE_DECK_LIST.map((deck) => deck.name)).toEqual([
      '잿더미의 산맥',
      '수정 해일',
      '움직이는 대지',
      '장송 행렬',
      '예언의 정원',
    ])

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

  it('declares every represented attribute and includes cards from both released sets', () => {
    for (const deck of SAMPLE_DECK_LIST) {
      const representedAttributes = new Set(
        deck.cardIds.flatMap((cardId) => CARDS[cardId].attributes),
      )
      expect(new Set(deck.attributes)).toEqual(representedAttributes)
      const setIds = new Set(deck.cardIds.map((cardId) => CARDS[cardId].setId))
      expect(setIds).toEqual(new Set(['foundations-001', 'evolution-begins-001']))
    }
  })

  it('provides actionable mana and keep guidance for every deck', () => {
    for (const deck of SAMPLE_DECK_LIST) {
      expect(deck.manaPriorityCards.length).toBeGreaterThanOrEqual(5)
      expect(deck.keepCards.length).toBeGreaterThanOrEqual(5)
      expect(deck.manaGuide.length).toBeGreaterThan(20)
    }
  })
})
