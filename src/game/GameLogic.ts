import { IGameLogic, IGameBoard } from '@/interfaces/GameEngine';
import { GameBoard } from './GameBoard';
import { DifficultySettings, GameState, Move, HintSuggestion } from '@/types';

export class GameLogic implements IGameLogic {
  private moveHistory: Move[] = [];
  private hintHistory: Array<{hint: HintSuggestion, timestamp: Date, gameState: number}> = [];
  private gameStartTime?: Date;
  private gameEndTime?: Date;
  private score: number = 0;

  createBoard(settings: DifficultySettings): IGameBoard {
    const board = new GameBoard(settings);
    this.resetGame();
    return board;
  }

  makeMove(board: IGameBoard, x: number, y: number, action: 'reveal' | 'flag'): boolean {
    // Validate the move first
    if (!this.validateMove(board, x, y, action)) {
      return false;
    }

    // Record game start time on first move
    if (board.getGameState() === GameState.READY && !this.gameStartTime) {
      this.gameStartTime = new Date();
    }

    // Create move record before executing
    const moveRecord: Move = {
      cell: { x, y },
      action,
      timestamp: new Date(),
      boardState: board.serialize(),
      wasOptimal: false, // Will be determined by AI analysis later
      alternativeOptions: [] // Will be populated by AI analysis later
    };

    let moveSuccessful = false;

    // Execute the move
    if (action === 'reveal') {
      moveSuccessful = board.revealCell(x, y);
    } else if (action === 'flag') {
      moveSuccessful = board.flagCell(x, y);
    }

    // Only record successful moves that are direct user actions
    // (not auto-revealed cells from the GameBoard's internal logic)
    if (moveSuccessful) {
      this.addMove(moveRecord);
      
      // Update score and timing based on game state
      this.updateGameMetrics(board);
    }

    return moveSuccessful;
  }

  validateMove(board: IGameBoard, x: number, y: number, action: 'reveal' | 'flag'): boolean {
    // Check if position is valid
    if (!board.isValidPosition(x, y)) {
      return false;
    }

    // Game must not be finished
    const gameState = board.getGameState();
    if (gameState === GameState.WON || gameState === GameState.LOST) {
      return false;
    }

    const cell = board.getCell(x, y);
    if (!cell) {
      return false;
    }

    // Validate reveal action
    if (action === 'reveal') {
      // Cannot reveal already revealed or flagged cells
      return !cell.isRevealed && !cell.isFlagged;
    }

    // Validate flag action
    if (action === 'flag') {
      // Cannot flag already revealed cells
      return !cell.isRevealed;
    }

    return false;
  }

  checkWinCondition(board: IGameBoard): boolean {
    const cells = board.getCells();
    const width = board.getWidth();
    const height = board.getHeight();

    // Win condition: all non-mine cells are revealed
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        if (!cell.isMine && !cell.isRevealed) {
          return false;
        }
      }
    }
    return true;
  }

  checkLossCondition(board: IGameBoard): boolean {
    const cells = board.getCells();
    const width = board.getWidth();
    const height = board.getHeight();

    // Loss condition: any mine is revealed
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        if (cell.isMine && cell.isRevealed) {
          return true;
        }
      }
    }
    return false;
  }

  calculateAdjacentMines(board: IGameBoard, x: number, y: number): number {
    const adjacentCells = board.getAdjacentCells(x, y);
    return adjacentCells.filter(cell => cell.isMine).length;
  }

  revealAdjacentCells(board: IGameBoard, x: number, y: number): void {
    const adjacentCells = board.getAdjacentCells(x, y);
    
    for (const cell of adjacentCells) {
      if (!cell.isRevealed && !cell.isFlagged && !cell.isMine) {
        this.makeMove(board, cell.x, cell.y, 'reveal');
      }
    }
  }

  // Game timing and scoring methods
  getGameDuration(): number {
    if (!this.gameStartTime) {
      return 0;
    }
    
    const endTime = this.gameEndTime || new Date();
    return Math.floor((endTime.getTime() - this.gameStartTime.getTime()) / 1000);
  }

  getScore(): number {
    return this.score;
  }

  getMoveCount(): number {
    return this.moveHistory.length;
  }

  getGameHistory(): Move[] {
    return [...this.moveHistory];
  }

  private addMove(move: Move): void {
    this.moveHistory.push(move);
  }

  private updateGameMetrics(board: IGameBoard): void {
    const gameState = board.getGameState();
    
    // Record end time when game finishes
    if ((gameState === GameState.WON || gameState === GameState.LOST) && !this.gameEndTime) {
      this.gameEndTime = new Date();
    }

    // Calculate score based on game completion and efficiency
    if (gameState === GameState.WON) {
      const duration = this.getGameDuration();
      const moveCount = this.getMoveCount();
      const boardSize = board.getWidth() * board.getHeight();
      const mineCount = board.getMineCount();
      
      // Base score calculation: higher score for faster completion with fewer moves
      // Formula: (boardSize * mineCount * 1000) / (duration * moveCount)
      this.score = Math.floor((boardSize * mineCount * 1000) / Math.max(duration * moveCount, 1));
    } else if (gameState === GameState.LOST) {
      // Penalty for losing
      this.score = Math.max(0, this.score - 100);
    }
  }

  private resetGame(): void {
    this.moveHistory = [];
    this.hintHistory = [];
    this.gameStartTime = undefined;
    this.gameEndTime = undefined;
    this.score = 0;
  }

  // Hint tracking methods
  recordHintUsage(hint: HintSuggestion): void {
    const hintRecord = {
      hint,
      timestamp: new Date(),
      gameState: this.moveHistory.length // Track at which move the hint was requested
    };
    this.hintHistory.push(hintRecord);
  }

  getHintHistory(): Array<{hint: HintSuggestion, timestamp: Date, gameState: number}> {
    return [...this.hintHistory];
  }

  getHintsUsedCount(): number {
    return this.hintHistory.length;
  }

  // Additional utility methods for game state management
  isGameActive(board: IGameBoard): boolean {
    const state = board.getGameState();
    return state === GameState.READY || state === GameState.PLAYING;
  }

  isGameFinished(board: IGameBoard): boolean {
    const state = board.getGameState();
    return state === GameState.WON || state === GameState.LOST;
  }

  getGameStatistics() {
    return {
      duration: this.getGameDuration(),
      score: this.getScore(),
      moveCount: this.getMoveCount(),
      startTime: this.gameStartTime,
      endTime: this.gameEndTime
    };
  }
}