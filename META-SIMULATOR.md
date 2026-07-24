# Duel Spirits 메타 시뮬레이터

이 도구는 실제 게임의 `createGame`과 `applyAction`을 그대로 사용해 화면 없이 대전을 반복합니다. 별도의 간이 룰을 복제하지 않으므로 카드 수치·포맷·덱 제한·공격 판정·각성·진화가 바뀌면 같은 규칙 엔진을 따라갑니다.

현재 제공하는 기능은 다음과 같습니다.

- 포맷 또는 지정한 카드 풀에서 합법적인 20장 덱 자동 생성
- 속성, 몬스터 수, 비용 곡선이 다른 초기 덱 생성
- 상위 덱을 남기고 일부 카드를 교체하는 세대별 변이 탐색
- 행동 평가 가중치의 교차·변이·엘리트 계승·명예의 전당 진화
- 진화 기능을 끄면 무작위·공격형·가치형·제어형 고정 봇 대전
- 양쪽 좌석과 선후공을 번갈아 배정하는 라운드로빈
- 덱 승률, 선공·후공 승률, 매치업, 카드 채용·확인·사용 통계 출력
- 모든 경기의 시드와 종료 사유 저장

## 1. 실행

의존성을 설치한 뒤 자기검증부터 실행합니다.

```bash
npm install
npm run sim:test
```

설정 예시를 복사합니다.

```bash
cp simulator.config.example.json simulator.config.json
npm run sim:meta
```

다른 설정 파일을 직접 지정할 수도 있습니다.

```bash
npm run sim:meta -- --config my-meta-test.json
npm run sim:meta -- --config my-meta-test.json --seed balance-2026-07-24
npm run sim:meta -- --config my-meta-test.json --out simulation-results/experiment-a
```

`simulator.config.json`이 없으면 코드의 빠른 기본 설정으로 실행됩니다.

## 2. 카드 풀 입력

### 포맷이 허용하는 전체 카드 사용

`cardIds`를 생략하거나 빈 배열로 두면 선택한 포맷의 전체 카드 풀을 자동으로 읽습니다.

```json
{
  "formatId": "open-v1",
  "selectedSetIds": [],
  "cardPool": {}
}
```

새 카드를 `src/content/cards.ts`에 추가하고 포맷에서 허용하면 별도 목록 수정 없이 자동 생성 대상에 들어갑니다.

### 특정 카드만 사용

```json
{
  "cardPool": {
    "cardIds": [
      "living_flame",
      "ash_hound",
      "high_tide",
      "ripple_spirit"
    ]
  }
}
```

카드 ID를 잘못 쓰면 해당 카드를 몰래 제외하지 않고 즉시 오류를 냅니다.

### 세트 또는 제외 목록으로 제한

```json
{
  "cardPool": {
    "includeSetIds": ["foundations-001"],
    "excludeCardIds": ["holy_mirror_wall"]
  }
}
```

`cardIds`, `includeSetIds`, `excludeCardIds`를 함께 쓰면 모든 조건을 통과한 카드만 남습니다.

## 3. 사람이 만든 덱도 함께 평가

자동 덱 사이에 기준 덱을 넣으려면 `seedDecks`를 사용합니다. 포맷의 덱 크기와 동일 카드 제한을 통과해야 합니다.

```json
{
  "seedDecks": [
    {
      "id": "my-fire-deck",
      "name": "내 불 덱",
      "cardIds": [
        "living_flame", "living_flame", "living_flame",
        "ash_hound", "ash_hound", "ash_hound"
      ]
    }
  ]
}
```

위 예시는 구조만 보여주는 짧은 목록입니다. 실제 입력은 현재 포맷의 정확한 덱 장수를 채워야 합니다.

## 4. 주요 설정

```json
{
  "deckGeneration": {
    "populationSize": 8,
    "generations": 2,
    "eliteCount": 3,
    "mutationsPerChild": 2,
    "minUnits": 10,
    "maxUnits": 17,
    "maxAttemptsPerDeck": 300
  },
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
    "finalBotCount": 3
  },
  "matches": {
    "gamesPerPair": 4,
    "botProfiles": ["aggressive", "value", "control"],
    "maxTurns": 80,
    "maxActions": 500
  }
}
```

- `deckGeneration.populationSize`: 세대마다 비교할 덱 수입니다. 실행 시간은 대략 이 값의 제곱에 비례합니다.
- `behaviorEvolution`: 행동 가중치 진화 설정입니다. 상세 내용은 `META-SIMULATOR-BEHAVIOR-EVOLUTION.md`를 참고하십시오.
- `generations`: 상위 덱을 변이시킬 횟수입니다.
- `eliteCount`: 다음 세대에 남길 상위 덱 수입니다.
- `mutationsPerChild`: 자식 덱에서 교체할 카드 수의 기준입니다.
- `minUnits`, `maxUnits`: 자동 덱의 몬스터 수 범위입니다.
- `gamesPerPair`: 덱 쌍마다 실행할 경기 수입니다. 짝수로 두면 선후공이 균형을 이룹니다.
- `botProfiles`: `random`, `aggressive`, `value`, `control`을 사용할 수 있습니다.
- `maxTurns`, `maxActions`: 무한 반복 또는 지나치게 긴 경기를 막는 안전장치입니다.

빠른 기능 확인은 4~8개 덱과 대진당 2~4경기로 시작하고, 후보가 좁혀지면 덱 수와 경기 수를 늘리는 편이 효율적입니다.

## 5. 결과 파일

기본 출력 위치는 `simulation-results/latest`입니다.

- `summary.md`: 최종 행동 봇, 상위 덱과 우선 검토 카드 요약
- `bots.csv`: 진화로 선택된 행동 봇의 적합도와 16개 행동 가중치
- `decks.csv`: 덱별 승률, 선공·후공 승률, 평균 턴, 신뢰구간, 덱 목록
- `matchups.csv`: 덱 대 덱 승률표 원자료
- `cards.csv`: 카드 채용률 관련 통계
- `report.json`: 세대, 덱, 모든 경기 시드와 상세 통계를 포함한 전체 결과

`report.json`의 경기에는 다음 종료 사유가 기록됩니다.

- `win`: 정상 승패 종료
- `turn-limit`: 최대 턴 도달
- `action-limit`: 최대 행동 수 도달
- `no-legal-actions`: 새 선택 방식 등을 시뮬레이터가 아직 열거하지 못함

마지막 경우에는 `failureDiagnostic`에 실패 시드와 선택 종류가 남으므로 같은 경기를 재현해 어댑터를 확장할 수 있습니다.

## 6. 새 카드 풀이 추가될 때

### 별도 작업 없이 대응되는 카드

다음 조건의 카드는 `src/content/cards.ts`에 정의하고 `rules.ts`에 판정을 구현하면 자동으로 덱 생성과 대전에 들어갑니다.

- 플레이할 때 추가 대상을 고르지 않는 몬스터·주문
- 기존 공격·마나·진화·각성·선택 구조만 사용하는 카드
- 기존 `PendingChoiceView` 종류를 사용하는 카드

### 플레이 순간 대상을 요구하는 카드

`PLAY_CARD`가 `selection.unitId`, `lifeIndex`, `effectManaId`, `fieldSlot`을 요구한다면 카드의 시뮬레이션 힌트를 등록합니다.

```ts
const CARD_SIMULATION_HINTS: Partial<Record<CardId, CardSimulationHints>> = {
  new_damage_spell: { playSelectionFields: ['unitId'] },
  new_life_spell: { playSelectionFields: ['lifeIndex'] },
}
```

힌트는 판정을 대신하지 않습니다. 봇이 입력 후보를 만들 뿐이며, 실제 합법 여부와 효과 처리는 항상 `applyAction`이 결정합니다.

### 완전히 새로운 선택 구조를 추가한 카드

새 `GameAction` 또는 새 `PendingChoiceView` 종류를 만들었다면 `src/simulator/legal-actions.ts`에 그 입력 후보를 만드는 경우를 추가해야 합니다. 누락하면 게임을 억지로 진행하지 않고 `no-legal-actions`와 재현 시드를 기록합니다.

이 경계 덕분에 카드 수나 수치가 바뀌는 것은 자동 대응하면서, 새로운 룰 문법이 생겼을 때만 작은 어댑터를 명시적으로 추가하게 됩니다.

## 7. 통계 해석

`cards.csv`의 높은 승률만 보고 바로 너프해서는 안 됩니다.

- `inclusion_win_rate`: 그 카드를 넣은 덱의 승률
- `seen_win_rate`: 그 카드를 실제로 손에서 본 게임의 승률
- `played_win_rate`: 그 카드를 사용하거나 소환한 게임의 승률
- `top_deck_rate`: 상위 덱 중 채용 비율
- `suspicion_score`: 사람이 먼저 검토할 순서를 위한 혼합 점수

이 값들은 카드 자체의 인과 효과와 덱 전체의 강함을 완전히 분리하지 못합니다. 최종 너프·버프 판단은 상위 덱에서 카드 한 장만 교체한 대응 실험과 사람 플레이를 함께 보는 것이 안전합니다.

## 8. 현재 봇의 범위

현재 봇은 공개된 `GameView`와 합법 행동만 받습니다. 행동 진화를 켜면 고정된 평가 구조 안의 가중치가 미러전 결과에 따라 교차·변이됩니다. 상대 손·덱·라이프의 정체를 읽지 않으므로 치팅하지 않습니다. 다만 휴리스틱 기반의 초기 메타 탐색기이며, 완전한 최적 플레이어나 강화학습 모델은 아닙니다.

따라서 이 도구가 특히 잘하는 일은 다음과 같습니다.

- 명백히 지나치게 강하거나 약한 덱 후보 찾기
- 선공 편향과 장기전·교착 비율 측정
- 카드 풀이 바뀔 때 반복 가능한 회귀 테스트
- 사람이 집중해서 플레이테스트할 덱과 카드의 우선순위 결정

## 9. 행동 AI의 평가 방식

휴리스틱 봇은 합법 행동을 만든 뒤 다음 요소를 합산해 행동을 고릅니다.

- 직접 공격으로 줄이는 라이프 수
- 전투 뒤 공개 전장 가치의 변화
- 내·상대 몬스터의 공격력, 남은 체력, 준비 여부, 키워드, 진화 스택
- 손·마나·준비된 마나·라이프의 공개 수량 변화
- 덱의 주 속성에 맞는 마나 배치와 중복 카드 보존
- 선택 효과의 문맥: 손 버리기, 자기 희생, 묘지 회수, 마나 교환, 덱 위 조작 등

`nextState`는 규칙 검증 과정에서 계산되지만 봇은 숨은 카드 정체를 평가에 사용하지 않습니다. 손·덱·라이프는 수량만 보고, 직접 공격은 공격 뒤 드러난 각성 결과를 미리 이용하지 않도록 별도 점수로 처리합니다.

현재 봇도 완전한 최적 플레이어는 아닙니다. 여러 턴 뒤의 콤보와 상대의 숨은 정보를 확률적으로 추론하지는 않으므로, 최종 밸런스 판정 전에는 사람 플레이와 비교해야 합니다.

## 10. 공정한 속성 비교 설정

초기 덱 생성기는 카드 풀에 존재하는 각 속성의 균형형 덱 계획을 먼저 한 번씩 배정합니다. 따라서 다섯 속성이 모두 있는 풀에서 `populationSize`가 5 이상이면 첫 세대에 각 속성의 대표 계획이 들어갑니다. 다음 세대를 만들 때도 속성별 최고 대표 덱을 최소 한 개씩 부모로 보존하므로, 작은 표본의 우연한 패배만으로 한 속성이 즉시 탐색에서 사라지지 않습니다.

좌석 4가지와 봇 프로필 3가지를 정확히 같은 횟수로 비교하려면 다음처럼 대진당 12경기를 권장합니다.

```json
{
  "matches": {
    "gamesPerPair": 12,
    "botProfiles": ["aggressive", "value", "control"]
  }
}
```

빠른 확인에서는 4경기도 가능하지만, 이 경우 각 대진 안에서 봇 성향별 표본은 완전히 같지 않습니다. 대진마다 시작 프로필을 회전해 전체 편향은 줄이지만, 최종 비교에는 12의 배수가 더 안전합니다.

## 11. 행동 가중치 진화

행동 정책 진화의 평가 방식, 세대별 경기 수, 설정값과 해석법은 `META-SIMULATOR-BEHAVIOR-EVOLUTION.md`에 정리되어 있습니다. 행동 진화를 끄려면 `behaviorEvolution.enabled`를 `false`로 두십시오.
