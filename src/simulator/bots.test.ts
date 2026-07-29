import { describe, expect, test } from 'vitest'

import { createGame } from '../shared/rules'
import { createGameView } from '../shared/views'
import { enumerateLegalActions } from './legal-actions'
import { getBotPolicy } from './bots'

describe('AI 행동 순서', () => {
  test('공격 가능한 진화 재료는 유리한 교환 공격을 먼저 한다', () => {
    const game = createGame({ random: () => 0.5, startingPlayer: 'P1' })
    game.players.P1.hand = [{
      instanceId: 'evolution',
      cardId: 'flame_mane_captain',
      ownerId: 'P1',
      controllerId: 'P1',
    }]
    game.players.P1.mana = Array.from({ length: 3 }, (_, index) => ({
      instanceId: `mana-${index}`,
      cardId: 'living_flame' as const,
      exhausted: false,
      ownerId: 'P1' as const,
      controllerId: 'P1' as const,
    }))
    game.players.P1.field = [{
      instanceId: 'base',
      cardId: 'living_smoke',
      ownerId: 'P1',
      controllerId: 'P1',
      slotIndex: 0,
      battlefieldEntrySeq: 1,
      damage: 0,
      exhausted: false,
      summonedThisTurn: false,
      attacksThisTurn: 0,
      temporaryAttackModifier: 0,
      temporaryHealthModifier: 0,
    }]
    game.players.P1.manaPlacedThisTurn = true
    game.players.P2.field = [{
      instanceId: 'target',
      cardId: 'tree_fairy',
      ownerId: 'P2',
      controllerId: 'P2',
      slotIndex: 0,
      battlefieldEntrySeq: 2,
      damage: 0,
      exhausted: true,
      summonedThisTurn: false,
      attacksThisTurn: 0,
      temporaryAttackModifier: 0,
      temporaryHealthModifier: 0,
    }]

    const options = enumerateLegalActions(game, 'P1')
    const action = getBotPolicy('value').chooseAction({
      actor: 'P1',
      view: createGameView(game, 'P1'),
      legalActions: options.map((option) => option.action),
      legalOptions: options.map((option) => ({
        action: option.action,
        nextView: createGameView(option.nextState, 'P1'),
      })),
      deckCardIds: ['living_smoke', 'flame_mane_captain'],
      random: () => 0,
    })

    expect(action).toMatchObject({
      type: 'ATTACK_UNIT',
      attackerId: 'base',
      defenderId: 'target',
    })
  })
})
