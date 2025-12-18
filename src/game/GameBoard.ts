import { Cell, GameState, DifficultySettings } from '@/types';
import { IGameBoard } from '@/interfaces/GameEngine';

export class GameBoard implements IGameBoard {
  private cells: Cell[][];
  private width: number;
  private height: number;
  private mineCount: number;
  private gameState: GameState;
  private startTime: Date;
  private endTime?: Date;

  constructor(settings: DifficultySettings) {
    this.width = settings.width;
    this.height = settings.height;
    this.mineCount = settings.mineCount;
    this.gameState = GameState.READY;
    this.startTime = new Date();
    this.cells = this.initializeBoard();
    this.placeMines();
    this.calculateAdjacentMines();
  }

  private initializeBoard(): Cell[][] {
    const board: Cell[][] = [];
    for (let y = 0; y < this.height; y++) {
      board[y] = [];
      for (let x = 0; x < this.width; x++) {
        board[y][x] = {
          x,
          y,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          adjacentMines: 0
        };
      }
    }
    return board;
  }

  private placeMines(): void {
    let minesPlaced = 0;
    while (minesPlaced < this.mineCount) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      
      if (!this.cells[y][x].isMine) {
        this.cells[y][x].isMine = true;
        minesPlaced++;
      }
    }
  }

  private calculateAdjacentMines(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.cells[y][x].isMine) {
          this.cells[y][x].adjacentMines = this.countAdjacentMines(x, y);
        }
      }
    }
  }

  private countAdjacentMines(x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (this.isValidPosition(nx, ny) && this.cells[ny][nx].isMine) {
          count++;
        }
      }
    }
    return count;
  }

  getCell(x: number, y: number): Cell | null {
    if (!this.isValidPosition(x, y)) {
      return null;
    }
    return this.cells[y][x];
  }

  getCells(): Cell[][] {
    return this.cells;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getMineCount(): number {
    return this.mineCount;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  revealCell(x: number, y: number): boolean {
    if (!this.isValidPosition(x, y)) {
      return false;
    }

    const cell = this.cells[y][x];
    if (cell.isRevealed || cell.isFlagged) {
      return false;
    }

    // Start the game on first move
    if (this.gameState === GameState.READY) {
      this.gameState = GameState.PLAYING;
    }

    cell.isRevealed = true;

    // Check if mine was revealed
    if (cell.isMine) {
      this.gameState = GameState.LOST;
      this.endTime = new Date();
      return true;
    }

    // Auto-reveal adjacent cells if this cell has no adjacent mines
    if (cell.adjacentMines === 0) {
      this.revealAdjacentCells(x, y);
    }

    // Check win condition
    if (this.checkWinCondition()) {
      this.gameState = GameState.WON;
      this.endTime = new Date();
    }

    return true;
  }

  private revealAdjacentCells(x: number, y: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (this.isValidPosition(nx, ny)) {
          const adjacentCell = this.cells[ny][nx];
          if (!adjacentCell.isRevealed && !adjacentCell.isFlagged && !adjacentCell.isMine) {
            this.revealCell(nx, ny);
          }
        }
      }
    }
  }

  flagCell(x: number, y: number): boolean {
    if (!this.isValidPosition(x, y)) {
      return false;
    }

    const cell = this.cells[y][x];
    if (cell.isRevealed) {
      return false;
    }

    cell.isFlagged = !cell.isFlagged;
    return true;
  }

  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getAdjacentCells(x: number, y: number): Cell[] {
    const adjacent: Cell[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (this.isValidPosition(nx, ny)) {
          adjacent.push(this.cells[ny][nx]);
        }
      }
    }
    
    return adjacent;
  }

  getRemainingMines(): number {
    let flaggedCount = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x].isFlagged) {
          flaggedCount++;
        }
      }
    }
    return this.mineCount - flaggedCount;
  }

  private checkWinCondition(): boolean {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (!cell.isMine && !cell.isRevealed) {
          return false;
        }
      }
    }
    return true;
  }

  serialize(): string {
    return JSON.stringify({
      width: this.width,
      height: this.height,
      mineCount: this.mineCount,
      gameState: this.gameState,
      startTime: this.startTime,
      endTime: this.endTime,
      cells: this.cells
    });
  }
}