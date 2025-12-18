// Core game types and interfaces

export enum GameState {
  READY = 'ready',
  PLAYING = 'playing',
  WON = 'won',
  LOST = 'lost'
}

export enum CellState {
  HIDDEN = 'hidden',
  REVEALED = 'revealed',
  FLAGGED = 'flagged'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  EXPERT = 'expert',
  CUSTOM = 'custom'
}

export enum SkillArea {
  PATTERN_RECOGNITION = 'pattern_recognition',
  PROBABILITY_ANALYSIS = 'probability_analysis',
  STRATEGIC_PLANNING = 'strategic_planning',
  RISK_ASSESSMENT = 'risk_assessment'
}

export interface Cell {
  x: number;
  y: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
  probability?: number;
}

export interface GameBoard {
  width: number;
  height: number;
  mineCount: number;
  cells: Cell[][];
  gameState: GameState;
  startTime: Date;
  endTime?: Date;
}

export interface ProbabilityMap {
  cellProbabilities: Map<string, number>;
  lastUpdated: Date;
  calculationMethod: 'exact' | 'monte_carlo';
}

export interface HintSuggestion {
  cell: { x: number; y: number };
  action: 'reveal' | 'flag';
  confidence: number;
  reasoning: string;
  expectedInformation: number;
}

export interface PlayerProfile {
  skillRating: number;
  gamesPlayed: number;
  winRate: number;
  averageTime: number;
  preferredDifficulty: DifficultyLevel;
  improvementAreas: string[];
}

export interface GameAnalysis {
  gameId: string;
  totalMoves: number;
  optimalMoves: number;
  hintsUsed: number;
  criticalMistakes: Move[];
  missedOpportunities: Move[];
  strategicInsights: string[];
  skillDemonstrated: SkillArea[];
}

export interface Move {
  cell: { x: number; y: number };
  action: 'reveal' | 'flag';
  timestamp: Date;
  boardState: string; // Serialized board state
  wasOptimal: boolean;
  alternativeOptions: HintSuggestion[];
}

export interface DifficultySettings {
  width: number;
  height: number;
  mineCount: number;
  level: DifficultyLevel;
}

export interface GameConfig {
  difficulty: DifficultySettings;
  enableHints: boolean;
  showProbabilities: boolean;
  enableAdaptiveDifficulty: boolean;
}