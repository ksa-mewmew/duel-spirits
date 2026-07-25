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
    keywords: CardKeyword[] = [],
    visualKey = 'rings',
    families: CardFamilyId[] = [],
    evolutionAttribute?: CardAttributeId,
  ): UnitCard => ({
    id,
    name,
    type: 'unit',
    cost,
    attack,
    health,
    attributes,
    families,
    rulesText,
    keywords,
    visualKey,
    evolutionAttribute,
    ...getMetadata(),
  })

  const spell = (
    id: CardId,
    name: string,
    cost: number,
    attributes: CardAttributeId[],
    rulesText: string,
    visualKey = 'waves',
    families: CardFamilyId[] = [],
  ): SpellCard => ({
    id,
    name,
    type: 'spell',
    cost,
    attributes,
    families,
    rulesText,
    visualKey,
    ...getMetadata(),
  })

  return { unit, spell }
}
