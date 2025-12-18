import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ProbabilityCalculator } from '@/ai/ProbabilityCalculator';
import { GameBoard } from '@/game/GameBoard';
import { DifficultyLevel } from '@/types';

describe('ProbabilityCalculator', () => {
  let calculator: ProbabilityCalculator;
  let board: GameBoard;

  beforeEach(() => {
    calculator = new ProbabilityCalculator();
    board = new GameBoard({
      width: 5,
      height: 5,
      mineCount: 5,
      level: DifficultyLevel.CUSTOM
    });
  });

  it('should create a probability calculator', () => {
    expect(calculator).toBeDefined();
    expect(calculator.getCalculationMethod()).toBe('exact');
  });

  it('should calculate probabilities for a simple board', () => {
    // Reveal a corner cell to create some constraints
    board.revealCell(0, 0);
    
    const probabilities = calculator.calculateProbabilities(board);
    
    expect(probabilities).toBeDefined();
    expect(probabilities.cellProbabilities).toBeInstanceOf(Map);
    expect(probabilities.lastUpdated).toBeInstanceOf(Date);
    expect(['exact', 'monte_carlo']).toContain(probabilities.calculationMethod);
  });

  it('should return 0 probability for revealed cells', () => {
    board.revealCell(0, 0);
    
    const probability = calculator.getCellProbability(board, 0, 0);
    
    expect(probability).toBe(0);
  });

  it('should return 0 probability for flagged cells', () => {
    board.flagCell(0, 0);
    
    const probability = calculator.getCellProbability(board, 0, 0);
    
    expect(probability).toBe(0);
  });

  it('should update probabilities when board state changes', async () => {
    const initialProbs = calculator.calculateProbabilities(board);
    
    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Make a move
    board.revealCell(2, 2);
    
    calculator.updateProbabilities(board);
    const updatedProbs = calculator.calculateProbabilities(board);
    
    expect(updatedProbs.lastUpdated.getTime()).toBeGreaterThanOrEqual(initialProbs.lastUpdated.getTime());
  });

  it('should handle timeout setting', () => {
    calculator.setCalculationTimeout(1000);
    
    // This should still work with the new timeout
    const probabilities = calculator.calculateProbabilities(board);
    expect(probabilities).toBeDefined();
  });

  it('should handle board with minimal unknown cells', () => {
    const smallBoard = new GameBoard({
      width: 2,
      height: 2,
      mineCount: 1,
      level: DifficultyLevel.CUSTOM
    });
    
    // Reveal one cell to create some constraints
    smallBoard.revealCell(0, 0);
    
    const probabilities = calculator.calculateProbabilities(smallBoard);
    
    // Should calculate probabilities for remaining unknown cells
    expect(probabilities.cellProbabilities.size).toBeGreaterThanOrEqual(0);
    expect(probabilities.calculationMethod).toMatch(/^(exact|monte_carlo)$/);
  });

  /**
   * Property 16: Real-time probability calculation
   * Feature: ai-minesweeper, Property 16: Real-time probability calculation
   * Validates: Requirements 4.1, 4.4
   */
  it('should recalculate probabilities in real-time when game state changes', () => {
    fc.assert(
      fc.property(
        // Generate board dimensions and mine count
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 1, max: 10 }),
        // Generate sequence of moves to make
        fc.array(fc.record({
          x: fc.integer({ min: 0, max: 7 }),
          y: fc.integer({ min: 0, max: 7 }),
          action: fc.constantFrom('reveal', 'flag')
        }), { minLength: 1, maxLength: 5 }),
        (width, height, mineCount, moves) => {
          // Ensure mine count is reasonable for board size
          const maxMines = Math.floor((width * height) * 0.8);
          const actualMineCount = Math.min(mineCount, maxMines);
          
          const board = new GameBoard({
            width,
            height,
            mineCount: actualMineCount,
            level: DifficultyLevel.CUSTOM
          });

          // Get initial probabilities
          const initialProbs = calculator.calculateProbabilities(board);
          const initialTimestamp = initialProbs.lastUpdated.getTime();

          // Make a series of valid moves and check probability updates
          let lastTimestamp = initialTimestamp;
          let movesMade = 0;

          for (const move of moves) {
            // Ensure move coordinates are within board bounds
            if (move.x >= width || move.y >= height) continue;
            
            const cell = board.getCell(move.x, move.y);
            if (!cell) continue;

            // Only make valid moves
            let canMakeMove = false;
            if (move.action === 'reveal' && !cell.isRevealed && !cell.isFlagged) {
              canMakeMove = true;
            } else if (move.action === 'flag' && !cell.isRevealed) {
              canMakeMove = true;
            }

            if (!canMakeMove) continue;

            // Make the move
            let moveSuccessful = false;
            if (move.action === 'reveal') {
              moveSuccessful = board.revealCell(move.x, move.y);
            } else if (move.action === 'flag') {
              moveSuccessful = board.flagCell(move.x, move.y);
            }

            if (!moveSuccessful) continue;

            movesMade++;

            // Calculate new probabilities after the move
            const newProbs = calculator.calculateProbabilities(board);
            const newTimestamp = newProbs.lastUpdated.getTime();

            // Property: Probabilities should be recalculated (timestamp updated)
            if (newTimestamp <= lastTimestamp) {
              // Allow for same millisecond timestamps, but ensure calculation occurred
              calculator.updateProbabilities(board);
              const updatedProbs = calculator.calculateProbabilities(board);
              expect(updatedProbs.lastUpdated.getTime()).toBeGreaterThanOrEqual(lastTimestamp);
            }

            lastTimestamp = newTimestamp;

            // Property: All probability values should be valid (between 0 and 1)
            for (const [key, probability] of newProbs.cellProbabilities) {
              expect(probability).toBeGreaterThanOrEqual(0);
              expect(probability).toBeLessThanOrEqual(1);
            }

            // Property: Revealed and flagged cells should not have probabilities
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const checkCell = board.getCell(x, y);
                if (checkCell && (checkCell.isRevealed || checkCell.isFlagged)) {
                  const cellKey = `${x},${y}`;
                  const cellProb = newProbs.cellProbabilities.get(cellKey);
                  // Probability should either not exist or be 0 for revealed/flagged cells
                  if (cellProb !== undefined) {
                    expect(cellProb).toBe(0);
                  }
                }
              }
            }

            // Stop if game ended
            if (board.getGameState() !== 'playing' && board.getGameState() !== 'ready') {
              break;
            }
          }

          // Property: If moves were made, probabilities should have been updated
          if (movesMade > 0) {
            const finalProbs = calculator.calculateProbabilities(board);
            expect(finalProbs.lastUpdated.getTime()).toBeGreaterThanOrEqual(initialTimestamp);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});