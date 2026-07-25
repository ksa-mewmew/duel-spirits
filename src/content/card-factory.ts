import { CARD_SETS, CONTENT_VERSION } from './sets'

import type {
  CardAttributeId,
  CardFamilyId,
  CardId,
  CardKeyword,
  SpellCard,
  UnitCard,
} from './cards'
import type { SetId } from './schema'

export interface UnitCardOptions {
  keywords?: CardKeyword[]
  visualKey?: string
  families?: CardFamilyId[]
  evolutionAttribute?: CardAttributeId
  flavorText?: string
}

export interface SpellCardOptions {
  visualKey?: string
  families?: CardFamilyId[]
  flavorText?: string
}

export function createCardFactory(setId: SetId) {
  let collectorIndex = 0

  const getMetadata = () => {
    collectorIndex += 1
    return {
      setId,
      collectorNumber: `${CARD_SETS[setId].code}-${String(collectorIndex).padStart(3, '0')}`,
      contentVersion: CONTENT_VERSION,
    }
  }

  const unit = (
    id: CardId,
    name: string,
    cost: number,
    attack: number,
    health: number,
    attributes: CardAttributeId[],
    rulesText = '',
    options: UnitCardOptions = {},
  ): UnitCard => {
    return {
      id,
      name,
      type: 'unit',
      cost,
      attack,
      health,
      attributes,
      families: options.families ?? [],
      rulesText,
      flavorText: options.flavorText ?? '',
      keywords: options.keywords ?? [],
      visualKey: options.visualKey ?? 'rings',
      evolutionAttribute: options.evolutionAttribute,
      ...getMetadata(),
    }
  }

  const spell = (
    id: CardId,
    name: string,
    cost: number,
    attributes: CardAttributeId[],
    rulesText: string,
    options: SpellCardOptions = {},
  ): SpellCard => {
    return {
      id,
      name,
      type: 'spell',
      cost,
      attributes,
      families: options.families ?? [],
      rulesText,
      flavorText: options.flavorText ?? '',
      visualKey: options.visualKey ?? 'waves',
      ...getMetadata(),
    }
  }

  return { unit, spell }
}
