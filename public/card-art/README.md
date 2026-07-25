# Duel Spirits 카드 일러스트

카드 일러스트는 카드가 들어 있는 세트별 폴더에서 관리합니다.

```text
public/card-art/
├─ foundations-001/
│  ├─ volcano_mouse.webp
│  └─ living_flame.webp
└─ evolution-begins-001/
   ├─ exploding_mountain_dragon.webp
   └─ funeral_inviter.webp
```

기본 경로는 다음과 같습니다.

```text
public/card-art/<set-id>/<card-id>.webp
```

예를 들어 `exploding_mountain_dragon`은 `evolution-begins-001` 세트에
들어 있으므로 다음 위치에 둡니다.

```text
public/card-art/evolution-begins-001/exploding_mountain_dragon.webp
```

파일을 넣고 새로고침하면 손패, 전장, 마나, 인게임 상세 보기, 덱빌더
목록과 덱빌더 상세 보기에 자동으로 적용됩니다.

## 권장 규격

- 형식: WebP
- 비율: 1:1
- 권장 크기: 1024×1024 또는 1536×1536
- 주요 피사체는 중앙에 배치
- 이름, 비용, 속성, 공격력과 체력은 이미지에 직접 넣지 않음

## 세트별 카드 정의

카드 데이터도 동일한 세트 ID를 파일명으로 사용합니다.

```text
src/content/card-sets/
├─ foundations-001.ts
└─ evolution-begins-001.ts
```

새 카드는 해당 세트 파일에 정의하고, 카드 ID는
`src/content/cards.ts`의 `CARD_IDS`에도 추가합니다.

## 카드별 구도 조정

특정 카드의 확대율이나 초점 위치를 조정하려면
`src/config/visual-assets.ts`의 `CARD_ART_PRESENTATION`에 추가합니다.

```ts
export const CARD_ART_PRESENTATION = {
  exploding_mountain_dragon: {
    position: '50% 42%',
    scale: 1.05,
  },
  funeral_inviter: {
    fileName: 'funeral_inviter_v2.webp',
    position: '48% 38%',
  },
}
```

`fileName`을 지정하더라도 파일은 그 카드가 속한 세트 폴더에서
불러옵니다.
