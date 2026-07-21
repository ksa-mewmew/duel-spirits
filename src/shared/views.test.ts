import {
  describe,
  expect,
  test,
} from 'vitest'

import { createGame, DECK_SIZE } from './rules'
import {
  countPlayerCardsInView,
  createGameView,
} from './views'

describe('플레이어별 비공개 게임 뷰', () => {
  test('P1에게는 P1 손만 공개한다', () => {
    const game = createGame(() => 0.5)
    const view = createGameView(game, 'P1')

    expect(view.viewer).toBe('P1')
    expect(view.players.P1.isViewer).toBe(true)
    expect(view.players.P2.isViewer).toBe(false)

    expect(view.players.P1.hand).toEqual(
      game.players.P1.hand,
    )

    expect(view.players.P1.handCount).toBe(
      game.players.P1.hand.length,
    )

    expect(view.players.P2.hand).toEqual([])
    expect(view.players.P2.handCount).toBe(
      game.players.P2.hand.length,
    )
  })

  test('상대의 손·덱·라이프 카드 식별자를 전송하지 않는다', () => {
    const game = createGame(() => 0.5)
    const view = createGameView(game, 'P1')
    const serializedView = JSON.stringify(view)

    const opponentHiddenCards = [
      ...game.players.P2.hand,
      ...game.players.P2.deck,
      ...game.players.P2.life,
    ]

    for (const card of opponentHiddenCards) {
      expect(serializedView).not.toContain(
        card.instanceId,
      )
    }
  })

  test('자신의 덱과 라이프 내용도 공개하지 않는다', () => {
    const game = createGame(() => 0.5)
    const view = createGameView(game, 'P1')
    const serializedView = JSON.stringify(view)

    const ownHiddenCards = [
      ...game.players.P1.deck,
      ...game.players.P1.life,
    ]

    for (const card of ownHiddenCards) {
      expect(serializedView).not.toContain(
        card.instanceId,
      )
    }

    for (const card of game.players.P1.hand) {
      expect(serializedView).toContain(
        card.instanceId,
      )
    }
  })

  test('공개 영역과 카드 장수는 양쪽에 동일하게 보인다', () => {
    const game = createGame(() => 0.5)

    const manaCard = game.players.P2.hand.pop()
    const fieldCard = game.players.P2.deck.pop()
    const discardCard = game.players.P2.life.pop()

    if (!manaCard || !fieldCard || !discardCard) {
      throw new Error('테스트 카드를 준비하지 못했습니다.')
    }

    game.players.P2.mana.push({
      ...manaCard,
      exhausted: false,
    })

    game.players.P2.field.push({
      ...fieldCard,
      slotIndex: 2,
      damage: 0,
      exhausted: false,
      summonedThisTurn: false,
      attacksThisTurn: 0,
      temporaryAttackModifier: 0,
      temporaryHealthModifier: 0,
    })

    game.players.P2.discard.push(discardCard)

    const p1View = createGameView(game, 'P1')
    const p2View = createGameView(game, 'P2')

    expect(p1View.players.P2.mana).toEqual(
      p2View.players.P2.mana,
    )

    expect(p1View.players.P2.field).toEqual(
      p2View.players.P2.field,
    )

    expect(p1View.players.P2.discard).toEqual(
      p2View.players.P2.discard,
    )

    expect(
      countPlayerCardsInView(p1View.players.P2),
    ).toBe(DECK_SIZE)

    expect(
      countPlayerCardsInView(p2View.players.P2),
    ).toBe(DECK_SIZE)
  })
})
