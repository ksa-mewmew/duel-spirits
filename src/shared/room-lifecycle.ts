import type {
  GameStatus,
  PlayerId,
} from './types'

export type RoomPhase =
  | 'waiting'
  | 'playing'
  | 'disconnected'
  | 'finished'

export interface RematchReadiness {
  P1: boolean
  P2: boolean
}

export function createEmptyRematchReadiness(): RematchReadiness {
  return {
    P1: false,
    P2: false,
  }
}

export function setRematchReady(
  readiness: RematchReadiness,
  playerId: PlayerId,
  ready: boolean,
): RematchReadiness {
  return {
    ...readiness,
    [playerId]: ready,
  }
}

export function getRematchReadyPlayers(
  readiness: RematchReadiness,
): PlayerId[] {
  const players: PlayerId[] = []

  if (readiness.P1) {
    players.push('P1')
  }

  if (readiness.P2) {
    players.push('P2')
  }

  return players
}

export function areBothPlayersReady(
  readiness: RematchReadiness,
): boolean {
  return readiness.P1 && readiness.P2
}

export function getRoomPhase(
  gameStatus: GameStatus | null,
  connectedPlayers: PlayerId[],
): RoomPhase {
  if (!gameStatus) {
    return 'waiting'
  }

  if (gameStatus === 'finished') {
    return 'finished'
  }

  if (connectedPlayers.length < 2) {
    return 'disconnected'
  }

  return 'playing'
}
