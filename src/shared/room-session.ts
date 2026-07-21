import type { PlayerId } from './types'

export interface SeatReservations {
  P1: string | null
  P2: string | null
}

export function createEmptySeats(): SeatReservations {
  return {
    P1: null,
    P2: null,
  }
}

export function findPlayerBySeatToken(
  seats: SeatReservations,
  seatToken: string,
): PlayerId | null {
  if (seats.P1 === seatToken) {
    return 'P1'
  }

  if (seats.P2 === seatToken) {
    return 'P2'
  }

  return null
}

export function findOpenSeat(
  seats: SeatReservations,
): PlayerId | null {
  if (!seats.P1) {
    return 'P1'
  }

  if (!seats.P2) {
    return 'P2'
  }

  return null
}

export function reserveSeat(
  seats: SeatReservations,
  playerId: PlayerId,
  seatToken: string,
): SeatReservations {
  return {
    ...seats,
    [playerId]: seatToken,
  }
}


export function releaseSeat(
  seats: SeatReservations,
  playerId: PlayerId,
): SeatReservations {
  return {
    ...seats,
    [playerId]: null,
  }
}

export function getReservedPlayers(
  seats: SeatReservations,
): PlayerId[] {
  const players: PlayerId[] = []

  if (seats.P1) {
    players.push('P1')
  }

  if (seats.P2) {
    players.push('P2')
  }

  return players
}
