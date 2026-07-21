import { describe, expect, test } from 'vitest'

import { DEFAULT_DECK } from './cards'
import {
  canStartMatch,
  createEmptyDeckReadiness,
  createEmptySubmittedDecks,
  setDeckReady,
  setSubmittedDeck,
} from './room-decks'

describe('방 덱 준비', () => {
  test('두 덱과 두 준비 상태가 있어야 시작한다', () => {
    let decks = createEmptySubmittedDecks()
    let ready = createEmptyDeckReadiness()
    const submitted = {
      deckId: 'test',
      name: '테스트',
      cardIds: [...DEFAULT_DECK],
    }

    decks = setSubmittedDeck(decks, 'P1', submitted)
    decks = setSubmittedDeck(decks, 'P2', submitted)
    ready = setDeckReady(ready, 'P1', true)

    expect(canStartMatch(decks, ready)).toBe(false)

    ready = setDeckReady(ready, 'P2', true)
    expect(canStartMatch(decks, ready)).toBe(true)
  })
})
