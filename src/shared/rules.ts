import { CARDS, DEFAULT_DECK } from './cards'
import { validateDeck } from './decks'
import { getFormat } from '../content/formats'
import { createMatchConfig } from './match-config'
import { createSeededRandom } from './random'
import type { CardDefinition, CardAttributeId, CardId, UnitCard } from './cards'
import type { CardPlaySelection, GameAction } from './actions'
import type {
  CardInstance,
  GameState,
  ManaCardInstance,
  PendingChoice,
  PlayerId,
  PlayerState,
  UnitInstance,
} from './types'

export { DECK_SIZE } from './decks'

export const LIFE_SIZE = 4
export const STARTING_HAND_SIZE = 4
export const DRAW_DECK_SIZE = 12
export const FIELD_LIMIT = 4

export type RandomSource = () => number
export type IdSource = () => string

export interface GameDecks {
  P1: CardId[]
  P2: CardId[]
}

export interface CreateGameOptions {
  decks?: GameDecks
  random?: RandomSource
  idSource?: IdSource
  startingPlayer?: PlayerId
  matchConfig?: import('./match-config').MatchConfig
  deckSelections?: Record<PlayerId, import('../content/schema').DeckFormatSelection<CardId>>
}

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GameRuleError'
  }
}

const defaultIdSource = () => crypto.randomUUID()

export function shuffle<T>(
  values: readonly T[],
  random: RandomSource = Math.random,
): T[] {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!]
  }
  return shuffled
}

const createInstances = (ids: readonly CardId[], ownerId: PlayerId, idSource: IdSource) =>
  ids.map((cardId) => ({
    instanceId: idSource(),
    cardId,
    ownerId,
    controllerId: ownerId,
  }))

function createPlayer(
  ownerId: PlayerId,
  ids: readonly CardId[],
  random: RandomSource,
  idSource: IdSource,
  matchConfig: import('./match-config').MatchConfig,
  selection: import('../content/schema').DeckFormatSelection<CardId>,
): PlayerState {
  const validation = validateDeck(ids, selection)
  if (!validation.valid) {
    throw new GameRuleError(validation.errors.join(' '))
  }

  const format = getFormat(matchConfig.formatId)
  const cards = shuffle(createInstances(ids, ownerId, idSource), random)
  const lifeEnd = format.startingLife
  const handEnd = lifeEnd + format.startingHand
  return {
    life: cards.slice(0, lifeEnd).map((card, lifeSlotIndex) => ({
      ...card,
      lifeSlotIndex,
    })),
    hand: cards.slice(lifeEnd, handEnd),
    deck: cards.slice(handEnd),
    mana: [],
    field: [],
    discard: [],
    manaPlacedThisTurn: false,
    attacksThisTurn: 0,
    extraLifeLossOnDirectAttack: false,
    darkCardsDiscardedThisTurn: 0,
  }
}

export function createGame(
  input: CreateGameOptions | RandomSource = {},
): GameState {
  const options = typeof input === 'function' ? { random: input } : input
  const matchConfig = options.matchConfig ?? createMatchConfig()
  const random = options.random ?? createSeededRandom(matchConfig.randomSeed).next
  const idSource = options.idSource ?? defaultIdSource
  const startingPlayer = options.startingPlayer ?? (random() <= 0.5 ? 'P1' : 'P2')
  const decks = options.decks ?? {
    P1: [...DEFAULT_DECK],
    P2: [...DEFAULT_DECK],
  }
  const deckSelections = options.deckSelections ?? {
    P1: { formatId: matchConfig.formatId, selectedSetIds: matchConfig.selectedSetIds, draftPool: null },
    P2: { formatId: matchConfig.formatId, selectedSetIds: matchConfig.selectedSetIds, draftPool: null },
  }

  const game: GameState = {
    matchConfig,
    actionSequence: 0,
    nextBattlefieldEntrySeq: 0,
    status: 'playing',
    currentPlayer: startingPlayer,
    turnNumber: 1,
    players: {
      P1: createPlayer('P1', decks.P1, random, idSource, matchConfig, deckSelections.P1),
      P2: createPlayer('P2', decks.P2, random, idSource, matchConfig, deckSelections.P2),
    },
    winner: null,
    pendingChoices: [],
  }

  assertValidInitialGame(game)
  return game
}

export const countPlayerCards = (player: PlayerState) =>
  player.deck.length
  + player.hand.length
  + player.life.length
  + player.mana.length
  + player.field.length
  + player.discard.length

export function assertValidInitialGame(game: GameState): void {
  const format = getFormat(game.matchConfig.formatId)
  for (const playerId of ['P1', 'P2'] as const) {
    const player = game.players[playerId]
    if (
      player.life.length !== format.startingLife
      || player.hand.length !== format.startingHand
      || player.deck.length !== format.deckSize - format.startingLife - format.startingHand
      || countPlayerCards(player) !== format.deckSize
    ) {
      throw new GameRuleError('초기 카드 배치가 올바르지 않습니다.')
    }
  }
}

const clone = (game: GameState): GameState => structuredClone(game)

const opponent = (playerId: PlayerId): PlayerId =>
  playerId === 'P1' ? 'P2' : 'P1'

export { opponent as getOpponentId }

const getFieldLimit = (game: GameState) => getFormat(game.matchConfig.formatId).fieldSlots

function normalizeState(game: GameState): void {
  game.pendingChoices ??= []
  for (const playerId of ['P1', 'P2'] as const) {
    game.players[playerId].darkCardsDiscardedThisTurn ??= 0
  }
}

function ready(game: GameState, actor: PlayerId): void {
  if (game.status !== 'playing') {
    throw new GameRuleError('이미 끝난 게임입니다.')
  }
  if (game.currentPlayer !== actor) {
    throw new GameRuleError(`${actor}의 턴이 아닙니다.`)
  }
}

function assertNoPendingChoice(game: GameState): void {
  if (game.pendingChoices.length > 0) {
    throw new GameRuleError('먼저 진행 중인 카드 선택을 완료해야 합니다.')
  }
}

export const countReadyMana = (player: PlayerState) =>
  player.mana.filter((mana) => !mana.exhausted).length

const unitDefinition = (unit: UnitInstance) => CARDS[unit.cardId] as UnitCard

function hasAttribute(card: CardInstance, attribute: CardAttributeId): boolean {
  return CARDS[card.cardId].attributes.includes(attribute)
}

function isIsolated(player: PlayerState, unit: UnitInstance): boolean {
  return player.field.every((other) => other.instanceId === unit.instanceId)
}

function hasKeyword(
  game: GameState,
  owner: PlayerId,
  unit: UnitInstance,
  keyword: 'rush' | 'charge' | 'windfury' | 'flying' | 'stealth' | 'assassination',
): boolean {
  const definition = unitDefinition(unit)
  if (definition.keywords?.includes(keyword)) return true
  if (keyword === 'rush' && unit.temporaryRush) return true
  if (
    unit.cardId === 'last_ember'
    && isIsolated(game.players[owner], unit)
    && keyword === 'charge'
  ) return true
  if (
    unit.cardId === 'corpse_cat'
    && game.players[owner].field.some((other) => other.instanceId !== unit.instanceId)
    && keyword === 'stealth'
  ) return true
  if (keyword === 'flying' && unit.temporaryFlying) return true
  if (
    unit.cardId === 'carrion_crow'
    && isIsolated(game.players[owner], unit)
    && keyword === 'flying'
  ) return true
  if (
    unit.cardId === 'nameless_shadow'
    && game.players[owner].discard.length >= 3
    && keyword === 'assassination'
  ) return true
  return false
}

function attackValue(
  game: GameState,
  owner: PlayerId,
  unit: UnitInstance,
): number {
  return unitDefinition(unit).attack
    + unit.temporaryAttackModifier
    + (
      unit.cardId === 'last_ember'
      && isIsolated(game.players[owner], unit)
        ? 1
        : 0
    )
    + (
      unit.cardId === 'volcano_mouse'
      && game.players[owner].mana.filter((mana) => hasAttribute(mana, 'fire')).length >= 2
        ? 1
        : 0
    )
}

function combatAttackValue(
  game: GameState,
  owner: PlayerId,
  unit: UnitInstance,
): number {
  return attackValue(game, owner, unit) + (unit.cardId === 'living_smoke' ? 2 : 0)
}

function healthValue(unit: UnitInstance): number {
  return unitDefinition(unit).health + unit.temporaryHealthModifier
}

function remainingHealth(unit: UnitInstance): number {
  return healthValue(unit) - unit.damage
}

function resetHandCost(
  card: CardInstance,
  preserveLifeSlot = false,
): CardInstance {
  const clean = { ...card }
  delete clean.costReduction
  if (!preserveLifeSlot) delete clean.lifeSlotIndex
  return clean
}

function placeInLife(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
): void {
  const player = game.players[owner]
  const slotCount = getFormat(game.matchConfig.formatId).startingLife
  const preferredSlot = card.lifeSlotIndex
  const occupiedSlots = new Set(
    player.life
      .map((lifeCard) => lifeCard.lifeSlotIndex)
      .filter((slotIndex): slotIndex is number => Number.isInteger(slotIndex)),
  )
  const lifeSlotIndex = Number.isInteger(preferredSlot)
    && preferredSlot! >= 0
    && preferredSlot! < slotCount
    && !occupiedSlots.has(preferredSlot!)
    ? preferredSlot!
    : Array.from({ length: slotCount }, (_, index) => index)
      .find((slotIndex) => !occupiedSlots.has(slotIndex))

  if (lifeSlotIndex === undefined) {
    throw new GameRuleError('라이프에 빈 슬롯이 없습니다.')
  }

  player.life.push({
    ...resetHandCost(card),
    lifeSlotIndex,
  })
}

function sendToDiscard(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
): void {
  const player = game.players[owner]
  const clean = resetHandCost(card)
  player.discard.push(clean)
  if (hasAttribute(clean, 'dark')) {
    player.darkCardsDiscardedThisTurn = (player.darkCardsDiscardedThisTurn ?? 0) + 1
  }
}

function handleUnitDeath(
  game: GameState,
  owner: PlayerId,
  unit: UnitInstance,
  random: RandomSource,
): void {
  sendToDiscard(game, owner, {
    instanceId: unit.instanceId,
    cardId: unit.cardId,
    ownerId: unit.ownerId,
    controllerId: unit.controllerId,
  })

  // 유언은 전장에서 묘지로 보내진 직후 발동합니다.
  if (unit.cardId === 'last_ember') {
    draw(game.players[owner], random)
  }
  if (unit.cardId === 'demon_finger') {
    const chooser = opponent(owner)
    if (game.players[chooser].hand.length > 0) {
      enqueueChoice(game, { type: 'DEMON_FINGER_DISCARD', playerId: chooser })
    }
  }
}

function moveFieldToDiscard(
  game: GameState,
  owner: PlayerId,
  index: number,
  random: RandomSource,
): void {
  const player = game.players[owner]
  const [unit] = player.field.splice(index, 1)
  if (!unit) return

  handleUnitDeath(game, owner, unit, random)
}

function cleanupDead(game: GameState, random: RandomSource): void {
  const deadUnits = collectDeadUnitsInResolutionOrder(game)

  for (const deadUnit of deadUnits) {
    const player = game.players[deadUnit.ownerId]
    const index = player.field.findIndex((unit) => unit.instanceId === deadUnit.instanceId)
    if (index >= 0) {
      moveFieldToDiscard(game, deadUnit.ownerId, index, random)
    }
  }
}

export function collectDeadUnitsInResolutionOrder(game: GameState): Array<{
  ownerId: PlayerId
  instanceId: string
  battlefieldEntrySeq: number
}> {
  return (['P1', 'P2'] as const)
    .flatMap((playerId) => {
      const player = game.players[playerId]
      return player.field
        .filter((unit) => unit.damage >= healthValue(unit))
        .map((unit) => ({
          ownerId: playerId,
          instanceId: unit.instanceId,
          battlefieldEntrySeq: unit.battlefieldEntrySeq,
        }))
    })
    .sort((left, right) => left.battlefieldEntrySeq - right.battlefieldEntrySeq)
}

function draw(player: PlayerState, random: RandomSource): void {
  let card = player.deck.shift()

  if (!card && player.discard.length > 0) {
    player.deck = shuffle(player.discard, random)
    player.discard = []
    card = player.deck.shift()
  }

  if (card) player.hand.push(card)
}

function placeCardInMana(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
  exhausted: boolean,
  random: RandomSource,
  source: 'hand' | 'effect',
): ManaCardInstance {
  const manaCard: ManaCardInstance = {
    ...resetHandCost(card),
    exhausted,
  }
  game.players[owner].mana.push(manaCard)

  if (manaCard.cardId === 'tree_fairy' && source !== 'hand') {
    draw(game.players[owner], random)
  }
  return manaCard
}

function spend(
  player: PlayerState,
  amount: number,
  manaIds: readonly string[],
): ManaCardInstance[] {
  if (manaIds.length !== amount || new Set(manaIds).size !== manaIds.length) {
    throw new GameRuleError(`비용으로 사용할 마나 ${amount}장을 정확히 선택해야 합니다.`)
  }

  const chosen = manaIds.map((id) =>
    player.mana.find((mana) => mana.instanceId === id && !mana.exhausted),
  )

  if (chosen.some((mana) => !mana)) {
    throw new GameRuleError('선택한 마나 중 사용할 수 없는 카드가 있습니다.')
  }

  const paid = chosen as ManaCardInstance[]
  for (const mana of paid) mana.exhausted = true
  return paid
}

function effectiveCost(
  player: PlayerState,
  card: CardInstance,
  definition: CardDefinition,
): number {
  if (
    card.cardId === 'coffin_warrior'
    && (player.darkCardsDiscardedThisTurn ?? 0) >= 2
  ) return 0
  return Math.max(0, definition.cost - (card.costReduction ?? 0))
}

export function getOpenFieldSlots(
  game: GameState,
  owner: PlayerId,
): number[] {
  const occupied = new Set(game.players[owner].field.map((unit) => unit.slotIndex))
  return Array.from({ length: getFieldLimit(game) }, (_, index) => index)
    .filter((index) => !occupied.has(index))
}

function requireOpenFieldSlot(
  game: GameState,
  owner: PlayerId,
  slotIndex: number | undefined,
): number {
  if (!Number.isInteger(slotIndex)) {
    throw new GameRuleError('소환할 전장 슬롯을 선택해야 합니다.')
  }
  const openSlots = getOpenFieldSlots(game, owner)
  if (!openSlots.includes(slotIndex!)) {
    throw new GameRuleError('선택한 전장 슬롯은 사용할 수 없습니다.')
  }
  return slotIndex!
}

function summonCard(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
  summonedThisTurn = true,
  requestedSlot?: number,
): UnitInstance {
  const player = game.players[owner]
  if (player.field.length >= getFieldLimit(game)) {
    throw new GameRuleError('전장에 빈 슬롯이 없습니다.')
  }

  const slotIndex = requestedSlot ?? getOpenFieldSlots(game, owner)[0]
  if (slotIndex === undefined || !getOpenFieldSlots(game, owner).includes(slotIndex)) {
    throw new GameRuleError('선택한 전장 슬롯은 사용할 수 없습니다.')
  }

  const clean = resetHandCost(card)
  const unit: UnitInstance = {
    ...clean,
    slotIndex,
    battlefieldEntrySeq: game.nextBattlefieldEntrySeq += 1,
    damage: 0,
    exhausted: false,
    summonedThisTurn,
    attacksThisTurn: 0,
    temporaryAttackModifier: 0,
    temporaryHealthModifier: 0,
    temporaryFlying: false,
  }
  player.field.push(unit)
  player.field.sort((left, right) => left.slotIndex - right.slotIndex)
  return unit
}

function enqueueChoice(game: GameState, choice: PendingChoice): void {
  game.pendingChoices.push(choice)
}

function placeMana(
  game: GameState,
  actor: PlayerId,
  instanceId: string,
  random: RandomSource,
): GameState {
  ready(game, actor)
  assertNoPendingChoice(game)
  const player = game.players[actor]
  if (player.manaPlacedThisTurn) {
    throw new GameRuleError('이번 턴에는 이미 마나를 놓았습니다.')
  }

  const index = player.hand.findIndex((card) => card.instanceId === instanceId)
  if (index < 0) throw new GameRuleError('손에서 카드를 찾지 못했습니다.')

  const [card] = player.hand.splice(index, 1)
  placeCardInMana(game, actor, card!, false, random, 'hand')
  player.manaPlacedThisTurn = true
  return game
}

function removeFromHand(player: PlayerState, instanceId: string): CardInstance | null {
  const index = player.hand.findIndex((card) => card.instanceId === instanceId)
  if (index < 0) return null
  const [card] = player.hand.splice(index, 1)
  return card ?? null
}

function awaken(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
  random: RandomSource,
): void {
  const player = game.players[owner]
  if (game.players[opponent(owner)].field.some((unit) => unit.cardId === 'prophet')) {
    return
  }

  switch (card.cardId) {
    case 'living_smoke':
    case 'apostle_pigeon': {
      const openSlots = getOpenFieldSlots(game, owner)
      if (openSlots.length === 1) {
        const handCard = removeFromHand(player, card.instanceId)
        if (handCard) summonCard(game, owner, handCard, true, openSlots[0])
      } else if (openSlots.length > 1) {
        enqueueChoice(game, {
          type: 'AWAKEN_SUMMON_SLOT',
          playerId: owner,
          cardInstanceId: card.instanceId,
        })
      }
      break
    }

    case 'demon_breath': {
      const handCard = removeFromHand(player, card.instanceId)
      if (handCard) {
        const candidateUnitIds = getDemonBreathCandidates(game, owner)
        if (candidateUnitIds.length === 1) {
          destroyDemonBreathTarget(game, owner, candidateUnitIds[0]!, random)
          sendToDiscard(game, owner, handCard)
        } else if (candidateUnitIds.length > 1) {
          enqueueChoice(game, {
            type: 'DEMON_BREATH_TARGET',
            playerId: owner,
            sourceCard: handCard,
            candidateUnitIds,
          })
        } else {
          sendToDiscard(game, owner, handCard)
        }
      }
      break
    }

    case 'eclipse': {
      const handCard = removeFromHand(player, card.instanceId)
      if (handCard) {
        for (const playerId of ['P1', 'P2'] as const) {
          game.players[playerId].field.forEach((unit) => { unit.exhausted = true })
        }
        sendToDiscard(game, owner, handCard)
      }
      break
    }

    case 'holy_mirror_wall': {
      const handCard = removeFromHand(player, card.instanceId)
      if (handCard) {
        sendToDiscard(game, owner, handCard)
        if (game.players[opponent(owner)].life.length > 0) {
          enqueueChoice(game, {
            type: 'HOLY_MIRROR_LIFE',
            playerId: owner,
          })
        }
      }
      break
    }
  }
}

function loseSelectedLife(
  game: GameState,
  defender: PlayerId,
  selectedInstanceIds: readonly string[],
  random: RandomSource,
  suppressAwakening = false,
): void {
  const player = game.players[defender]
  for (const instanceId of selectedInstanceIds) {
    const index = player.life.findIndex((card) => card.instanceId === instanceId)
    if (index < 0) {
      throw new GameRuleError('선택한 라이프 카드를 찾지 못했습니다.')
    }
    const [card] = player.life.splice(index, 1)
    const handCard = resetHandCost(card!, true)
    player.hand.push(handCard)
    if (!suppressAwakening) awaken(game, defender, handCard, random)
  }
}

function resolveArrival(
  game: GameState,
  actor: PlayerId,
  unit: UnitInstance,
  paidMana: ManaCardInstance[],
  random: RandomSource,
): void {
  const player = game.players[actor]
  const paidAttributes = new Set(
    paidMana.flatMap((mana) => CARDS[mana.cardId].attributes),
  )

  switch (unit.cardId) {
    case 'ash_pirate_ship':
      if (paidAttributes.has('fire')) {
        player.field.forEach((ally) => { ally.temporaryAttackModifier += 2 })
      }
      if (paidAttributes.has('water')) {
        unit.temporaryRush = true
      }
      break

    case 'wave_reader': {
      if (paidAttributes.has('water')) {
        const top = player.deck[0]
        if (top) {
          enqueueChoice(game, {
            type: 'WAVE_READER_TOP',
            playerId: actor,
            revealedCard: { ...top },
          })
        }
      }
      break
    }

    case 'ripple_spirit':
      draw(player, random)
      break

    case 'surging_wave': {
      const revealedCards = player.deck.slice(0, 2).map((card) => ({ ...card }))
      if (revealedCards.length > 0) {
        enqueueChoice(game, {
          type: 'SURGING_WAVE_TOP',
          playerId: actor,
          revealedCards,
        })
      }
      break
    }

    case 'seeding_fairy': {
      const top = player.deck.shift()
      if (top) placeCardInMana(game, actor, top, true, random, 'effect')
      break
    }

    case 'temple_prospect':
      if (player.life.length > 0) {
        enqueueChoice(game, {
          type: 'TEMPLE_PROSPECT_LIFE',
          playerId: actor,
          sourceUnitId: unit.instanceId,
        })
      }
      break
  }
}

function getDemonBreathCandidates(
  game: GameState,
  actor: PlayerId,
): string[] {
  const enemy = game.players[opponent(actor)]
  const maxRemainingHealth = Math.max(...enemy.field.map(remainingHealth), -1)
  return enemy.field
    .filter((unit) => remainingHealth(unit) === maxRemainingHealth)
    .map((unit) => unit.instanceId)
}

function destroyDemonBreathTarget(
  game: GameState,
  actor: PlayerId,
  unitId: string,
  random: RandomSource,
): void {
  const enemyId = opponent(actor)
  const enemy = game.players[enemyId]
  const candidateIds = getDemonBreathCandidates(game, actor)
  if (!candidateIds.includes(unitId)) {
    throw new GameRuleError('남은 체력이 가장 높은 상대 몬스터를 선택해야 합니다.')
  }
  const index = enemy.field.findIndex((unit) => unit.instanceId === unitId)
  if (index < 0) throw new GameRuleError('선택한 상대 몬스터가 없습니다.')
  moveFieldToDiscard(game, enemyId, index, random)
}

function requireUnitTarget(
  selection: CardPlaySelection | undefined,
): string {
  if (!selection?.unitId) {
    throw new GameRuleError('효과의 대상 몬스터를 선택해야 합니다.')
  }
  return selection.unitId
}

function requireLifeIndex(
  selection: CardPlaySelection | undefined,
): number {
  if (!Number.isInteger(selection?.lifeIndex)) {
    throw new GameRuleError('효과의 대상 라이프를 선택해야 합니다.')
  }
  return selection!.lifeIndex!
}

function resolveSpell(
  game: GameState,
  actor: PlayerId,
  card: CardInstance,
  paidMana: ManaCardInstance[],
  random: RandomSource,
  selection?: CardPlaySelection,
): void {
  const player = game.players[actor]
  const enemyId = opponent(actor)
  const enemy = game.players[enemyId]
  const paidAttributes = new Set(
    paidMana.flatMap((mana) => CARDS[mana.cardId].attributes),
  )

  switch (card.cardId) {
    case 'burning_procession': {
      const revealedCards = player.deck.slice(0, 4).map((item) => ({ ...item }))
      if (revealedCards.length > 0) {
        enqueueChoice(game, {
          type: 'BURNING_PROCESSION',
          playerId: actor,
          revealedCards,
          maxSummons: Math.min(2, getFieldLimit(game) - player.field.length),
        })
      }
      break
    }

    case 'ebb':
    case 'reverse_current': {
      if (card.cardId === 'ebb' && player.mana.some((mana) => !hasAttribute(mana, 'water'))) {
        throw new GameRuleError('마나에는 물 카드만 있어야 합니다.')
      }
      const targetId = requireUnitTarget(selection)
      const index = enemy.field.findIndex(
        (unit) => unit.instanceId === targetId && unit.exhausted,
      )
      if (index < 0) {
        throw new GameRuleError('선택한 소진 몬스터를 대상으로 삼을 수 없습니다.')
      }
      const [unit] = enemy.field.splice(index, 1)
      enemy.hand.push({ instanceId: unit!.instanceId, cardId: unit!.cardId })
      break
    }

    case 'ash_clearing_rain':
      for (const playerId of ['P1', 'P2'] as const) {
        const current = game.players[playerId]
        for (let index = current.field.length - 1; index >= 0; index -= 1) {
          const unit = current.field[index]!
          if (attackValue(game, playerId, unit) === 1 || remainingHealth(unit) === 1) {
            moveFieldToDiscard(game, playerId, index, random)
          }
        }
      }
      break

    case 'high_tide':
      draw(player, random)
      draw(player, random)
      break

    case 'tsunami':
      if (paidAttributes.has('water')) draw(player, random)
      if (paidAttributes.has('earth')) {
        const top = player.deck.shift()
        if (top) placeCardInMana(game, actor, top, true, random, 'effect')
      }
      break

    case 'desertification': {
      const targetId = requireUnitTarget(selection)
      const index = enemy.field.findIndex((unit) => unit.instanceId === targetId)
      if (index < 0) throw new GameRuleError('선택한 대상 몬스터가 없습니다.')
      const [unit] = enemy.field.splice(index, 1)
      placeCardInMana(game, enemyId, {
        instanceId: unit!.instanceId,
        cardId: unit!.cardId,
      }, true, random, 'effect')
      placeCardInMana(game, actor, card, true, random, 'effect')
      return
    }

    case 'overgrown_sprout':
      if (player.mana.filter((mana) => hasAttribute(mana, 'earth')).length >= 4) {
        player.field.forEach((unit) => {
          if (attackValue(game, actor, unit) === 1) unit.temporaryFlying = true
        })
      }
      break

    case 'grave_digging': {
      const effectManaId = selection?.effectManaId
      if (!effectManaId) {
        throw new GameRuleError('묘지로 보낼 준비된 마나를 선택해야 합니다.')
      }
      const manaIndex = player.mana.findIndex(
        (mana) => mana.instanceId === effectManaId && !mana.exhausted,
      )
      if (manaIndex < 0) {
        throw new GameRuleError('선택한 마나는 준비 상태가 아닙니다.')
      }
      const [mana] = player.mana.splice(manaIndex, 1)
      sendToDiscard(game, actor, mana!)
      enqueueChoice(game, {
        type: 'GRAVE_DIGGING_RETURN',
        playerId: actor,
        sourceCard: card,
        maxCards: 2,
      })
      return
    }

    case 'demon_breath': {
      const targetId = requireUnitTarget(selection)
      destroyDemonBreathTarget(game, actor, targetId, random)
      break
    }

    case 'eclipse':
      if (paidAttributes.has('light')) {
        for (const playerId of ['P1', 'P2'] as const) {
          game.players[playerId].field.forEach((unit) => { unit.exhausted = true })
        }
      }
      if (paidAttributes.has('dark')) {
        for (const playerId of ['P1', 'P2'] as const) {
          const current = game.players[playerId]
          for (let index = current.field.length - 1; index >= 0; index -= 1) {
            if (current.field[index]!.exhausted) {
              moveFieldToDiscard(game, playerId, index, random)
            }
          }
        }
      }
      break

    case 'devotion':
      if (player.life.length > 2) {
        throw new GameRuleError('라이프가 2장 이하일 때만 사용할 수 있습니다.')
      }
      placeInLife(game, actor, card)
      return

    case 'holy_mirror_wall': {
      const lifeIndex = requireLifeIndex(selection)
      if (lifeIndex < 0 || lifeIndex >= enemy.life.length) {
        throw new GameRuleError('선택한 상대 라이프가 없습니다.')
      }
      const [lifeCard] = enemy.life.splice(lifeIndex, 1)
      sendToDiscard(game, enemyId, lifeCard!)
      break
    }

    case 'battle_campfire':
      if (paidAttributes.has('fire')) {
        game.players.P1.field.forEach((unit) => { unit.damage += 1 })
        game.players.P2.field.forEach((unit) => { unit.damage += 1 })
        cleanupDead(game, random)
      }
      if (paidAttributes.has('light')) {
        player.field.forEach((unit) => { unit.damage = Math.max(0, unit.damage - 1) })
      }
      break
  }

  sendToDiscard(game, actor, card)
}

function playCard(
  game: GameState,
  actor: PlayerId,
  instanceId: string,
  manaIds: string[],
  selection: CardPlaySelection | undefined,
  random: RandomSource,
): GameState {
  ready(game, actor)
  assertNoPendingChoice(game)

  const player = game.players[actor]
  const index = player.hand.findIndex((card) => card.instanceId === instanceId)
  if (index < 0) throw new GameRuleError('손에서 카드를 찾지 못했습니다.')

  const card = player.hand[index]!
  const definition = CARDS[card.cardId]

  if (definition.type === 'unit' && player.field.length >= getFieldLimit(game)) {
    throw new GameRuleError('전장에 빈 슬롯이 없습니다.')
  }
  const paidMana = spend(player, effectiveCost(player, card, definition), manaIds)
  player.hand.splice(index, 1)

  if (definition.type === 'unit') {
    const fieldSlot = requireOpenFieldSlot(game, actor, selection?.fieldSlot)
    const unit = summonCard(game, actor, card, true, fieldSlot)
    resolveArrival(game, actor, unit, paidMana, random)
  } else {
    resolveSpell(game, actor, resetHandCost(card), paidMana, random, selection)
  }

  return game
}

function summonFromMana(
  game: GameState,
  actor: PlayerId,
  instanceId: string,
  fieldSlot: number,
): GameState {
  ready(game, actor)
  assertNoPendingChoice(game)
  const player = game.players[actor]
  const index = player.mana.findIndex(
    (mana) => mana.instanceId === instanceId && mana.cardId === 'heavy_seed',
  )
  if (index < 0) {
    throw new GameRuleError('소환할 수 있는 마나 카드가 아닙니다.')
  }
  if (player.mana.filter((mana) => hasAttribute(mana, 'earth')).length < 4) {
    throw new GameRuleError('땅 마나가 4장 이상 필요합니다.')
  }
  const slotIndex = requireOpenFieldSlot(game, actor, fieldSlot)
  const [mana] = player.mana.splice(index, 1)
  summonCard(game, actor, mana!, true, slotIndex)
  return game
}

function hasApostlePigeonOnBattlefield(game: GameState): boolean {
  return game.players.P1.field.concat(game.players.P2.field)
    .some((unit) => unit.cardId === 'apostle_pigeon')
}

function assertCanAttack(
  game: GameState,
  actor: PlayerId,
  unit: UnitInstance,
  targetKind: 'unit' | 'player',
): void {
  if (unit.exhausted) {
    throw new GameRuleError('소진된 몬스터는 공격할 수 없습니다.')
  }
  if (unit.summonedThisTurn) {
    const hasRush = hasKeyword(game, actor, unit, 'rush')
    const hasCharge = hasKeyword(game, actor, unit, 'charge')
    if (!hasRush && !(hasCharge && targetKind === 'unit')) {
      throw new GameRuleError(
        hasCharge
          ? '돌진 몬스터는 소환된 턴에 상대 몬스터만 공격할 수 있습니다.'
          : '이번 턴에 소환된 몬스터는 공격할 수 없습니다.',
      )
    }
  }
  const maxAttacks = hasKeyword(game, actor, unit, 'windfury') ? 2 : 1
  if (unit.attacksThisTurn >= maxAttacks) {
    throw new GameRuleError('공격 횟수를 모두 사용했습니다.')
  }
  if (
    hasApostlePigeonOnBattlefield(game)
    && game.players[actor].attacksThisTurn >= 1
  ) {
    throw new GameRuleError('사도의 비둘기 때문에 이번 턴에는 더 공격할 수 없습니다.')
  }
}

function consumeAttack(
  player: PlayerState,
  unit: UnitInstance,
  game: GameState,
  actor: PlayerId,
): void {
  unit.attacksThisTurn += 1
  player.attacksThisTurn += 1
  unit.exhausted = unit.attacksThisTurn >= (
    hasKeyword(game, actor, unit, 'windfury') ? 2 : 1
  )
}

function attackUnit(
  game: GameState,
  actor: PlayerId,
  attackerId: string,
  defenderId: string,
  random: RandomSource,
): GameState {
  ready(game, actor)
  assertNoPendingChoice(game)
  const player = game.players[actor]
  const enemyId = opponent(actor)
  const enemy = game.players[enemyId]
  const attacker = player.field.find((unit) => unit.instanceId === attackerId)
  const defender = enemy.field.find((unit) => unit.instanceId === defenderId)
  if (!attacker || !defender) {
    throw new GameRuleError('공격 대상을 찾지 못했습니다.')
  }

  assertCanAttack(game, actor, attacker, 'unit')
  if (
    enemy.field.some((unit) => unit.cardId === 'cathedral_guard' && !unit.exhausted)
    && unitDefinition(attacker).cost <= 1
  ) {
    throw new GameRuleError('준비된 성당 경비병 때문에 비용 1 이하 몬스터는 공격할 수 없습니다.')
  }
  if (hasKeyword(game, enemyId, defender, 'stealth')) {
    throw new GameRuleError('잠행 몬스터는 공격 대상으로 선택할 수 없습니다.')
  }

  const attackerHasAssassination = hasKeyword(game, actor, attacker, 'assassination')
  const defenderHasAssassination = hasKeyword(game, enemyId, defender, 'assassination')

  consumeAttack(player, attacker, game, actor)
  attacker.damage += combatAttackValue(game, enemyId, defender)
  defender.damage += combatAttackValue(game, actor, attacker)
  cleanupDead(game, random)

  const assassinationTargets = [
    ...(attackerHasAssassination ? [{ owner: enemyId, instanceId: defenderId }] : []),
    ...(defenderHasAssassination ? [{ owner: actor, instanceId: attackerId }] : []),
  ].map((target) => {
    const unit = game.players[target.owner].field.find((candidate) => candidate.instanceId === target.instanceId)
    return unit ? { ...target, battlefieldEntrySeq: unit.battlefieldEntrySeq } : null
  }).filter((target): target is { owner: PlayerId; instanceId: string; battlefieldEntrySeq: number } => target !== null)
    .sort((left, right) => left.battlefieldEntrySeq - right.battlefieldEntrySeq)

  for (const target of assassinationTargets) {
    const targetPlayer = game.players[target.owner]
    const targetIndex = targetPlayer.field.findIndex((unit) => unit.instanceId === target.instanceId)
    if (targetIndex >= 0) moveFieldToDiscard(game, target.owner, targetIndex, random)
  }
  return game
}

function attackPlayer(
  game: GameState,
  actor: PlayerId,
  attackerId: string,
  lifeSlotIndices: number[],
  random: RandomSource,
): GameState {
  ready(game, actor)
  assertNoPendingChoice(game)
  const player = game.players[actor]
  const enemyId = opponent(actor)
  const enemy = game.players[enemyId]
  const attacker = player.field.find((unit) => unit.instanceId === attackerId)
  if (!attacker) throw new GameRuleError('공격 몬스터를 찾지 못했습니다.')

  assertCanAttack(game, actor, attacker, 'player')
  if (attacker.cardId === 'blue_black_hound') {
    throw new GameRuleError('검푸른 들개는 직접 공격할 수 없습니다.')
  }
  if (
    enemy.field.some((unit) => unit.cardId === 'cathedral_guard' && !unit.exhausted)
    && unitDefinition(attacker).cost <= 1
  ) {
    throw new GameRuleError('준비된 성당 경비병 때문에 비용 1 이하 몬스터는 공격할 수 없습니다.')
  }
  const hasAttackableUnit = enemy.field.some(
    (unit) => !hasKeyword(game, enemyId, unit, 'stealth'),
  )
  if (hasAttackableUnit && !hasKeyword(game, actor, attacker, 'flying')) {
    throw new GameRuleError('공격 가능한 상대 몬스터가 있습니다.')
  }

  const requestedLoss = 1
  const selectableLoss = Math.min(requestedLoss, enemy.life.length)

  const selectedLifeCards = lifeSlotIndices.map((slotIndex) => enemy.life.find(
    (card, index) => (card.lifeSlotIndex ?? index) === slotIndex,
  ))
  if (
    lifeSlotIndices.length !== selectableLoss
    || new Set(lifeSlotIndices).size !== lifeSlotIndices.length
    || lifeSlotIndices.some((slotIndex) => !Number.isInteger(slotIndex) || slotIndex < 0)
    || selectedLifeCards.some((card) => card === undefined)
  ) {
    throw new GameRuleError(`파괴할 상대 라이프 ${selectableLoss}장을 선택해야 합니다.`)
  }

  const selectedInstanceIds = selectedLifeCards.map((card) => card!.instanceId)
  consumeAttack(player, attacker, game, actor)

  if (enemy.life.length === 0) {
    game.status = 'finished'
    game.winner = actor
    game.pendingChoices = []
    return game
  }

  loseSelectedLife(game, enemyId, selectedInstanceIds, random)
  return game
}

function resolveChoice(
  game: GameState,
  actor: PlayerId,
  choiceIds: string[],
  random: RandomSource,
): GameState {
  if (game.status !== 'playing') {
    throw new GameRuleError('이미 끝난 게임입니다.')
  }
  const pending = game.pendingChoices[0]
  if (!pending) throw new GameRuleError('진행 중인 선택이 없습니다.')
  if (pending.playerId !== actor) {
    throw new GameRuleError('상대가 카드 효과를 선택하는 중입니다.')
  }

  const player = game.players[actor]

  switch (pending.type) {
    case 'TEMPLE_PROSPECT_LIFE': {
      if (choiceIds.length !== 1 || !choiceIds[0]!.startsWith('life:')) {
        throw new GameRuleError('손으로 가져올 라이프 한 장을 선택해야 합니다.')
      }
      const lifeIndex = Number(choiceIds[0]!.slice(5))
      if (!Number.isInteger(lifeIndex) || lifeIndex < 0 || lifeIndex >= player.life.length) {
        throw new GameRuleError('선택한 라이프가 없습니다.')
      }
      const [lifeCard] = player.life.splice(lifeIndex, 1)
      player.hand.push(resetHandCost(lifeCard!, true))
      game.pendingChoices.shift()
      game.pendingChoices.unshift({
        type: 'TEMPLE_PROSPECT_HAND',
        playerId: actor,
        sourceUnitId: pending.sourceUnitId,
      })
      return game
    }

    case 'TEMPLE_PROSPECT_HAND': {
      if (choiceIds.length > 1) {
        throw new GameRuleError('라이프로 놓을 손 카드는 한 장만 선택할 수 있습니다.')
      }
      if (choiceIds.length === 1) {
        const handIndex = player.hand.findIndex(
          (card) => card.instanceId === choiceIds[0],
        )
        if (handIndex < 0) throw new GameRuleError('선택한 손 카드를 찾지 못했습니다.')
        const [handCard] = player.hand.splice(handIndex, 1)
        placeInLife(game, actor, handCard!)
      }
      game.pendingChoices.shift()
      return game
    }

    case 'WAVE_READER_TOP': {
      if (choiceIds.length !== 1 || !['keep', 'discard'].includes(choiceIds[0]!)) {
        throw new GameRuleError('덱 위에 둘지 묘지로 보낼지 선택해야 합니다.')
      }
      const top = player.deck[0]
      if (!top || top.instanceId !== pending.revealedCard.instanceId) {
        throw new GameRuleError('확인했던 덱 위 카드가 변경되었습니다.')
      }
      if (choiceIds[0] === 'discard') {
        sendToDiscard(game, actor, player.deck.shift()!)
      }
      game.pendingChoices.shift()
      return game
    }

    case 'SURGING_WAVE_TOP': {
      if (choiceIds.length !== 1) {
        throw new GameRuleError('소환할 카드와 슬롯 또는 덱 맨 아래 순서를 선택해야 합니다.')
      }
      const prefix = player.deck.slice(0, pending.revealedCards.length)
      if (
        prefix.length !== pending.revealedCards.length
        || prefix.some((card, index) => card.instanceId !== pending.revealedCards[index]!.instanceId)
      ) {
        throw new GameRuleError('확인했던 덱 위 카드가 변경되었습니다.')
      }

      const choice = choiceIds[0]!
      const revealed = player.deck.splice(0, pending.revealedCards.length)
      let bottomCards = [...revealed]

      if (choice.startsWith('summon:')) {
        const payload = choice.slice('summon:'.length)
        const separator = payload.lastIndexOf('@')
        if (separator < 1) {
          throw new GameRuleError('소환할 카드와 전장 슬롯을 함께 선택해야 합니다.')
        }
        const instanceId = payload.slice(0, separator)
        const slotIndex = requireOpenFieldSlot(game, actor, Number(payload.slice(separator + 1)))
        const selectedIndex = revealed.findIndex((card) => card.instanceId === instanceId)
        const selected = revealed[selectedIndex]
        const definition = selected ? CARDS[selected.cardId] : null
        if (
          !selected
          || definition?.type !== 'unit'
          || definition.cost > 2
          || !definition.attributes.includes('water')
        ) {
          throw new GameRuleError('비용 2 이하의 물 몬스터를 선택해야 합니다.')
        }
        summonCard(game, actor, selected, true, slotIndex)
        bottomCards = revealed.filter((_, index) => index !== selectedIndex)
      } else if (choice === 'bottom:reverse') {
        bottomCards.reverse()
      } else if (choice !== 'bottom:normal') {
        throw new GameRuleError('몰아치는 파도의 처리 방법을 선택해야 합니다.')
      }

      player.deck.push(...bottomCards)
      game.pendingChoices.shift()
      return game
    }

    case 'BURNING_PROCESSION': {
      const prefix = player.deck.slice(0, pending.revealedCards.length)
      if (
        prefix.length !== pending.revealedCards.length
        || prefix.some((card, index) => card.instanceId !== pending.revealedCards[index]!.instanceId)
      ) {
        throw new GameRuleError('확인했던 덱 카드가 변경되었습니다.')
      }

      const selectableIds = new Set(pending.revealedCards.filter((card) => {
        const definition = CARDS[card.cardId]
        return definition.type === 'unit'
          && definition.cost <= 2
          && definition.attributes.includes('fire')
      }).map((card) => card.instanceId))

      const selections = choiceIds.map((choice) => {
        const separator = choice.lastIndexOf('@')
        if (separator < 1) throw new GameRuleError('소환할 카드와 슬롯을 함께 선택해야 합니다.')
        return {
          instanceId: choice.slice(0, separator),
          slotIndex: Number(choice.slice(separator + 1)),
        }
      })
      if (new Set(selections.map((item) => item.instanceId)).size !== selections.length) {
        throw new GameRuleError('같은 카드를 두 번 선택할 수 없습니다.')
      }
      if (new Set(selections.map((item) => item.slotIndex)).size !== selections.length) {
        throw new GameRuleError('같은 전장 슬롯을 두 번 선택할 수 없습니다.')
      }
      if (selections.some((item) => !selectableIds.has(item.instanceId))) {
        throw new GameRuleError('선택한 카드 중 소환할 수 없는 카드가 있습니다.')
      }
      if (selections.length > pending.maxSummons) {
        throw new GameRuleError('빈 전장 슬롯보다 많은 몬스터를 선택했습니다.')
      }
      const openSlots = new Set(getOpenFieldSlots(game, actor))
      if (selections.some((item) => !Number.isInteger(item.slotIndex) || !openSlots.has(item.slotIndex))) {
        throw new GameRuleError('선택한 전장 슬롯은 사용할 수 없습니다.')
      }

      const revealed = player.deck.splice(0, pending.revealedCards.length)
      const selected = new Map(selections.map((item) => [item.instanceId, item.slotIndex]))
      for (const revealedCard of revealed) {
        const slotIndex = selected.get(revealedCard.instanceId)
        if (slotIndex !== undefined) {
          summonCard(game, actor, revealedCard, true, slotIndex)
        } else {
          sendToDiscard(game, actor, revealedCard)
        }
      }
      game.pendingChoices.shift()
      return game
    }


    case 'GRAVE_DIGGING_RETURN': {
      if (choiceIds.length > pending.maxCards || new Set(choiceIds).size !== choiceIds.length) {
        throw new GameRuleError(`묘지에서 최대 ${pending.maxCards}장까지 선택할 수 있습니다.`)
      }
      const selectedCards = choiceIds.map((instanceId) => {
        const index = player.discard.findIndex((card) => card.instanceId === instanceId)
        if (index < 0) throw new GameRuleError('선택한 묘지 카드를 찾지 못했습니다.')
        return player.discard[index]!
      })
      for (const selected of selectedCards) {
        const index = player.discard.findIndex((card) => card.instanceId === selected.instanceId)
        const [returned] = player.discard.splice(index, 1)
        player.hand.push(returned!)
      }
      sendToDiscard(game, actor, pending.sourceCard)
      game.pendingChoices.shift()
      return game
    }

    case 'DEMON_FINGER_DISCARD': {
      if (choiceIds.length !== 1) {
        throw new GameRuleError('묘지로 보낼 손 카드 한 장을 선택해야 합니다.')
      }
      const handIndex = player.hand.findIndex((card) => card.instanceId === choiceIds[0])
      if (handIndex < 0) throw new GameRuleError('선택한 손 카드를 찾지 못했습니다.')
      const [discarded] = player.hand.splice(handIndex, 1)
      sendToDiscard(game, actor, discarded!)
      game.pendingChoices.shift()
      return game
    }

    case 'DEMON_BREATH_TARGET': {
      if (choiceIds.length !== 1 || !pending.candidateUnitIds.includes(choiceIds[0]!)) {
        throw new GameRuleError('남은 체력이 가장 높은 상대 몬스터 중 한 장을 선택해야 합니다.')
      }
      destroyDemonBreathTarget(game, actor, choiceIds[0]!, random)
      sendToDiscard(game, actor, pending.sourceCard)
      game.pendingChoices.shift()
      return game
    }

    case 'AWAKEN_SUMMON_SLOT': {
      if (choiceIds.length !== 1 || !choiceIds[0]!.startsWith('slot:')) {
        throw new GameRuleError('각성으로 소환할 전장 슬롯을 선택해야 합니다.')
      }
      const slotIndex = requireOpenFieldSlot(game, actor, Number(choiceIds[0]!.slice(5)))
      const handCard = removeFromHand(player, pending.cardInstanceId)
      if (!handCard) {
        throw new GameRuleError('각성한 카드를 손에서 찾지 못했습니다.')
      }
      summonCard(game, actor, handCard, true, slotIndex)
      game.pendingChoices.shift()
      return game
    }

    case 'HOLY_MIRROR_LIFE': {
      if (choiceIds.length !== 1 || !choiceIds[0]!.startsWith('life:')) {
        throw new GameRuleError('묘지로 보낼 상대 라이프 한 장을 선택해야 합니다.')
      }
      const enemyId = opponent(actor)
      const enemy = game.players[enemyId]
      const lifeIndex = Number(choiceIds[0]!.slice(5))
      if (!Number.isInteger(lifeIndex) || lifeIndex < 0 || lifeIndex >= enemy.life.length) {
        throw new GameRuleError('선택한 상대 라이프가 없습니다.')
      }
      const [lifeCard] = enemy.life.splice(lifeIndex, 1)
      sendToDiscard(game, enemyId, lifeCard!)
      game.pendingChoices.shift()
      return game
    }
  }
}

function clearEndOfTurnEffects(
  game: GameState,
  random: RandomSource,
): void {
  for (const playerId of ['P1', 'P2'] as const) {
    const player = game.players[playerId]
    player.extraLifeLossOnDirectAttack = false
    for (const unit of player.field) {
      unit.temporaryAttackModifier = 0
      unit.temporaryHealthModifier = 0
      unit.temporaryRush = false
      unit.temporaryFlying = false
    }
  }
  cleanupDead(game, random)
}

function endTurn(
  game: GameState,
  actor: PlayerId,
  random: RandomSource,
): GameState {
  ready(game, actor)
  assertNoPendingChoice(game)
  clearEndOfTurnEffects(game, random)

  for (const playerId of ['P1', 'P2'] as const) {
    game.players[playerId].darkCardsDiscardedThisTurn = 0
  }

  const nextPlayerId = opponent(actor)
  const nextPlayer = game.players[nextPlayerId]
  game.currentPlayer = nextPlayerId
  game.turnNumber += 1

  for (const mana of nextPlayer.mana) mana.exhausted = false
  for (const unit of nextPlayer.field) {
    unit.exhausted = false
    unit.summonedThisTurn = false
    unit.attacksThisTurn = 0
  }
  nextPlayer.manaPlacedThisTurn = false
  nextPlayer.attacksThisTurn = 0
  draw(nextPlayer, random)
  return game
}

export function applyAction(
  state: GameState,
  actor: PlayerId,
  action: GameAction,
  suppliedRandom?: RandomSource,
): GameState {
  const game = clone(state)
  normalizeState(game)
  const random = suppliedRandom
    ?? createSeededRandom(
      `${game.matchConfig.randomSeed}:action:${game.actionSequence + 1}`,
    ).next

  if (
    action.type !== 'RESOLVE_CHOICE'
    && action.type !== 'SURRENDER'
    && game.pendingChoices.length > 0
  ) {
    throw new GameRuleError('먼저 진행 중인 카드 선택을 완료해야 합니다.')
  }

  let result: GameState

  switch (action.type) {
    case 'PLACE_MANA':
      result = placeMana(game, actor, action.cardInstanceId, random)
      break
    case 'PLAY_CARD':
      result = playCard(
        game,
        actor,
        action.cardInstanceId,
        action.manaIds,
        action.selection,
        random,
      )
      break
    case 'RESOLVE_CHOICE':
      result = resolveChoice(game, actor, action.choiceIds, random)
      break
    case 'SUMMON_FROM_MANA':
      result = summonFromMana(game, actor, action.cardInstanceId, action.fieldSlot)
      break
    case 'ATTACK_UNIT':
      result = attackUnit(game, actor, action.attackerId, action.defenderId, random)
      break
    case 'ATTACK_PLAYER': {
      const enemyLife = game.players[opponent(actor)].life
      const lifeSlotIndices = action.lifeSlotIndices ?? (action.lifeIndices ?? []).map(
        (lifeIndex) => enemyLife[lifeIndex]?.lifeSlotIndex ?? lifeIndex,
      )
      result = attackPlayer(
        game,
        actor,
        action.attackerId,
        lifeSlotIndices,
        random,
      )
      break
    }
    case 'END_TURN':
      result = endTurn(game, actor, random)
      break
    case 'SURRENDER':
      if (game.status !== 'playing') {
        throw new GameRuleError('이미 끝난 게임입니다.')
      }
      game.status = 'finished'
      game.winner = opponent(actor)
      game.pendingChoices = []
      result = game
      break
  }

  result.actionSequence += 1
  return result
}
