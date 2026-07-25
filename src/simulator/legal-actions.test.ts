import { describe, expect, test } from 'vitest'

import { createGame } from '../shared/rules'
import { enumerateLegalActions } from './legal-actions'

describe('시뮬레이터 합법 행동 열거', () => {
  test('솟아나는 대지는 지불하지 않은 각 마나를 소환 대상으로 검토한다', () => {
    const game = createGame({ random: () => 0.5, startingPlayer: 'P1' })
    game.players.P1.hand = [{
      instanceId: 'rising',
      cardId: 'rising_earth',
      ownerId: 'P1',
      controllerId: 'P1',
    }]
    game.players.P1.mana = Array.from({ length: 6 }, (_, index) => ({
      instanceId: `earth-${index}`,
      cardId: 'seeding_fairy' as const,
      exhausted: false,
      ownerId: 'P1' as const,
      controllerId: 'P1' as const,
    }))
    game.players.P1.field = []

    const actions = enumerateLegalActions(game)
      .map((option) => option.action)
      .filter((action) => (
        action.type === 'PLAY_CARD'
        && action.cardInstanceId === 'rising'
        && action.selection?.effectManaId
      ))

    expect(new Set(actions.map((action) => (
      action.type === 'PLAY_CARD' ? action.selection?.effectManaId : undefined
    )))).toEqual(new Set([
      'earth-0',
      'earth-1',
      'earth-2',
      'earth-3',
      'earth-4',
      'earth-5',
    ]))
  })
})
