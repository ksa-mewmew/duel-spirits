# Duel Spirits

친구 초대형 온라인 대전 카드게임입니다. 현재는 모든 카드가 해금되어 있으며, Cloudflare Worker + Durable Object가 서버 판정을 담당하고 GitHub Pages가 웹 클라이언트를 제공합니다.

## 현재 카드풀

- `FOU · foundations`: 카드군 1, 40종
- `EVO · evolution-begins`: 카드군 2, 40종
- 전체 카드풀 80종
- 
## 현재 포맷

- 전체 카드전
- 세트 한정전
- 드래프트 제한 풀전
- 금지·제한전
- 캠페인 전용 덱 포맷
# Duel Spirits

## Web development

```bash
npm install
npm run dev
```

## Electron desktop app

```bash
# Vite and Electron development processes
npm run dev:desktop

# Packaged application
npm run package:desktop

# Windows Squirrel installer
npm run make:desktop
```

Windows artifacts are written to:

```text
out/make/squirrel.windows/x64/
```

Upload `Duel Spirits-<version> Setup.exe` to a public GitHub Release. The
desktop app checks the latest public release for
`ksa-mewmew/duel-spirits`, shows release notes in the lobby, and opens the
release page in the system browser. It never downloads or installs updates
automatically.

The desktop renderer is isolated and sandboxed. Clipboard, app metadata, and
update checks are exposed only through the limited preload API.

### Windows icon

No `.ico` source asset currently exists. Add a multi-resolution Windows icon
at `build/icon.ico`, then set `packagerConfig.icon` and the Squirrel
`setupIcon` in `forge.config.cjs`. Until then the package uses Electron's
default executable icon.
