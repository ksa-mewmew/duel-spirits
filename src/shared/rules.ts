import { CARD_ATTRIBUTES, CARDS, DEFAULT_DECK } from './cards'
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
  + player.field.reduce((count, unit) => count + (unit.evolutionStack?.length ?? 0), 0)
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

function meetsSummonCondition(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
): boolean {
  if (card.cardId !== 'volcano_mouse') return true
  return game.players[owner].mana.filter((mana) => hasAttribute(mana, 'fire')).length >= 2
}

function requireSummonCondition(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
): void {
  if (!meetsSummonCondition(game, owner, card)) {
    throw new GameRuleError('화산쥐는 자신의 마나에 불 카드가 2장 이상 있어야 소환할 수 있습니다.')
  }
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
  if (keyword === 'charge' && unit.temporaryCharge) return true
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
  if (
    unit.cardId === 'funeral_inviter'
    && game.players[owner].discard.length >= 4
    && keyword === 'stealth'
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
      unit.cardId === 'hard_seed_bug'
      && game.players[owner].mana.filter((mana) => hasAttribute(mana, 'earth')).length >= 5
        ? 1
        : 0
    )
    + (
      unit.cardId === 'salvation_lancer'
      && game.players[owner].life.length <= 2
        ? 1
        : 0
    )
}

function combatAttackValue(
  game: GameState,
  owner: PlayerId,
  unit: UnitInstance,
  role: 'attacker' | 'defender',
  targetKind: 'unit' | 'player' = 'unit',
): number {
  return attackValue(game, owner, unit)
    + (unit.cardId === 'living_smoke' ? 2 : 0)
    + (unit.cardId === 'spark_chasing_lizard' && role === 'attacker' ? 3 : 0)
    + (unit.cardId === 'cliff_hunter' && role === 'attacker' && targetKind === 'unit' ? 2 : 0)
}

function healthValue(game: GameState, owner: PlayerId, unit: UnitInstance): number {
  return unitDefinition(unit).health
    + unit.temporaryHealthModifier
    + (
      unit.cardId === 'hard_seed_bug'
      && game.players[owner].mana.filter((mana) => hasAttribute(mana, 'earth')).length >= 5
        ? 1
        : 0
    )
}

function remainingHealth(game: GameState, owner: PlayerId, unit: UnitInstance): number {
  return healthValue(game, owner, unit) - unit.damage
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

function unitAsCard(unit: UnitInstance): CardInstance {
  return {
    instanceId: unit.instanceId,
    cardId: unit.cardId,
    ownerId: unit.ownerId,
    controllerId: unit.controllerId,
  }
}

function discardEvolutionStack(
  game: GameState,
  owner: PlayerId,
  unit: UnitInstance,
): void {
  for (const material of unit.evolutionStack ?? []) {
    sendToDiscard(game, owner, material)
  }
}

function moveFieldUnitToHand(
  game: GameState,
  owner: PlayerId,
  index: number,
  causedBy: PlayerId | null = null,
): CardInstance | null {
  const player = game.players[owner]
  const unit = player.field[index]
  if (!unit) return null
  if (
    unit.cardId === 'walking_hill'
    && causedBy !== null
    && causedBy !== owner
  ) return null

  player.field.splice(index, 1)
  discardEvolutionStack(game, owner, unit)
  const card = resetHandCost(unitAsCard(unit))
  player.hand.push(card)
  return card
}

function moveFieldUnitToMana(
  game: GameState,
  owner: PlayerId,
  index: number,
  exhausted: boolean,
  random: RandomSource,
): ManaCardInstance | null {
  const player = game.players[owner]
  const unit = player.field[index]
  if (!unit) return null
  player.field.splice(index, 1)
  discardEvolutionStack(game, owner, unit)
  return placeCardInMana(game, owner, unitAsCard(unit), exhausted, random, 'non-hand')
}

function handleUnitDeath(
  game: GameState,
  owner: PlayerId,
  unit: UnitInstance,
  random: RandomSource,
): void {
  sendToDiscard(game, owner, unitAsCard(unit))
  discardEvolutionStack(game, owner, unit)

  // 유언은 전장에서 묘지로 보내진 직후 발동합니다.
  if (unit.cardId === 'last_ember') {
    draw(game.players[owner], random)
  }
  if (unit.cardId === 'demon_finger' || unit.cardId === 'funeral_inviter') {
    const chooser = opponent(owner)
    if (game.players[chooser].hand.length > 0) {
      enqueueChoice(game, { type: 'DEMON_FINGER_DISCARD', playerId: chooser })
    }
  }
  if (unit.cardId === 'unexploded_bomb_mouse') {
    const candidateIds = game.players[opponent(owner)].field.map((target) => target.instanceId)
    if (candidateIds.length > 0) {
      enqueueChoice(game, {
        type: 'SOF_CHOICE',
        effect: 'BOMB_MOUSE_DAMAGE',
        playerId: owner,
        sourcePlayerId: owner,
        candidateIds,
      })
    }
  }
  if (unit.cardId === 'mourner') {
    const candidateIds = game.players[owner].discard
      .filter((card) => {
        const definition = CARDS[card.cardId]
        return definition.type === 'unit'
          && definition.cost <= 2
          && definition.attributes.includes('dark')
      })
      .map((card) => card.instanceId)
    if (candidateIds.length > 0 && getOpenFieldSlots(game, owner).length > 0) {
      enqueueChoice(game, {
        type: 'SOF_CHOICE',
        effect: 'MOURNER_LAST_WORDS',
        playerId: owner,
        sourcePlayerId: owner,
        candidateIds,
        maxChoices: 1,
        minChoices: 0,
      })
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
        .filter((unit) => unit.damage >= healthValue(game, playerId, unit))
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
  _random: RandomSource,
  _source: 'hand' | 'non-hand',
): ManaCardInstance {
  const manaCard: ManaCardInstance = {
    ...resetHandCost(card),
    exhausted,
  }
  game.players[owner].mana.push(manaCard)

  if (manaCard.cardId === 'tree_fairy' && game.players[owner].hand.length > 0) {
    enqueueChoice(game, {
      type: 'SOF_CHOICE',
      effect: 'TREE_FAIRY_HAND_MANA',
      playerId: owner,
      sourcePlayerId: owner,
      sourceCard: { ...manaCard },
      candidateIds: game.players[owner].hand.map((handCard) => handCard.instanceId),
      minChoices: 0,
      maxChoices: 1,
    })
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
  summonConditionAlreadyChecked = false,
): UnitInstance {
  const player = game.players[owner]
  if (!summonConditionAlreadyChecked) requireSummonCondition(game, owner, card)
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

function evolveCard(
  game: GameState,
  owner: PlayerId,
  card: CardInstance,
  baseUnitId: string | undefined,
): UnitInstance {
  const definition = CARDS[card.cardId]
  if (definition.type !== 'unit' || !definition.evolutionAttribute) {
    throw new GameRuleError('진화 몬스터가 아닙니다.')
  }
  if (!baseUnitId) {
    throw new GameRuleError('진화시킬 내 몬스터를 선택해야 합니다.')
  }
  const player = game.players[owner]
  const index = player.field.findIndex((unit) => unit.instanceId === baseUnitId)
  const base = player.field[index]
  if (!base || !CARDS[base.cardId].attributes.includes(definition.evolutionAttribute)) {
    throw new GameRuleError(`${CARD_ATTRIBUTES[definition.evolutionAttribute].name} 몬스터 위에만 진화할 수 있습니다.`)
  }

  const clean = resetHandCost(card)
  const unit: UnitInstance = {
    ...clean,
    slotIndex: base.slotIndex,
    battlefieldEntrySeq: game.nextBattlefieldEntrySeq += 1,
    damage: 0,
    exhausted: false,
    summonedThisTurn: true,
    evolvedThisTurn: true,
    attacksThisTurn: 0,
    temporaryAttackModifier: 0,
    temporaryHealthModifier: 0,
    temporaryFlying: false,
    evolutionStack: [
      ...(base.evolutionStack ?? []),
      unitAsCard(base),
    ],
  }
  player.field.splice(index, 1, unit)
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

function cardHasAwakening(cardId: CardId): boolean {
  return ['living_smoke', 'apostle_pigeon', 'demon_breath', 'eclipse', 'holy_mirror_wall']
    .includes(cardId)
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
  selection?: CardPlaySelection,
  evolved = false,
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

    case 'iron_horn_boar':
      if (paidAttributes.has('fire')) unit.temporaryCharge = true
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
      if (top) placeCardInMana(game, actor, top, true, random, 'non-hand')
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

    case 'exploding_mountain_dragon':
      game.players[opponent(actor)].field.forEach((target) => { target.damage += 2 })
      cleanupDead(game, random)
      break

    case 'underwater_observer': {
      const revealedCards = player.deck.slice(0, 2).map((card) => ({ ...card }))
      if (revealedCards.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'UNDERWATER_OBSERVER_TOP',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          revealedCards,
        })
      }
      break
    }

    case 'ice_mirror_spirit': {
      const candidateIds = game.players[opponent(actor)].field
        .filter((target) => target.exhausted && unitDefinition(target).cost <= 2)
        .map((target) => target.instanceId)
      if (candidateIds.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'ICE_MIRROR_FREEZE',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds, minChoices: 1, maxChoices: 1,
        })
      }
      break
    }

    case 'wave_fin': {
      const candidateIds = game.players[opponent(actor)].field
        .filter((target) => target.exhausted && unitDefinition(target).cost <= 2)
        .map((target) => target.instanceId)
      if (candidateIds.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'WAVE_FIN_BOUNCE',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds, minChoices: 0, maxChoices: 1,
        })
      }
      break
    }

    case 'crystal_tsunami': {
      const candidateIds = game.players[opponent(actor)].field
        .filter((target) => target.exhausted)
        .map((target) => target.instanceId)
      if (candidateIds.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'CRYSTAL_TSUNAMI_BOUNCE',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds, minChoices: 0, maxChoices: 1,
        })
      }
      break
    }

    case 'mana_flipping_fairy':
      if (player.mana.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'MANA_FLIP_RETURN',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds: player.mana.map((mana) => mana.instanceId), minChoices: 0, maxChoices: 1,
        })
      }
      break

    case 'earth_guardian':
      if (evolved) {
        const candidateIds = player.mana.filter((mana) => {
          const definition = CARDS[mana.cardId]
          return definition.type === 'unit'
            && definition.cost <= 2
            && !definition.evolutionAttribute
            && meetsSummonCondition(game, actor, mana)
        }).map((mana) => mana.instanceId)
        const maxChoices = Math.min(2, getOpenFieldSlots(game, actor).length)
        if (candidateIds.length > 0 && maxChoices > 0) {
          enqueueChoice(game, {
            type: 'SOF_CHOICE', effect: 'EARTH_GUARDIAN_SUMMON',
            playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
            candidateIds, minChoices: 0, maxChoices,
          })
        }
      }
      break

    case 'grave_merchant': {
      const candidateIds = player.discard.filter((card) => {
        const definition = CARDS[card.cardId]
        return definition.type === 'unit' && definition.cost <= 1
      }).map((card) => card.instanceId)
      if (candidateIds.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'GRAVE_MERCHANT_RETURN',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds, minChoices: 1, maxChoices: 1,
        })
      }
      break
    }

    case 'blackwing_predator': {
      const candidateIds = player.discard.filter((card) => {
        const definition = CARDS[card.cardId]
        return definition.type === 'unit' && definition.cost <= 1 && definition.attributes.includes('dark')
      }).map((card) => card.instanceId)
      if (candidateIds.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'BLACKWING_RETURN',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds, minChoices: 0, maxChoices: 1,
        })
      }
      break
    }

    case 'mourner': {
      const candidateIds = player.field
        .filter((ally) => ally.instanceId !== unit.instanceId)
        .map((ally) => ally.instanceId)
      if (candidateIds.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'MOURNER_SACRIFICE',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds, minChoices: 0, maxChoices: 1,
        })
      }
      break
    }

    case 'sky_white_horse_knight': {
      const candidateIds = player.field
        .filter((ally) => ally.instanceId !== unit.instanceId && ally.exhausted)
        .map((ally) => ally.instanceId)
      if (candidateIds.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'SKY_KNIGHT_READY',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds, minChoices: 0, maxChoices: 1,
        })
      }
      break
    }

    case 'lava_gardener': {
      if (paidAttributes.has('fire') && game.players[opponent(actor)].field.length > 0) {
        const targetId = requireUnitTarget(selection)
        const target = game.players[opponent(actor)].field.find((enemyUnit) => enemyUnit.instanceId === targetId)
        if (!target) throw new GameRuleError('피해를 줄 상대 몬스터를 선택해야 합니다.')
        target.damage += 1
        cleanupDead(game, random)
      }
      if (paidAttributes.has('earth')) {
        const exhaustedMana = player.mana.filter((mana) => mana.exhausted)
        if (exhaustedMana.length > 0) {
          const target = exhaustedMana.find((mana) => mana.instanceId === selection?.effectManaId)
          if (!target) throw new GameRuleError('준비할 소진 마나를 선택해야 합니다.')
          target.exhausted = false
        }
      }
      break
    }

    case 'stone_pillar_priest': {
      const hasEarth = paidAttributes.has('earth')
      const hasLight = paidAttributes.has('light')
      if (hasEarth && player.hand.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'STONE_PRIEST_HAND_MANA',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds: player.hand.map((card) => card.instanceId), minChoices: 0, maxChoices: 1,
          data: { hasLight },
        })
      } else if (hasLight && player.life.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'STONE_PRIEST_LIFE',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds: player.life.map((card) => card.instanceId), minChoices: 0, maxChoices: 1,
        })
      }
      break
    }

    case 'mirror_lake_prophet': {
      const hasLight = paidAttributes.has('light')
      const hasWater = paidAttributes.has('water')
      if (hasLight && player.life.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'MIRROR_LAKE_RESOLVE',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds: player.life.map((card) => card.instanceId), minChoices: 1, maxChoices: 1,
          revealedCards: hasWater && player.deck[0] ? [{ ...player.deck[0] }] : [],
          data: { stage: 'choose-life', hasWater },
        })
      } else if (hasWater && player.deck[0]) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'MIRROR_LAKE_RESOLVE',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          revealedCards: [{ ...player.deck[0] }], minChoices: 1, maxChoices: 1,
          data: { stage: 'water-only' },
        })
      }
      break
    }

    case 'sunken_coffin_keeper': {
      const hasWater = paidAttributes.has('water')
      const hasDark = paidAttributes.has('dark')
      if (hasWater && player.discard.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'COFFIN_KEEPER_BOTTOM',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          candidateIds: player.discard.map((card) => card.instanceId), minChoices: 0, maxChoices: 1,
          data: { hasDark, drawAfter: hasWater && hasDark },
        })
      } else if (hasDark && player.deck[0]) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'COFFIN_KEEPER_TOP',
          playerId: actor, sourcePlayerId: actor, sourceUnitId: unit.instanceId,
          revealedCards: [{ ...player.deck[0] }], minChoices: 1, maxChoices: 1,
          data: { drawAfter: hasWater && hasDark },
        })
      } else if (hasWater && hasDark) {
        draw(player, random)
      }
      break
    }
  }
}

function getDemonBreathCandidates(
  game: GameState,
  actor: PlayerId,
): string[] {
  const enemy = game.players[opponent(actor)]
  const maxRemainingHealth = Math.max(...enemy.field.map((unit) => remainingHealth(game, opponent(actor), unit)), -1)
  return enemy.field
    .filter((unit) => remainingHealth(game, opponent(actor), unit) === maxRemainingHealth)
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
      const revealedCards = player.deck.slice(0, 3).map((item) => ({ ...item }))
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
      moveFieldUnitToHand(game, enemyId, index, actor)
      break
    }

    case 'ash_clearing_rain':
      for (const playerId of ['P1', 'P2'] as const) {
        const current = game.players[playerId]
        for (let index = current.field.length - 1; index >= 0; index -= 1) {
          const unit = current.field[index]!
          if (attackValue(game, playerId, unit) === 1 || remainingHealth(game, playerId, unit) === 1) {
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
        if (top) placeCardInMana(game, actor, top, true, random, 'non-hand')
      }
      break

    case 'desertification': {
      const targetId = requireUnitTarget(selection)
      const index = enemy.field.findIndex((unit) => unit.instanceId === targetId)
      if (index < 0) throw new GameRuleError('선택한 대상 몬스터가 없습니다.')
      moveFieldUnitToMana(game, enemyId, index, true, random)
      placeCardInMana(game, actor, card, true, random, 'non-hand')
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
      cleanupDead(game, random)
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

    case 'volcanic_eruption': {
      const ownFireBefore = new Set(
        player.field
          .filter((unit) => unitDefinition(unit).attributes.includes('fire'))
          .map((unit) => unit.instanceId),
      )
      for (const playerId of ['P1', 'P2'] as const) {
        game.players[playerId].field.forEach((unit) => { unit.damage += 2 })
      }
      cleanupDead(game, random)
      const ownFireDied = [...ownFireBefore]
        .some((id) => !player.field.some((unit) => unit.instanceId === id))
      if (ownFireDied) {
        for (const playerId of ['P1', 'P2'] as const) {
          game.players[playerId].field.forEach((unit) => { unit.damage += 2 })
        }
        cleanupDead(game, random)
      }
      break
    }

    case 'grand_reverse_current':
      for (const playerId of ['P1', 'P2'] as const) {
        const current = game.players[playerId]
        for (let index = current.field.length - 1; index >= 0; index -= 1) {
          if (current.field[index]!.exhausted) {
            moveFieldUnitToHand(game, playerId, index, actor)
          }
        }
      }
      break

    case 'rising_earth': {
      const manaId = selection?.effectManaId
      if (!manaId) throw new GameRuleError('소환할 마나 카드를 선택해야 합니다.')
      if (paidMana.some((mana) => mana.instanceId === manaId)) {
        throw new GameRuleError('비용으로 소진한 마나는 효과로 소환할 수 없습니다.')
      }
      const manaIndex = player.mana.findIndex((mana) => mana.instanceId === manaId)
      const mana = player.mana[manaIndex]
      const definition = mana ? CARDS[mana.cardId] : null
      if (
        !mana
        || definition?.type !== 'unit'
        || definition.cost > 5
        || definition.evolutionAttribute
        || !meetsSummonCondition(game, actor, mana)
      ) {
        throw new GameRuleError('비용 5 이하인 비진화 몬스터를 마나에서 선택해야 합니다.')
      }
      const slot = requireOpenFieldSlot(game, actor, selection?.fieldSlot)
      requireSummonCondition(game, actor, mana)
      player.mana.splice(manaIndex, 1)
      const summoned = summonCard(game, actor, mana, true, slot, true)
      if (definition.attributes.includes('earth')) summoned.temporaryCharge = true
      cleanupDead(game, random)
      break
    }

    case 'mass_burial':
      if (enemy.field.length > 0) {
        enqueueChoice(game, {
          type: 'SOF_CHOICE', effect: 'MASS_BURIAL_ENEMY_FIRST',
          playerId: enemyId, sourcePlayerId: actor, sourceCard: card,
          candidateIds: enemy.field.map((unit) => unit.instanceId), minChoices: 1, maxChoices: 1,
        })
        return
      }
      break

    case 'last_prayer':
      if (player.life.length > 2) {
        throw new GameRuleError('라이프가 2장 이하일 때만 사용할 수 있습니다.')
      }
      enemy.field.forEach((unit) => { unit.exhausted = true })
      player.field.forEach((unit) => {
        unit.exhausted = false
        unit.attacksThisTurn = 0
      })
      break

    case 'crematory_smoke':
      if (paidAttributes.has('fire')) {
        if (paidAttributes.has('dark')) {
          enemy.field.forEach((unit) => { unit.damage += 2 })
        } else {
          const targetId = requireUnitTarget(selection)
          const target = enemy.field.find((unit) => unit.instanceId === targetId)
          if (!target) throw new GameRuleError('피해를 줄 상대 몬스터를 선택해야 합니다.')
          target.damage += 2
        }
        cleanupDead(game, random)
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

  if (
    definition.type === 'unit'
    && !definition.evolutionAttribute
    && player.field.length >= getFieldLimit(game)
  ) {
    throw new GameRuleError('전장에 빈 슬롯이 없습니다.')
  }
  const paidMana = spend(player, effectiveCost(player, card, definition), manaIds)
  player.hand.splice(index, 1)

  if (definition.type === 'unit') {
    if (definition.evolutionAttribute) {
      const unit = evolveCard(game, actor, card, selection?.evolutionUnitId)
      resolveArrival(game, actor, unit, paidMana, random, selection, true)
    } else {
      const fieldSlot = requireOpenFieldSlot(game, actor, selection?.fieldSlot)
      const unit = summonCard(game, actor, card, true, fieldSlot)
      resolveArrival(game, actor, unit, paidMana, random, selection, false)
    }
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
  random: RandomSource,
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
  cleanupDead(game, random)
  return game
}

function battlefieldAttackLimit(game: GameState): number {
  const allUnits = game.players.P1.field.concat(game.players.P2.field)
  if (allUnits.some((unit) => unit.cardId === 'apostle_pigeon')) return 1
  if (allUnits.some((unit) => unit.cardId === 'spirit_agent')) return 2
  return Number.POSITIVE_INFINITY
}

function assertCanAttack(
  game: GameState,
  actor: PlayerId,
  unit: UnitInstance,
  targetKind: 'unit' | 'player',
): void {
  if (unit.cardId === 'silent_shield_soldier') {
    throw new GameRuleError('침묵하는 방패병은 공격할 수 없습니다.')
  }
  if (unit.exhausted) {
    throw new GameRuleError('소진된 몬스터는 공격할 수 없습니다.')
  }
  if (unit.summonedThisTurn && !unit.evolvedThisTurn) {
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
  const globalLimit = battlefieldAttackLimit(game)
  if (game.players[actor].attacksThisTurn >= globalLimit) {
    throw new GameRuleError(
      globalLimit === 1
        ? '사도의 비둘기 때문에 이번 턴에는 더 공격할 수 없습니다.'
        : '성령의 대리인 때문에 이번 턴에는 더 공격할 수 없습니다.',
    )
  }
}

function cannotDirectAttack(unit: UnitInstance): boolean {
  return [
    'blue_black_hound',
    'iron_horn_boar',
    'boulder_carrier',
    'weakened_giant',
  ].includes(unit.cardId)
}

function canTargetUnit(
  game: GameState,
  actor: PlayerId,
  attacker: UnitInstance,
  defender: UnitInstance,
  ignoreSkyKnight = false,
): boolean {
  const enemyId = opponent(actor)
  if (hasKeyword(game, enemyId, defender, 'stealth')) return false
  if (defender.cardId === 'scale_diver' && combatAttackValue(game, actor, attacker, 'attacker', 'unit') >= 3) return false
  if (defender.cardId === 'little_judge' && unitDefinition(attacker).cost <= 1) return false

  if (!ignoreSkyKnight && defender.cardId !== 'sky_white_horse_knight') {
    const hasAttackableSkyKnight = game.players[enemyId].field.some(
      (unit) => unit.cardId === 'sky_white_horse_knight'
        && canTargetUnit(game, actor, attacker, unit, true),
    )
    if (hasAttackableSkyKnight) return false
  }
  return true
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
  if (!canTargetUnit(game, actor, attacker, defender)) {
    if (defender.cardId === 'scale_diver') {
      throw new GameRuleError('비늘 잠수부는 공격력 3 이상인 몬스터에게 공격받지 않습니다.')
    }
    if (defender.cardId === 'little_judge') {
      throw new GameRuleError('작은 심판관은 비용 1 이하 몬스터에게 공격받지 않습니다.')
    }
    if (enemy.field.some((unit) => unit.cardId === 'sky_white_horse_knight' && canTargetUnit(game, actor, attacker, unit, true))) {
      throw new GameRuleError('가능하다면 천공의 백마기사부터 공격해야 합니다.')
    }
    throw new GameRuleError('이 몬스터는 공격 대상으로 선택할 수 없습니다.')
  }

  consumeAttack(player, attacker, game, actor)

  // 화염 투창병은 공격·방어 어느 쪽이든 전투 전에 상대에게 피해를 줍니다.
  if (attacker.cardId === 'flame_javelin_soldier') defender.damage += 1
  if (defender.cardId === 'flame_javelin_soldier') attacker.damage += 1
  if (
    attacker.cardId === 'flame_javelin_soldier'
    || defender.cardId === 'flame_javelin_soldier'
  ) {
    cleanupDead(game, random)
    const attackerStillHere = player.field.some((unit) => unit.instanceId === attackerId)
    const defenderStillHere = enemy.field.some((unit) => unit.instanceId === defenderId)
    if (!attackerStillHere || !defenderStillHere) return game
  }

  const attackerHasAssassination = hasKeyword(game, actor, attacker, 'assassination')
  const defenderHasAssassination = hasKeyword(game, enemyId, defender, 'assassination')

  const attackerDamage = combatAttackValue(game, enemyId, defender, 'defender', 'unit')
  const defenderDamage = combatAttackValue(game, actor, attacker, 'attacker', 'unit')
  attacker.damage += attackerDamage
  defender.damage += defenderDamage
  cleanupDead(game, random)

  const attackerSurvived = player.field.some((unit) => unit.instanceId === attackerId)
  const defenderSurvived = enemy.field.some((unit) => unit.instanceId === defenderId)
  const defenderDiedInCombat = !defenderSurvived

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

  const livingAttacker = player.field.find((unit) => unit.instanceId === attackerId)
  if (livingAttacker && attacker.cardId === 'flame_mane_captain' && defenderDiedInCombat) {
    livingAttacker.exhausted = false
    livingAttacker.attacksThisTurn = 0
  }
  if (livingAttacker && attacker.cardId === 'returning_paladin') {
    livingAttacker.exhausted = false
    livingAttacker.attacksThisTurn = 0
  }

  // 전투 후 살아 있는 해파리는 손으로 돌아갑니다.
  if (attackerSurvived) {
    const index = player.field.findIndex((unit) => unit.instanceId === attackerId && unit.cardId === 'returning_jellyfish')
    if (index >= 0) moveFieldUnitToHand(game, actor, index)
  }
  if (defenderSurvived) {
    const index = enemy.field.findIndex((unit) => unit.instanceId === defenderId && unit.cardId === 'returning_jellyfish')
    if (index >= 0) moveFieldUnitToHand(game, enemyId, index)
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
  if (cannotDirectAttack(attacker)) {
    throw new GameRuleError('이 몬스터는 직접 공격할 수 없습니다.')
  }
  if (
    enemy.field.some((unit) => unit.cardId === 'cathedral_guard' && !unit.exhausted)
    && unitDefinition(attacker).cost <= 1
  ) {
    throw new GameRuleError('준비된 성당 경비병 때문에 비용 1 이하 몬스터는 공격할 수 없습니다.')
  }

  const hasAttackableSkyKnight = enemy.field.some(
    (unit) => unit.cardId === 'sky_white_horse_knight'
      && canTargetUnit(game, actor, attacker, unit, true),
  )
  if (hasAttackableSkyKnight) {
    throw new GameRuleError('가능하다면 천공의 백마기사부터 공격해야 합니다.')
  }

  const hasAttackableUnit = enemy.field.some((unit) => canTargetUnit(game, actor, attacker, unit))
  if (hasAttackableUnit && !hasKeyword(game, actor, attacker, 'flying')) {
    throw new GameRuleError('공격 가능한 상대 몬스터가 있습니다.')
  }

  const requestedLoss = attacker.cardId === 'exploding_mountain_dragon' && enemy.life.length >= 3 ? 2 : 1
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

  if (attacker.cardId === 'wave_fin') {
    enqueueChoice(game, {
      type: 'SOF_CHOICE', effect: 'WAVE_FIN_DRAW',
      playerId: actor, sourcePlayerId: actor, sourceUnitId: attackerId,
      minChoices: 1, maxChoices: 1,
    })
  }
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
    case 'SOF_CHOICE': {
      const sourcePlayer = game.players[pending.sourcePlayerId]
      const enemyId = opponent(pending.sourcePlayerId)
      const sourceEnemy = game.players[enemyId]
      const oneOptional = (): string | null => {
        if (choiceIds.length > 1) throw new GameRuleError('한 장만 선택할 수 있습니다.')
        return choiceIds[0] ?? null
      }
      const oneRequired = (): string => {
        if (choiceIds.length !== 1) throw new GameRuleError('카드 한 장을 선택해야 합니다.')
        return choiceIds[0]!
      }
      const assertCandidate = (id: string): void => {
        if (!(pending.candidateIds ?? []).includes(id)) {
          throw new GameRuleError('선택할 수 없는 카드입니다.')
        }
      }
      const shift = (): void => { game.pendingChoices.shift() }

      switch (pending.effect) {
        case 'BOMB_MOUSE_DAMAGE': {
          const currentCandidates = sourceEnemy.field.filter((unit) =>
            (pending.candidateIds ?? []).includes(unit.instanceId),
          )
          if (currentCandidates.length === 0) {
            if (choiceIds.length > 0) throw new GameRuleError('피해를 줄 상대 몬스터가 없습니다.')
            shift()
            return game
          }
          const id = oneRequired()
          const target = currentCandidates.find((unit) => unit.instanceId === id)
          if (!target) throw new GameRuleError('피해를 줄 상대 몬스터를 선택해야 합니다.')
          target.damage += 2
          shift()
          cleanupDead(game, random)
          return game
        }

        case 'UNDERWATER_OBSERVER_TOP': {
          const revealed = pending.revealedCards ?? []
          const prefix = sourcePlayer.deck.slice(0, revealed.length)
          if (prefix.some((card, index) => card.instanceId !== revealed[index]?.instanceId)) {
            throw new GameRuleError('확인했던 덱 위 카드가 변경되었습니다.')
          }
          const choice = oneRequired()
          const cards = sourcePlayer.deck.splice(0, revealed.length)
          if (choice === 'keep:reverse') cards.reverse()
          else if (choice.startsWith('discard:')) {
            const discardId = choice.slice('discard:'.length)
            const index = cards.findIndex((card) => card.instanceId === discardId)
            if (index < 0) throw new GameRuleError('묘지로 보낼 카드를 선택해야 합니다.')
            const [discarded] = cards.splice(index, 1)
            sendToDiscard(game, pending.sourcePlayerId, discarded!)
          } else if (choice !== 'keep:normal') {
            throw new GameRuleError('덱 위 카드의 순서를 선택해야 합니다.')
          }
          sourcePlayer.deck.unshift(...cards)
          shift()
          return game
        }

        case 'ICE_MIRROR_FREEZE': {
          const id = oneRequired()
          assertCandidate(id)
          const target = sourceEnemy.field.find((unit) => unit.instanceId === id)
          if (!target || !target.exhausted || unitDefinition(target).cost > 2) {
            throw new GameRuleError('소진된 비용 2 이하인 상대 몬스터를 선택해야 합니다.')
          }
          target.skipNextReady = true
          shift()
          return game
        }

        case 'WAVE_FIN_BOUNCE':
        case 'CRYSTAL_TSUNAMI_BOUNCE': {
          const id = oneOptional()
          if (id) {
            assertCandidate(id)
            const index = sourceEnemy.field.findIndex((unit) => unit.instanceId === id && unit.exhausted)
            if (index < 0) throw new GameRuleError('되돌릴 소진 몬스터를 찾지 못했습니다.')
            moveFieldUnitToHand(game, enemyId, index, pending.sourcePlayerId)
          }
          shift()
          return game
        }

        case 'WAVE_FIN_DRAW': {
          const choice = oneRequired()
          if (!['draw', 'skip'].includes(choice)) throw new GameRuleError('카드를 뽑을지 선택해야 합니다.')
          shift()
          if (choice === 'draw') {
            draw(sourcePlayer, random)
            if (sourcePlayer.hand.length > 0) {
              game.pendingChoices.unshift({
                type: 'SOF_CHOICE', effect: 'WAVE_FIN_BOTTOM',
                playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
                sourceUnitId: pending.sourceUnitId,
                candidateIds: sourcePlayer.hand.map((card) => card.instanceId), minChoices: 1, maxChoices: 1,
              })
            }
          }
          return game
        }

        case 'WAVE_FIN_BOTTOM': {
          const id = oneRequired()
          assertCandidate(id)
          const index = sourcePlayer.hand.findIndex((card) => card.instanceId === id)
          if (index < 0) throw new GameRuleError('덱 아래에 놓을 손 카드를 찾지 못했습니다.')
          const [card] = sourcePlayer.hand.splice(index, 1)
          sourcePlayer.deck.push(resetHandCost(card!))
          shift()
          return game
        }

        case 'TREE_FAIRY_HAND_MANA': {
          const id = oneOptional()
          if (id) {
            assertCandidate(id)
            const index = sourcePlayer.hand.findIndex((card) => card.instanceId === id)
            if (index < 0) throw new GameRuleError('마나에 놓을 손 카드를 찾지 못했습니다.')
            const [card] = sourcePlayer.hand.splice(index, 1)
            placeCardInMana(game, pending.sourcePlayerId, card!, false, random, 'hand')
          }
          shift()
          return game
        }

        case 'MANA_FLIP_RETURN': {
          const id = oneOptional()
          shift()
          if (id) {
            assertCandidate(id)
            const index = sourcePlayer.mana.findIndex((mana) => mana.instanceId === id)
            if (index < 0) throw new GameRuleError('손으로 가져올 마나를 찾지 못했습니다.')
            const [mana] = sourcePlayer.mana.splice(index, 1)
            sourcePlayer.hand.push(resetHandCost(mana!))
            game.pendingChoices.unshift({
              type: 'SOF_CHOICE', effect: 'MANA_FLIP_PLACE',
              playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
              sourceUnitId: pending.sourceUnitId,
              candidateIds: sourcePlayer.hand.map((card) => card.instanceId), minChoices: 1, maxChoices: 1,
            })
          }
          return game
        }

        case 'MANA_FLIP_PLACE': {
          const id = oneRequired()
          assertCandidate(id)
          const index = sourcePlayer.hand.findIndex((card) => card.instanceId === id)
          if (index < 0) throw new GameRuleError('마나에 놓을 손 카드를 찾지 못했습니다.')
          const [card] = sourcePlayer.hand.splice(index, 1)
          placeCardInMana(game, pending.sourcePlayerId, card!, true, random, 'hand')
          shift()
          cleanupDead(game, random)
          return game
        }

        case 'EARTH_GUARDIAN_SUMMON': {
          const max = pending.maxChoices ?? 0
          if (choiceIds.length > max || new Set(choiceIds).size !== choiceIds.length) {
            throw new GameRuleError(`최대 ${max}장까지 소환할 수 있습니다.`)
          }
          const open = new Set(getOpenFieldSlots(game, pending.sourcePlayerId))
          const parsed = choiceIds.map((choice) => {
            const separator = choice.lastIndexOf('@')
            if (separator < 1) throw new GameRuleError('마나 카드와 전장 슬롯을 함께 선택해야 합니다.')
            return { id: choice.slice(0, separator), slot: Number(choice.slice(separator + 1)) }
          })
          if (new Set(parsed.map((item) => item.id)).size !== parsed.length || new Set(parsed.map((item) => item.slot)).size !== parsed.length) {
            throw new GameRuleError('같은 카드나 슬롯을 두 번 선택할 수 없습니다.')
          }
          for (const item of parsed) {
            assertCandidate(item.id)
            if (!open.has(item.slot)) throw new GameRuleError('선택한 전장 슬롯은 사용할 수 없습니다.')
          }
          const summons = parsed.map((item) => {
            const mana = sourcePlayer.mana.find((candidate) => candidate.instanceId === item.id)
            const definition = mana ? CARDS[mana.cardId] : null
            if (
              !mana
              || definition?.type !== 'unit'
              || definition.cost > 2
              || definition.evolutionAttribute
              || !meetsSummonCondition(game, pending.sourcePlayerId, mana)
            ) {
              throw new GameRuleError('현재 소환 조건을 만족하는 비용 2 이하 비진화 몬스터만 소환할 수 있습니다.')
            }
            return { ...item, mana }
          })
          for (const item of summons) {
            const index = sourcePlayer.mana.findIndex((mana) => mana.instanceId === item.id)
            if (index < 0) throw new GameRuleError('소환할 마나 카드를 찾지 못했습니다.')
            sourcePlayer.mana.splice(index, 1)
            summonCard(game, pending.sourcePlayerId, item.mana, true, item.slot, true)
          }
          shift()
          cleanupDead(game, random)
          return game
        }

        case 'GRAVE_MERCHANT_RETURN':
        case 'BLACKWING_RETURN': {
          const id = pending.effect === 'GRAVE_MERCHANT_RETURN' ? oneRequired() : oneOptional()
          if (id) {
            assertCandidate(id)
            const index = sourcePlayer.discard.findIndex((card) => card.instanceId === id)
            if (index < 0) throw new GameRuleError('묘지에서 선택한 카드를 찾지 못했습니다.')
            const [card] = sourcePlayer.discard.splice(index, 1)
            sourcePlayer.hand.push(resetHandCost(card!))
          }
          shift()
          return game
        }

        case 'MASS_BURIAL_ENEMY_FIRST': {
          const id = oneRequired()
          assertCandidate(id)
          const index = sourceEnemy.field.findIndex((unit) => unit.instanceId === id)
          if (index < 0) throw new GameRuleError('묘지로 보낼 자신의 몬스터를 찾지 못했습니다.')
          moveFieldToDiscard(game, enemyId, index, random)
          shift()
          if (sourcePlayer.field.length > 0) {
            game.pendingChoices.unshift({
              type: 'SOF_CHOICE', effect: 'MASS_BURIAL_SELF',
              playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
              sourceCard: pending.sourceCard,
              candidateIds: sourcePlayer.field.map((unit) => unit.instanceId), minChoices: 0, maxChoices: 1,
            })
          } else if (pending.sourceCard) {
            sendToDiscard(game, pending.sourcePlayerId, pending.sourceCard)
          }
          return game
        }

        case 'MASS_BURIAL_SELF': {
          const id = oneOptional()
          shift()
          if (id) {
            assertCandidate(id)
            const index = sourcePlayer.field.findIndex((unit) => unit.instanceId === id)
            if (index < 0) throw new GameRuleError('묘지로 보낼 자신의 몬스터를 찾지 못했습니다.')
            moveFieldToDiscard(game, pending.sourcePlayerId, index, random)
            if (sourceEnemy.field.length > 0) {
              game.pendingChoices.unshift({
                type: 'SOF_CHOICE', effect: 'MASS_BURIAL_ENEMY_SECOND',
                playerId: enemyId, sourcePlayerId: pending.sourcePlayerId,
                sourceCard: pending.sourceCard,
                candidateIds: sourceEnemy.field.map((unit) => unit.instanceId), minChoices: 1, maxChoices: 1,
              })
              return game
            }
          }
          if (pending.sourceCard) sendToDiscard(game, pending.sourcePlayerId, pending.sourceCard)
          return game
        }

        case 'MASS_BURIAL_ENEMY_SECOND': {
          const id = oneRequired()
          assertCandidate(id)
          const index = sourceEnemy.field.findIndex((unit) => unit.instanceId === id)
          if (index < 0) throw new GameRuleError('추가로 묘지로 보낼 몬스터를 찾지 못했습니다.')
          moveFieldToDiscard(game, enemyId, index, random)
          if (pending.sourceCard) sendToDiscard(game, pending.sourcePlayerId, pending.sourceCard)
          shift()
          return game
        }

        case 'MOURNER_SACRIFICE': {
          const id = oneOptional()
          shift()
          if (id) {
            assertCandidate(id)
            const index = sourcePlayer.field.findIndex((unit) => unit.instanceId === id)
            if (index < 0) throw new GameRuleError('묘지로 보낼 다른 몬스터를 찾지 못했습니다.')
            moveFieldToDiscard(game, pending.sourcePlayerId, index, random)
            if (sourceEnemy.field.length > 0) {
              game.pendingChoices.unshift({
                type: 'SOF_CHOICE', effect: 'MOURNER_DESTROY',
                playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
                sourceUnitId: pending.sourceUnitId,
                candidateIds: sourceEnemy.field.map((unit) => unit.instanceId), minChoices: 1, maxChoices: 1,
              })
            }
          }
          return game
        }

        case 'MOURNER_DESTROY': {
          const id = oneRequired()
          assertCandidate(id)
          const index = sourceEnemy.field.findIndex((unit) => unit.instanceId === id)
          if (index < 0) throw new GameRuleError('묘지로 보낼 상대 몬스터를 찾지 못했습니다.')
          moveFieldToDiscard(game, enemyId, index, random)
          shift()
          return game
        }

        case 'MOURNER_LAST_WORDS': {
          if (choiceIds.length > 1) throw new GameRuleError('소환할 몬스터는 한 장만 선택할 수 있습니다.')
          const choice = choiceIds[0]
          if (choice) {
            const separator = choice.lastIndexOf('@')
            if (separator < 1) throw new GameRuleError('묘지 카드와 전장 슬롯을 함께 선택해야 합니다.')
            const id = choice.slice(0, separator)
            const slot = requireOpenFieldSlot(game, pending.sourcePlayerId, Number(choice.slice(separator + 1)))
            assertCandidate(id)
            const index = sourcePlayer.discard.findIndex((card) => card.instanceId === id)
            const card = sourcePlayer.discard[index]
            const definition = card ? CARDS[card.cardId] : null
            if (!card || definition?.type !== 'unit' || definition.cost > 2 || !definition.attributes.includes('dark')) {
              throw new GameRuleError('비용 2 이하인 어둠 몬스터를 선택해야 합니다.')
            }
            sourcePlayer.discard.splice(index, 1)
            summonCard(game, pending.sourcePlayerId, card, true, slot)
          }
          shift()
          return game
        }

        case 'SKY_KNIGHT_READY': {
          const id = oneOptional()
          if (id) {
            assertCandidate(id)
            const unit = sourcePlayer.field.find((ally) => ally.instanceId === id && ally.exhausted)
            if (!unit) throw new GameRuleError('준비할 소진 몬스터를 찾지 못했습니다.')
            unit.exhausted = false
            unit.attacksThisTurn = 0
          }
          shift()
          return game
        }

        case 'STONE_PRIEST_HAND_MANA': {
          const id = oneOptional()
          if (id) {
            assertCandidate(id)
            const index = sourcePlayer.hand.findIndex((card) => card.instanceId === id)
            if (index < 0) throw new GameRuleError('마나에 놓을 손 카드를 찾지 못했습니다.')
            const [card] = sourcePlayer.hand.splice(index, 1)
            placeCardInMana(game, pending.sourcePlayerId, card!, true, random, 'hand')
          }
          const hasLight = Boolean(pending.data?.hasLight)
          shift()
          if (hasLight && sourcePlayer.life.length > 0) {
            game.pendingChoices.unshift({
              type: 'SOF_CHOICE', effect: 'STONE_PRIEST_LIFE',
              playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
              sourceUnitId: pending.sourceUnitId,
              candidateIds: sourcePlayer.life.map((card) => card.instanceId), minChoices: 0, maxChoices: 1,
              data: { stage: 'choose' },
            })
          }
          return game
        }

        case 'STONE_PRIEST_LIFE': {
          const stage = String(pending.data?.stage ?? 'choose')
          if (stage === 'revealed') {
            const choice = oneRequired()
            if (!['keep', 'take'].includes(choice)) throw new GameRuleError('라이프 카드를 그대로 둘지 손으로 가져올지 선택해야 합니다.')
            if (choice === 'take') {
              if (!pending.data?.canAwaken) {
                throw new GameRuleError('각성 카드만 손으로 가져와 각성을 발동할 수 있습니다.')
              }
              const lifeId = String(pending.data?.lifeId ?? '')
              const index = sourcePlayer.life.findIndex((card) => card.instanceId === lifeId)
              if (index < 0) throw new GameRuleError('확인했던 라이프 카드가 변경되었습니다.')
              const [lifeCard] = sourcePlayer.life.splice(index, 1)
              const handCard = resetHandCost(lifeCard!, true)
              sourcePlayer.hand.push(handCard)
              awaken(game, pending.sourcePlayerId, handCard, random)
            }
            shift()
            return game
          }

          const id = oneOptional()
          shift()
          if (id) {
            assertCandidate(id)
            const lifeCard = sourcePlayer.life.find((card) => card.instanceId === id)
            if (!lifeCard) throw new GameRuleError('확인할 라이프 카드를 찾지 못했습니다.')
            const canAwaken = cardHasAwakening(lifeCard.cardId)
            game.pendingChoices.unshift({
              type: 'SOF_CHOICE', effect: 'STONE_PRIEST_LIFE',
              playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
              sourceUnitId: pending.sourceUnitId,
              revealedCards: [{ ...lifeCard }], minChoices: 1, maxChoices: 1,
              data: { stage: 'revealed', lifeId: lifeCard.instanceId, canAwaken },
            })
          }
          return game
        }

        case 'MIRROR_LAKE_RESOLVE': {
          const stage = String(pending.data?.stage ?? '')
          if (stage === 'choose-life') {
            const lifeId = oneRequired()
            assertCandidate(lifeId)
            const lifeCard = sourcePlayer.life.find((card) => card.instanceId === lifeId)
            if (!lifeCard) throw new GameRuleError('확인할 라이프 카드를 찾지 못했습니다.')
            const top = Boolean(pending.data?.hasWater) ? sourcePlayer.deck[0] : undefined
            shift()
            game.pendingChoices.unshift({
              type: 'SOF_CHOICE', effect: 'MIRROR_LAKE_RESOLVE',
              playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
              sourceUnitId: pending.sourceUnitId,
              revealedCards: [{ ...lifeCard }, ...(top ? [{ ...top }] : [])],
              minChoices: 1, maxChoices: 1,
              data: { stage: top ? 'both' : 'light-only', lifeId, topId: top?.instanceId ?? null },
            })
            return game
          }

          const choice = oneRequired()
          const top = sourcePlayer.deck[0]
          if (stage === 'water-only') {
            if (!top || top.instanceId !== pending.revealedCards?.[0]?.instanceId) {
              throw new GameRuleError('확인했던 덱 위 카드가 변경되었습니다.')
            }
            if (choice === 'discard') sendToDiscard(game, pending.sourcePlayerId, sourcePlayer.deck.shift()!)
            else if (choice !== 'keep') throw new GameRuleError('덱 위 카드를 처리할 방법을 선택해야 합니다.')
          } else if (stage === 'both') {
            const lifeId = String(pending.data?.lifeId ?? '')
            const topId = String(pending.data?.topId ?? '')
            const lifeIndex = sourcePlayer.life.findIndex((card) => card.instanceId === lifeId)
            if (lifeIndex < 0 || !top || top.instanceId !== topId) {
              throw new GameRuleError('확인했던 카드가 변경되었습니다.')
            }
            if (choice === 'discard') {
              sendToDiscard(game, pending.sourcePlayerId, sourcePlayer.deck.shift()!)
            } else if (choice === 'swap') {
              const [lifeCard] = sourcePlayer.life.splice(lifeIndex, 1, {
                ...resetHandCost(top, true),
                lifeSlotIndex: sourcePlayer.life[lifeIndex]!.lifeSlotIndex,
              })
              sourcePlayer.deck[0] = resetHandCost(lifeCard!)
            } else if (choice !== 'keep') {
              throw new GameRuleError('확인한 카드를 처리할 방법을 선택해야 합니다.')
            }
          } else if (stage !== 'light-only' || choice !== 'close') {
            throw new GameRuleError('확인한 카드 처리를 완료해야 합니다.')
          }
          shift()
          return game
        }

        case 'COFFIN_KEEPER_BOTTOM': {
          const id = oneOptional()
          if (id) {
            assertCandidate(id)
            const index = sourcePlayer.discard.findIndex((card) => card.instanceId === id)
            if (index < 0) throw new GameRuleError('덱 아래에 놓을 묘지 카드를 찾지 못했습니다.')
            const [card] = sourcePlayer.discard.splice(index, 1)
            sourcePlayer.deck.push(resetHandCost(card!))
          }
          const hasDark = Boolean(pending.data?.hasDark)
          const drawAfter = Boolean(pending.data?.drawAfter)
          shift()
          if (hasDark && sourcePlayer.deck[0]) {
            game.pendingChoices.unshift({
              type: 'SOF_CHOICE', effect: 'COFFIN_KEEPER_TOP',
              playerId: pending.sourcePlayerId, sourcePlayerId: pending.sourcePlayerId,
              sourceUnitId: pending.sourceUnitId,
              revealedCards: [{ ...sourcePlayer.deck[0] }], minChoices: 1, maxChoices: 1,
              data: { drawAfter },
            })
          } else if (drawAfter) {
            draw(sourcePlayer, random)
          }
          return game
        }

        case 'COFFIN_KEEPER_TOP': {
          const choice = oneRequired()
          if (!['discard', 'keep'].includes(choice)) throw new GameRuleError('덱 위 카드를 묘지로 보낼지 선택해야 합니다.')
          const top = sourcePlayer.deck[0]
          if (!top || top.instanceId !== pending.revealedCards?.[0]?.instanceId) {
            throw new GameRuleError('확인했던 덱 위 카드가 변경되었습니다.')
          }
          if (choice === 'discard') sendToDiscard(game, pending.sourcePlayerId, sourcePlayer.deck.shift()!)
          shift()
          if (pending.data?.drawAfter) draw(sourcePlayer, random)
          return game
        }
      }
    }

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
          && meetsSummonCondition(game, actor, card)
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
      if (player.hand.length === 0) {
        if (choiceIds.length > 0) throw new GameRuleError('묘지로 보낼 손 카드가 없습니다.')
        game.pendingChoices.shift()
        return game
      }
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
      unit.temporaryCharge = false
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

  const endingPlayer = game.players[actor]
  const hasDarkCardInDiscard = endingPlayer.discard
    .some((card) => CARDS[card.cardId].attributes.includes('dark'))
  if (!hasDarkCardInDiscard) {
    const weakenedGiantIds = endingPlayer.field
      .filter((unit) => unit.cardId === 'weakened_giant')
      .map((unit) => unit.instanceId)
    for (const instanceId of weakenedGiantIds) {
      const index = endingPlayer.field.findIndex((unit) => unit.instanceId === instanceId)
      if (index >= 0) moveFieldToDiscard(game, actor, index, random)
    }
  }

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
    if (unit.skipNextReady) {
      unit.skipNextReady = false
    } else {
      unit.exhausted = false
    }
    unit.summonedThisTurn = false
    unit.evolvedThisTurn = false
    unit.attacksThisTurn = 0
  }
  nextPlayer.manaPlacedThisTurn = false
  nextPlayer.attacksThisTurn = 0
  const turnDrawCount = getFormat(game.matchConfig.formatId).turnDrawCount
  for (let drawIndex = 0; drawIndex < turnDrawCount; drawIndex += 1) {
    draw(nextPlayer, random)
  }
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
      result = summonFromMana(game, actor, action.cardInstanceId, action.fieldSlot, random)
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
