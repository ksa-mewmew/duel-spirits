# Duel Spirits

친구와 같은 상대를 여러 판 반복해 즐기고 덱을 교환하는 비공개 1대1 카드게임입니다. 웹과 Windows 앱은 같은 클라이언트 코드와 Cloudflare Worker + Durable Object 대전 서버를 사용합니다. 모든 카드는 처음부터 사용할 수 있습니다.

## 로컬 개발

```bash
npm install

# 웹 클라이언트
npm run dev

# 대전 서버
npm run server:dev

# 웹 클라이언트 + Electron
npm run dev:desktop
```

설정하지 않으면 로컬 웹은 `localhost:8787`, 배포 빌드는 `card-duel-server.psh20030604.workers.dev`에 접속합니다. 다른 서버는 `.env`의 `VITE_GAME_SERVER_HOST`로 지정합니다.

## 검증

```bash
npm run check
npm run sim:test
npm run sim:samples
```

`npm run check`는 단위 테스트, TypeScript 검사, 프로덕션 웹 빌드를 실행합니다.

## 서버 배포와 내부 통계

```bash
npm run server:deploy
```

대전 종료 시 `Analytics` Durable Object에 최근 2,000경기를 보관합니다. 기록 항목은 버전, 포맷, 양쪽 덱과 속성, 승자, 선후공, 턴 수, 종료 사유, 사용 카드입니다. 계정이나 개인정보는 저장하지 않습니다.

통계 조회 토큰을 한 번 등록합니다.

```bash
npx wrangler secret put INTERNAL_STATS_TOKEN
```

그 후 운영자만 다음 엔드포인트를 조회할 수 있습니다.

```text
GET /internal/stats
Authorization: Bearer <INTERNAL_STATS_TOKEN>
```

토큰이 설정되지 않았거나 일치하지 않으면 엔드포인트는 `404`를 반환합니다.

## Windows 앱

```bash
# 패키지 디렉터리
npm run package:desktop

# Windows Squirrel 설치 파일
npm run make:desktop
```

결과는 `out/make/squirrel.windows/x64/`에 생성됩니다. `Duel Spirits-<version> Setup.exe`를 공개 GitHub Release에 올리면 앱에서 새 버전을 확인하고 다운로드 페이지를 엽니다.

앱의 렌더러는 샌드박스와 context isolation을 사용합니다. 덱은 Electron `userData/decks.json`에 저장되며 저장할 때 이전 파일을 `decks.backup.json`으로 보존합니다. 웹의 `localStorage`도 동일한 덱 데이터 형식과 덱 코드를 사용합니다.

## 콘텐츠와 패치

- 카드 정의: `src/content/card-sets/`
- 카드 세트 및 규칙 버전: `src/content/sets.ts`
- 기본 덱 4개: `src/content/sample-decks.ts`
- 패치 노트와 이전 기록: `src/content/patch-notes.ts`
- 내부 AI 시뮬레이터: `src/simulator/`

네트워크 규칙을 호환되지 않게 변경할 때는 `src/shared/version.ts`의 `NETWORK_PROTOCOL_VERSION`을 올립니다. 구버전 앱은 서버에서 업데이트 안내와 함께 접속이 거절됩니다.
