import { describe, expect, test } from 'vitest'

import type { DraftPool } from '../content/schema'
import type { CardId } from './cards'
import {
  areBothDraftsConfirmed,
  autoCompleteDraftSelection,
  confirmDraftSelection,
  createRoomDraftState,
  setDraftSelection,
} from './room-draft'

function pool(cardIds: CardId[]): DraftPool<CardId> {
  return { id: 'pool', seed: 'seed', cardIds, createdAt: 1 }
}

describe('서버 권위 드래프트', () => {
  test('두 풀과 공통 마감 시각으로 시작한다', () => {
    const draft = createRoomDraftState({
      P1: pool(['last_ember']),
      P2: pool(['living_smoke']),
    }, 300, 1_000)

    expect(draft.deadlineAt).toBe(301_000)
    expect(draft.selectedIndices).toEqual({ P1: [], P2: [] })
  })

  test('선택 수와 인덱스를 검증하고 확정한다', () => {
    const cards = Array.from({ length: 20 }, () => 'last_ember' as const)
    let draft = createRoomDraftState({
      P1: pool(cards),
      P2: pool(cards),
    }, 300, 0)
    draft = setDraftSelection(draft, 'P1', [...cards.keys()], 20)
    draft = confirmDraftSelection(draft, 'P1', 20)

    expect(draft.confirmed.P1).toBe(true)
    expect(areBothDraftsConfirmed(draft)).toBe(false)
    expect(() => setDraftSelection(draft, 'P1', [], 20)).toThrow()
  })

  test('시간 종료 시 중복 제한을 지키며 부족한 카드를 채운다', () => {
    const cards: CardId[] = [
      'last_ember', 'last_ember', 'last_ember', 'last_ember',
      'living_smoke', 'living_smoke', 'living_smoke',
      'iron_horn_boar', 'iron_horn_boar', 'iron_horn_boar',
    ]
    const completed = autoCompleteDraftSelection(pool(cards), [0], 6, 3)

    expect(completed).toHaveLength(6)
    expect(completed).not.toContain(3)
  })
})
