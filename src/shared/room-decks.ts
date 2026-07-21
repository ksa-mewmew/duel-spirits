import type { SubmittedDeck } from './decks'
import type { PlayerId } from './types'

export type SubmittedDecks = Record<PlayerId, SubmittedDeck | null>
export type DeckReadiness = Record<PlayerId, boolean>

export function createEmptySubmittedDecks(): SubmittedDecks {
  return { P1: null, P2: null }
}

export function createEmptyDeckReadiness(): DeckReadiness {
  return { P1: false, P2: false }
}

export function setSubmittedDeck(
  decks: SubmittedDecks,
  playerId: PlayerId,
  deck: SubmittedDeck | null,
): SubmittedDecks {
  return {
    ...decks,
    [playerId]: deck,
  }
}

export function setDeckReady(
  readiness: DeckReadiness,
  playerId: PlayerId,
  ready: boolean,
): DeckReadiness {
  return {
    ...readiness,
    [playerId]: ready,
  }
}

export function canStartMatch(
  decks: SubmittedDecks,
  readiness: DeckReadiness,
): boolean {
  return Boolean(
    decks.P1
    && decks.P2
    && readiness.P1
    && readiness.P2,
  )
}
