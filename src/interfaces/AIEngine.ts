import { 
  Cell, 
  GameBoard, 
  ProbabilityMap, 
  HintSuggestion, 
  PlayerProfile, 
  GameAnalysis, 
  Move,
  DifficultyLevel 
} from '@/types';
import { IGameBoard } from './GameEngine';

export interface IProbabilityCalculator {
  calculateProbabilities(board: IGameBoard): ProbabilityMap;
  getCellProbability(board: IGameBoard, x: number, y: number): number;
  updateProbabilities(board: IGameBoard): void;
  getCalculationMethod(): 'exact' | 'monte_carlo';
  setCalculationTimeout(ms: number): void;
}

export interface IHintEngine {
  generateHint(board: IGameBoard, probabilities: ProbabilityMap): HintSuggestion | null;
  findSafeMoves(board: IGameBoard, probabilities: ProbabilityMap): HintSuggestion[];
  findBestProbabilisticMove(board: IGameBoard, probabilities: ProbabilityMap): HintSuggestion | null;
  calculateInformationGain(board: IGameBoard, x: number, y: number): number;
  rankMoves(moves: HintSuggestion[]): HintSuggestion[];
}

export interface IAdaptiveDifficultyManager {
  adjustDifficulty(profile: PlayerProfile): DifficultyLevel;
  updateProfile(profile: PlayerProfile, gameResult: 'win' | 'loss', gameTime: number, hintsUsed: number): PlayerProfile;
  shouldIncreaseDifficulty(profile: PlayerProfile): boolean;
  shouldDecreaseDifficulty(profile: PlayerProfile): boolean;
  getRecommendedDifficulty(profile: PlayerProfile): DifficultyLevel;
  notifyDifficultyChange(oldLevel: DifficultyLevel, newLevel: DifficultyLevel): void;
}

export interface IGameAnalyzer {
  analyzeGame(moves: Move[], finalBoard: IGameBoard): GameAnalysis;
  identifySuboptimalMoves(moves: Move[]): Move[];
  generateImprovementSuggestions(analysis: GameAnalysis): string[];
  trackPerformanceTrends(analyses: GameAnalysis[]): string[];
  generateGameReplay(moves: Move[]): string[];
}