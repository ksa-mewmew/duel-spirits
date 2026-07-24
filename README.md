# Duel Spirits

친구 초대형 온라인 대전 카드게임입니다. 현재는 모든 카드가 해금되어 있으며, Cloudflare Worker + Durable Object가 서버 판정을 담당하고 GitHub Pages가 웹 클라이언트를 제공합니다.

## 로컬 실행

```bash
npm ci
npm run server:dev
```

다른 터미널에서:

```bash
npm run dev
```

## 검사

```bash
npm run check
```

## 메타 시뮬레이션

실제 규칙 엔진을 화면 없이 반복 실행해 카드 풀에서 덱을 생성하고, 봇 라운드로빈과 카드·덱 통계를 만들 수 있습니다.

```bash
npm run sim:test
cp simulator.config.example.json simulator.config.json
npm run sim:meta
```

설정, 새 카드 대응 방식, 결과 해석은 `META-SIMULATOR.md`를 참고하세요.

## 서버 배포

기존 Worker 이름은 배포 호환성을 위해 `card-duel-server`로 유지합니다.

```bash
npm run server:deploy
```

## 현재 카드풀

- `DSF · 정령의 기초`: 카드군 1, 40종
- `SOF · 진화의 시작`: 카드군 2, 40종
- 전체 카드풀 80종

SOF에는 기존 몬스터 위에 겹쳐 사용하는 `진화` 몬스터가 포함됩니다. 구체적인 구현 범위와 진화 판정은 `CARD-GROUP-2-SOF.md`를 참고하세요.

## 현재 포맷

- 전체 카드전
- 세트 한정전
- 드래프트 제한 풀전
- 금지·제한전
- 캠페인 전용 덱 포맷

확장 구조와 현재 구현 범위는 `ARCHITECTURE.md`, 최초 배포 절차는 `DEPLOY-FRIENDS.md`를 참고하세요.
