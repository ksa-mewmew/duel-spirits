import { ALL_CARD_IDS, CARDS } from './cards'
import { CARD_SETS } from '../content/sets'

import type { CardId } from './cards'
import type { SetId } from '../content/schema'

export interface CardAccessContext {
  playerId?: string
  campaignUnlocks?: CardId[]
}

export interface CardAccessPolicy {
  id: string
  canUseCard(cardId: CardId, quantity: number, context?: CardAccessContext): boolean
  getAvailableCardIds(context?: CardAccessContext): CardId[]
}

export class AllCardsUnlockedPolicy implements CardAccessPolicy {
  readonly id = 'all-unlocked'

  canUseCard(): boolean {
    return true
  }

  getAvailableCardIds(): CardId[] {
    return [...ALL_CARD_IDS]
  }
}

export class OwnedSetPolicy implements CardAccessPolicy {
  readonly id = 'owned-sets'
  private readonly ownedSetIds: readonly SetId[]

  constructor(ownedSetIds: readonly SetId[]) {
    this.ownedSetIds = ownedSetIds
  }

  canUseCard(cardId: CardId, _quantity: number): boolean {
    return this.ownedSetIds.includes(CARDS[cardId].setId)
  }

  getAvailableCardIds(): CardId[] {
    return ALL_CARD_IDS.filter((cardId) => this.canUseCard(cardId, 1))
  }
}

export class CampaignUnlockPolicy implements CardAccessPolicy {
  readonly id = 'campaign-unlocks'

  canUseCard(cardId: CardId, _quantity: number, context?: CardAccessContext): boolean {
    return context?.campaignUnlocks?.includes(cardId) ?? false
  }

  getAvailableCardIds(context?: CardAccessContext): CardId[] {
    return ALL_CARD_IDS.filter((cardId) => this.canUseCard(cardId, 1, context))
  }
}

export interface CollectionEntry {
  cardId: CardId
  quantity: number
  variantIds: string[]
}

export class CollectionQuantityPolicy implements CardAccessPolicy {
  readonly id = 'collection-quantity'
  private readonly quantities: Map<CardId, number>

  constructor(entries: readonly CollectionEntry[]) {
    this.quantities = new Map(entries.map((entry) => [entry.cardId, entry.quantity]))
  }

  canUseCard(cardId: CardId, quantity: number): boolean {
    return (this.quantities.get(cardId) ?? 0) >= quantity
  }

  getAvailableCardIds(): CardId[] {
    return ALL_CARD_IDS.filter((cardId) => (this.quantities.get(cardId) ?? 0) > 0)
  }
}

export const CURRENT_CARD_ACCESS_POLICY: CardAccessPolicy = new AllCardsUnlockedPolicy()

export const DEFAULT_PLAYER_ENTITLEMENTS = {
  ownedSetIds: Object.values(CARD_SETS)
    .filter((set) => set.unlockedByDefault)
    .map((set) => set.id),
} as const
