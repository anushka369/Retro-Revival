import { GameBoard, HintSuggestion, GameAnalysis, GameConfig, ProbabilityMap } from '@/types';
import { IGameBoard } from './GameEngine';

export interface IGameRenderer {
  render(board: IGameBoard, probabilities?: ProbabilityMap): void;
  renderCell(x: number, y: number, cell: any): void;
  renderProbabilities(probabilities: ProbabilityMap): void;
  renderHint(hint: HintSuggestion): void;
  clearCanvas(): void;
  resize(width: number, height: number): void;
  setAnimationEnabled(enabled: boolean): void;
  animateCellReveal(x: number, y: number): Promise<void>;
}

export interface IControlPanel {
  initialize(config: GameConfig): void;
  onNewGame(callback: () => void): void;
  onHintRequest(callback: () => void): void;
  onDifficultyChange(callback: (difficulty: string) => void): void;
  onSettingsChange(callback: (settings: Partial<GameConfig>) => void): void;
  updateGameStats(stats: GameStats): void;
  showNotification(message: string, type: 'info' | 'warning' | 'success' | 'error'): void;
}

export interface IAnalysisViewer {
  displayAnalysis(analysis: GameAnalysis): void;
  showReplay(moves: any[]): void;
  renderProbabilityVisualization(probabilities: ProbabilityMap): void;
  showMoveAlternatives(move: any, alternatives: HintSuggestion[]): void;
  toggleAnalysisSection(section: string): void;
}

export interface IEventHandler {
  handleCellClick(x: number, y: number): void;
  handleCellRightClick(x: number, y: number): void;
  handleKeyPress(key: string): void;
  handleResize(): void;
  handleTouchStart(x: number, y: number): void;
  handleTouchEnd(x: number, y: number): void;
}

export interface GameStats {
  minesRemaining: number;
  timeElapsed: number;
  hintsUsed: number;
  gameState: string;
  winRate?: number;
  averageTime?: number;
}