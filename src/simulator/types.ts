import type { GameAction } from '../shared/actions'
import type { CardId } from '../shared/cards'
import type { DeckFormatSelection, GameFormatId, SetId } from '../content/schema'
import type { GameState, PlayerId } from '../shared/types'
import type { GameView } from '../shared/views'

export type BotProfileId = 'random' | 'aggressive' | 'value' | 'control'
export type HeuristicBotProfileId = Exclude<BotProfileId, 'random'>

export interface HeuristicWeights {
  directAttack: number
  unitAttack: number
  playUnit: number
  playSpell: number
  placeMana: number
  endTurn: number
  attackStat: number
  healthStat: number
  handValue: number
  highCostBias: number
  favorableTrade: number
  lifeValue: number
  manaValue: number
  readyManaValue: number
  readyUnitValue: number
  stateDelta: number
}

export type HeuristicWeightKey = keyof HeuristicWeights

export interface LegalActionLimits {
  maxPaymentVariantsPerCard: number
  maxGeneratedActions: number
  maxChoiceCombinations: number
}

export interface LegalActionOption {
  action: GameAction
  nextState: GameState
}

export interface BotDecisionOption {
  action: GameAction
  /** 행동 뒤 상태에서 현재 플레이어에게 공개되는 정보만 담습니다. */
  nextView: GameView
}

export interface BotDecisionContext {
  actor: PlayerId
  view: GameView
  legalActions: readonly GameAction[]
  legalOptions: readonly BotDecisionOption[]
  deckCardIds: readonly CardId[]
  random: () => number
}

export interface BotPolicy {
  id: string
  name: string
  chooseAction(context: BotDecisionContext): GameAction
}

export interface BehaviorCandidate {
  id: string
  name: string
  weights: HeuristicWeights
  generation: number
  parentIds: string[]
  tags: string[]
}

export interface BehaviorEvolutionConfig {
  enabled: boolean
  populationSize: number
  generations: number
  eliteCount: number
  mutationsPerChild: number
  mutationScale: number
  trainingDeckCount: number
  gamesPerPairPerDeck: number
  hallOfFameCount: number
  finalBotCount: number
  drawScore: number
  seedProfiles: HeuristicBotProfileId[]
}

export interface BehaviorStanding {
  botId: string
  botName: string
  generation: number
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  fitness: number
  normalFinishes: number
  normalFinishRate: number
  averageTurns: number
  confidenceLow: number
  confidenceHigh: number
}

export interface BehaviorGenerationReport {
  generation: number
  behaviors: BehaviorCandidate[]
  hallOfFame: BehaviorCandidate[]
  trainingDecks: DeckCandidate[]
  standings: BehaviorStanding[]
  matches: SimulatedMatchResult[]
}

export interface DeckCandidate {
  id: string
  name: string
  cardIds: CardId[]
  generation: number
  parentId: string | null
  tags: string[]
}

export interface DeckGenerationConfig {
  populationSize: number
  generations: number
  eliteCount: number
  mutationsPerChild: number
  minUnits: number
  maxUnits: number
  maxAttemptsPerDeck: number
}

export interface MatchSimulationConfig {
  gamesPerPair: number
  botProfiles: BotProfileId[]
  maxTurns: number
  maxActions: number
  legalActionLimits: LegalActionLimits
}

export interface CardPoolConfig {
  /** 생략하면 포맷이 허용하는 전체 카드 풀을 사용합니다. */
  cardIds?: CardId[]
  includeSetIds?: SetId[]
  excludeCardIds?: CardId[]
}

export interface MetaSimulationConfig {
  seed: string
  formatId: GameFormatId
  selectedSetIds: SetId[]
  cardPool: CardPoolConfig
  deckGeneration: DeckGenerationConfig
  behaviorEvolution: BehaviorEvolutionConfig
  matches: MatchSimulationConfig
  outputDirectory: string
  seedDecks: Array<{
    id?: string
    name: string
    cardIds: CardId[]
  }>
}

export interface MatchParticipant {
  deckId: string
  deckName: string
  cardIds: CardId[]
  botId: string
  botName: string
  botProfile: BotProfileId | 'evolved'
}

export interface PlayerMatchTelemetry {
  seenCardIds: CardId[]
  playedCardIds: CardId[]
  summonedCardIds: CardId[]
  manaCardIds: CardId[]
  attackedWithCardIds: CardId[]
}

export type MatchTermination = 'win' | 'turn-limit' | 'action-limit' | 'no-legal-actions'

export interface MatchFailureDiagnostic {
  actor: PlayerId
  currentPlayer: PlayerId
  turnNumber: number
  pendingChoiceType: string | null
  pendingChoiceEffect: string | null
}

export interface SimulatedMatchResult {
  seed: string
  startingPlayer: PlayerId
  winner: PlayerId | null
  termination: MatchTermination
  turns: number
  actions: number
  participants: Record<PlayerId, MatchParticipant>
  telemetry: Record<PlayerId, PlayerMatchTelemetry>
  /** 새 선택 유형을 시뮬레이터가 아직 모를 때 재현할 수 있는 최소 정보입니다. */
  failureDiagnostic?: MatchFailureDiagnostic
}

export interface DeckStanding {
  deckId: string
  deckName: string
  generation: number
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  firstGames: number
  firstWins: number
  secondGames: number
  secondWins: number
  averageTurns: number
  confidenceLow: number
  confidenceHigh: number
}

export interface MatchupStanding {
  deckAId: string
  deckBId: string
  games: number
  deckAWins: number
  deckBWins: number
  draws: number
  deckAWinRate: number
}

export interface CardStanding {
  cardId: CardId
  cardName: string
  deckCount: number
  topDeckCount: number
  totalCopies: number
  averageCopiesWhenIncluded: number
  games: number
  wins: number
  inclusionWinRate: number
  seenGames: number
  seenWins: number
  seenWinRate: number
  playedGames: number
  playedWins: number
  playedWinRate: number
  topDeckRate: number
  suspicionScore: number
}

export interface GenerationReport {
  generation: number
  decks: DeckCandidate[]
  standings: DeckStanding[]
  matchups: MatchupStanding[]
  matches: SimulatedMatchResult[]
}

export interface MetaSimulationReport {
  createdAt: string
  seed: string
  selection: DeckFormatSelection<CardId>
  cardPool: CardId[]
  config: MetaSimulationConfig
  behaviorGenerations: BehaviorGenerationReport[]
  finalBehaviors: BehaviorCandidate[]
  finalBehaviorStandings: BehaviorStanding[]
  generations: GenerationReport[]
  finalDecks: DeckCandidate[]
  finalStandings: DeckStanding[]
  finalMatchups: MatchupStanding[]
  cardStandings: CardStanding[]
}
