import type { CardId } from '../shared/cards'
import type { GameAction } from '../shared/actions'
import type { GameState, PlayerId } from '../shared/types'

export type ScenarioId = string

export interface ScenarioRule {
  id: string
  parameters: Record<string, string | number | boolean>
}

export type CampaignReward =
  | { type: 'unlock-card'; cardId: CardId }
  | { type: 'unlock-set'; setId: string }
  | { type: 'campaign-flag'; flag: string }

export interface CampaignScenario {
  id: ScenarioId
  name: string
  description: string
  formatId: 'campaign-prologue-v1'
  opponentDeckId: string
  aiProfileId: string
  specialRules: ScenarioRule[]
  rewards: CampaignReward[]
}

export interface ActionContext {
  game: GameState
  playerId: PlayerId
}

export interface PlayerController {
  readonly type: 'human' | 'ai'
  getNextAction(context: ActionContext): Promise<GameAction>
}

export interface AiProfile {
  id: string
  name: string
  chooseAction(context: ActionContext): GameAction
}
