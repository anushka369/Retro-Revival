import { Cell, GameBoard, GameState, Move, DifficultySettings } from '@/types';

export interface IGameBoard {
  getCell(x: number, y: number): Cell | null;
  getCells(): Cell[][];
  getWidth(): number;
  getHeight(): number;
  getMineCount(): number;
  getGameState(): GameState;
  revealCell(x: number, y: number): boolean;
  flagCell(x: number, y: number): boolean;
  isValidPosition(x: number, y: number): boolean;
  getAdjacentCells(x: number, y: number): Cell[];
  getRemainingMines(): number;
  serialize(): string;
}

export interface IGameLogic {
  createBoard(settings: DifficultySettings): IGameBoard;
  makeMove(board: IGameBoard, x: number, y: number, action: 'reveal' | 'flag'): boolean;
  checkWinCondition(board: IGameBoard): boolean;
  checkLossCondition(board: IGameBoard): boolean;
  calculateAdjacentMines(board: IGameBoard, x: number, y: number): number;
  revealAdjacentCells(board: IGameBoard, x: number, y: number): void;
  validateMove(board: IGameBoard, x: number, y: number, action: 'reveal' | 'flag'): boolean;
}

export interface IStateManager {
  getCurrentBoard(): IGameBoard | null;
  saveState(board: IGameBoard): void;
  loadState(): IGameBoard | null;
  getGameHistory(): Move[];
  addMove(move: Move): void;
  canUndo(): boolean;
  undo(): IGameBoard | null;
  reset(): void;
}