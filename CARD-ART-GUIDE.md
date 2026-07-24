# 카드 아트 적용 가이드

## 파일 넣기

`public/card-art/<card id>.webp` 형식으로 저장합니다. 코드 수정 없이 자동으로 연결됩니다.

예: `public/card-art/volcano_mouse.webp`

## 권장 규격

- 비율: 5:7
- 작업 원본: 1500×2100px 이상 권장
- 게임용: 1000×1400px 전후 WebP
- 색 공간: sRGB
- 중요한 얼굴·머리·상징: 화면 중앙보다 약간 위
- 아래 20%: 카드명과 수치가 덮어도 되는 영역
- 좌상단·우상단: 비용과 속성 아이콘이 올라가므로 핵심 요소를 피함

## 화면별 사용

- 손패: 전체 5:7 아트
- 전장: 같은 이미지를 카드 크기에 맞춰 확대
- 덱 빌더: 전체 5:7 아트
- 상세 보기: 가장 큰 전체 카드
- 현재 덱 목록: 정사각형 중앙 크롭

## 크롭 조절

`src/content/cards.ts`의 `CARD_ART_PRESENTATION`에 카드별 값을 추가합니다.

```ts
export const CARD_ART_PRESENTATION = {
  volcano_mouse: { position: '50% 38%', scale: 1.04 },
  floating_mountains: { position: '50% 32%', scale: 1.08 },
}
```

- `position`: CSS `background-position`
- `scale`: 카드 면에서의 확대 배율
