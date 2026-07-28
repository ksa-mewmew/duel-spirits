import { getPublicAssetUrl } from './public-asset-url'

export type CardFrameKey =
  | 'neutral'
  | 'fire'
  | 'water'
  | 'earth'
  | 'light'
  | 'dark'
  | 'multi'

const CARD_FRAME_PATHS: Record<CardFrameKey, string> = {
  neutral: getPublicAssetUrl('ui/card-frames/neutral.png'),
  fire: getPublicAssetUrl('ui/card-frames/fire.png'),
  water: getPublicAssetUrl('ui/card-frames/water.png'),
  earth: getPublicAssetUrl('ui/card-frames/earth.png'),
  light: getPublicAssetUrl('ui/card-frames/light.png'),
  dark: getPublicAssetUrl('ui/card-frames/dark.png'),
  multi: getPublicAssetUrl('ui/card-frames/multi.png'),
}

const SINGLE_ATTRIBUTE_FRAME_KEYS = new Set<CardFrameKey>([
  'fire',
  'water',
  'earth',
  'light',
  'dark',
])

export function getCardFrameSrc(card: {
  attributes: readonly string[]
}): string {
  if (card.attributes.length > 1) {
    return CARD_FRAME_PATHS.multi
  }

  const primaryAttribute = card.attributes[0]

  if (
    primaryAttribute
    && SINGLE_ATTRIBUTE_FRAME_KEYS.has(primaryAttribute as CardFrameKey)
  ) {
    return CARD_FRAME_PATHS[primaryAttribute as CardFrameKey]
  }

  return CARD_FRAME_PATHS.neutral
}
