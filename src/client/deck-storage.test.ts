import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { SAMPLE_DECK_LIST } from '../content/sample-decks'
import { DECK_SCHEMA_VERSION } from '../shared/decks'
import { getActiveDeckId, loadDecks } from './deck-storage'

function createLocalStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => { values.clear() },
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: createLocalStorage() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('견본 덱 저장 동기화', () => {
  test('기존 일식 견본 덱을 성령의 계율로 교체하고 사용자 덱은 보존한다', () => {
    const source = SAMPLE_DECK_LIST[0]!
    window.localStorage.setItem('card-duel:decks:v1', JSON.stringify([
      {
        schemaVersion: DECK_SCHEMA_VERSION,
        id: 'sample-eclipse-omen',
        name: '일식의 징조',
        cardIds: source.cardIds,
        formatId: source.formatId,
        selectedSetIds: [],
        draftPool: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        schemaVersion: DECK_SCHEMA_VERSION,
        id: 'my-deck',
        name: '내 덱',
        cardIds: source.cardIds,
        formatId: source.formatId,
        selectedSetIds: [],
        draftPool: null,
        createdAt: 2,
        updatedAt: 2,
      },
    ]))
    window.localStorage.setItem('card-duel:active-deck:v1', 'sample-eclipse-omen')

    const decks = loadDecks()
    const spiritDeck = SAMPLE_DECK_LIST.find((deck) => deck.id === 'spirit-discipline')!

    expect(decks.some((deck) => deck.id === 'sample-eclipse-omen')).toBe(false)
    expect(decks.find((deck) => deck.id === 'sample-spirit-discipline')).toMatchObject({
      name: '성령의 계율',
      cardIds: [...spiritDeck.cardIds],
    })
    expect(decks.some((deck) => deck.id === 'my-deck')).toBe(true)
    expect(getActiveDeckId()).toBe('sample-spirit-discipline')
  })
})
