const BASE_URL = import.meta.env.BASE_URL

export type FrameKey =
  | 'neutral'
  | 'fire'
  | 'water'
  | 'earth'
  | 'light'
  | 'dark'
  | 'multi'

export const CARD_FRAME_PATHS: Record<FrameKey, string> = {
  neutral: `${BASE_URL}ui/card-frames/neutral.png`,
  fire: `${BASE_URL}ui/card-frames/fire.png`,
  water: `${BASE_URL}ui/card-frames/water.png`,
  earth: `${BASE_URL}ui/card-frames/earth.png`,
  light: `${BASE_URL}ui/card-frames/light.png`,
  dark: `${BASE_URL}ui/card-frames/dark.png`,
  multi: `${BASE_URL}ui/card-frames/multi.png`,
}

function normalizeAttribute(value: string | null | undefined): FrameKey | null {
  if (!value) return null

  const v = value.trim().toLowerCase()

  if (v === '불' || v === 'fire') return 'fire'
  if (v === '물' || v === 'water') return 'water'
  if (v === '땅' || v === 'earth') return 'earth'
  if (v === '빛' || v === 'light') return 'light'
  if (v === '어둠' || v === 'dark') return 'dark'

  if (
    v === '다속성' ||
    v === 'multi' ||
    v === 'multicolor' ||
    v === 'rainbow'
  ) {
    return 'multi'
  }

  return null
}

/**
 * CardDefinition의 실제 구조가
 * - attribute: string
 * 또는
 * - attributes: string[]
 * 둘 중 어느 쪽이어도 동작하도록 만든 함수
 */
export function getCardFrameKey(card: {
  attribute?: string | null
  attributes?: string[] | null
}): FrameKey {
  const attrs = Array.isArray(card.attributes)
    ? card.attributes.filter(Boolean)
    : []

  if (attrs.length >= 2) {
    return 'multi'
  }

  if (attrs.length === 1) {
    return normalizeAttribute(attrs[0]) ?? 'neutral'
  }

  const single = normalizeAttribute(card.attribute)
  if (single) return single

  return 'neutral'
}

export function getCardFrameSrc(card: {
  attribute?: string | null
  attributes?: string[] | null
}): string {
  return CARD_FRAME_PATHS[getCardFrameKey(card)]
}
