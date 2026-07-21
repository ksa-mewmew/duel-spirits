import type { GameAction } from './actions'
import type { SubmittedDeck } from './decks'
import type { RoomPhase } from './room-lifecycle'
import type { RoomSettings } from './room-settings'
import type { SeatExpiryState } from './room-timing'
import type { PlayerId } from './types'
import type { GameView } from './views'

export interface PublicDeckState {
  submitted: boolean
  ready: boolean
  name: string | null
}

export type PublicDeckStates = Record<PlayerId, PublicDeckState>

export type ClientMessage =
  | {
      type: 'PLAYER_ACTION'
      action: GameAction
    }
  | {
      type: 'SUBMIT_DECK'
      deck: SubmittedDeck
    }
  | {
      type: 'SET_DECK_READY'
      ready: boolean
    }
  | {
      type: 'SET_REMATCH_READY'
      ready: boolean
    }
  | {
      type: 'LEAVE_ROOM'
    }

export type JoinRejectReason =
  | 'INVALID_ROOM_KEY'
  | 'INVALID_SEAT_TOKEN'
  | 'ROOM_FULL'
  | 'MISSING_ROOM_KEY'

export type ServerMessage =
  | {
      type: 'ASSIGNED_PLAYER'
      roomId: string
      playerId: PlayerId
      seatToken: string
      reconnected: boolean
    }
  | {
      type: 'ROOM_STATE'
      phase: RoomPhase
      connectedPlayers: PlayerId[]
      reservedPlayers: PlayerId[]
      rematchReadyPlayers: PlayerId[]
      deckStates: PublicDeckStates
      settings: RoomSettings
      turnDeadlineAt: number | null
      seatExpiresAt: SeatExpiryState
    }
  | {
      type: 'JOIN_REJECTED'
      reason: JoinRejectReason
      message: string
    }
  | {
      type: 'GAME_VIEW'
      game: GameView
    }
  | {
      type: 'ACTION_ERROR'
      message: string
    }
  | {
      type: 'DECK_ACCEPTED'
      deckId: string
      deckName: string
    }
  | {
      type: 'TURN_TIMED_OUT'
      playerId: PlayerId
    }
  | {
      type: 'SEAT_EXPIRED'
      playerId: PlayerId
    }
  | {
      type: 'LEFT_ROOM'
    }
  | {
      type: 'GAME_CLEARED'
    }
