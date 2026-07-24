import type { CardId } from '../shared/cards'

export interface CardArtPresentation {
  /** public/card-art 아래에서 사용할 파일명입니다. 기본값은 `<card id>.webp`입니다. */
  fileName?: string
  /** CSS background-position 형식의 초점 위치입니다. */
  position?: string
  /** 카드 내부에서 그림을 확대할 배율입니다. */
  scale?: number
}

/**
 * 카드 일러스트는 `public/card-art/<card id>.webp`에 넣으면 자동으로 연결됩니다.
 * 특정 카드만 구도 조정이 필요할 때 이 표에 값을 추가하세요.
 */
export const CARD_ART_PRESENTATION: Partial<Record<CardId, CardArtPresentation>> = {
  // volcano_mouse: { position: '50% 38%', scale: 1.04 },
  // funeral_inviter: { fileName: 'funeral_inviter_v2.webp', position: '48% 35%' },
}

function getPublicAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}${relativePath.replace(/^\/+/, '')}`
}

export function getCardArtPresentation(cardId: CardId): {
  url: string
  position: string
  scale: number
} {
  const presentation = CARD_ART_PRESENTATION[cardId]
  const fileName = presentation?.fileName ?? `${cardId}.webp`
  const scale = presentation?.scale ?? 1

  return {
    url: getPublicAssetUrl(`card-art/${fileName}`),
    position: presentation?.position ?? '50% 42%',
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  }
}
