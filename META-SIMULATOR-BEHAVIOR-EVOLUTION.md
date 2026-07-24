# 행동 가중치 진화

이 버전은 덱뿐 아니라 휴리스틱 봇의 행동 가중치도 진화시킵니다. 신경망이나 강화학습은 사용하지 않습니다. `bots.ts`의 공개 상태 평가 구조는 그대로 두고, 그 안에서 사용하는 16개 숫자를 유전자로 취급합니다.

## 무엇이 진화하는가

- 직접 공격 선호
- 몬스터 공격 선호
- 몬스터·주문 사용 선호
- 마나 배치 선호
- 턴 종료 선호
- 공격력·체력·손·라이프·마나 가치
- 유리한 교환의 가치
- 준비된 마나·몬스터 가치
- 행동 뒤 공개 상태 변화의 반영 비율

카드 효과의 의미나 합법 행동 생성 규칙 자체가 자동으로 새로 생기는 것은 아닙니다. 새로운 선택 문법은 여전히 `legal-actions.ts`와 선택 문맥 평가에 연결해야 합니다.

## 덱 강함과 행동 실력을 분리하는 방법

행동 봇 A와 B를 비교할 때 양쪽에 같은 덱을 줍니다. 여러 속성의 훈련 덱 각각에서 좌석과 선공을 바꾸어 미러전을 진행합니다.

```text
행동 봇 A + 물 훈련 덱  vs  행동 봇 B + 같은 물 훈련 덱
행동 봇 A + 땅 훈련 덱  vs  행동 봇 B + 같은 땅 훈련 덱
...
```

같은 덱을 쓰므로 강한 덱을 배정받은 정책이 좋은 정책으로 오인되는 문제를 줄입니다. 최종 상위 정책 여러 개를 실제 덱 진화 대전에 번갈아 사용하므로, 한 가지 플레이 성향에만 맞는 메타가 생성되는 것도 줄입니다.

## 세대 진행

1. 공격형·가치형·제어형 기준 가중치로 초기 집단을 만듭니다.
2. 남는 자리는 기준 가중치의 변이체로 채웁니다.
3. 모든 현재 정책과 명예의 전당 정책을 훈련 덱 미러전에서 비교합니다.
4. 승리 점수에서 제한 종료 비율을 감점해 적합도를 계산합니다.
5. 상위 정책은 그대로 계승합니다.
6. 두 상위 부모의 가중치를 섞고 일부 항목을 변이해 자식을 만듭니다.
7. 과거 강자를 명예의 전당에 남겨 새 세대가 최근 상대에게만 과적합되지 않게 합니다.

## 설정

```json
{
  "behaviorEvolution": {
    "enabled": true,
    "populationSize": 8,
    "generations": 3,
    "eliteCount": 3,
    "mutationsPerChild": 4,
    "mutationScale": 0.08,
    "trainingDeckCount": 5,
    "gamesPerPairPerDeck": 2,
    "hallOfFameCount": 3,
    "finalBotCount": 3,
    "drawScore": 0.15,
    "seedProfiles": ["aggressive", "value", "control"]
  }
}
```

- `enabled`: `false`이면 이전처럼 `matches.botProfiles`의 고정 봇만 사용합니다.
- `populationSize`: 한 행동 세대의 정책 수입니다. 시간은 대략 제곱에 비례합니다.
- `generations`: 행동 가중치 세대 수입니다.
- `eliteCount`: 변이 없이 다음 세대로 계승할 상위 정책 수입니다.
- `mutationsPerChild`: 자식 하나에서 변경할 가중치 항목 수의 기준입니다.
- `mutationScale`: 각 변이의 폭입니다. `0.04`는 보수적이고 `0.12` 이상은 급격한 탐색입니다.
- `trainingDeckCount`: 행동 실력을 검사할 서로 다른 미러 덱 수입니다. 다섯 속성이 있는 풀에서는 5 이상을 권장합니다.
- `gamesPerPairPerDeck`: 행동 정책 한 쌍이 훈련 덱 하나에서 치르는 경기 수입니다. 선공 균형을 위해 2의 배수로 둡니다.
- `hallOfFameCount`: 다음 세대도 계속 상대할 과거 강자의 수입니다.
- `finalBotCount`: 최종 덱 메타 실험에 투입할 상위 행동 봇 수입니다.
- `drawScore`: 승리 1점에 비해 무승부·제한 종료에 주는 점수입니다. 별도로 제한 종료 비율 감점도 적용됩니다.
- `seedProfiles`: 초기 유전자에 사용할 기준형입니다.

## 경기 수 계산

첫 행동 세대의 대략적인 경기 수는 다음과 같습니다.

```text
populationSize × (populationSize - 1) ÷ 2
× trainingDeckCount
× gamesPerPairPerDeck
```

명예의 전당이 찬 뒤에는 비교 대상이 최대 `populationSize + hallOfFameCount`가 됩니다. 기본 예시는 행동 진화에 대략 1,380경기를 사용하고, 이후 덱 진화 경기를 별도로 실행합니다.

빠른 확인용:

```json
{
  "behaviorEvolution": {
    "populationSize": 4,
    "generations": 2,
    "trainingDeckCount": 3,
    "gamesPerPairPerDeck": 2,
    "hallOfFameCount": 1,
    "finalBotCount": 2
  }
}
```

본격 비교용:

```json
{
  "behaviorEvolution": {
    "populationSize": 10,
    "generations": 5,
    "eliteCount": 4,
    "mutationsPerChild": 4,
    "mutationScale": 0.06,
    "trainingDeckCount": 7,
    "gamesPerPairPerDeck": 4,
    "hallOfFameCount": 4,
    "finalBotCount": 3
  }
}
```

## 결과

- `bots.csv`: 최종 행동 봇의 적합도, 승률, 정상 종료율, 16개 가중치
- `summary.md`: 최종 행동 봇 요약
- `report.json`: 모든 행동 세대, 훈련 덱, 정책 계보, 경기 시드와 세대별 가중치

한 번의 시드에서 우승한 가중치를 절대적인 최적값으로 보아서는 안 됩니다. 카드 풀이나 훈련 덱 표본에 따라 다른 국소 최적점이 나올 수 있으므로, 서로 다른 시드에서 반복해서 자주 살아남는 가중치와 덱 결과를 함께 보는 편이 안전합니다.
