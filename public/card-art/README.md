# Duel Spirits 카드 일러스트 자리

카드 ID와 같은 이름의 WebP 파일을 이 폴더에 넣으면 덱 빌더, 손패, 전장, 마나, 상세 보기에서 자동으로 표시됩니다.

예시:

- `public/card-art/volcano_mouse.webp`
- `public/card-art/living_flame.webp`
- `public/card-art/funeral_inviter.webp`

## 권장 규격

- 형식: WebP
- 비율: 5:7 세로형
- 권장 크기: 1000×1400 또는 1500×2100
- 핵심 피사체는 중앙보다 약간 위에 배치
- 카드명 띠가 올라오는 하단은 중요한 얼굴이나 핵심 물체를 피하기
- 테두리, 카드명, 비용, 속성, 공격력, 체력은 이미지에 직접 넣지 않기

## 카드별 크롭 조정

`src/config/visual-assets.ts`의 `CARD_ART_PRESENTATION`에 필요한 카드만 추가하세요.

```ts
export const CARD_ART_PRESENTATION = {
  volcano_mouse: { position: '50% 38%', scale: 1.04 },
  funeral_inviter: {
    fileName: 'funeral_inviter_v2.webp',
    position: '48% 35%',
  },
}
```

기본 파일명은 항상 `<card id>.webp`입니다. 준비 현황은 아래 명령으로 확인할 수 있습니다.

```bash
npm run art:check
```
