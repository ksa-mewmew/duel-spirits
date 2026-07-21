import { CARD_GROUPS, CARDS } from '../shared/cards'
import { DECK_SCHEMA_VERSION, isDeckCompatibleWithFormat, validateDeck } from '../shared/decks'
import { getFormat } from '../content/formats'
import { FIELD_LIMIT, LIFE_SIZE } from '../shared/rules'
import {
  parseRoomFormatId,
  parseSeatExpirySeconds,
  parseSelectedSetIds,
  parseTurnLimitSeconds,
} from '../shared/room-settings'
import { renderCard, renderCardBack } from '../components/card-renderer'

import type { CardId } from '../shared/cards'
import type { CardPlaySelection, GameAction } from '../shared/actions'
import type { PublicDeckStates } from '../shared/messages'
import type { RoomPhase } from '../shared/room-lifecycle'
import type { RoomSettings } from '../shared/room-settings'
import type { SeatExpiryState } from '../shared/room-timing'
import type { CardInstance, PlayerId, UnitInstance } from '../shared/types'
import type { GameView, PlayerView } from '../shared/views'

import { getActiveDeck, loadDecks, setActiveDeckId } from './deck-storage'
import {
  connectToRoom,
  sendDeck,
  sendDeckReady,
  sendLeaveRoom,
  sendPlayerAction,
  sendRematchReady,
} from './network'

interface PlayDraft {
  cardInstanceId: string
  manaIds: string[]
  unitId?: string
  lifeIndex?: number
  effectManaId?: string
  discardId?: string
}

const appQuery = document.querySelector<HTMLDivElement>('#app')
if (!appQuery) throw new Error('App element was not found.')
const appElement: HTMLDivElement = appQuery

const pageUrl = new URL(window.location.href)
const roomIdParam = pageUrl.searchParams.get('room')
const roomKeyParam = pageUrl.searchParams.get('key')
if (!roomIdParam || !roomKeyParam) throw new Error('Room id and key are required.')
const roomId = roomIdParam
const roomKey = roomKeyParam

const requestedFormatId = parseRoomFormatId(pageUrl.searchParams.get('format'))
const requestedSettings: RoomSettings = {
  turnLimitSeconds: parseTurnLimitSeconds(pageUrl.searchParams.get('turn')),
  seatExpirySeconds: parseSeatExpirySeconds(pageUrl.searchParams.get('seatExpiry')),
  formatId: requestedFormatId,
  selectedSetIds: parseSelectedSetIds(pageUrl.searchParams.get('sets'), requestedFormatId),
}

const seatStorageKey = `card-duel:seat:${roomId}:${roomKey}`
let seatToken = window.localStorage.getItem(seatStorageKey)
let game: GameView | null = null
let assignedPlayerId: PlayerId | null = null
let connectedPlayers: PlayerId[] = []
let reservedPlayers: PlayerId[] = []
let rematchReadyPlayers: PlayerId[] = []
let roomPhase: RoomPhase = 'waiting'
let roomSettings: RoomSettings = requestedSettings
let turnDeadlineAt: number | null = null
let seatExpiresAt: SeatExpiryState = { P1: null, P2: null }
let deckStates: PublicDeckStates = {
  P1: { submitted: false, ready: false, name: null },
  P2: { submitted: false, ready: false, name: null },
}
let selectedAttackerId: string | null = null
let selectedAttackLifeIndices: number[] = []
let playDraft: PlayDraft | null = null
let pendingChoiceIds: string[] = []
let message = '서버에 연결하는 중입니다.'
let networkStatus = '연결 중'
let awaitingServer = false
let hasLeftRoom = false
let joinRejectedMessage: string | null = null
let selectedDeckId = getActiveDeck().id
let openDiscardPlayerId: PlayerId | null = null
let pinnedPreviewCardId: CardId | null = null
let roomMenuOpen = false
let rulebookOpen = false

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getSelectedDeck() {
  const decks = loadDecks()
  return decks.find((deck) => deck.id === selectedDeckId) ?? getActiveDeck()
}

function submitSelectedDeck(): void {
  const deck = getSelectedDeck()
  const validation = validateDeck(deck.cardIds, deck)
  if (!validation.valid) {
    message = validation.errors.join(' ')
    render()
    return
  }
  if (!isDeckCompatibleWithFormat(
    deck,
    roomSettings.formatId,
    roomSettings.selectedSetIds,
  )) {
    message = `이 방은 ${getFormat(roomSettings.formatId).name} 포맷입니다. 같은 포맷의 덱을 선택해 주세요.`
    render()
    return
  }

  setActiveDeckId(deck.id)
  awaitingServer = true
  sendDeck(socket, {
    schemaVersion: DECK_SCHEMA_VERSION,
    deckId: deck.id,
    name: deck.name,
    cardIds: [...deck.cardIds],
    formatId: deck.formatId,
    selectedSetIds: [...deck.selectedSetIds],
    draftPool: deck.draftPool ? structuredClone(deck.draftPool) : null,
  })
  render()
}

const socket = connectToRoom(
  roomId,
  {
    roomKey,
    getSeatToken: () => seatToken,
    requestedSettings,
  },
  {
    onOpen: () => {
      networkStatus = '서버 연결됨'
      render()
    },
    onClose: (event) => {
      awaitingServer = false
      if (event.code === 4001) {
        joinRejectedMessage = '같은 자리가 다른 창에서 연결되었습니다.'
      } else if (event.code === 4002) {
        hasLeftRoom = true
        game = null
        assignedPlayerId = null
        window.localStorage.removeItem(seatStorageKey)
      } else if (!joinRejectedMessage && !hasLeftRoom) {
        networkStatus = '연결 끊김 · 재접속 시도 중'
      }
      render()
    },
    onError: () => {
      networkStatus = '연결 오류'
      awaitingServer = false
      render()
    },
    onMessage: (serverMessage) => {
      switch (serverMessage.type) {
        case 'ASSIGNED_PLAYER':
          seatToken = serverMessage.seatToken
          window.localStorage.setItem(seatStorageKey, seatToken)
          assignedPlayerId = serverMessage.playerId
          networkStatus = serverMessage.reconnected
            ? `${serverMessage.playerId} 재접속`
            : `${serverMessage.playerId} 배정`
          break

        case 'ROOM_STATE':
          roomPhase = serverMessage.phase
          connectedPlayers = serverMessage.connectedPlayers
          reservedPlayers = serverMessage.reservedPlayers
          rematchReadyPlayers = serverMessage.rematchReadyPlayers
          deckStates = serverMessage.deckStates
          roomSettings = serverMessage.settings
          turnDeadlineAt = serverMessage.turnDeadlineAt
          seatExpiresAt = serverMessage.seatExpiresAt
          awaitingServer = false
          if (
            roomPhase === 'waiting'
            && assignedPlayerId
            && !deckStates[assignedPlayerId].submitted
          ) {
            const compatibleDeck = loadDecks().find((deck) =>
              isDeckCompatibleWithFormat(
                deck,
                roomSettings.formatId,
                roomSettings.selectedSetIds,
              ),
            )
            if (compatibleDeck) selectedDeckId = compatibleDeck.id
            queueMicrotask(submitSelectedDeck)
          }
          break

        case 'DECK_ACCEPTED':
          awaitingServer = false
          message = `${serverMessage.deckName} 덱을 서버가 확인했습니다.`
          break

        case 'GAME_VIEW':
          game = serverMessage.game
          assignedPlayerId ??= game.viewer
          selectedAttackerId = null
          selectedAttackLifeIndices = []
          playDraft = null
          pendingChoiceIds = []
          awaitingServer = false
          message = game.status === 'finished'
            ? `${game.winner} 승리`
            : game.pendingChoice
              ? game.pendingChoice.playerId === game.viewer
                ? '각성 또는 카드 효과를 선택해야 합니다.'
                : `${game.pendingChoice.playerId}이(가) 카드 효과를 선택하고 있습니다.`
              : game.currentPlayer === game.viewer
                ? '내 턴입니다.'
                : '상대 턴입니다.'
          break

        case 'ACTION_ERROR':
          awaitingServer = false
          message = serverMessage.message
          break

        case 'TURN_TIMED_OUT':
          awaitingServer = false
          message = `${serverMessage.playerId}의 제한 시간이 끝나 턴이 넘어갔습니다.`
          break

        case 'SEAT_EXPIRED':
          message = `${serverMessage.playerId}의 자리가 만료되었습니다.`
          break

        case 'LEFT_ROOM':
          hasLeftRoom = true
          game = null
          assignedPlayerId = null
          window.localStorage.removeItem(seatStorageKey)
          openDiscardPlayerId = null
          pinnedPreviewCardId = null
          roomMenuOpen = false
          rulebookOpen = false
          socket.close()
          break

        case 'GAME_CLEARED':
          game = null
          selectedAttackerId = null
          selectedAttackLifeIndices = []
          playDraft = null
          pendingChoiceIds = []
          openDiscardPlayerId = null
          pinnedPreviewCardId = null
          roomMenuOpen = false
          rulebookOpen = false
          message = '현재 게임이 정리되었습니다.'
          break

        case 'JOIN_REJECTED':
          joinRejectedMessage = serverMessage.message
          networkStatus = serverMessage.message
          socket.close()
          break
      }
      render()
    },
  },
)

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function updateClock(): void {
  const timer = document.querySelector<HTMLElement>('#turn-timer')
  if (!timer) return
  if (roomSettings.turnLimitSeconds === null) timer.textContent = '∞'
  else if (turnDeadlineAt === null) {
    timer.textContent = roomPhase === 'disconnected'
      ? '일시 정지'
      : `${roomSettings.turnLimitSeconds}초`
  } else timer.textContent = formatDuration(turnDeadlineAt - Date.now())

  for (const playerId of ['P1', 'P2'] as const) {
    const element = document.querySelector<HTMLElement>(`#seat-expiry-${playerId}`)
    const expiry = seatExpiresAt[playerId]
    if (element) {
      element.textContent = expiry === null
        ? ''
        : `${formatDuration(expiry - Date.now())} 후 만료`
    }
  }
}

function actionButton(
  label: string,
  action: string,
  valueName?: string,
  value?: string,
  disabled = false,
): string {
  return `<button type="button" data-action="${action}" ${valueName && value !== undefined ? `data-${valueName}="${escapeHtml(value)}"` : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`
}

function effectiveCost(card: CardInstance): number {
  return Math.max(0, CARDS[card.cardId].cost - (card.costReduction ?? 0))
}

function unitTargetMode(cardId: CardId): 'any' | 'exhausted' | null {
  if (cardId === 'desertification') return 'any'
  if (cardId === 'ebb' || cardId === 'reverse_current') return 'exhausted'
  return null
}

function needsLifeTarget(cardId: CardId): boolean {
  return cardId === 'holy_mirror_wall'
}

function hasRushView(unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  return definition.type === 'unit'
    && (definition.keywords?.includes('rush') || unit.temporaryRush === true)
}

function hasChargeView(unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  return definition.type === 'unit'
    && definition.keywords?.includes('charge') === true
}

function hasWindfuryView(player: PlayerView, unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return false
  if (definition.keywords?.includes('windfury')) return true
  if (unit.cardId === 'last_ember' && player.field.length === 1) return true
  if (unit.cardId === 'carrion_crow' && player.discard.length >= 2) return true
  return false
}

function hasFlyingView(unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  return definition.type === 'unit' && definition.keywords?.includes('flying') === true
}

function hasStealthView(player: PlayerView, unit: UnitInstance): boolean {
  if (unit.cardId === 'corpse_cat' && player.field.length > 1) return true
  return unit.cardId === 'nameless_shadow' && player.field.length === 1
}

function attackValueView(player: PlayerView, unit: UnitInstance): number {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return 0
  return definition.attack
    + unit.temporaryAttackModifier
    + (unit.cardId === 'last_ember' && player.field.length === 1 ? 2 : 0)
}

function canUnitAttackView(
  player: PlayerView,
  unit: UnitInstance,
  targetKind: 'unit' | 'player',
): boolean {
  if (unit.exhausted) return false
  if (
    unit.summonedThisTurn
    && !hasRushView(unit)
    && !(targetKind === 'unit' && hasChargeView(unit))
  ) return false
  const maxAttacks = hasWindfuryView(player, unit) ? 2 : 1
  if (unit.attacksThisTurn >= maxAttacks) return false
  if (
    game
    && game.players.P1.field.concat(game.players.P2.field)
      .some((candidate) => candidate.cardId === 'apostle_pigeon')
    && player.attacksThisTurn >= 1
  ) return false
  return true
}

function selectedPlayCard(): CardInstance | null {
  if (!game || !playDraft) return null
  return game.players[game.viewer].hand.find(
    (card) => card.instanceId === playDraft?.cardInstanceId,
  ) ?? null
}

function canSelectedAttackerDirectAttack(opponentPlayer: PlayerView): boolean {
  if (!game || !selectedAttackerId) return false
  const self = game.players[game.viewer]
  const attacker = self.field.find((unit) => unit.instanceId === selectedAttackerId)
  if (!attacker || !canUnitAttackView(self, attacker, 'player')) return false
  const attackableEnemy = opponentPlayer.field.some(
    (unit) => !hasStealthView(opponentPlayer, unit),
  )
  return hasFlyingView(attacker) || !attackableEnemy
}

function requiredAttackLifeCount(opponentPlayer: PlayerView): number {
  if (!game || !selectedAttackerId) return 0
  const self = game.players[game.viewer]
  const attacker = self.field.find((unit) => unit.instanceId === selectedAttackerId)
  if (!attacker) return 0
  const extra = self.extraLifeLossOnDirectAttack && attackValueView(self, attacker) === 1 ? 1 : 0
  return Math.min(1 + extra, opponentPlayer.lifeCount)
}

function renderCardBacks(count: number, className: string): string {
  return Array.from({ length: count }, () => renderCardBack([className])).join('')
}

function renderLife(playerId: PlayerId, owner: 'self' | 'opponent'): string {
  if (!game) return ''
  const player = game.players[playerId]
  const pending = game.pendingChoice
  const pendingMine = pending?.playerId === game.viewer
  const canAttackLife = owner === 'opponent'
    && pending === null
    && playDraft === null
    && canSelectedAttackerDirectAttack(player)

  const visibleSlots = Math.max(LIFE_SIZE, player.lifeCount)
  return Array.from({ length: visibleSlots }, (_, index) => {
    if (index >= player.lifeCount) {
      return '<div class="life-slot is-empty" aria-label="빈 라이프 자리"><span aria-hidden="true">＋</span></div>'
    }

    let action: string | null = null
    let selected = false
    if (pendingMine && pending?.type === 'TEMPLE_PROSPECT_LIFE' && owner === 'self') {
      action = 'resolve-life-choice'
    } else if (pendingMine && pending?.type === 'HOLY_MIRROR_LIFE' && owner === 'opponent') {
      action = 'resolve-life-choice'
    } else if (playDraft && owner === 'opponent' && needsLifeTarget(selectedPlayCard()?.cardId ?? 'living_flame')) {
      action = 'select-spell-life'
      selected = playDraft.lifeIndex === index
    } else if (canAttackLife) {
      action = 'select-attack-life'
      selected = selectedAttackLifeIndices.includes(index)
    }

    const cardBack = renderCardBack([
      'life-card',
      `life-card--${owner}`,
      action ? 'is-targetable' : '',
      selected ? 'is-selected' : '',
    ].filter(Boolean))

    return action
      ? `<button type="button" class="life-choice-button" data-action="${action}" data-life-index="${index}">${cardBack}</button>`
      : cardBack
  }).join('')
}

function renderMana(player: PlayerView, isSelf: boolean): string {
  if (!game) return ''
  const normalCanAct = isSelf
    && game.viewer === game.currentPlayer
    && game.status === 'playing'
    && roomPhase === 'playing'
    && game.pendingChoice === null
    && playDraft === null
    && !awaitingServer

  return player.mana.map((mana) => {
    const selectedAsCost = playDraft?.manaIds.includes(mana.instanceId) ?? false
    const selectedAsEffect = playDraft?.effectManaId === mana.instanceId
    const actions: string[] = []

    if (isSelf && playDraft && !mana.exhausted) {
      const draftCard = selectedPlayCard()
      if (draftCard?.cardId === 'grave_digging') {
        actions.push(actionButton(
          selectedAsEffect ? '선택 취소' : '묘지로 보냄',
          'select-effect-mana',
          'mana-id',
          mana.instanceId,
        ))
      } else {
        actions.push(actionButton(
          selectedAsCost ? '비용 취소' : '비용 선택',
          'select-cost-mana',
          'mana-id',
          mana.instanceId,
        ))
      }
    } else if (normalCanAct && mana.cardId === 'heavy_seed') {
      actions.push(actionButton('소환', 'summon-from-mana', 'mana-id', mana.instanceId))
    }

    return renderCard(mana.cardId, {
      instanceId: mana.instanceId,
      compact: true,
      exhausted: mana.exhausted,
      selected: selectedAsCost || selectedAsEffect,
      targetable: isSelf && playDraft !== null && !mana.exhausted,
      classNames: ['mana-card'],
      statusBadges: [{
        label: mana.exhausted ? '소진' : '준비',
        tone: mana.exhausted ? 'inactive' : 'active',
      }],
      actionsHtml: actions.join(''),
    })
  }).join('') || '<div class="zone-empty">마나 없음</div>'
}

function hasLegalPlayTarget(card: CardInstance, self: PlayerView, enemy: PlayerView): boolean {
  const targetMode = unitTargetMode(card.cardId)
  if (targetMode === 'any' && enemy.field.length === 0) return false
  if (targetMode === 'exhausted' && !enemy.field.some((unit) => unit.exhausted)) return false
  if (needsLifeTarget(card.cardId) && enemy.lifeCount === 0) return false
  if (card.cardId === 'grave_digging' && !self.mana.some((mana) => !mana.exhausted)) return false
  return true
}

function renderHand(player: PlayerView, isSelf: boolean): string {
  if (!isSelf) return renderCardBacks(player.handCount, 'hand-card hand-card--hidden')
  if (!game) return ''
  const currentGame = game

  const enemyId: PlayerId = currentGame.viewer === 'P1' ? 'P2' : 'P1'
  const enemy = currentGame.players[enemyId]
  const isMyTurn = currentGame.viewer === currentGame.currentPlayer
  const readyMana = player.mana.filter((mana) => !mana.exhausted).length
  const pending = currentGame.pendingChoice

  return player.hand.map((card) => {
    const definition = CARDS[card.cardId]
    const selected = playDraft?.cardInstanceId === card.instanceId
    const canAct = currentGame.status === 'playing'
      && roomPhase === 'playing'
      && isMyTurn
      && !awaitingServer
      && pending === null
      && playDraft === null
    const actions: string[] = []

    if (pending?.playerId === currentGame.viewer && pending.type === 'TEMPLE_PROSPECT_HAND') {
      actions.push(actionButton('라이프로', 'resolve-hand-choice', 'card-instance-id', card.instanceId))
    } else if (canAct) {
      actions.push(actionButton(
        '마나',
        'place-mana',
        'card-instance-id',
        card.instanceId,
        player.manaPlacedThisTurn,
      ))
      actions.push(actionButton(
        definition.type === 'unit' ? '소환 준비' : '사용 준비',
        'begin-play-card',
        'card-instance-id',
        card.instanceId,
        readyMana < effectiveCost(card)
          || (definition.type === 'unit' && player.field.length >= FIELD_LIMIT)
          || !hasLegalPlayTarget(card, player, enemy),
      ))
    }

    return renderCard(card.cardId, {
      instanceId: card.instanceId,
      selected,
      classNames: ['hand-card'],
      actionsHtml: actions.join(''),
    })
  }).join('') || '<div class="zone-empty">손이 비었습니다.</div>'
}

function getUnitStatusBadges(
  player: PlayerView,
  unit: UnitInstance,
): Array<{ label: string; tone?: 'active' | 'inactive' | 'warning' }> {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return []

  const badges: Array<{ label: string; tone?: 'active' | 'inactive' | 'warning' }> = []
  const isolated = player.field.length === 1

  if (unit.cardId === 'last_ember' || unit.cardId === 'nameless_shadow') {
    badges.push({
      label: isolated ? '고립' : '고립 해제',
      tone: isolated ? 'active' : 'inactive',
    })
  }
  if (hasRushView(unit)) badges.push({ label: '기습' })
  if (hasChargeView(unit)) badges.push({ label: '돌진', tone: 'warning' })
  if (hasWindfuryView(player, unit)) badges.push({ label: '질풍' })
  if (hasFlyingView(unit)) badges.push({ label: '비행' })
  if (hasStealthView(player, unit)) badges.push({ label: '잠행' })
  return badges
}

function renderField(player: PlayerView, isSelf: boolean): string {
  if (!game) return ''
  const currentGame = game
  const isMyTurn = currentGame.viewer === currentGame.currentPlayer
  const draftCard = selectedPlayCard()
  const targetMode = draftCard ? unitTargetMode(draftCard.cardId) : null
  const opponentId: PlayerId = currentGame.viewer === 'P1' ? 'P2' : 'P1'
  const opponentPlayer = currentGame.players[opponentId]

  const cards = player.field.map((unit) => {
    const definition = CARDS[unit.cardId]
    if (definition.type !== 'unit') return ''
    const selectedForAttack = unit.instanceId === selectedAttackerId
    const selectedForSpell = unit.instanceId === playDraft?.unitId
    const normalAttackMode = playDraft === null && currentGame.pendingChoice === null
    const canSelectAttacker = isSelf
      && isMyTurn
      && normalAttackMode
      && roomPhase === 'playing'
      && currentGame.status === 'playing'
      && !awaitingServer
      && (
        canUnitAttackView(player, unit, 'player')
        || (
          canUnitAttackView(player, unit, 'unit')
          && opponentPlayer.field.some((target) => !hasStealthView(opponentPlayer, target))
        )
      )
    const canSpellTarget = !isSelf
      && isMyTurn
      && targetMode !== null
      && currentGame.pendingChoice === null
      && !awaitingServer
      && (targetMode === 'any' || unit.exhausted)
    const selectedAttacker = currentGame.players[currentGame.viewer].field.find(
      (candidate) => candidate.instanceId === selectedAttackerId,
    )
    const canAttackTarget = !isSelf
      && isMyTurn
      && normalAttackMode
      && selectedAttacker !== undefined
      && canUnitAttackView(currentGame.players[currentGame.viewer], selectedAttacker, 'unit')
      && !hasStealthView(player, unit)
      && roomPhase === 'playing'
      && !awaitingServer

    let actions = ''
    if (canSpellTarget) {
      actions = actionButton(
        selectedForSpell ? '대상 취소' : '주문 대상',
        'select-spell-unit',
        'unit-id',
        unit.instanceId,
      )
    } else if (isSelf && canSelectAttacker) {
      actions = actionButton(
        selectedForAttack ? '선택 취소' : '공격',
        'select-attacker',
        'unit-id',
        unit.instanceId,
      )
    } else if (canAttackTarget) {
      actions = actionButton('공격 대상', 'attack-unit', 'defender-id', unit.instanceId)
    }

    return renderCard(unit.cardId, {
      instanceId: unit.instanceId,
      selected: selectedForAttack || selectedForSpell,
      targetable: canSpellTarget || canAttackTarget,
      exhausted: unit.exhausted,
      summonedThisTurn: unit.summonedThisTurn,
      remainingHealth: definition.health - unit.damage,
      displayAttack: attackValueView(player, unit),
      statusBadges: getUnitStatusBadges(player, unit),
      classNames: ['field-card'],
      actionsHtml: actions,
    })
  })

  while (cards.length < FIELD_LIMIT) cards.push('<div class="field-slot is-empty"></div>')
  return cards.join('')
}

function renderCardPile(playerId: PlayerId, kind: 'deck' | 'discard'): string {
  if (!game) return ''
  const player = game.players[playerId]

  if (kind === 'deck') {
    return `<div class="card-pile card-pile--deck" aria-label="${playerId}의 덱 ${player.deckCount}장">
      <div class="card-pile__back" aria-hidden="true"><span></span></div>
      <span class="card-pile__label">덱</span>
      <strong class="card-pile__count">${player.deckCount}</strong>
    </div>`
  }

  const topCard = player.discard.at(-1)
  const topDefinition = topCard ? CARDS[topCard.cardId] : null
  return `<button
    type="button"
    class="card-pile card-pile--discard ${topCard ? '' : 'is-empty'}"
    data-action="open-discard"
    data-player-id="${playerId}"
    ${topCard ? `data-preview-card-id="${topCard.cardId}"` : ''}
    aria-label="${playerId}의 묘지 ${player.discard.length}장 열기"
  >
    <div class="card-pile__face card-pile__face--${topDefinition?.groups[0] ?? 'empty'}">
      <span>${topDefinition ? escapeHtml(topDefinition.name) : '비어 있음'}</span>
    </div>
    <span class="card-pile__label">묘지</span>
    <strong class="card-pile__count">${player.discard.length}</strong>
  </button>`
}

function renderPlayerBoard(playerId: PlayerId, position: 'self' | 'opponent'): string {
  if (!game) return ''
  const player = game.players[playerId]
  const isSelf = player.isViewer
  const directTargeting = position === 'opponent'
    && game.pendingChoice === null
    && playDraft === null
    && canSelectedAttackerDirectAttack(player)
  const readyMana = player.mana.filter((card) => !card.exhausted).length

  const isActivePlayer = game.currentPlayer === playerId
  const strip = `<header class="player-strip player-strip--${position} ${isActivePlayer ? 'is-active-turn' : ''}">
    <strong>${playerId} ${isSelf ? '· 나' : '· 상대'}</strong>
    ${isActivePlayer ? `<span class="turn-owner-badge">${isSelf ? '내 턴' : '진행 중'}</span>` : ''}
    <span>손 ${player.handCount}</span>
    <span>라이프 ${player.lifeCount}</span>
    <span>마나 ${readyMana}/${player.mana.length}</span>
    <span>덱 ${player.deckCount}</span>
    <button type="button" class="strip-link" data-action="open-discard" data-player-id="${playerId}">묘지 ${player.discard.length}</button>
  </header>`

  const board = `<div class="combat-row combat-row--${position}">
    <section class="life-zone life-zone--rail ${directTargeting ? 'is-targetable' : ''}" aria-label="${playerId} 라이프">
      <div class="zone-heading"><span>라이프</span><strong>${player.lifeCount}</strong></div>
      <div class="life-stack">${renderLife(playerId, position)}</div>
    </section>

    <section class="field-column" aria-label="${playerId} 전장">
      <div class="field-heading">${position === 'opponent' ? '상대 전장' : '내 전장'}</div>
      <div class="field-zone">${renderField(player, isSelf)}</div>
    </section>

    <aside class="resource-rail">
      <section class="mana-zone" aria-label="${playerId} 마나">
        <div class="zone-heading"><span>마나</span><strong>${readyMana}/${player.mana.length}</strong></div>
        <div class="mana-list">${renderMana(player, isSelf)}</div>
      </section>
      <div class="pile-row">
        ${renderCardPile(playerId, 'deck')}
        ${renderCardPile(playerId, 'discard')}
      </div>
    </aside>
  </div>`

  if (position === 'opponent') {
    return `<section class="player-board player-board--opponent ${isActivePlayer ? 'is-active-player' : ''}">${strip}${board}</section>`
  }

  return `<section class="player-board player-board--self ${isActivePlayer ? 'is-active-player' : ''}">
    ${board}
    ${strip}
    <section class="hand-area" aria-label="내 손패">
      <div class="hand-heading"><span>내 손패</span><strong>${player.handCount}</strong></div>
      <div class="hand-zone hand-zone--self">${renderHand(player, true)}</div>
    </section>
  </section>`
}

function renderMiniChoiceCard(
  card: CardInstance,
  action: string,
  selected = false,
  disabled = false,
): string {
  return renderCard(card.cardId, {
    instanceId: card.instanceId,
    compact: true,
    selected,
    classNames: ['choice-card'],
    actionsHtml: actionButton(
      selected ? '선택 취소' : '선택',
      action,
      'card-instance-id',
      card.instanceId,
      disabled,
    ),
  })
}

function renderPlayDraftPanel(): string {
  if (!game || !playDraft) return ''
  const card = selectedPlayCard()
  if (!card) return ''
  const definition = CARDS[card.cardId]
  const cost = effectiveCost(card)
  const targetMode = unitTargetMode(card.cardId)
  const sections: string[] = [
    `<p><strong>${escapeHtml(definition.name)}</strong></p>`,
    `<p>비용 마나: ${playDraft.manaIds.length}/${cost}</p>`,
  ]

  if (targetMode) {
    sections.push(`<p>대상 몬스터: ${playDraft.unitId ? '선택됨' : '선택 필요'}</p>`)
  }
  if (needsLifeTarget(card.cardId)) {
    sections.push(`<p>대상 라이프: ${playDraft.lifeIndex === undefined ? '선택 필요' : `${playDraft.lifeIndex + 1}번째`}</p>`)
  }
  if (card.cardId === 'grave_digging') {
    sections.push(`<p>묘지로 보낼 마나: ${playDraft.effectManaId ? '선택됨' : '선택 필요'}</p>`)
    sections.push(`<p>손으로 가져올 카드: ${playDraft.discardId ? '선택됨' : '선택 필요'}</p>`)
    sections.push(`<button type="button" data-action="open-discard" data-player-id="${game.viewer}">내 묘지에서 카드 선택</button>`)
  }

  sections.push('<div class="choice-actions">')
  sections.push(actionButton('사용 확정', 'confirm-play-card'))
  sections.push(actionButton('취소', 'cancel-play-card'))
  sections.push('</div>')
  return `<div class="selection-panel"><h3>카드 사용 선택</h3>${sections.join('')}</div>`
}

function renderPendingChoicePanel(): string {
  if (!game?.pendingChoice) return ''
  const pending = game.pendingChoice
  if (pending.playerId !== game.viewer) {
    return `<div class="selection-panel"><h3>효과 처리 중</h3><p>${pending.playerId}의 선택을 기다리고 있습니다.</p></div>`
  }

  switch (pending.type) {
    case 'TEMPLE_PROSPECT_LIFE':
      return '<div class="selection-panel selection-panel--urgent"><h3>신전의 유망주</h3><p>손으로 가져올 자신의 라이프를 선택하세요.</p></div>'
    case 'TEMPLE_PROSPECT_HAND':
      return `<div class="selection-panel selection-panel--urgent"><h3>신전의 유망주</h3><p>손 카드 한 장을 라이프로 놓거나 건너뛸 수 있습니다.</p>${actionButton('건너뛰기', 'skip-hand-choice')}</div>`
    case 'HOLY_MIRROR_LIFE':
      return '<div class="selection-panel selection-panel--urgent"><h3>성스러운 거울의 벽</h3><p>묘지로 보낼 상대 라이프를 선택하세요.</p></div>'
    case 'WAVE_READER_TOP':
      return `<div class="selection-panel selection-panel--urgent"><h3>물결을 읽는 자</h3>${pending.revealedCard ? renderCard(pending.revealedCard.cardId, { compact: true, classNames: ['choice-card'] }) : ''}<div class="choice-actions">${actionButton('덱 위에 둔다', 'resolve-simple-choice', 'choice-id', 'keep')}${actionButton('묘지로 보낸다', 'resolve-simple-choice', 'choice-id', 'discard')}</div></div>`
    case 'SURGING_WAVE_TOP':
      return `<div class="selection-panel selection-panel--urgent"><h3>몰아치는 파도</h3>${pending.revealedCard ? renderCard(pending.revealedCard.cardId, { compact: true, classNames: ['choice-card'] }) : ''}<div class="choice-actions">${actionButton('덱 위에 둔다', 'resolve-simple-choice', 'choice-id', 'leave')}${actionButton('소환한다', 'resolve-simple-choice', 'choice-id', 'summon', !pending.canSummon)}</div></div>`
    case 'BURNING_PROCESSION': {
      const selectable = pending.revealedCards.filter((card) => {
        const definition = CARDS[card.cardId]
        return definition.type === 'unit'
          && definition.cost <= 1
          && definition.groups.includes('fire')
      })
      return `<div class="selection-panel selection-panel--urgent"><h3>불타는 행렬</h3><p>소환할 몬스터를 최대 ${pending.maxSummons}장 선택하세요. 선택하지 않은 카드는 묘지로 갑니다.</p><div class="choice-card-grid">${pending.revealedCards.map((card) => renderMiniChoiceCard(card, 'toggle-burning-choice', pendingChoiceIds.includes(card.instanceId), !selectable.some((candidate) => candidate.instanceId === card.instanceId))).join('')}</div><div class="choice-actions">${actionButton(`확정 (${pendingChoiceIds.length})`, 'confirm-burning-choice')}</div></div>`
    }
  }
}

function renderAttackLifePanel(opponentPlayer: PlayerView): string {
  if (!selectedAttackerId || playDraft || game?.pendingChoice) return ''
  if (!canSelectedAttackerDirectAttack(opponentPlayer)) return ''
  const required = requiredAttackLifeCount(opponentPlayer)
  return `<div class="selection-panel"><h3>직접 공격</h3><p>파괴할 라이프: ${selectedAttackLifeIndices.length}/${required}</p><div class="choice-actions">${actionButton('직접 공격 확정', 'confirm-attack-player', undefined, undefined, selectedAttackLifeIndices.length !== required)}${actionButton('공격 선택 취소', 'cancel-attacker')}</div></div>`
}

function renderCardInspector(): string {
  const cardId = pinnedPreviewCardId
  return `<aside id="card-inspector" class="card-inspector ${cardId ? 'is-visible is-pinned' : ''}" aria-live="polite" aria-hidden="${cardId ? 'false' : 'true'}">
    ${cardId ? renderCardInspectorContent(cardId) : ''}
  </aside>`
}

function renderCardInspectorContent(cardId: CardId): string {
  const card = CARDS[cardId]
  const groups = card.groups.map((groupId) => CARD_GROUPS[groupId].name).join(' · ')
  const keywordNames: Record<string, string> = {
    rush: '기습', charge: '돌진', windfury: '질풍', flying: '비행', stealth: '잠행',
  }
  const keywords = card.type === 'unit'
    ? (card.keywords ?? []).map((keyword) => keywordNames[keyword]).filter(Boolean)
    : []
  return `<div class="card-inspector__inner">
    <button type="button" class="card-inspector__close" data-action="close-card-preview" aria-label="카드 상세 닫기">×</button>
    <div class="card-inspector__visual">${renderCard(cardId, { interactive: false, classNames: ['card-preview-card'] })}</div>
    <div class="card-inspector__copy">
      <div class="card-inspector__meta"><span>${escapeHtml(groups)}</span><span>${card.type === 'unit' ? '몬스터' : '주문'} · 비용 ${card.cost}</span></div>
      <h2>${escapeHtml(card.name)}</h2>
      ${card.type === 'unit' ? `<p class="card-inspector__stats">공격력 ${card.attack} · 체력 ${card.health}</p>` : ''}
      ${keywords.length ? `<p class="card-inspector__keywords">${keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join('')}</p>` : ''}
      <p class="card-inspector__rules">${escapeHtml(card.rulesText || '효과 없음')}</p>
      <p class="card-inspector__hint">클릭으로 고정 · Esc로 닫기</p>
    </div>
  </div>`
}

function discardCandidates(playerId: PlayerId): CardInstance[] {
  if (!game) return []
  const candidates = [...game.players[playerId].discard]
  const draftCard = selectedPlayCard()
  if (
    playerId === game.viewer
    && draftCard?.cardId === 'grave_digging'
    && playDraft?.effectManaId
  ) {
    const mana = game.players[playerId].mana.find(
      (candidate) => candidate.instanceId === playDraft?.effectManaId,
    )
    if (mana && !candidates.some((candidate) => candidate.instanceId === mana.instanceId)) {
      candidates.push(mana)
    }
  }
  return candidates
}

function renderDiscardModal(): string {
  if (!game || !openDiscardPlayerId) return ''
  const playerId = openDiscardPlayerId
  const player = game.players[playerId]
  const selectionMode = playerId === game.viewer
    && selectedPlayCard()?.cardId === 'grave_digging'
    && playDraft !== null
  const candidates = discardCandidates(playerId)
  const cards = [...candidates].reverse()

  return `<div class="modal-backdrop" data-modal="discard">
    <section class="discard-dialog" role="dialog" aria-modal="true" aria-labelledby="discard-title">
      <header class="discard-dialog__header">
        <div>
          <p class="eyebrow">공개 정보</p>
          <h2 id="discard-title">${playerId}${player.isViewer ? ' · 내' : ' · 상대'} 묘지</h2>
        </div>
        <button type="button" data-action="close-discard" aria-label="묘지 닫기">닫기</button>
      </header>
      <div class="discard-tabs" aria-label="묘지 전환">
        ${(['P1', 'P2'] as const).map((id) => `<button type="button" data-action="view-discard-player" data-player-id="${id}" class="${id === playerId ? 'is-active' : ''}">${id} 묘지 · ${game?.players[id].discard.length ?? 0}</button>`).join('')}
      </div>
      ${selectionMode ? `<div class="discard-selection-note"><strong>파묘</strong><span>손으로 가져올 카드 1장을 선택하세요.${playDraft?.effectManaId ? ' 이번에 묘지로 보낼 마나도 선택할 수 있습니다.' : ''}</span></div>` : ''}
      <div class="discard-grid">
        ${cards.map((card, index) => renderCard(card.cardId, {
          instanceId: card.instanceId,
          selected: playDraft?.discardId === card.instanceId,
          classNames: ['discard-card'],
          actionsHtml: selectionMode
            ? actionButton(
                playDraft?.discardId === card.instanceId ? '선택 취소' : '가져오기',
                'select-discard-return',
                'card-instance-id',
                card.instanceId,
              )
            : '',
          dataAttributes: index === 0 ? { recent: 'true' } : undefined,
        })).join('') || '<div class="discard-empty"><strong>묘지가 비어 있습니다.</strong><span>카드가 묘지로 보내지면 이곳에서 양쪽 플레이어가 확인할 수 있습니다.</span></div>'}
      </div>
      <footer class="discard-dialog__footer">
        <span>최근에 묘지로 간 카드부터 표시됩니다.</span>
        ${selectionMode ? `<button type="button" data-action="close-discard" ${playDraft?.discardId ? '' : 'disabled'}>선택 완료</button>` : ''}
      </footer>
    </section>
  </div>`
}

function renderDecisionDock(opponentId: PlayerId): string {
  if (!game) return ''
  const pendingPanel = renderPendingChoicePanel()
  const draftPanel = renderPlayDraftPanel()
  const attackPanel = renderAttackLifePanel(game.players[opponentId])
  const activePanel = pendingPanel || draftPanel || attackPanel
  const canEndTurn = game.status === 'playing'
    && roomPhase === 'playing'
    && game.viewer === game.currentPlayer
    && game.pendingChoice === null
    && playDraft === null
    && selectedAttackerId === null

  return `<aside class="decision-dock ${activePanel ? 'has-selection' : ''}" aria-live="polite">
    ${activePanel}
    <div class="primary-actions">
      <button id="end-turn-button" class="end-turn-button" type="button" ${canEndTurn && !awaitingServer ? '' : 'disabled'}>턴 종료</button>
      ${game.status === 'finished' ? `<button id="rematch-button" type="button">${rematchReadyPlayers.includes(game.viewer) ? '재대전 취소' : '재대전 요청'}</button>` : ''}
    </div>
  </aside>`
}

function renderRoomMenu(): string {
  if (!game || !roomMenuOpen) return ''
  return `<div class="room-menu" role="menu">
    <div class="room-menu__summary"><span>방 ${escapeHtml(roomId)}</span><span>턴 ${game.turnNumber}</span></div>
    <button id="copy-invite-button" type="button" role="menuitem">초대 링크 복사</button>
    <button id="surrender-button" type="button" role="menuitem" ${game.status === 'playing' ? '' : 'disabled'}>항복</button>
    <button id="leave-room-button" type="button" role="menuitem">자리 나가기</button>
  </div>`
}

function renderTurnRibbon(): string {
  if (!game) return ''
  const needsMyChoice = game.pendingChoice?.playerId === game.viewer
  const isMyTurn = game.currentPlayer === game.viewer
  const stateClass = needsMyChoice
    ? 'turn-ribbon--response'
    : isMyTurn
      ? 'turn-ribbon--mine'
      : 'turn-ribbon--opponent'
  const title = needsMyChoice
    ? '내 선택 필요'
    : isMyTurn
      ? '내 턴'
      : '상대 턴'
  const detail = needsMyChoice
    ? game.currentPlayer === game.viewer
      ? '카드 효과를 선택해야 턴을 계속할 수 있습니다.'
      : '상대 턴 중 각성이 발동했습니다. 선택을 완료해 주세요.'
    : message

  return `<section class="turn-ribbon ${stateClass}" aria-live="assertive">
    <strong>${title}</strong>
    <span id="turn-timer" class="turn-timer"></span>
    <span class="turn-message">${escapeHtml(detail)}</span>
    <span class="turn-number">TURN ${game.turnNumber}</span>
  </section>`
}

function renderRulebookModal(): string {
  if (!rulebookOpen) return ''
  return `<div class="modal-backdrop rulebook-backdrop" data-modal="rulebook">
    <section class="rulebook-dialog" role="dialog" aria-modal="true" aria-labelledby="rulebook-title">
      <header class="rulebook-dialog__header">
        <div><p class="eyebrow">DUEL SPIRITS</p><h2 id="rulebook-title">룰북</h2></div>
        <button type="button" data-action="close-rulebook" aria-label="룰북 닫기">닫기</button>
      </header>
      <nav class="rulebook-index" aria-label="룰북 목차">
        <a href="#rules-goal">승리와 준비</a><a href="#rules-turn">턴 진행</a><a href="#rules-combat">공격</a><a href="#rules-keywords">키워드</a>
      </nav>
      <div class="rulebook-content">
        <section id="rules-goal"><h3>승리와 게임 준비</h3><p>각 플레이어는 덱 12장으로 시작하며, 라이프 4장·손 4장·덱 4장으로 나눕니다. 라이프의 정체는 소유자에게도 공개되지 않습니다.</p><p>상대 라이프가 없는 상태에서 직접 공격에 성공하면 승리합니다.</p></section>
        <section id="rules-turn"><h3>턴 진행</h3><ol><li>턴을 시작하면 마나와 몬스터가 준비되고 카드 1장을 뽑습니다.</li><li>턴마다 손 카드 1장을 준비된 마나로 놓을 수 있습니다.</li><li>준비된 마나를 선택해 비용을 지불하고 카드 사용·소환을 합니다.</li><li>준비된 몬스터로 공격한 뒤 턴을 종료합니다.</li></ol><p>마나는 카드군을 유지하며, 공명은 그 카드를 위해 실제로 소진한 마나만 확인합니다.</p></section>
        <section id="rules-combat"><h3>공격과 라이프</h3><p>일반 몬스터는 소환된 턴에 공격할 수 없습니다. 공격 가능한 상대 몬스터가 있다면 먼저 몬스터를 공격해야 합니다. 상대 몬스터가 모두 잠행이라면 직접 공격할 수 있습니다.</p><p>직접 공격은 공격력과 무관하게 상대 라이프 1장을 손으로 이동시킵니다. 그 카드에 각성이 있으면 즉시 발동하며, 상대 턴 중에도 각성 선택을 수행할 수 있습니다.</p></section>
        <section id="rules-keywords"><h3>키워드</h3><dl class="keyword-list">
          <div><dt>출현</dt><dd>손에서 원래 비용을 지불해 정상 소환했을 때 발동합니다.</dd></div>
          <div><dt>각성</dt><dd>라이프에서 자신의 손으로 이동한 직후 발동합니다.</dd></div>
          <div><dt>공명</dt><dd>비용 지불에 사용한 마나의 카드군을 확인합니다.</dd></div>
          <div><dt>고립</dt><dd>자신의 전장에 다른 아군 몬스터가 없을 동안 지속 적용됩니다.</dd></div>
          <div><dt>질풍</dt><dd>자신의 턴마다 최대 두 번 공격할 수 있습니다.</dd></div>
          <div><dt>기습</dt><dd>소환된 턴에도 몬스터와 플레이어를 공격할 수 있습니다.</dd></div>
          <div><dt>돌진</dt><dd>소환된 턴에는 상대 몬스터만 공격할 수 있습니다.</dd></div>
          <div><dt>비행</dt><dd>상대 전장의 몬스터를 무시하고 직접 공격할 수 있습니다.</dd></div>
          <div><dt>잠행</dt><dd>상대 몬스터의 공격 대상으로 선택될 수 없습니다.</dd></div>
        </dl></section>
      </div>
      <footer class="rulebook-dialog__footer"><span>카드의 개별 문구가 일반 규칙보다 우선합니다.</span><button type="button" data-action="close-rulebook">게임으로 돌아가기</button></footer>
    </section>
  </div>`
}

function renderWaitingRoom(): string {
  const decks = loadDecks()
  const options = decks.map((deck) => {
    const compatible = isDeckCompatibleWithFormat(
      deck,
      roomSettings.formatId,
      roomSettings.selectedSetIds,
    )
    return `<option value="${escapeHtml(deck.id)}" ${deck.id === selectedDeckId ? 'selected' : ''} ${compatible ? '' : 'disabled'}>${escapeHtml(deck.name)} · ${escapeHtml(getFormat(deck.formatId).shortName)}${compatible ? '' : ' · 포맷 불일치'}</option>`
  }).join('')
  const me = assignedPlayerId
  const myDeckState = me ? deckStates[me] : null
  const ready = myDeckState?.ready ?? false

  return `<section class="panel match-lobby">
    <header class="section-heading"><h2>대전 준비 · ${escapeHtml(getFormat(roomSettings.formatId).name)}</h2><span>${connectedPlayers.length}/2 접속</span></header>
    <div class="seat-grid">${(['P1', 'P2'] as const).map((playerId) => `<div class="seat-card ${connectedPlayers.includes(playerId) ? 'is-online' : ''}"><strong>${playerId}${playerId === me ? ' · 나' : ''}</strong><span>${connectedPlayers.includes(playerId) ? '접속 중' : reservedPlayers.includes(playerId) ? '재접속 대기' : '빈자리'}</span><span>${deckStates[playerId].name ?? '덱 미제출'}</span><span>${deckStates[playerId].ready ? '준비 완료' : '준비 중'}</span><small id="seat-expiry-${playerId}"></small></div>`).join('')}</div>
    <div class="match-deck-controls"><label>사용할 덱<select id="room-deck-select">${options}</select></label><button id="submit-deck-button" type="button">덱 제출</button><button id="deck-ready-button" type="button" ${myDeckState?.submitted ? '' : 'disabled'}>${ready ? '준비 취소' : '준비 완료'}</button><a class="button-link" href="./#decks" target="_blank">덱 빌더</a></div>
  </section>`
}

function render(): void {
  const opponentId: PlayerId | null = game
    ? (game.viewer === 'P1' ? 'P2' : 'P1')
    : null
  let content = ''

  document.body.classList.toggle('game-active', game !== null)

  if (joinRejectedMessage || hasLeftRoom) {
    content = `<section class="panel room-ended-panel"><h2>${escapeHtml(joinRejectedMessage ?? '자리에서 나왔습니다.')}</h2><a class="button-link" href="./">첫 화면</a></section>`
  } else if (!game) content = renderWaitingRoom()
  else if (opponentId) {
    content = `<section class="game-layout">
      <main class="battle-board ${game.currentPlayer === game.viewer ? 'is-my-turn' : 'is-opponent-turn'} ${game.pendingChoice?.playerId === game.viewer ? 'is-my-response' : ''}">
        ${renderPlayerBoard(opponentId, 'opponent')}
        ${renderTurnRibbon()}
        ${renderPlayerBoard(game.viewer, 'self')}
        ${renderDecisionDock(opponentId)}
      </main>
      ${renderCardInspector()}
      ${renderDiscardModal()}
    </section>`
  }

  const gameTopbar = game
    ? `<header class="room-topbar room-topbar--game">
        <div class="brand-cluster"><strong>Duel Spirits</strong><span class="connection-state">${escapeHtml(networkStatus)}</span></div>
        <div class="match-state"><span>${escapeHtml(getFormat(game.matchConfig.formatId).shortName)}</span><span>${game.viewer} 시점</span><span>방 ${escapeHtml(roomId)}</span></div>
        <button id="rulebook-button" class="topbar-text-button" type="button">룰북</button>
        <div class="room-menu-anchor">
          <button id="room-menu-button" class="icon-button" type="button" aria-expanded="${roomMenuOpen}" aria-label="방 메뉴">⋮</button>
          ${renderRoomMenu()}
        </div>
      </header>`
    : `<header class="room-topbar"><strong>Duel Spirits</strong><span>${escapeHtml(networkStatus)}</span><button id="rulebook-button" class="topbar-text-button" type="button">룰북</button></header>`

  appElement.innerHTML = `<div class="room-screen ${game ? 'room-screen--game' : ''}">${gameTopbar}${content}</div>${renderRulebookModal()}`
  bindEvents()
  updateClock()
}

function sendAction(action: GameAction): void {
  awaitingServer = true
  sendPlayerAction(socket, action)
  render()
}

function toggleString(values: string[], value: string, max?: number): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value)
  if (max !== undefined && values.length >= max) return values
  return [...values, value]
}

function confirmPlayDraft(): void {
  if (!game || !playDraft) return
  const card = selectedPlayCard()
  if (!card) return
  const cost = effectiveCost(card)
  if (playDraft.manaIds.length !== cost) {
    message = `비용으로 사용할 마나 ${cost}장을 선택해 주세요.`
    render()
    return
  }
  if (unitTargetMode(card.cardId) && !playDraft.unitId) {
    message = '대상 몬스터를 선택해 주세요.'
    render()
    return
  }
  if (needsLifeTarget(card.cardId) && playDraft.lifeIndex === undefined) {
    message = '대상 라이프를 선택해 주세요.'
    render()
    return
  }
  if (card.cardId === 'grave_digging' && (!playDraft.effectManaId || !playDraft.discardId)) {
    message = '묘지로 보낼 마나와 손으로 가져올 카드를 모두 선택해 주세요.'
    render()
    return
  }

  const selection: CardPlaySelection = {
    unitId: playDraft.unitId,
    lifeIndex: playDraft.lifeIndex,
    effectManaId: playDraft.effectManaId,
    discardId: playDraft.discardId,
  }
  openDiscardPlayerId = null
  sendAction({
    type: 'PLAY_CARD',
    cardInstanceId: playDraft.cardInstanceId,
    manaIds: [...playDraft.manaIds],
    selection,
  })
}

function setCardInspector(cardId: CardId | null, pinned: boolean): void {
  const inspector = document.querySelector<HTMLElement>('#card-inspector')
  if (pinned) pinnedPreviewCardId = cardId
  if (!inspector) return

  if (!cardId) {
    inspector.classList.remove('is-visible', 'is-pinned')
    inspector.setAttribute('aria-hidden', 'true')
    inspector.innerHTML = ''
    return
  }

  inspector.innerHTML = renderCardInspectorContent(cardId)
  inspector.classList.add('is-visible')
  inspector.classList.toggle('is-pinned', pinnedPreviewCardId === cardId)
  inspector.setAttribute('aria-hidden', 'false')
  inspector.querySelector<HTMLElement>('[data-action="close-card-preview"]')?.addEventListener('click', () => {
    pinnedPreviewCardId = null
    setCardInspector(null, false)
  })
}

function closeTransientLayers(): boolean {
  if (rulebookOpen) {
    rulebookOpen = false
    render()
    return true
  }
  if (openDiscardPlayerId) {
    openDiscardPlayerId = null
    render()
    return true
  }
  if (roomMenuOpen) {
    roomMenuOpen = false
    render()
    return true
  }
  if (pinnedPreviewCardId) {
    pinnedPreviewCardId = null
    setCardInspector(null, false)
    return true
  }
  return false
}

function bindEvents(): void {
  document.querySelector<HTMLButtonElement>('#rulebook-button')?.addEventListener('click', () => {
    rulebookOpen = true
    roomMenuOpen = false
    render()
  })
  for (const control of document.querySelectorAll<HTMLElement>('[data-action="close-rulebook"]')) {
    control.addEventListener('click', () => {
      rulebookOpen = false
      render()
    })
  }
  document.querySelector<HTMLElement>('[data-modal="rulebook"]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      rulebookOpen = false
      render()
    }
  })

  document.querySelector<HTMLButtonElement>('#room-menu-button')?.addEventListener('click', () => {
    roomMenuOpen = !roomMenuOpen
    render()
  })

  for (const control of document.querySelectorAll<HTMLElement>('[data-action="open-discard"]')) {
    control.addEventListener('click', () => {
      const playerId = control.dataset.playerId
      if (playerId !== 'P1' && playerId !== 'P2') return
      openDiscardPlayerId = playerId
      roomMenuOpen = false
      render()
    })
  }
  for (const control of document.querySelectorAll<HTMLElement>('[data-action="close-discard"]')) {
    control.addEventListener('click', () => {
      openDiscardPlayerId = null
      render()
    })
  }
  for (const control of document.querySelectorAll<HTMLElement>('[data-action="view-discard-player"]')) {
    control.addEventListener('click', () => {
      const playerId = control.dataset.playerId
      if (playerId !== 'P1' && playerId !== 'P2') return
      openDiscardPlayerId = playerId
      render()
    })
  }
  document.querySelector<HTMLElement>('[data-modal="discard"]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      openDiscardPlayerId = null
      render()
    }
  })

  for (const control of document.querySelectorAll<HTMLElement>('[data-action="close-card-preview"]')) {
    control.addEventListener('click', () => {
      pinnedPreviewCardId = null
      setCardInspector(null, false)
    })
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-card-id], [data-preview-card-id]')) {
    if (element.closest('.card-inspector')) continue
    const rawCardId = element.dataset.previewCardId ?? element.dataset.cardId
    if (!rawCardId || !(rawCardId in CARDS)) continue
    const cardId = rawCardId as CardId

    element.addEventListener('pointerenter', () => {
      if (!pinnedPreviewCardId) setCardInspector(cardId, false)
    })
    element.addEventListener('pointerleave', () => {
      if (!pinnedPreviewCardId) setCardInspector(null, false)
    })
    element.addEventListener('focus', () => {
      if (!pinnedPreviewCardId) setCardInspector(cardId, false)
    })
    element.addEventListener('blur', () => {
      if (!pinnedPreviewCardId) setCardInspector(null, false)
    })
    element.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button, [data-action]')) return
      pinnedPreviewCardId = pinnedPreviewCardId === cardId ? null : cardId
      setCardInspector(pinnedPreviewCardId, pinnedPreviewCardId !== null)
    })
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      if ((event.target as HTMLElement).closest('button')) return
      event.preventDefault()
      pinnedPreviewCardId = pinnedPreviewCardId === cardId ? null : cardId
      setCardInspector(pinnedPreviewCardId, pinnedPreviewCardId !== null)
    })
  }

  document.onkeydown = (event) => {
    if (event.key === 'Escape') closeTransientLayers()
  }
  document.querySelector<HTMLSelectElement>('#room-deck-select')?.addEventListener('change', (event) => {
    selectedDeckId = (event.currentTarget as HTMLSelectElement).value
    setActiveDeckId(selectedDeckId)
  })
  document.querySelector<HTMLButtonElement>('#submit-deck-button')?.addEventListener('click', submitSelectedDeck)
  document.querySelector<HTMLButtonElement>('#deck-ready-button')?.addEventListener('click', () => {
    if (assignedPlayerId) sendDeckReady(socket, !deckStates[assignedPlayerId].ready)
  })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="place-mana"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.cardInstanceId
      if (id) sendAction({ type: 'PLACE_MANA', cardInstanceId: id })
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="begin-play-card"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.cardInstanceId
      if (!id) return
      playDraft = { cardInstanceId: id, manaIds: [] }
      selectedAttackerId = null
      selectedAttackLifeIndices = []
      message = '사용할 마나와 필요한 대상을 직접 선택해 주세요.'
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-cost-mana"]')) {
    button.addEventListener('click', () => {
      if (!playDraft) return
      const manaId = button.dataset.manaId
      const card = selectedPlayCard()
      if (!manaId || !card) return
      const cost = effectiveCost(card)
      const next = toggleString(playDraft.manaIds, manaId, cost)
      if (next.length === playDraft.manaIds.length && !playDraft.manaIds.includes(manaId)) {
        message = `비용 마나는 ${cost}장까지만 선택할 수 있습니다.`
      }
      playDraft.manaIds = next
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-effect-mana"]')) {
    button.addEventListener('click', () => {
      if (!playDraft) return
      const manaId = button.dataset.manaId
      if (!manaId) return
      const previousEffectManaId = playDraft.effectManaId
      playDraft.effectManaId = previousEffectManaId === manaId ? undefined : manaId
      if (
        playDraft.discardId
        && playDraft.discardId === previousEffectManaId
        && playDraft.effectManaId !== previousEffectManaId
      ) playDraft.discardId = undefined
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-spell-unit"]')) {
    button.addEventListener('click', () => {
      if (!playDraft) return
      const unitId = button.dataset.unitId
      if (!unitId) return
      playDraft.unitId = playDraft.unitId === unitId ? undefined : unitId
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-spell-life"]')) {
    button.addEventListener('click', () => {
      if (!playDraft) return
      const index = Number(button.dataset.lifeIndex)
      if (!Number.isInteger(index)) return
      playDraft.lifeIndex = playDraft.lifeIndex === index ? undefined : index
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-discard-return"]')) {
    button.addEventListener('click', () => {
      if (!playDraft) return
      const id = button.dataset.cardInstanceId
      if (!id) return
      playDraft.discardId = playDraft.discardId === id ? undefined : id
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="confirm-play-card"]')?.addEventListener('click', confirmPlayDraft)
  document.querySelector<HTMLButtonElement>('[data-action="cancel-play-card"]')?.addEventListener('click', () => {
    playDraft = null
    openDiscardPlayerId = null
    message = '카드 사용 선택을 취소했습니다.'
    render()
  })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="summon-from-mana"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.manaId
      if (id) sendAction({ type: 'SUMMON_FROM_MANA', cardInstanceId: id })
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-attacker"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.unitId
      if (!id) return
      selectedAttackerId = selectedAttackerId === id ? null : id
      selectedAttackLifeIndices = []
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="attack-unit"]')) {
    button.addEventListener('click', () => {
      const defenderId = button.dataset.defenderId
      if (selectedAttackerId && defenderId) {
        sendAction({ type: 'ATTACK_UNIT', attackerId: selectedAttackerId, defenderId })
      }
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-attack-life"]')) {
    button.addEventListener('click', () => {
      if (!game) return
      const index = Number(button.dataset.lifeIndex)
      if (!Number.isInteger(index)) return
      const enemyId: PlayerId = game.viewer === 'P1' ? 'P2' : 'P1'
      selectedAttackLifeIndices = toggleString(
        selectedAttackLifeIndices.map(String),
        String(index),
        requiredAttackLifeCount(game.players[enemyId]),
      ).map(Number)
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="confirm-attack-player"]')?.addEventListener('click', () => {
    if (selectedAttackerId) {
      sendAction({
        type: 'ATTACK_PLAYER',
        attackerId: selectedAttackerId,
        lifeIndices: [...selectedAttackLifeIndices],
      })
    }
  })
  document.querySelector<HTMLButtonElement>('[data-action="cancel-attacker"]')?.addEventListener('click', () => {
    selectedAttackerId = null
    selectedAttackLifeIndices = []
    render()
  })

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="resolve-life-choice"]')) {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.lifeIndex)
      if (Number.isInteger(index)) sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [`life:${index}`] })
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="resolve-hand-choice"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.cardInstanceId
      if (id) sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [id] })
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="skip-hand-choice"]')?.addEventListener('click', () => sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [] }))
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="resolve-simple-choice"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.choiceId
      if (id) sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [id] })
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-burning-choice"]')) {
    button.addEventListener('click', () => {
      if (!game?.pendingChoice || game.pendingChoice.type !== 'BURNING_PROCESSION') return
      const id = button.dataset.cardInstanceId
      if (!id) return
      pendingChoiceIds = toggleString(pendingChoiceIds, id, game.pendingChoice.maxSummons)
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="confirm-burning-choice"]')?.addEventListener('click', () => sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [...pendingChoiceIds] }))

  document.querySelector<HTMLButtonElement>('#end-turn-button')?.addEventListener('click', () => sendAction({ type: 'END_TURN' }))
  document.querySelector<HTMLButtonElement>('#surrender-button')?.addEventListener('click', () => sendAction({ type: 'SURRENDER' }))
  document.querySelector<HTMLButtonElement>('#rematch-button')?.addEventListener('click', () => {
    if (game) sendRematchReady(socket, !rematchReadyPlayers.includes(game.viewer))
  })
  document.querySelector<HTMLButtonElement>('#leave-room-button')?.addEventListener('click', () => sendLeaveRoom(socket))
  document.querySelector<HTMLButtonElement>('#copy-invite-button')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pageUrl.toString())
      message = '초대 링크를 복사했습니다.'
      roomMenuOpen = false
    } catch {
      message = '주소창의 링크를 직접 복사해 주세요.'
      roomMenuOpen = false
    }
    render()
  })
}

window.setInterval(updateClock, 250)
render()
