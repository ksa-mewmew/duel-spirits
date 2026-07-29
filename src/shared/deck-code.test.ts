import { describe, expect, test } from 'vitest'
import { SAMPLE_DECK_LIST } from '../content/sample-decks'
import { DECK_SCHEMA_VERSION } from './decks'
import { exportDeckCode, importDeckCode } from './deck-code'
import type { SavedDeck } from './decks'

describe('deck codes', () => {
  test('round trips a portable deck without retaining its local id', () => {
    const sample = SAMPLE_DECK_LIST[0]!
    const source: SavedDeck = {
      schemaVersion: DECK_SCHEMA_VERSION,
      id: 'private-local-id',
      name: sample.name,
      cardIds: [...sample.cardIds],
      formatId: sample.formatId,
      selectedSetIds: [],
      draftPool: null,
      createdAt: 1,
      updatedAt: 1,
    }
    const imported = importDeckCode(exportDeckCode(source), 123)
    expect(imported.cardIds).toEqual(source.cardIds)
    expect(imported.name).toBe(source.name)
    expect(imported.id).not.toBe(source.id)
    expect(imported.createdAt).toBe(123)
  })

  test('rejects unrelated text', () => {
    expect(() => importDeckCode('not-a-deck')).toThrow('덱 코드')
  })
})
