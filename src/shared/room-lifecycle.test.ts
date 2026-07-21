import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  areBothPlayersReady,
  createEmptyRematchReadiness,
  getRematchReadyPlayers,
  getRoomPhase,
  setRematchReady,
} from './room-lifecycle'

describe('재대전 준비 상태', () => {
  test('처음에는 아무도 준비하지 않았다', () => {
    const readiness = createEmptyRematchReadiness()

    expect(getRematchReadyPlayers(readiness)).toEqual([])
    expect(areBothPlayersReady(readiness)).toBe(false)
  })

  test('두 플레이어가 모두 동의하면 재대전할 수 있다', () => {
    let readiness = createEmptyRematchReadiness()
    readiness = setRematchReady(readiness, 'P1', true)
    readiness = setRematchReady(readiness, 'P2', true)

    expect(getRematchReadyPlayers(readiness)).toEqual([
      'P1',
      'P2',
    ])
    expect(areBothPlayersReady(readiness)).toBe(true)
  })

  test('재대전 요청을 취소할 수 있다', () => {
    let readiness = createEmptyRematchReadiness()
    readiness = setRematchReady(readiness, 'P1', true)
    readiness = setRematchReady(readiness, 'P1', false)

    expect(getRematchReadyPlayers(readiness)).toEqual([])
  })
})

describe('방 단계', () => {
  test('게임이 없으면 대기 중이다', () => {
    expect(getRoomPhase(null, ['P1'])).toBe('waiting')
  })

  test('진행 중인 게임에서 한 명이 끊기면 일시 중단된다', () => {
    expect(getRoomPhase('playing', ['P1'])).toBe(
      'disconnected',
    )
  })

  test('두 명이 연결된 진행 중 게임은 playing이다', () => {
    expect(getRoomPhase('playing', ['P1', 'P2'])).toBe(
      'playing',
    )
  })

  test('끝난 게임은 접속 수와 관계없이 finished다', () => {
    expect(getRoomPhase('finished', ['P1'])).toBe(
      'finished',
    )
  })
})
