import { describe, expect, test } from 'vitest'

import {
  createEmptySeatExpiryState,
  getExpiredPlayers,
  getNextAlarmAt,
  pauseTurnClock,
  resumeTurnClock,
  setSeatExpiry,
  startTurnClock,
} from './room-timing'

describe('턴 시계', () => {
  test('180초 제한을 시작한다', () => {
    expect(startTurnClock(180, 1000)).toEqual({
      deadlineAt: 181000,
      pausedRemainingMs: null,
    })
  })

  test('연결이 끊기면 남은 시간을 보존하고 재개한다', () => {
    const started = startTurnClock(180, 1000)
    const paused = pauseTurnClock(started, 61000)
    const resumed = resumeTurnClock(paused, 180, 100000)

    expect(paused).toEqual({
      deadlineAt: null,
      pausedRemainingMs: 120000,
    })

    expect(resumed.deadlineAt).toBe(220000)
  })
})

describe('자리 자동 만료', () => {
  test('만료 시각이 지난 자리만 찾는다', () => {
    let expiries = createEmptySeatExpiryState()
    expiries = setSeatExpiry(expiries, 'P1', 5000)
    expiries = setSeatExpiry(expiries, 'P2', 9000)

    expect(getExpiredPlayers(expiries, 7000)).toEqual(['P1'])
  })

  test('가장 이른 사건을 다음 알람으로 선택한다', () => {
    const expiries = {
      P1: 9000,
      P2: 12000,
    }

    expect(getNextAlarmAt(
      {
        deadlineAt: 7000,
        pausedRemainingMs: null,
      },
      expiries,
    )).toBe(7000)
  })
})
