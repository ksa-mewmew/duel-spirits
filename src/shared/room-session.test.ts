import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  createEmptySeats,
  findOpenSeat,
  findPlayerBySeatToken,
  getReservedPlayers,
  releaseSeat,
  reserveSeat,
} from './room-session'

describe('방 자리 예약', () => {
  test('빈 방에서는 P1이 먼저 배정된다', () => {
    const seats = createEmptySeats()

    expect(findOpenSeat(seats)).toBe('P1')
  })

  test('P1이 예약되면 다음 자리는 P2다', () => {
    const seats = reserveSeat(
      createEmptySeats(),
      'P1',
      'p1-token',
    )

    expect(findOpenSeat(seats)).toBe('P2')
    expect(getReservedPlayers(seats)).toEqual(['P1'])
  })

  test('두 자리가 예약되면 새 참가자는 들어올 수 없다', () => {
    let seats = createEmptySeats()
    seats = reserveSeat(seats, 'P1', 'p1-token')
    seats = reserveSeat(seats, 'P2', 'p2-token')

    expect(findOpenSeat(seats)).toBeNull()
    expect(getReservedPlayers(seats)).toEqual([
      'P1',
      'P2',
    ])
  })

  test('자리 토큰으로 기존 플레이어를 찾는다', () => {
    let seats = createEmptySeats()
    seats = reserveSeat(seats, 'P1', 'p1-token')
    seats = reserveSeat(seats, 'P2', 'p2-token')

    expect(
      findPlayerBySeatToken(seats, 'p1-token'),
    ).toBe('P1')

    expect(
      findPlayerBySeatToken(seats, 'p2-token'),
    ).toBe('P2')

    expect(
      findPlayerBySeatToken(seats, 'unknown-token'),
    ).toBeNull()
  })

  test('플레이어가 나가면 해당 자리만 비워진다', () => {
    let seats = createEmptySeats()
    seats = reserveSeat(seats, 'P1', 'p1-token')
    seats = reserveSeat(seats, 'P2', 'p2-token')
    seats = releaseSeat(seats, 'P2')

    expect(getReservedPlayers(seats)).toEqual(['P1'])
    expect(findOpenSeat(seats)).toBe('P2')
    expect(
      findPlayerBySeatToken(seats, 'p2-token'),
    ).toBeNull()
  })

})
