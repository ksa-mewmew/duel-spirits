import {
  DEFAULT_SEAT_EXPIRY_SECONDS,
  DEFAULT_DRAFT_LIMIT_SECONDS,
  DEFAULT_TURN_LIMIT_SECONDS,
  SEAT_EXPIRY_OPTIONS,
  DRAFT_LIMIT_OPTIONS,
  TURN_LIMIT_OPTIONS,
} from '../shared/room-settings'
import { LOBBY_FORMATS, DEFAULT_FORMAT_ID, getFormat } from '../content/formats'
import { CARD_SETS } from '../content/sets'
import { validateDeck } from '../shared/decks'
import { getAppVersion } from '../shared/version'

import { getActiveDeck } from './deck-storage'

import type { GameFormatId, SetId } from '../content/schema'
import type { UpdateCheckResult } from '../shared/update'

let updateResult: UpdateCheckResult | null = null
let updateChecked = false
let updateDismissed = false
let updateChecking = false
let manualUpdateMessage = ''
let settingsOpen = false
let desktopResolution = '1600x900'
let desktopResolutionLoaded = false
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createRoomCode(length = 8): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return [...values].map((value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('')
}

function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function createOptionMarkup(value: number | null, label: string, selectedValue: number | null): string {
  const serialized = value === null ? 'none' : String(value)
  return `<option value="${serialized}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(label)}</option>`
}

export function renderLobby(appElement: HTMLDivElement): void {
  const desktopUpdates = window.duelDesktop?.updates
  const desktopWindow = window.duelDesktop?.window
  if (desktopWindow && !desktopResolutionLoaded) {
    desktopResolutionLoaded = true
    void desktopWindow.getResolution().then((resolution) => {
      desktopResolution = resolution
      renderLobby(appElement)
    })
  }
  if (desktopUpdates && !updateChecked && !updateChecking) {
    updateChecking = true
    void desktopUpdates.check().then((result) => {
      updateResult = result
      updateChecked = true
      updateChecking = false
      renderLobby(appElement)
    }).catch(() => {
      updateChecked = true
      updateChecking = false
    })
  }
  const availableUpdate = updateResult?.status === 'available' ? updateResult : null
  const updateBanner = availableUpdate && !updateDismissed
    ? `<section class="lobby-update-banner" aria-label="새 버전 알림">
        <div><strong>새 버전 v${escapeHtml(availableUpdate.latestVersion)}이 있습니다.</strong><span>${escapeHtml(availableUpdate.title)}</span></div>
        ${availableUpdate.notes ? `<p>${escapeHtml(availableUpdate.notes.slice(0, 500))}</p>` : ''}
        <div><button id="open-update-page" type="button">업데이트 페이지 열기</button><button id="dismiss-update-banner" type="button">나중에</button></div>
      </section>`
    : ''
  const activeDeck = getActiveDeck()
  const deckValidation = validateDeck(activeDeck.cardIds, activeDeck)
  const initialFormatId = LOBBY_FORMATS.some((format) => format.id === activeDeck.formatId)
    ? activeDeck.formatId
    : DEFAULT_FORMAT_ID

  const turnOptions = TURN_LIMIT_OPTIONS.map((seconds) => createOptionMarkup(
    seconds,
    seconds === null ? '시간 제한 없음' : `${seconds}초`,
    DEFAULT_TURN_LIMIT_SECONDS,
  )).join('')

  const expiryOptions = SEAT_EXPIRY_OPTIONS.map((seconds) => createOptionMarkup(
    seconds,
    `${seconds / 60}분`,
    DEFAULT_SEAT_EXPIRY_SECONDS,
  )).join('')
  const draftOptions = DRAFT_LIMIT_OPTIONS.map((seconds) => createOptionMarkup(
    seconds,
    `${Math.floor(seconds / 60)}분${seconds % 60 ? ` ${seconds % 60}초` : ''}`,
    DEFAULT_DRAFT_LIMIT_SECONDS,
  )).join('')
  const latestSetIds = Object.keys(CARD_SETS).slice(-3) as SetId[]
  appElement.innerHTML = `<main class="app-shell lobby-screen">
    <header class="lobby-masthead">
      <div class="lobby-brand"><span class="lobby-brand__sigil" aria-hidden="true"></span><span>DUEL SPIRITS</span></div>
      <nav class="lobby-utility" aria-label="빠른 메뉴">
        ${desktopUpdates ? '<button type="button" id="check-update-button">업데이트 확인</button>' : ''}
        ${desktopWindow ? '<button type="button" id="open-display-settings">설정</button>' : ''}
        <a class="button-link" href="#rulebook">룰북</a>
        <a class="button-link" href="#patch-notes">패치 노트</a>
        <a class="button-link" href="#support">버그 신고</a>
        ${desktopWindow ? '<button type="button" id="exit-game-button">게임 종료</button>' : ''}
      </nav>
    </header>

    <section class="lobby-hero" aria-labelledby="game-title">
      <p class="eyebrow">PRIVATE CARD DUEL</p>
      <h1 id="game-title">Duel<br>Spirits</h1>
      <p class="lobby-hero__subtitle">20장의 덱과 다섯 속성으로 만드는 비공개 1대1 카드 대전. 초대 링크 하나로 친구와 서버에 접속합니다.</p>
      <div class="lobby-hero__keywords" aria-label="게임 특징"><span>20장 덱</span><span>숨겨진 라이프</span><span>서버 권위 대전</span></div>
    </section>

    <section class="panel lobby-command" aria-label="대전 시작">
      <div class="lobby-command__title"><div><p class="eyebrow">COMMAND</p><h2>대전을 시작합니다</h2></div><span>친구 초대 전용</span></div>
      ${updateBanner}
      ${manualUpdateMessage ? `<p class="lobby-update-status" role="status">${escapeHtml(manualUpdateMessage)}</p>` : ''}

      <section class="active-deck-summary" aria-label="활성 덱">
        <div><span class="eyebrow">ACTIVE DECK</span><h2>${escapeHtml(activeDeck.name)}</h2><p>${escapeHtml(getFormat(activeDeck.formatId).name)} · ${activeDeck.cardIds.length}장 · ${deckValidation.valid ? '사용 가능' : '수정 필요'}</p></div>
        <span class="active-deck-summary__status">현재 사용 중</span>
      </section>

      <div id="lobby-action-menu" class="lobby-actions">
        <a class="lobby-action-button button-link is-primary" href="?ai=1&format=${encodeURIComponent(activeDeck.formatId)}&sets=${encodeURIComponent(activeDeck.selectedSetIds.join(','))}"><span><strong>AI 대전</strong><br><span>현재 덱을 혼자 시험하고 패치를 검증합니다.</span></span><b>→</b></a>
        <button class="lobby-action-button is-primary" type="button" data-lobby-mode="create"><span><strong>비공개 방 만들기</strong><br><span>포맷을 고르고 서버 방을 생성합니다.</span></span><b>→</b></button>
        <button class="lobby-action-button" type="button" data-lobby-mode="join"><span><strong>친구 방 참가</strong><br><span>방 코드 또는 초대 링크를 입력합니다.</span></span><b>→</b></button>
        <a class="lobby-action-button button-link" href="#decks"><span><strong>덱 빌더</strong><br><span>카드 풀을 살펴보고 사용할 덱을 구성합니다.</span></span><b>→</b></a>
        <a class="lobby-action-button button-link is-tutorial" href="?tutorial=1"><span><strong>튜토리얼</strong><br><span>첫 승리까지 핵심 조작을 차례로 연습합니다.</span></span><b>01—06</b></a>
      </div>

      <section id="lobby-create-panel" class="lobby-mode-panel" aria-labelledby="create-panel-title">
        <h3 id="create-panel-title">새 방 만들기</h3>
        <label class="field-label" for="format-select">대전 포맷</label>
        <select id="format-select">${LOBBY_FORMATS.map((format) => `<option value="${format.id}" ${format.id === initialFormatId ? 'selected' : ''}>${escapeHtml(format.name)}</option>`).join('')}</select>
        <p id="format-description" class="field-help"></p>
        <div id="draft-settings" hidden>
          <label class="field-label" for="draft-limit-select">드래프트 제한 시간</label>
          <select id="draft-limit-select">${draftOptions}</select>
          <p class="field-help">두 번째 플레이어가 들어오면 동시에 시작합니다. 시간 종료 시 남은 자리는 서버가 자동으로 채웁니다.</p>
        </div>
        <fieldset id="set-picker" class="format-set-picker">
          <legend>사용할 카드 세트</legend>
          <button id="latest-sets-button" class="set-preset-button" type="button">최신 세트 사용</button>
          ${Object.values(CARD_SETS).map((set) => `<label><input type="checkbox" data-room-set="${set.id}" ${activeDeck.selectedSetIds.includes(set.id) || set.id === 'foundations-001' ? 'checked' : ''}>${escapeHtml(set.name)} <small>${escapeHtml(set.code)}</small></label>`).join('')}
        </fieldset>
        <label class="field-label" for="turn-limit-select">턴 제한 시간</label>
        <select id="turn-limit-select">${turnOptions}</select>
        <details>
          <summary>고급 설정</summary>
          <div class="lobby-advanced-fields">
            <label class="field-label" for="room-code-input">방 코드</label>
            <input id="room-code-input" type="text" maxlength="24" placeholder="비워두면 자동 생성" autocomplete="off">
            <label class="field-label" for="seat-expiry-select">연결 종료 후 자리 보존</label>
            <select id="seat-expiry-select">${expiryOptions}</select>
          </div>
        </details>
        <div class="lobby-mode-panel__actions"><button type="button" data-lobby-back>뒤로</button><button id="create-room-button" class="is-primary" type="button">방 생성</button></div>
      </section>

      <section id="lobby-join-panel" class="lobby-mode-panel" aria-labelledby="join-panel-title">
        <h3 id="join-panel-title">친구 방 참가</h3>
        <p class="field-help">방 코드만 입력하거나 친구가 보낸 초대 링크를 붙여 넣으세요.</p>
        <label class="field-label" for="join-room-code-input">방 코드</label>
        <input id="join-room-code-input" type="text" maxlength="24" placeholder="예: A7K9M2QP" autocomplete="off">
        <div class="field-separator" aria-hidden="true">또는</div>
        <label class="field-label" for="invite-link-input">초대 링크</label>
        <input id="invite-link-input" type="url" placeholder="https://.../?room=...&key=..." autocomplete="off">
        <p id="join-error" class="form-error" role="alert" aria-live="polite"></p>
        <div class="lobby-mode-panel__actions"><button type="button" data-lobby-back>뒤로</button><button id="join-room-button" class="is-primary" type="button">방 참가</button></div>
      </section>
    </section>

    <footer class="lobby-footer"><span>DUEL SPIRITS v${escapeHtml(getAppVersion())} · CARD SET 01</span><span>16:9 DESKTOP EDITION</span></footer>
    ${desktopWindow && settingsOpen ? `<div class="display-settings-backdrop" role="presentation">
      <section class="display-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="display-settings-title">
        <p class="eyebrow">DISPLAY</p>
        <h2 id="display-settings-title">화면 설정</h2>
        <p>창 크기를 선택하면 1920 × 1080 기준 UI 전체가 같은 비율로 조정됩니다.</p>
        <label class="field-label" for="display-resolution">해상도</label>
        <select id="display-resolution">
          ${['1280x720', '1600x900', '1920x1080'].map((resolution) => `<option value="${resolution}" ${resolution === desktopResolution ? 'selected' : ''}>${resolution.replace('x', ' × ')}</option>`).join('')}
        </select>
        <div class="display-settings-actions">
          <button type="button" id="close-display-settings">취소</button>
          <button type="button" class="is-primary" id="apply-display-settings">적용</button>
        </div>
      </section>
    </div>` : ''}
  </main>`

  function updateFormatHelp(): void {
    const formatId = (document.querySelector<HTMLSelectElement>('#format-select')?.value ?? DEFAULT_FORMAT_ID) as GameFormatId
    const format = getFormat(formatId)
    const help = document.querySelector<HTMLElement>('#format-description')
    const picker = document.querySelector<HTMLElement>('#set-picker')
    const draftSettings = document.querySelector<HTMLElement>('#draft-settings')
    if (help) help.textContent = format.description
    if (picker) picker.hidden = format.cardPool.type !== 'selected-sets' && format.deckSource !== 'draft'
    if (draftSettings) draftSettings.hidden = format.deckSource !== 'draft'
  }

  const actionMenu = document.querySelector<HTMLElement>('#lobby-action-menu')
  const createPanel = document.querySelector<HTMLElement>('#lobby-create-panel')
  const joinPanel = document.querySelector<HTMLElement>('#lobby-join-panel')
  const setLobbyMode = (mode: 'menu' | 'create' | 'join'): void => {
    actionMenu?.toggleAttribute('hidden', mode !== 'menu')
    createPanel?.classList.toggle('is-active', mode === 'create')
    joinPanel?.classList.toggle('is-active', mode === 'join')
    if (mode === 'join') requestAnimationFrame(() => document.querySelector<HTMLInputElement>('#invite-link-input')?.focus())
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lobby-mode]')) {
    button.addEventListener('click', () => setLobbyMode(button.dataset.lobbyMode === 'join' ? 'join' : 'create'))
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lobby-back]')) {
    button.addEventListener('click', () => setLobbyMode('menu'))
  }
  document.querySelector<HTMLButtonElement>('#exit-game-button')?.addEventListener('click', () => {
    if (window.confirm('Duel Spirits를 종료할까요?')) void desktopWindow?.close()
  })
  document.querySelector<HTMLButtonElement>('#open-display-settings')?.addEventListener('click', () => {
    settingsOpen = true
    renderLobby(appElement)
  })
  document.querySelector<HTMLButtonElement>('#close-display-settings')?.addEventListener('click', () => {
    settingsOpen = false
    renderLobby(appElement)
  })
  document.querySelector<HTMLButtonElement>('#apply-display-settings')?.addEventListener('click', async () => {
    const resolution = document.querySelector<HTMLSelectElement>('#display-resolution')?.value
    if (!resolution || !desktopWindow) return
    try {
      desktopResolution = await desktopWindow.setResolution(resolution)
      settingsOpen = false
      renderLobby(appElement)
    } catch {
      window.alert('화면 해상도를 변경하지 못했습니다. 다시 시도해 주세요.')
    }
  })
  document.querySelector<HTMLButtonElement>('#dismiss-update-banner')?.addEventListener('click', () => {
    updateDismissed = true
    renderLobby(appElement)
  })
  document.querySelector<HTMLButtonElement>('#open-update-page')?.addEventListener('click', () => {
    void window.duelDesktop?.updates?.openDownloadPage()
  })
  document.querySelector<HTMLButtonElement>('#check-update-button')?.addEventListener('click', async () => {
    const updates = window.duelDesktop?.updates
    if (!updates || updateChecking) return
    updateChecking = true
    manualUpdateMessage = '업데이트 정보를 확인하고 있습니다.'
    renderLobby(appElement)
    try {
      updateResult = await updates.check()
      updateChecked = true
      updateDismissed = false
      manualUpdateMessage = updateResult.status === 'up-to-date'
        ? '현재 최신 버전을 사용하고 있습니다.'
        : updateResult.status === 'unavailable'
          ? '업데이트 정보를 확인하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
          : ''
    } finally {
      updateChecking = false
      renderLobby(appElement)
    }
  })

  document.querySelector<HTMLSelectElement>('#format-select')?.addEventListener('change', updateFormatHelp)
  document.querySelector<HTMLButtonElement>('#latest-sets-button')?.addEventListener('click', () => {
    for (const input of document.querySelectorAll<HTMLInputElement>('[data-room-set]')) {
      input.checked = latestSetIds.includes(input.dataset.roomSet as SetId)
    }
  })
  updateFormatHelp()

  document.querySelector<HTMLButtonElement>('#create-room-button')?.addEventListener('click', () => {
    const roomCodeInput = document.querySelector<HTMLInputElement>('#room-code-input')
    const turnLimitSelect = document.querySelector<HTMLSelectElement>('#turn-limit-select')
    const seatExpirySelect = document.querySelector<HTMLSelectElement>('#seat-expiry-select')
    const draftLimitSelect = document.querySelector<HTMLSelectElement>('#draft-limit-select')
    const formatId = (document.querySelector<HTMLSelectElement>('#format-select')?.value ?? DEFAULT_FORMAT_ID) as GameFormatId
    const format = getFormat(formatId)
    const selectedSetIds = [...document.querySelectorAll<HTMLInputElement>('[data-room-set]:checked')]
      .map((input) => input.dataset.roomSet as SetId)

    if ((format.cardPool.type === 'selected-sets' || format.deckSource === 'draft') && selectedSetIds.length === 0) {
      window.alert('적어도 하나의 카드 세트를 선택해야 합니다.')
      return
    }

    const roomId = normalizeRoomCode(roomCodeInput?.value ?? '') || createRoomCode()
    // A room code is an invitation secret in this small-group product. Keeping
    // the room key equal to the generated code lets friends join with either
    // the short code or the complete URL without an account/directory service.
    const roomKey = roomId
    const url = new URL(window.location.href)
    url.hash = ''
    url.search = ''
    url.searchParams.set('room', roomId)
    url.searchParams.set('key', roomKey)
    url.searchParams.set('turn', turnLimitSelect?.value ?? '180')
    url.searchParams.set('seatExpiry', seatExpirySelect?.value ?? '900')
    url.searchParams.set('draft', draftLimitSelect?.value ?? String(DEFAULT_DRAFT_LIMIT_SECONDS))
    url.searchParams.set('format', formatId)
    if (format.cardPool.type === 'selected-sets' || format.deckSource === 'draft') url.searchParams.set('sets', selectedSetIds.join(','))
    window.location.assign(url.toString())
  })

  document.querySelector<HTMLButtonElement>('#join-room-button')?.addEventListener('click', () => {
    const inviteInput = document.querySelector<HTMLInputElement>('#invite-link-input')
    const codeInput = document.querySelector<HTMLInputElement>('#join-room-code-input')
    const errorElement = document.querySelector<HTMLParagraphElement>('#join-error')
    try {
      const code = normalizeRoomCode(codeInput?.value ?? '')
      if (code) {
        const roomUrl = new URL(window.location.href)
        roomUrl.hash = ''
        roomUrl.search = ''
        roomUrl.searchParams.set('room', code)
        roomUrl.searchParams.set('key', code)
        window.location.assign(roomUrl.toString())
        return
      }
      const inviteUrl = new URL(inviteInput?.value.trim() ?? '')
      if (
        inviteUrl.origin !== window.location.origin
        || !inviteUrl.searchParams.get('room')
        || !inviteUrl.searchParams.get('key')
      ) throw new Error('invalid-invite')
      window.location.assign(inviteUrl.toString())
    } catch {
      if (errorElement) errorElement.textContent = '올바른 방 코드 또는 초대 링크를 입력해 주세요.'
    }
  })
}
