import {
  DEFAULT_SEAT_EXPIRY_SECONDS,
  DEFAULT_TURN_LIMIT_SECONDS,
  SEAT_EXPIRY_OPTIONS,
  TURN_LIMIT_OPTIONS,
} from '../shared/room-settings'
import { LOBBY_FORMATS, DEFAULT_FORMAT_ID, getFormat } from '../content/formats'
import { CARD_SETS } from '../content/sets'
import { validateDeck } from '../shared/decks'

import { getActiveDeck } from './deck-storage'

import type { GameFormatId, SetId } from '../content/schema'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function createRoomCode(length = 8): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return [...values].map((value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('')
}

function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24)
}

function createOptionMarkup(value: number | null, label: string, selectedValue: number | null): string {
  const serialized = value === null ? 'none' : String(value)
  return `<option value="${serialized}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(label)}</option>`
}

export function renderLobby(appElement: HTMLDivElement): void {
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

  appElement.innerHTML = `<main class="app-shell lobby-screen">
    <header class="lobby-masthead">
      <div class="lobby-brand"><span class="lobby-brand__sigil" aria-hidden="true"></span><span>DUEL SPIRITS</span></div>
      <nav class="lobby-utility" aria-label="빠른 메뉴">
        <a class="button-link" href="#decks">덱 빌더</a>
        <button type="button" id="lobby-rule-hint">게임 안내</button>
      </nav>
    </header>

    <section class="lobby-hero" aria-labelledby="game-title">
      <p class="eyebrow">PRIVATE CARD DUEL</p>
      <h1 id="game-title">Duel<br>Spirits</h1>
      <p class="lobby-hero__subtitle">20장의 덱과 다섯 속성으로 만드는 비공개 1대1 카드 대전. 계정이나 매칭 없이 링크 하나로 친구를 초대합니다.</p>
      <div class="lobby-hero__keywords" aria-label="게임 특징"><span>20장 덱</span><span>숨겨진 라이프</span><span>서버 권위 대전</span></div>
    </section>

    <section class="panel lobby-command" aria-label="대전 시작">
      <div class="lobby-command__title"><div><p class="eyebrow">COMMAND</p><h2>대전을 시작합니다</h2></div><span>친구 초대 전용</span></div>

      <section class="active-deck-summary" aria-label="활성 덱">
        <div><span class="eyebrow">ACTIVE DECK</span><h2>${escapeHtml(activeDeck.name)}</h2><p>${escapeHtml(getFormat(activeDeck.formatId).name)} · ${activeDeck.cardIds.length}장 · ${deckValidation.valid ? '사용 가능' : '수정 필요'}</p></div>
        <a class="button-link" href="#decks">변경</a>
      </section>

      <div id="lobby-action-menu" class="lobby-actions">
        <button class="lobby-action-button is-primary" type="button" data-lobby-mode="create"><span><strong>비공개 방 만들기</strong><br><span>포맷을 고르고 초대 링크를 생성합니다.</span></span><b>→</b></button>
        <button class="lobby-action-button" type="button" data-lobby-mode="join"><span><strong>초대 링크로 참가</strong><br><span>받은 링크를 붙여 넣어 바로 입장합니다.</span></span><b>→</b></button>
        <a class="lobby-action-button button-link" href="#decks"><span><strong>덱 빌더 열기</strong><br><span>카드 풀을 살펴보고 사용할 덱을 구성합니다.</span></span><b>→</b></a>
      </div>

      <section id="lobby-create-panel" class="lobby-mode-panel" aria-labelledby="create-panel-title">
        <h3 id="create-panel-title">새 방 만들기</h3>
        <label class="field-label" for="format-select">대전 포맷</label>
        <select id="format-select">${LOBBY_FORMATS.map((format) => `<option value="${format.id}" ${format.id === initialFormatId ? 'selected' : ''}>${escapeHtml(format.name)}</option>`).join('')}</select>
        <p id="format-description" class="field-help"></p>
        <fieldset id="set-picker" class="format-set-picker">
          <legend>세트 한정전 사용 세트</legend>
          ${Object.values(CARD_SETS).map((set) => `<label><input type="checkbox" data-room-set="${set.id}" ${activeDeck.selectedSetIds.includes(set.id) || set.id === 'foundations-001' ? 'checked' : ''}>${escapeHtml(set.name)} <small>${escapeHtml(set.code)}</small></label>`).join('')}
        </fieldset>
        <label class="field-label" for="turn-limit-select">턴 제한 시간</label>
        <select id="turn-limit-select">${turnOptions}</select>
        <details>
          <summary>고급 설정</summary>
          <div class="lobby-mode-panel is-active">
            <label class="field-label" for="room-code-input">방 코드</label>
            <input id="room-code-input" type="text" maxlength="24" placeholder="비워두면 자동 생성" autocomplete="off">
            <label class="field-label" for="seat-expiry-select">연결 종료 후 자리 보존</label>
            <select id="seat-expiry-select">${expiryOptions}</select>
          </div>
        </details>
        <div class="lobby-mode-panel__actions"><button type="button" data-lobby-back>뒤로</button><button id="create-room-button" class="is-primary" type="button">방 생성</button></div>
      </section>

      <section id="lobby-join-panel" class="lobby-mode-panel" aria-labelledby="join-panel-title">
        <h3 id="join-panel-title">초대 링크로 참가</h3>
        <p class="field-help">친구가 보낸 Duel Spirits 링크를 그대로 붙여 넣으세요.</p>
        <label class="field-label" for="invite-link-input">초대 링크</label>
        <input id="invite-link-input" type="url" placeholder="https://.../?room=...&key=..." autocomplete="off">
        <p id="join-error" class="form-error" role="alert" aria-live="polite"></p>
        <div class="lobby-mode-panel__actions"><button type="button" data-lobby-back>뒤로</button><button id="join-room-button" class="is-primary" type="button">방 참가</button></div>
      </section>
    </section>

    <footer class="lobby-footer"><span>DUEL SPIRITS · CARD SET 01</span><span>16:9 DESKTOP EDITION</span></footer>
  </main>`

  function updateFormatHelp(): void {
    const formatId = (document.querySelector<HTMLSelectElement>('#format-select')?.value ?? DEFAULT_FORMAT_ID) as GameFormatId
    const format = getFormat(formatId)
    const help = document.querySelector<HTMLElement>('#format-description')
    const picker = document.querySelector<HTMLElement>('#set-picker')
    if (help) help.textContent = format.description
    if (picker) picker.hidden = format.cardPool.type !== 'selected-sets'
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
  document.querySelector<HTMLButtonElement>('#lobby-rule-hint')?.addEventListener('click', () => {
    window.alert('방을 만든 뒤 초대 링크를 친구에게 보내세요. 두 플레이어가 덱을 준비하면 대전이 시작됩니다.')
  })

  document.querySelector<HTMLSelectElement>('#format-select')?.addEventListener('change', updateFormatHelp)
  updateFormatHelp()

  document.querySelector<HTMLButtonElement>('#create-room-button')?.addEventListener('click', () => {
    const roomCodeInput = document.querySelector<HTMLInputElement>('#room-code-input')
    const turnLimitSelect = document.querySelector<HTMLSelectElement>('#turn-limit-select')
    const seatExpirySelect = document.querySelector<HTMLSelectElement>('#seat-expiry-select')
    const formatId = (document.querySelector<HTMLSelectElement>('#format-select')?.value ?? DEFAULT_FORMAT_ID) as GameFormatId
    const format = getFormat(formatId)
    const selectedSetIds = [...document.querySelectorAll<HTMLInputElement>('[data-room-set]:checked')]
      .map((input) => input.dataset.roomSet as SetId)

    if (format.cardPool.type === 'selected-sets' && selectedSetIds.length === 0) {
      window.alert('세트 한정전에서는 적어도 하나의 세트를 선택해야 합니다.')
      return
    }

    const requestedRoomCode = normalizeRoomCode(roomCodeInput?.value ?? '')
    const roomId = requestedRoomCode || createRoomCode()
    const roomKey = crypto.randomUUID()
    const url = new URL(window.location.href)
    url.hash = ''
    url.search = ''
    url.searchParams.set('room', roomId)
    url.searchParams.set('key', roomKey)
    url.searchParams.set('turn', turnLimitSelect?.value ?? '180')
    url.searchParams.set('seatExpiry', seatExpirySelect?.value ?? '900')
    url.searchParams.set('format', formatId)
    if (format.cardPool.type === 'selected-sets') url.searchParams.set('sets', selectedSetIds.join(','))
    window.location.assign(url.toString())
  })

  document.querySelector<HTMLButtonElement>('#join-room-button')?.addEventListener('click', () => {
    const inviteInput = document.querySelector<HTMLInputElement>('#invite-link-input')
    const errorElement = document.querySelector<HTMLParagraphElement>('#join-error')

    try {
      const inviteUrl = new URL(inviteInput?.value.trim() ?? '')
      if (
        inviteUrl.origin !== window.location.origin
        || !inviteUrl.searchParams.get('room')
        || !inviteUrl.searchParams.get('key')
      ) throw new Error('invalid-invite')
      window.location.assign(inviteUrl.toString())
    } catch {
      if (errorElement) errorElement.textContent = '올바른 초대 링크를 입력해 주세요.'
    }
  })
}
