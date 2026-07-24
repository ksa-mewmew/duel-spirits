import type { CardId } from './cards'
import type { DraftPool } from '../content/schema'
import type { PlayerId } from './types'

export interface RoomDraftState {
  pools: Record<PlayerId, DraftPool<CardId>>
  selectedIndices: Record<PlayerId, number[]>
  confirmed: Record<PlayerId, boolean>
  deadlineAt: number
}

export interface DraftPlayerView {
  pool: DraftPool<CardId>
  selectedIndices: number[]
  confirmed: boolean
  opponentSelectedCount: number
  opponentConfirmed: boolean
  deadlineAt: number
  poolSize: number
  deckSize: number
}

export function createRoomDraftState(
  pools: Record<PlayerId, DraftPool<CardId>>,
  timeLimitSeconds: number,
  now: number,
): RoomDraftState {
  return {
    pools: structuredClone(pools),
    selectedIndices: { P1: [], P2: [] },
    confirmed: { P1: false, P2: false },
    deadlineAt: now + timeLimitSeconds * 1000,
  }
}

export function normalizeDraftIndices(
  indices: readonly number[],
  poolSize: number,
  deckSize: number,
): number[] {
  if (indices.length > deckSize) {
    throw new Error(`드래프트 카드는 ${deckSize}장까지만 선택할 수 있습니다.`)
  }

  const unique = [...new Set(indices)]
  if (
    unique.length !== indices.length
    || unique.some((index) => !Number.isInteger(index) || index < 0 || index >= poolSize)
  ) {
    throw new Error('올바르지 않은 드래프트 카드 선택입니다.')
  }
  return unique
}

export function setDraftSelection(
  draft: RoomDraftState,
  playerId: PlayerId,
  indices: readonly number[],
  deckSize: number,
): RoomDraftState {
  if (draft.confirmed[playerId]) {
    throw new Error('이미 확정한 드래프트 덱은 바꿀 수 없습니다.')
  }

  return {
    ...draft,
    selectedIndices: {
      ...draft.selectedIndices,
      [playerId]: normalizeDraftIndices(
        indices,
        draft.pools[playerId].cardIds.length,
        deckSize,
      ),
    },
  }
}

export function confirmDraftSelection(
  draft: RoomDraftState,
  playerId: PlayerId,
  deckSize: number,
): RoomDraftState {
  if (draft.selectedIndices[playerId].length !== deckSize) {
    throw new Error(`드래프트 덱 ${deckSize}장을 모두 선택해야 합니다.`)
  }
  return {
    ...draft,
    confirmed: {
      ...draft.confirmed,
      [playerId]: true,
    },
  }
}

export function autoCompleteDraftSelection(
  pool: DraftPool<CardId>,
  selectedIndices: readonly number[],
  deckSize: number,
  maxCopiesPerCard: number,
): number[] {
  const result = normalizeDraftIndices(
    selectedIndices,
    pool.cardIds.length,
    deckSize,
  )
  const selected = new Set(result)
  const counts = new Map<CardId, number>()
  for (const index of result) {
    const cardId = pool.cardIds[index]
    if (cardId) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  }

  for (let index = 0; index < pool.cardIds.length && result.length < deckSize; index += 1) {
    if (selected.has(index)) continue
    const cardId = pool.cardIds[index]
    if (!cardId || (counts.get(cardId) ?? 0) >= maxCopiesPerCard) continue
    selected.add(index)
    result.push(index)
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  }

  if (result.length !== deckSize) {
    throw new Error('드래프트 풀에서 유효한 덱을 자동 완성할 수 없습니다.')
  }
  return result
}

export function areBothDraftsConfirmed(draft: RoomDraftState): boolean {
  return draft.confirmed.P1 && draft.confirmed.P2
}

export function createDraftPlayerView(
  draft: RoomDraftState,
  playerId: PlayerId,
  deckSize: number,
): DraftPlayerView {
  const opponentId: PlayerId = playerId === 'P1' ? 'P2' : 'P1'
  return {
    pool: structuredClone(draft.pools[playerId]),
    selectedIndices: [...draft.selectedIndices[playerId]],
    confirmed: draft.confirmed[playerId],
    opponentSelectedCount: draft.selectedIndices[opponentId].length,
    opponentConfirmed: draft.confirmed[opponentId],
    deadlineAt: draft.deadlineAt,
    poolSize: draft.pools[playerId].cardIds.length,
    deckSize,
  }
}
