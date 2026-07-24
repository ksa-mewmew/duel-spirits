# Duel Spirits 카드 이미지 폴더

카드 ID와 같은 이름의 WebP 파일을 이 폴더에 넣으면 UI 전체에 자동으로 표시됩니다.

예시:

- `volcano_mouse.webp`
- `living_flame.webp`
- `funeral_inviter.webp`

권장 원본 비율은 **5:7 세로형**입니다. 화면용 파일은 대략 1000×1400px 전후의 WebP를 권장합니다.
이미지는 카드 면 전체, 손패, 전장, 덱 빌더, 상세 보기에서 공통으로 사용됩니다.

인물이나 몬스터의 핵심 부위는 중앙보다 조금 위에 두고, 아래쪽은 카드 이름 띠가 덮어도 괜찮게 제작하세요.
특정 카드의 초점이 잘못 잘리면 `src/content/cards.ts`의 `CARD_ART_PRESENTATION`에 위치와 확대값을 추가합니다.

```ts
export const CARD_ART_PRESENTATION = {
  volcano_mouse: { position: '50% 38%', scale: 1.04 },
}
```
