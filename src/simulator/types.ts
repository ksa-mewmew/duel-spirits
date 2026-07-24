import type { GameAction } from '../shared/actions'
import type { CardId } from '../shared/cards'
import type { DeckFormatSelection, GameFormatId, SetId } from '../content/schema'
import type { GameState, PlayerId } from '../shared/types'
import type { GameView } from '../shared/views'

export type BotProfileId = 'random' | 'aggressive' | 'value' | 'control'
export type HeuristicBotProfileId = Exclude<BotProfileId, 'random'>

export type DeckStrategy = 'aggro' | 'value' | 'control' | 'ramp' | 'graveyard' | 'life' | 'evolution' | 'midrange'

export type DeckRole =
  | 'early_unit'
  | 'pressure'
  | 'defender'
  | 'tempo'
  | 'removal'
  | 'board_clear'
  | 'draw'
  | 'ramp'
  | 'mana_payoff'
  | 'graveyard_enabler'
  | 'graveyard_payoff'
  | 'recursion'
  | 'life_control'
  | 'awakening'
  | 'evolution'
  | 'resonance'
  | 'finisher'
  | 'utility'

export interface DeckProfileSummary {
  distinctCards: number
  singletonCount: number
  doubletonCount: number
  tripletonCount: number
  unitCount: number
  spellCount: number
  averageCost: number
  strategy: DeckStrategy
  attributes: import('../shared/cards').CardAttributeId[]
  roleCounts: Partial<Record<DeckRole, number>>
  topPackages: string[]
}

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
  parentIds?: string[]
  tags: string[]
  archetypeId?: string
  archetypeName?: string
  strategy?: DeckStrategy
  source?: 'seed' | 'archetype' | 'exploratory' | 'elite' | 'mutation' | 'crossover'
}

export interface DeckGenerationConfig {
  populationSize: number
  generations: number
  eliteCount: number
  mutationsPerChild: number
  minUnits: number
  maxUnits: number
  maxAttemptsPerDeck: number
  /** 초기 집단 중 아키타입·역할·매수 골격을 따르는 비율입니다. */
  humanDeckRatio: number
  /** 20장 덱에서 보통 8~11종처럼 일관성 있는 카드 종류 수를 유도합니다. */
  minDistinctCards: number
  maxDistinctCards: number
  /** 인간형 원형에서 상황 대응용 1장 카드의 최대 종류 수입니다. */
  maxSingletonCards: number
  /** 엘리트 둘의 카드 선호를 섞어 새 덱을 만드는 확률입니다. */
  crossoverChance: number
  /** 싱글톤을 줄이고 핵심 카드 매수를 늘리는 변이 확률입니다. */
  compressionChance: number
  /** 같은 역할·시너지 패키지를 묶어 교체하는 변이 확률입니다. */
  packageMutationChance: number
  /** 각 세대에 새 아키타입 원형을 다시 투입해 조기 수렴을 막는 수입니다. */
  immigrantCount: number
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
