import { afterEach, describe, expect, test, vi } from 'vitest'
import { SAMPLE_DECK_LIST } from '../content/sample-decks'
import { createDefaultFormatSelection, DECK_SCHEMA_VERSION } from '../shared/decks'
import { createDefaultRoomSettings } from '../shared/room-settings'
import { LocalAiSocket } from './local-ai-socket'

import type { ServerMessage } from '../shared/messages'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LocalAiSocket', () => {
  test('uses the online room message contract to start an AI match', async () => {
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
    })
    const messages: ServerMessage[] = []
    const sample = SAMPLE_DECK_LIST[0]!
    const settings = {
      ...createDefaultRoomSettings(),
      ...createDefaultFormatSelection(sample.formatId),
    }
    const socket = new LocalAiSocket('AI', settings, {
      onMessage: (message) => messages.push(message),
    })
    await Promise.resolve()

    socket.send(JSON.stringify({
      type: 'SUBMIT_DECK',
      deck: {
        schemaVersion: DECK_SCHEMA_VERSION,
        deckId: 'test',
        name: sample.name,
        cardIds: sample.cardIds,
        ...createDefaultFormatSelection(sample.formatId),
      },
    }))
    socket.send(JSON.stringify({ type: 'SET_DECK_READY', ready: true }))

    expect(messages.some((message) => message.type === 'ASSIGNED_PLAYER')).toBe(true)
    expect(messages.some((message) => message.type === 'DECK_ACCEPTED')).toBe(true)
    expect(messages.some((message) => message.type === 'GAME_VIEW')).toBe(true)
    socket.close()
  })

  test('uses the requested sample deck as the AI opponent', async () => {
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
    })
    const messages: ServerMessage[] = []
    const localDeck = SAMPLE_DECK_LIST[0]!
    const opponentDeck = SAMPLE_DECK_LIST[1]!
    const settings = {
      ...createDefaultRoomSettings(),
      ...createDefaultFormatSelection(localDeck.formatId),
    }
    const socket = new LocalAiSocket('AI', settings, {
      onMessage: (message) => messages.push(message),
    }, opponentDeck.id)
    await Promise.resolve()

    socket.send(JSON.stringify({
      type: 'SUBMIT_DECK',
      deck: {
        schemaVersion: DECK_SCHEMA_VERSION,
        deckId: 'test',
        name: localDeck.name,
        cardIds: localDeck.cardIds,
        ...createDefaultFormatSelection(localDeck.formatId),
      },
    }))
    socket.send(JSON.stringify({ type: 'SET_DECK_READY', ready: true }))

    expect(messages.some((message) => (
      message.type === 'ROOM_STATE'
      && message.deckStates.P2.name === `AI · ${opponentDeck.name}`
    ))).toBe(true)
    socket.close()
  })
})
