# 메타 시뮬레이터 v5 — 인간형 덱 생성과 진화

이번 버전은 덱을 단순한 20장 배열로 취급하던 방식을 바꾸고, 실제 카드게임에서 흔히 쓰는 다음 흐름을 시뮬레이터에 반영합니다.

```text
아키타입과 승리 계획
→ 역할별 카드 후보
→ 3장 핵심 / 2장 보조 / 소수의 1장 대응 카드
→ 매수·패키지·비용 곡선 변이
→ 실제 대전 승률로 생존 판정
```

중요한 원칙은 **인간처럼 생긴 덱에 승률 외 보너스를 주지 않는 것**입니다. 인간형 판단은 좋은 후보를 만들고 변이를 유도하는 데만 쓰며, 최종 적합도는 여전히 실제 봇 대전 결과로 결정됩니다.

## 1. 카드 역할 자동 추정

`src/simulator/deck-intelligence.ts`가 카드 정의를 읽어 다음 역할을 추정합니다.

- 초동 몬스터
- 압박
- 수비
- 템포
- 제거
- 광역 제거
- 드로우
- 마나 가속
- 마나 보상
- 묘지 투입
- 묘지 보상
- 회수
- 라이프 조작
- 각성
- 진화
- 공명
- 마무리
- 범용

추정에는 카드 유형, 비용, 공격력·체력, 키워드, 속성, `rulesText`, 카드군을 사용합니다. 카드 이름별 예외 목록에 의존하지 않으므로 카드 풀이 바뀌어도 기본적으로 자동 대응합니다.

자동 추정이 새 카드의 의미를 충분히 파악하지 못할 때만 카드 정의에 선택적 힌트를 붙일 수 있습니다.

```ts
{
  // 기존 카드 정의...
  deckHints: {
    roles: ['graveyard_enabler', 'draw'],
    packageIds: ['dark-grave-engine'],
    copyClass: 'core',
  },
}
```

`deckHints`는 강제 규칙이 아닙니다. 초기 생성과 변이 확률을 유도할 뿐입니다.

## 2. 아키타입 원형

카드 풀에서 속성별 역할 밀도를 계산해 다음 전략 중 적합한 원형을 만듭니다.

- 공격
- 가치
- 제어
- 성장
- 묘지
- 라이프
- 진화
- 균형

예를 들어 현재 풀에서는 물 가치, 땅 성장, 어둠 묘지, 빛 라이프 같은 원형이 자연스럽게 생성될 수 있습니다. 다속성 카드가 충분하면 속성 조합 원형도 추가됩니다.

작은 population에서도 가능한 한 각 속성 원형이 먼저 한 번씩 들어갑니다. 행동 가중치 진화의 훈련 덱도 이 원형 생성기를 사용하므로, 불 덱만 학습시키는 편향을 줄입니다.

## 3. 인간형 매수 구조

기본 설정은 20장 덱을 대체로 8~11종으로 구성하고, 한 장만 채용하는 카드는 최대 3종으로 유도합니다.

흔히 생성되는 예시는 다음과 같습니다.

```text
3장 카드 4종 = 12장
2장 카드 3종 = 6장
1장 카드 2종 = 2장
총 20장 / 9종
```

또는:

```text
3장 카드 3종 = 9장
2장 카드 4종 = 8장
1장 카드 3종 = 3장
총 20장 / 10종
```

초동·드로우·마나 가속·엔진 카드는 3장을 선호합니다. 무거운 마무리와 상황 대응 카드는 보통 1~2장을 선호합니다. 다만 진화 과정에서는 실제 승률이 좋다면 무거운 카드가 3장으로 늘어날 수도 있습니다.

## 4. 덱 변이

기존의 무작위 한 장 교체에 더해 다음 변이를 사용합니다.

### 매수 집중

싱글톤 하나를 빼고 기존 핵심 카드의 매수를 늘립니다.

```text
A 1장 제거 → B 2장에서 3장으로
```

### 같은 역할 교체

교체 전 카드와 비용·유형·역할·패키지가 비슷한 카드를 우선 탐색합니다.

### 패키지 변이

묘지, 마나, 라이프, 진화, 공명 등 현재 덱의 주요 패키지와 연결되는 카드를 함께 탐색합니다.

### 교차

엘리트 덱 두 개에서 자주 채용된 카드를 선호하는 새 인간형 원형을 생성합니다. 단순히 덱 절반을 잘라 붙이지 않으므로 덱 크기, 매수 제한, 역할 골격이 유지됩니다.

### 신규 원형 유입

매 세대 일정 수의 새 아키타입 덱을 투입합니다. 초기 결과가 우연히 나빴다는 이유로 한 속성이나 전략이 영구히 사라지는 것을 막습니다.

## 5. 설정

`deckGeneration`에 다음 항목이 추가되었습니다.

```json
{
  "deckGeneration": {
    "populationSize": 8,
    "generations": 3,
    "eliteCount": 3,
    "mutationsPerChild": 2,
    "minUnits": 10,
    "maxUnits": 17,
    "maxAttemptsPerDeck": 300,

    "humanDeckRatio": 0.85,
    "minDistinctCards": 8,
    "maxDistinctCards": 11,
    "maxSingletonCards": 3,

    "crossoverChance": 0.28,
    "compressionChance": 0.38,
    "packageMutationChance": 0.34,
    "immigrantCount": 1
  }
}
```

- `humanDeckRatio`: 초기 덱 중 인간형 원형 비율. 나머지는 넓은 탐색용 혼합 덱입니다.
- `minDistinctCards`, `maxDistinctCards`: 인간형 원형에서 유도할 카드 종류 수입니다.
- `maxSingletonCards`: 한 장만 채용하는 카드 종류의 상한입니다.
- `crossoverChance`: 엘리트 둘의 선호를 섞어 새 덱을 만들 확률입니다.
- `compressionChance`: 싱글톤을 줄이고 기존 핵심 매수를 올릴 확률입니다.
- `packageMutationChance`: 같은 역할·시너지 패키지를 중심으로 교체할 확률입니다.
- `immigrantCount`: 세대마다 새로 투입할 아키타입 원형 수입니다.

기존 설정 파일에 이 항목이 없어도 기본값이 자동 적용됩니다.

## 6. 결과 읽기

`decks.csv`에 다음 열이 추가됩니다.

- `archetype`
- `strategy`
- `source`
- `distinct_cards`
- `singletons`
- `doubletons`
- `tripletons`
- `units`
- `spells`
- `average_cost`
- `top_packages`

`source` 값은 다음 의미입니다.

- `archetype`: 초기 또는 신규 인간형 원형
- `exploratory`: 일부러 넓게 흩어진 탐색 덱
- `elite`: 이전 세대 상위 덱
- `mutation`: 매수·역할·패키지 변이 덱
- `crossover`: 두 엘리트의 카드 선호를 섞은 덱
- `seed`: 사용자가 직접 넣은 덱

`summary.md`의 상위 덱 아래에도 1·2·3장 카드 종류 수와 주요 패키지가 표시됩니다.

## 7. 권장 설정

빠른 확인용:

```json
{
  "deckGeneration": {
    "populationSize": 6,
    "generations": 2,
    "eliteCount": 2,
    "mutationsPerChild": 2,
    "humanDeckRatio": 0.9,
    "minDistinctCards": 8,
    "maxDistinctCards": 11,
    "maxSingletonCards": 3,
    "immigrantCount": 1
  },
  "matches": {
    "gamesPerPair": 4
  }
}
```

본격 탐색용:

```json
{
  "deckGeneration": {
    "populationSize": 12,
    "generations": 5,
    "eliteCount": 4,
    "mutationsPerChild": 3,
    "humanDeckRatio": 0.85,
    "minDistinctCards": 8,
    "maxDistinctCards": 11,
    "maxSingletonCards": 3,
    "crossoverChance": 0.3,
    "compressionChance": 0.4,
    "packageMutationChance": 0.35,
    "immigrantCount": 2
  },
  "matches": {
    "gamesPerPair": 8
  }
}
```

초기 메타에서는 2~3세대만으로 후보를 압축하고, 상위 덱이 보인 뒤 population과 대진 수를 늘리는 편이 효율적입니다.
