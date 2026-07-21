# Duel Spirits 친구 초대 버전 배포 안내 — Cloudflare 직접 배포

이 버전은 PartyKit 대시보드나 PartyKit 계정을 사용하지 않습니다.

- **Cloudflare Worker + Durable Object**: 실시간 게임 서버
- **GitHub Pages**: 친구가 접속하는 게임 화면

게임 서버 주소는 24시간 접속할 수 있습니다. 각 방은 접속자가 없을 때 자동으로 잠들며, 저장된 방 상태는 다음 접속 때 복원됩니다. 따라서 개발자의 컴퓨터를 계속 켜 둘 필요가 없습니다.

---

## npm 설치 주소 확인

이 배포본의 `package-lock.json`은 공개 npm 레지스트리(`https://registry.npmjs.org/`)만 사용합니다. 설치 로그에 `packages.applied-caas-gateway1.internal.api.openai.org`가 보인다면 이전 배포본의 잠금 파일을 사용 중인 것이므로, 최신 압축본으로 교체하거나 아래 명령으로 확인하세요.

```powershell
Select-String -Path package-lock.json -Pattern "applied-caas-gateway"
npm config get registry
```

첫 명령은 아무것도 출력하지 않고, 두 번째 명령은 `https://registry.npmjs.org/`를 출력해야 합니다.

## 0. 준비

- Node.js 22 LTS 권장
- Cloudflare 계정
- GitHub 계정

프로젝트 폴더에서:

```bash
npm ci
npm run check
```

---

## 1. Cloudflare에 직접 로그인

```bash
npx wrangler login
```

브라우저에서 Cloudflare 권한 승인을 마칩니다. 이 로그인은 PartyKit 로그인과 무관합니다.

확인:

```bash
npm run server:whoami
```

---

## 2. 게임 서버 배포

```bash
npm run server:deploy
```

최초 배포에서는 Workers.dev 서브도메인을 정하라는 안내가 나올 수 있습니다. 배포가 끝나면 다음과 비슷한 주소가 출력됩니다.

```text
https://card-duel-server.<내-workers-서브도메인>.workers.dev
```

서버 점검:

```text
https://card-duel-server.<내-workers-서브도메인>.workers.dev/health
```

정상이라면 다음 JSON이 표시됩니다.

```json
{"ok":true,"service":"duel-spirits-server"}
```

서버 로그:

```bash
npm run server:tail
```

---

## 3. GitHub 저장소 만들기

GitHub에서 새 저장소를 만든 뒤 프로젝트를 올립니다.

```bash
git init
git add .
git commit -m "Deploy Duel Spirits friend invite version"
git branch -M main
git remote add origin https://github.com/<사용자명>/duel-spirits.git
git push -u origin main
```

GitHub Desktop을 사용해도 됩니다.

---

## 4. 게임 서버 주소를 GitHub에 등록

저장소에서:

`Settings → Secrets and variables → Actions → Variables → New repository variable`

다음을 만듭니다.

- 이름: `GAME_SERVER_HOST`
- 값: 배포된 Worker 호스트

예:

```text
card-duel-server.my-subdomain.workers.dev
```

`https://`와 마지막 `/`는 빼는 편이 좋습니다. 워크플로가 붙어 있어도 정규화하지만, 호스트만 입력하는 것이 가장 명확합니다.

---

## 5. GitHub Pages 켜기

저장소에서:

`Settings → Pages → Build and deployment → Source → GitHub Actions`

그 뒤 `Actions → Deploy web to GitHub Pages → Run workflow`를 실행합니다.

완료 주소는 보통 다음과 같습니다.

```text
https://<사용자명>.github.io/<저장소명>/
```

이 페이지에서 방을 만들고 초대 링크를 친구에게 보내면 됩니다.

---

## 6. 서버 자동 배포 설정 — 선택 사항

프로젝트의 `Deploy Cloudflare game server` 워크플로를 사용하면 서버 코드 변경 시 자동 배포됩니다.

Cloudflare에서 API 토큰을 만듭니다.

1. Cloudflare Dashboard → My Profile → API Tokens
2. `Create Token`
3. `Edit Cloudflare Workers` 템플릿 사용
4. 가능하면 이 계정으로 범위를 제한

GitHub 저장소의 다음 위치에 두 값을 **Actions secret**으로 등록합니다.

`Settings → Secrets and variables → Actions → Secrets`

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

토큰은 코드, 채팅, 커밋에 넣으면 안 됩니다.

---

## 7. 로컬 개발

터미널 두 개를 엽니다.

첫 번째 터미널:

```bash
npm run server:dev
```

두 번째 터미널:

```bash
npm run dev
```

로컬 웹은 별도 설정이 없으면 `localhost:8787`의 서버에 연결합니다.

---

## 8. 24시간 운영의 정확한 의미

Cloudflare Worker의 공개 주소는 계속 접속 가능합니다. 다만 개별 방의 JavaScript 프로세스를 빈방 상태로 계속 실행하지는 않습니다.

- 플레이 중: 방이 활성화되어 WebSocket과 게임 상태를 처리
- 접속자가 없거나 유휴 상태: 방이 하이버네이션 또는 종료
- 다시 접속: 저장소에서 상태를 읽고 즉시 재구성
- 턴 제한 및 자리 만료: Durable Object Alarm으로 예약 처리

이 방식이 일반적인 상시 온라인 서버보다 저렴하고 안정적입니다. 방을 억지로 깨워 두는 keep-alive 요청은 필요하지 않습니다.

---

## 9. 업데이트 순서

규칙이나 서버 코드를 바꿨다면:

```bash
npm run server:deploy
```

그 뒤 GitHub에 푸시하여 웹도 갱신합니다.

```bash
git add .
git commit -m "Update game"
git push
```

자동 서버 배포 secret을 등록했다면 푸시만으로 둘 다 배포됩니다.

---

## 문제 해결

### 웹은 열리지만 방 연결이 실패함

- GitHub 변수 `GAME_SERVER_HOST`가 실제 Workers.dev 호스트와 같은지 확인
- Worker 주소의 `/health`가 열리는지 확인
- `npm run server:tail`로 오류 확인

### 최초 Worker 배포가 인증 오류로 실패함

```bash
npx wrangler logout
npx wrangler login
npm run server:deploy
```

### GitHub Pages 작업이 GAME_SERVER_HOST 오류로 멈춤

저장소 Actions variable에 `GAME_SERVER_HOST`를 등록한 뒤 워크플로를 다시 실행합니다.

### 방이 잠들면 게임이 사라지는가

아닙니다. 방 상태는 Durable Object의 SQLite 기반 저장소에 기록됩니다. 방이 다시 깨어날 때 상태를 불러옵니다. 다만 현재 게임 규칙대로 두 자리 모두 만료되면 방 데이터는 정리됩니다.
