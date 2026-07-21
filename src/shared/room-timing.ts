import type { PlayerId } from './types'

export interface SeatExpiryState {
  P1: number | null
  P2: number | null
}

export interface TurnClockState {
  deadlineAt: number | null
  pausedRemainingMs: number | null
}

export function createEmptySeatExpiryState(): SeatExpiryState {
  return {
    P1: null,
    P2: null,
  }
}

export function createStoppedTurnClock(): TurnClockState {
  return {
    deadlineAt: null,
    pausedRemainingMs: null,
  }
}

export function startTurnClock(
  turnLimitSeconds: number | null,
  now: number,
): TurnClockState {
  if (turnLimitSeconds === null) {
    return createStoppedTurnClock()
  }

  return {
    deadlineAt: now + turnLimitSeconds * 1000,
    pausedRemainingMs: null,
  }
}

export function pauseTurnClock(
  clock: TurnClockState,
  now: number,
): TurnClockState {
  if (clock.deadlineAt === null) {
    return clock
  }

  return {
    deadlineAt: null,
    pausedRemainingMs: Math.max(
      0,
      clock.deadlineAt - now,
    ),
  }
}

export function resumeTurnClock(
  clock: TurnClockState,
  turnLimitSeconds: number | null,
  now: number,
): TurnClockState {
  if (turnLimitSeconds === null) {
    return createStoppedTurnClock()
  }

  const remainingMs = clock.pausedRemainingMs
    ?? turnLimitSeconds * 1000

  return {
    deadlineAt: now + Math.max(0, remainingMs),
    pausedRemainingMs: null,
  }
}

export function setSeatExpiry(
  expiries: SeatExpiryState,
  playerId: PlayerId,
  expiresAt: number | null,
): SeatExpiryState {
  return {
    ...expiries,
    [playerId]: expiresAt,
  }
}

export function getExpiredPlayers(
  expiries: SeatExpiryState,
  now: number,
): PlayerId[] {
  const expired: PlayerId[] = []

  if (expiries.P1 !== null && expiries.P1 <= now) {
    expired.push('P1')
  }

  if (expiries.P2 !== null && expiries.P2 <= now) {
    expired.push('P2')
  }

  return expired
}

export function getNextAlarmAt(
  clock: TurnClockState,
  expiries: SeatExpiryState,
): number | null {
  const candidates = [
    clock.deadlineAt,
    expiries.P1,
    expiries.P2,
  ].filter(
    (value): value is number => value !== null,
  )

  if (candidates.length === 0) {
    return null
  }

  return Math.min(...candidates)
}
