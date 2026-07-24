const BASE_URL = import.meta.env.BASE_URL

export type CardFrameKey =
  | 'neutral'
  | 'fire'
  | 'water'
  | 'earth'
  | 'light'
  | 'dark'
  | 'multi'

const CARD_FRAME_PATHS: Record<CardFrameKey, string> = {
  neutral: `${BASE_URL}ui/card-frames/neutral.png`,
  fire: `${BASE_URL}ui/card-frames/fire.png`,
  water: `${BASE_URL}ui/card-frames/water.png`,
  earth: `${BASE_URL}ui/card-frames/earth.png`,
  light: `${BASE_URL}ui/card-frames/light.png`,
  dark: `${BASE_URL}ui/card-frames/dark.png`,
  multi: `${BASE_URL}ui/card-frames/multi.png`,
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