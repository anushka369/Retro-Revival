import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GameLogic } from '@/game/GameLogic';
import { GameBoard } from '@/game/GameBoard';
import { DifficultyLevel, GameState } from '@/types';

describe('GameLogic', () => {
  let gameLogic: GameLogic;
  let testSettings: any;

  beforeEach(() => {
    gameLogic = new GameLogic();
    testSettings = {
      width: 5,
      height: 5,
      mineCount: 3,
      level: DifficultyLevel.BEGINNER
    };
  });

  describe('Board Creation and Move Validation', () => {
    it('should create a valid game board', () => {
      const board = gameLogic.createBoard(testSettings);
      
      expect(board.getWidth()).toBe(5);
      expect(board.getHeight()).toBe(5);
      expect(board.getMineCount()).toBe(3);
      expect(board.getGameState()).toBe(GameState.READY);
    });

    it('should validate moves correctly', () => {
      const board = gameLogic.createBoard(testSettings);
      
      // Valid moves
      expect(gameLogic.validateMove(board, 0, 0, 'reveal')).toBe(true);
      expect(gameLogic.validateMove(board, 2, 2, 'flag')).toBe(true);
      
      // Invalid position
      expect(gameLogic.validateMove(board, -1, 0, 'reveal')).toBe(false);
      expect(gameLogic.validateMove(board, 5, 5, 'reveal')).toBe(false);
      
      // Flag a cell first, then try to reveal it
      gameLogic.makeMove(board, 1, 1, 'flag');
      expect(gameLogic.validateMove(board, 1, 1, 'reveal')).toBe(false);
    });

    it('should reject moves on finished games', () => {
      const board = gameLogic.createBoard(testSettings);
      
      // Manually set game state to finished
      const cells = board.getCells();
      // Find a mine and reveal it to end the game
      for (let y = 0; y < board.getHeight(); y++) {
        for (let x = 0; x < board.getWidth(); x++) {
          if (cells[y][x].isMine) {
            gameLogic.makeMove(board, x, y, 'reveal');
            break;
          }
        }
        if (board.getGameState() === GameState.LOST) break;
      }
      
      // Should reject moves on finished game
      expect(gameLogic.validateMove(board, 0, 0, 'reveal')).toBe(false);
    });
  });

  describe('Win/Loss Condition Detection', () => {
    it('should detect loss condition when mine is revealed', () => {
      const board = gameLogic.createBoard(testSettings);
      const cells = board.getCells();
      
      // Find a mine and reveal it
      for (let y = 0; y < board.getHeight(); y++) {
        for (let x = 0; x < board.getWidth(); x++) {
          if (cells[y][x].isMine) {
            gameLogic.makeMove(board, x, y, 'reveal');
            expect(gameLogic.checkLossCondition(board)).toBe(true);
            return;
          }
        }
      }
    });

    it('should detect win condition when all safe cells are revealed', () => {
      const board = gameLogic.createBoard(testSettings);
      const cells = board.getCells();
      
      // Reveal all non-mine cells
      for (let y = 0; y < board.getHeight(); y++) {
        for (let x = 0; x < board.getWidth(); x++) {
          if (!cells[y][x].isMine) {
            gameLogic.makeMove(board, x, y, 'reveal');
          }
        }
      }
      
      expect(gameLogic.checkWinCondition(board)).toBe(true);
    });
  });

  describe('Game Timing and Scoring', () => {
    it('should track game duration', () => {
      const board = gameLogic.createBoard(testSettings);
      
      // Initially no duration
      expect(gameLogic.getGameDuration()).toBe(0);
      
      // Make a move to start timing
      gameLogic.makeMove(board, 0, 0, 'reveal');
      
      // Should have some duration now (even if very small)
      expect(gameLogic.getGameDuration()).toBeGreaterThanOrEqual(0);
    });

    it('should track move count', () => {
      const board = gameLogic.createBoard(testSettings);
      
      expect(gameLogic.getMoveCount()).toBe(0);
      
      // First, flag a cell (this should always work)
      const result1 = gameLogic.makeMove(board, 0, 0, 'flag');
      expect(result1).toBe(true);
      expect(gameLogic.getMoveCount()).toBe(1);
      
      // Then flag another cell
      const result2 = gameLogic.makeMove(board, 4, 4, 'flag');
      expect(result2).toBe(true);
      expect(gameLogic.getMoveCount()).toBe(2);
    });

    it('should calculate score for won games', () => {
      const board = gameLogic.createBoard(testSettings);
      const cells = board.getCells();
      
      // Reveal all non-mine cells to win
      for (let y = 0; y < board.getHeight(); y++) {
        for (let x = 0; x < board.getWidth(); x++) {
          if (!cells[y][x].isMine) {
            gameLogic.makeMove(board, x, y, 'reveal');
          }
        }
      }
      
      // Should have a positive score for winning
      expect(gameLogic.getScore()).toBeGreaterThan(0);
    });
  });

  describe('Game State Management', () => {
    it('should track game history', () => {
      const board = gameLogic.createBoard(testSettings);
      
      // First, flag a cell (this should always work)
      const result1 = gameLogic.makeMove(board, 0, 0, 'flag');
      expect(result1).toBe(true);
      
      // Then reveal a different cell
      const result2 = gameLogic.makeMove(board, 4, 4, 'reveal');
      expect(result2).toBe(true);
      
      const history = gameLogic.getGameHistory();
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('flag');
      expect(history[1].action).toBe('reveal');
    });

    it('should provide game statistics', () => {
      const board = gameLogic.createBoard(testSettings);
      gameLogic.makeMove(board, 0, 0, 'reveal');
      
      const stats = gameLogic.getGameStatistics();
      expect(stats.moveCount).toBe(1);
      expect(stats.duration).toBeGreaterThanOrEqual(0);
      expect(stats.startTime).toBeDefined();
    });

    it('should correctly identify active and finished games', () => {
      const board = gameLogic.createBoard(testSettings);
      
      expect(gameLogic.isGameActive(board)).toBe(true);
      expect(gameLogic.isGameFinished(board)).toBe(false);
      
      // End the game by revealing a mine
      const cells = board.getCells();
      for (let y = 0; y < board.getHeight(); y++) {
        for (let x = 0; x < board.getWidth(); x++) {
          if (cells[y][x].isMine) {
            gameLogic.makeMove(board, x, y, 'reveal');
            break;
          }
        }
        if (board.getGameState() === GameState.LOST) break;
      }
      
      expect(gameLogic.isGameActive(board)).toBe(false);
      expect(gameLogic.isGameFinished(board)).toBe(true);
    });
  });

  describe('Property-Based Tests', () => {
    // Generator for valid difficulty settings
    const difficultySettingsArb = fc.record({
      width: fc.integer({ min: 3, max: 15 }),
      height: fc.integer({ min: 3, max: 15 }),
      mineCount: fc.integer({ min: 1, max: 20 }),
      level: fc.constantFrom(DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.EXPERT)
    }).filter(settings => settings.mineCount < settings.width * settings.height);

    /**
     * **Feature: ai-minesweeper, Property 2: Mine revelation ends game**
     * For any game board containing mines, revealing any mine cell should immediately end the game in a lost state and make all mine locations visible
     * **Validates: Requirements 1.2**
     */
    it('Property 2: Mine revelation ends game', () => {
      fc.assert(
        fc.property(
          difficultySettingsArb,
          (settings) => {
            const gameLogic = new GameLogic();
            const board = gameLogic.createBoard(settings);
            
            // Find all mine positions
            const cells = board.getCells();
            const minePositions: { x: number; y: number }[] = [];
            
            for (let y = 0; y < board.getHeight(); y++) {
              for (let x = 0; x < board.getWidth(); x++) {
                if (cells[y][x].isMine) {
                  minePositions.push({ x, y });
                }
              }
            }
            
            // There should be mines on the board
            if (minePositions.length === 0) {
              return false;
            }
            
            // Pick a random mine to reveal
            const randomMineIndex = Math.floor(Math.random() * minePositions.length);
            const mineToReveal = minePositions[randomMineIndex];
            
            // Store initial game state
            const initialGameState = board.getGameState();
            
            // Reveal the mine
            const moveResult = gameLogic.makeMove(board, mineToReveal.x, mineToReveal.y, 'reveal');
            
            // Verify the move was successful
            if (!moveResult) {
              return false;
            }
            
            // Verify the game state changed to LOST
            const finalGameState = board.getGameState();
            if (finalGameState !== GameState.LOST) {
              return false;
            }
            
            // Verify the mine cell is now revealed
            const revealedMineCell = board.getCell(mineToReveal.x, mineToReveal.y);
            if (!revealedMineCell || !revealedMineCell.isRevealed) {
              return false;
            }
            
            // Verify loss condition is detected by game logic
            const lossDetected = gameLogic.checkLossCondition(board);
            if (!lossDetected) {
              return false;
            }
            
            // Verify the game is no longer active
            const gameActive = gameLogic.isGameActive(board);
            const gameFinished = gameLogic.isGameFinished(board);
            
            return !gameActive && gameFinished;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 3: Victory condition detection**
     * For any game board, revealing all non-mine cells should result in a won game state with recorded completion time
     * **Validates: Requirements 1.3**
     */
    it('Property 3: Victory condition detection', () => {
      fc.assert(
        fc.property(
          difficultySettingsArb,
          (settings) => {
            const gameLogic = new GameLogic();
            const board = gameLogic.createBoard(settings);
            
            // Get initial game statistics
            const initialStats = gameLogic.getGameStatistics();
            
            // Find all non-mine positions
            const cells = board.getCells();
            const safeCells: { x: number; y: number }[] = [];
            
            for (let y = 0; y < board.getHeight(); y++) {
              for (let x = 0; x < board.getWidth(); x++) {
                if (!cells[y][x].isMine) {
                  safeCells.push({ x, y });
                }
              }
            }
            
            // There should be safe cells on the board
            if (safeCells.length === 0) {
              return false;
            }
            
            // Reveal all safe cells
            for (const safeCell of safeCells) {
              // Only reveal if not already revealed (auto-reveal might have revealed some)
              const cell = board.getCell(safeCell.x, safeCell.y);
              if (cell && !cell.isRevealed) {
                const moveResult = gameLogic.makeMove(board, safeCell.x, safeCell.y, 'reveal');
                // Move should succeed unless cell was auto-revealed
                if (!moveResult && !cell.isRevealed) {
                  return false;
                }
              }
            }
            
            // Verify the game state is WON
            const finalGameState = board.getGameState();
            if (finalGameState !== GameState.WON) {
              return false;
            }
            
            // Verify win condition is detected by game logic
            const winDetected = gameLogic.checkWinCondition(board);
            if (!winDetected) {
              return false;
            }
            
            // Verify all non-mine cells are revealed
            for (let y = 0; y < board.getHeight(); y++) {
              for (let x = 0; x < board.getWidth(); x++) {
                const cell = cells[y][x];
                if (!cell.isMine && !cell.isRevealed) {
                  return false;
                }
              }
            }
            
            // Verify the game is no longer active but is finished
            const gameActive = gameLogic.isGameActive(board);
            const gameFinished = gameLogic.isGameFinished(board);
            
            if (gameActive || !gameFinished) {
              return false;
            }
            
            // Verify completion time is recorded
            const finalStats = gameLogic.getGameStatistics();
            if (!finalStats.endTime) {
              return false;
            }
            
            // Verify duration is positive (game took some time)
            const duration = gameLogic.getGameDuration();
            if (duration < 0) {
              return false;
            }
            
            // Verify score is calculated for won game
            const score = gameLogic.getScore();
            if (score <= 0) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Hint Tracking', () => {
    it('should track hint usage correctly', () => {
      gameLogic.createBoard(testSettings);
      
      // Initially no hints used
      expect(gameLogic.getHintsUsedCount()).toBe(0);
      expect(gameLogic.getHintHistory()).toHaveLength(0);
      
      // Record a hint
      const mockHint = {
        cell: { x: 1, y: 1 },
        action: 'reveal' as const,
        confidence: 0.8,
        reasoning: 'Test hint',
        expectedInformation: 2.5
      };
      
      gameLogic.recordHintUsage(mockHint);
      
      // Verify hint is tracked
      expect(gameLogic.getHintsUsedCount()).toBe(1);
      const hintHistory = gameLogic.getHintHistory();
      expect(hintHistory).toHaveLength(1);
      expect(hintHistory[0].hint).toEqual(mockHint);
      expect(hintHistory[0].timestamp).toBeInstanceOf(Date);
      expect(hintHistory[0].gameState).toBe(0); // No moves made yet
    });

    it('should track multiple hints with correct game state', () => {
      const board = gameLogic.createBoard(testSettings);
      
      // Make a move first - use a corner cell to avoid auto-reveals
      const move1Success = gameLogic.makeMove(board, 4, 4, 'flag');
      expect(move1Success).toBe(true);
      expect(gameLogic.getMoveCount()).toBe(1);
      
      // Record first hint
      const hint1 = {
        cell: { x: 1, y: 1 },
        action: 'reveal' as const,
        confidence: 0.8,
        reasoning: 'First hint',
        expectedInformation: 2.5
      };
      gameLogic.recordHintUsage(hint1);
      
      // Make another move
      const move2Success = gameLogic.makeMove(board, 4, 3, 'flag');
      expect(move2Success).toBe(true);
      expect(gameLogic.getMoveCount()).toBe(2);
      
      // Record second hint
      const hint2 = {
        cell: { x: 2, y: 2 },
        action: 'flag' as const,
        confidence: 0.9,
        reasoning: 'Second hint',
        expectedInformation: 1.0
      };
      gameLogic.recordHintUsage(hint2);
      
      // Verify both hints are tracked
      expect(gameLogic.getHintsUsedCount()).toBe(2);
      const hintHistory = gameLogic.getHintHistory();
      expect(hintHistory).toHaveLength(2);
      
      // First hint should be recorded after 1 move
      expect(hintHistory[0].gameState).toBe(1);
      expect(hintHistory[0].hint).toEqual(hint1);
      
      // Second hint should be recorded after 2 moves
      expect(hintHistory[1].gameState).toBe(2);
      expect(hintHistory[1].hint).toEqual(hint2);
    });

    it('should reset hint history on new game', () => {
      gameLogic.createBoard(testSettings);
      
      // Record a hint
      const mockHint = {
        cell: { x: 1, y: 1 },
        action: 'reveal' as const,
        confidence: 0.8,
        reasoning: 'Test hint',
        expectedInformation: 2.5
      };
      gameLogic.recordHintUsage(mockHint);
      
      expect(gameLogic.getHintsUsedCount()).toBe(1);
      
      // Create new game
      gameLogic.createBoard(testSettings);
      
      // Hint history should be reset
      expect(gameLogic.getHintsUsedCount()).toBe(0);
      expect(gameLogic.getHintHistory()).toHaveLength(0);
    });
  });
});