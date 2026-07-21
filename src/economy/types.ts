import type { CardId } from '../shared/cards'
import type { SetId } from '../content/schema'

export interface PlayerEntitlements {
  playerId: string
  ownedSetIds: SetId[]
}

export interface CollectionEntry {
  playerId: string
  cardId: CardId
  quantity: number
  variantIds: string[]
}

export type InventoryChange =
  | { itemType: 'card'; itemId: CardId; amount: number }
  | { itemType: 'set'; itemId: SetId; amount: number }
  | { itemType: 'currency'; itemId: string; amount: number }

export interface InventoryTransaction {
  id: string
  playerId: string
  reason: string
  changes: InventoryChange[]
  createdAt: number
  idempotencyKey: string
}

export interface ProductSet {
  id: string
  name: string
  setIds: SetId[]
  cardIds: CardId[]
}
