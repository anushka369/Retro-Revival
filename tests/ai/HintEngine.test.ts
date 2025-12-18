import { describe, it, expect, beforeEach } from 'vitest';
import { HintEngine } from '@/ai/HintEngine';
import { GameBoard } from '@/game/GameBoard';
import { GameLogic } from '@/game/GameLogic';
import { ProbabilityCalculator } from '@/ai/ProbabilityCalculator';
import { GameState, DifficultyLevel } from '@/types';
import * as fc from 'fast-check';

describe('HintEngine', () => {
  let hintEngine: HintEngine;
  let gameBoard: GameBoard;
  let probabilityCalculator: ProbabilityCalculator;

  beforeEach(() => {
    hintEngine = new HintEngine();
    probabilityCalculator = new ProbabilityCalculator();
    
    // Create a simple 3x3 board for testing
    gameBoard = new GameBoard({
      width: 3,
      height: 3,
      mineCount: 1,
      level: DifficultyLevel.CUSTOM
    });
  });

  describe('generateHint', () => {
    it('should return null for empty probability map', () => {
      const emptyProbabilities = {
        cellProbabilities: new Map(),
        lastUpdated: new Date(),
        calculationMethod: 'exact' as const
      };

      const hint = hintEngine.generateHint(gameBoard, emptyProbabilities);
      expect(hint).toBeNull();
    });

    it('should generate a hint when probabilities are available', () => {
      // Reveal a cell to create some game state
      gameBoard.revealCell(0, 0);
      
      const probabilities = probabilityCalculator.calculateProbabilities(gameBoard);
      const hint = hintEngine.generateHint(gameBoard, probabilities);

      if (hint) {
        expect(hint).toHaveProperty('cell');
        expect(hint).toHaveProperty('action');
        expect(hint).toHaveProperty('confidence');
        expect(hint).toHaveProperty('reasoning');
        expect(hint).toHaveProperty('expectedInformation');
        expect(hint.confidence).toBeGreaterThanOrEqual(0);
        expect(hint.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('findSafeMoves', () => {
    it('should return empty array when no safe moves exist', () => {
      const probabilities = {
        cellProbabilities: new Map([
          ['0,0', 0.5],
          ['0,1', 0.5],
          ['1,0', 0.5]
        ]),
        lastUpdated: new Date(),
        calculationMethod: 'exact' as const
      };

      const safeMoves = hintEngine.findSafeMoves(gameBoard, probabilities);
      expect(safeMoves).toEqual([]);
    });

    it('should identify safe moves with zero probability', () => {
      const probabilities = {
        cellProbabilities: new Map([
          ['0,0', 0.0], // Safe move
          ['0,1', 0.5],
          ['1,0', 1.0]  // Definite mine
        ]),
        lastUpdated: new Date(),
        calculationMethod: 'exact' as const
      };

      const safeMoves = hintEngine.findSafeMoves(gameBoard, probabilities);
      expect(safeMoves.length).toBeGreaterThan(0);
      
      const safeRevealMove = safeMoves.find(move => move.action === 'reveal');
      expect(safeRevealMove).toBeDefined();
      expect(safeRevealMove?.cell).toEqual({ x: 0, y: 0 });
      expect(safeRevealMove?.confidence).toBe(1.0);

      const safeFlagMove = safeMoves.find(move => move.action === 'flag');
      expect(safeFlagMove).toBeDefined();
      expect(safeFlagMove?.cell).toEqual({ x: 1, y: 0 });
      expect(safeFlagMove?.confidence).toBe(1.0);
    });
  });

  describe('findBestProbabilisticMove', () => {
    it('should return null when no moves are available', () => {
      // Reveal all cells
      for (let y = 0; y < gameBoard.getHeight(); y++) {
        for (let x = 0; x < gameBoard.getWidth(); x++) {
          gameBoard.revealCell(x, y);
        }
      }

      const probabilities = {
        cellProbabilities: new Map(),
        lastUpdated: new Date(),
        calculationMethod: 'exact' as const
      };

      const move = hintEngine.findBestProbabilisticMove(gameBoard, probabilities);
      expect(move).toBeNull();
    });

    it('should return the move with lowest probability', () => {
      const probabilities = {
        cellProbabilities: new Map([
          ['0,0', 0.3],
          ['0,1', 0.1], // Lowest probability
          ['1,0', 0.8]
        ]),
        lastUpdated: new Date(),
        calculationMethod: 'exact' as const
      };

      const move = hintEngine.findBestProbabilisticMove(gameBoard, probabilities);
      expect(move).toBeDefined();
      expect(move?.cell).toEqual({ x: 0, y: 1 });
      expect(move?.action).toBe('reveal');
      expect(move?.confidence).toBe(0.9); // 1 - 0.1
    });
  });

  describe('calculateInformationGain', () => {
    it('should return 0 for revealed cells', () => {
      gameBoard.revealCell(0, 0);
      const gain = hintEngine.calculateInformationGain(gameBoard, 0, 0);
      expect(gain).toBe(0);
    });

    it('should return 0 for flagged cells', () => {
      gameBoard.flagCell(0, 0);
      const gain = hintEngine.calculateInformationGain(gameBoard, 0, 0);
      expect(gain).toBe(0);
    });

    it('should return positive value for unrevealed cells', () => {
      const gain = hintEngine.calculateInformationGain(gameBoard, 0, 0);
      expect(gain).toBeGreaterThan(0);
    });

    it('should return higher gain for frontier cells', () => {
      // Reveal a cell to create a frontier
      gameBoard.revealCell(0, 0);
      
      // Find an unrevealed cell adjacent to a revealed cell (frontier)
      let frontierCell = null;
      let nonFrontierCell = null;
      
      for (let y = 0; y < gameBoard.getHeight(); y++) {
        for (let x = 0; x < gameBoard.getWidth(); x++) {
          const cell = gameBoard.getCell(x, y);
          if (cell && !cell.isRevealed && !cell.isFlagged) {
            const adjacentCells = gameBoard.getAdjacentCells(x, y);
            const hasRevealedAdjacent = adjacentCells.some(c => c.isRevealed);
            
            if (hasRevealedAdjacent && !frontierCell) {
              frontierCell = { x, y };
            } else if (!hasRevealedAdjacent && !nonFrontierCell) {
              nonFrontierCell = { x, y };
            }
          }
        }
      }
      
      // If we found both types of cells, compare their information gain
      if (frontierCell && nonFrontierCell) {
        const frontierGain = hintEngine.calculateInformationGain(gameBoard, frontierCell.x, frontierCell.y);
        const nonFrontierGain = hintEngine.calculateInformationGain(gameBoard, nonFrontierCell.x, nonFrontierCell.y);
        
        expect(frontierGain).toBeGreaterThan(nonFrontierGain);
      } else {
        // If we can't find both types, just check that information gain is calculated
        const gain = hintEngine.calculateInformationGain(gameBoard, 1, 1);
        expect(gain).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('rankMoves', () => {
    it('should sort moves by confidence first', () => {
      const moves = [
        {
          cell: { x: 0, y: 0 },
          action: 'reveal' as const,
          confidence: 0.5,
          reasoning: 'Low confidence',
          expectedInformation: 1.0
        },
        {
          cell: { x: 1, y: 0 },
          action: 'reveal' as const,
          confidence: 0.9,
          reasoning: 'High confidence',
          expectedInformation: 0.5
        }
      ];

      const ranked = hintEngine.rankMoves(moves);
      expect(ranked[0].confidence).toBe(0.9);
      expect(ranked[1].confidence).toBe(0.5);
    });

    it('should sort by information gain when confidence is equal', () => {
      const moves = [
        {
          cell: { x: 0, y: 0 },
          action: 'reveal' as const,
          confidence: 0.8,
          reasoning: 'Low info',
          expectedInformation: 0.5
        },
        {
          cell: { x: 1, y: 0 },
          action: 'reveal' as const,
          confidence: 0.8,
          reasoning: 'High info',
          expectedInformation: 1.5
        }
      ];

      const ranked = hintEngine.rankMoves(moves);
      expect(ranked[0].expectedInformation).toBe(1.5);
      expect(ranked[1].expectedInformation).toBe(0.5);
    });

    it('should prefer reveal over flag when all else is equal', () => {
      const moves = [
        {
          cell: { x: 0, y: 0 },
          action: 'flag' as const,
          confidence: 0.8,
          reasoning: 'Flag move',
          expectedInformation: 1.0
        },
        {
          cell: { x: 1, y: 0 },
          action: 'reveal' as const,
          confidence: 0.8,
          reasoning: 'Reveal move',
          expectedInformation: 1.0
        }
      ];

      const ranked = hintEngine.rankMoves(moves);
      expect(ranked[0].action).toBe('reveal');
      expect(ranked[1].action).toBe('flag');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: ai-minesweeper, Property 10: Information-maximizing move selection**
     * **Validates: Requirements 2.5**
     */
    it('should prioritize moves that reveal the most information when multiple equally safe moves exist', () => {
      fc.assert(
        fc.property(
          // Generate board configuration
          fc.record({
            width: fc.integer({ min: 4, max: 8 }),
            height: fc.integer({ min: 4, max: 8 }),
          }).chain(({ width, height }) => 
            fc.record({
              width: fc.constant(width),
              height: fc.constant(height),
              mineCount: fc.integer({ min: 2, max: Math.floor(width * height * 0.2) }),
              // Generate positions for creating multiple safe moves
              revealPositions: fc.array(
                fc.record({
                  x: fc.integer({ min: 0, max: width - 1 }),
                  y: fc.integer({ min: 0, max: height - 1 })
                }),
                { minLength: 1, maxLength: 3 }
              )
            })
          ),
          (config) => {
            // Create a game board
            const gameBoard = new GameBoard({
              width: config.width,
              height: config.height,
              mineCount: config.mineCount,
              level: DifficultyLevel.CUSTOM
            });

            // Reveal some cells to create constraints (avoid mines to keep game active)
            let revealedCount = 0;
            for (const pos of config.revealPositions) {
              const cell = gameBoard.getCell(pos.x, pos.y);
              if (cell && !cell.isMine && revealedCount < 2) {
                gameBoard.revealCell(pos.x, pos.y);
                revealedCount++;
                if (gameBoard.getGameState() !== GameState.PLAYING && gameBoard.getGameState() !== GameState.READY) {
                  break;
                }
              }
            }

            // Skip if game is over or no cells were revealed
            if (gameBoard.getGameState() === GameState.WON || gameBoard.getGameState() === GameState.LOST || revealedCount === 0) {
              return true;
            }

            // Calculate probabilities
            const probabilityCalculator = new ProbabilityCalculator();
            const probabilities = probabilityCalculator.calculateProbabilities(gameBoard);

            // Skip if no probabilities calculated
            if (probabilities.cellProbabilities.size === 0) {
              return true;
            }

            // Find all safe moves (probability = 0)
            const safeMoves = hintEngine.findSafeMoves(gameBoard, probabilities);
            
            // If we have multiple safe moves, test information maximization
            if (safeMoves.length >= 2) {
              // Filter to only reveal actions for fair comparison
              const safeRevealMoves = safeMoves.filter(move => move.action === 'reveal');
              
              if (safeRevealMoves.length >= 2) {
                // Rank the moves
                const rankedMoves = hintEngine.rankMoves(safeRevealMoves);
                
                // Verify that moves are sorted by information gain (when confidence is equal)
                for (let i = 0; i < rankedMoves.length - 1; i++) {
                  const currentMove = rankedMoves[i];
                  const nextMove = rankedMoves[i + 1];
                  
                  // If confidence is equal (both safe moves should have confidence = 1.0)
                  if (Math.abs(currentMove.confidence - nextMove.confidence) <= 0.01) {
                    // Current move should have >= information gain than next move
                    expect(currentMove.expectedInformation).toBeGreaterThanOrEqual(nextMove.expectedInformation);
                  }
                }
                
                // The top-ranked move should be the one with highest information gain among equal confidence moves
                const topMove = rankedMoves[0];
                const maxInformationGain = Math.max(...safeRevealMoves.map(m => m.expectedInformation));
                
                // Allow for small floating point differences
                expect(topMove.expectedInformation).toBeCloseTo(maxInformationGain, 5);
              }
            }

            // Test the main generateHint method respects information maximization
            const hint = hintEngine.generateHint(gameBoard, probabilities);
            if (hint && safeMoves.length >= 2) {
              // The generated hint should be one of the safe moves (if any exist)
              const safeRevealMoves = safeMoves.filter(move => move.action === 'reveal');
              if (safeRevealMoves.length > 0) {
                // Find the move that matches the hint
                const matchingMove = safeRevealMoves.find(move => 
                  move.cell.x === hint.cell.x && 
                  move.cell.y === hint.cell.y && 
                  move.action === hint.action
                );
                
                if (matchingMove) {
                  // The hint should have the maximum information gain among safe moves
                  const maxInfoGain = Math.max(...safeRevealMoves.map(m => m.expectedInformation));
                  expect(hint.expectedInformation).toBeCloseTo(maxInfoGain, 5);
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 9: Hint usage tracking**
     * **Validates: Requirements 2.4**
     */
    it('should track hint usage for performance analysis when hints are requested', () => {
      fc.assert(
        fc.property(
          // Generate board configuration and hint request sequence
          fc.record({
            width: fc.integer({ min: 3, max: 8 }),
            height: fc.integer({ min: 3, max: 8 }),
          }).chain(({ width, height }) => 
            fc.record({
              width: fc.constant(width),
              height: fc.constant(height),
              mineCount: fc.integer({ min: 1, max: Math.floor(width * height * 0.25) }),
              revealSequence: fc.array(
                fc.record({
                  x: fc.integer({ min: 0, max: width - 1 }),
                  y: fc.integer({ min: 0, max: height - 1 })
                }),
                { minLength: 1, maxLength: 4 }
              ),
              hintRequestCount: fc.integer({ min: 1, max: 5 })
            })
          ),
          (config) => {
            // Create GameLogic instance for testing hint tracking
            const gameLogic = new GameLogic();
            
            // Create a game board
            const gameBoard = gameLogic.createBoard({
              width: config.width,
              height: config.height,
              mineCount: config.mineCount,
              level: DifficultyLevel.CUSTOM
            });

            // Initially, no hints should be tracked
            expect(gameLogic.getHintsUsedCount()).toBe(0);
            expect(gameLogic.getHintHistory()).toHaveLength(0);

            // Reveal some cells to create a game state (avoid mines to keep game active)
            let revealedCount = 0;
            for (const pos of config.revealSequence) {
              const cell = gameBoard.getCell(pos.x, pos.y);
              if (cell && !cell.isMine && revealedCount < 3) {
                const moveSuccessful = gameLogic.makeMove(gameBoard, pos.x, pos.y, 'reveal');
                if (moveSuccessful) {
                  revealedCount++;
                }
                // Stop if game ended
                if (gameBoard.getGameState() !== GameState.PLAYING && gameBoard.getGameState() !== GameState.READY) {
                  break;
                }
              }
            }

            // Skip if game is over or no cells were revealed
            if (gameBoard.getGameState() === GameState.WON || gameBoard.getGameState() === GameState.LOST || revealedCount === 0) {
              return true;
            }

            // Calculate probabilities for hint generation
            const probabilityCalculator = new ProbabilityCalculator();
            const probabilities = probabilityCalculator.calculateProbabilities(gameBoard);

            // Skip if no probabilities calculated (no constraints available)
            if (probabilities.cellProbabilities.size === 0) {
              return true;
            }

            // Track initial move count for game state verification
            const initialMoveCount = gameLogic.getMoveCount();
            let hintsGenerated = 0;

            // Request hints and verify tracking
            for (let i = 0; i < config.hintRequestCount; i++) {
              const hint = hintEngine.generateHint(gameBoard, probabilities);
              
              if (hint) {
                // Record the hint usage (simulating the main game loop behavior)
                gameLogic.recordHintUsage(hint);
                hintsGenerated++;

                // Verify hint count incremented
                expect(gameLogic.getHintsUsedCount()).toBe(hintsGenerated);

                // Verify hint history length matches count
                const hintHistory = gameLogic.getHintHistory();
                expect(hintHistory).toHaveLength(hintsGenerated);

                // Verify the most recent hint record
                const latestHintRecord = hintHistory[hintHistory.length - 1];
                expect(latestHintRecord.hint).toEqual(hint);
                expect(latestHintRecord.timestamp).toBeInstanceOf(Date);
                expect(latestHintRecord.gameState).toBe(initialMoveCount); // Should match move count when hint was requested

                // Verify hint record structure
                expect(latestHintRecord.hint).toHaveProperty('cell');
                expect(latestHintRecord.hint).toHaveProperty('action');
                expect(latestHintRecord.hint).toHaveProperty('confidence');
                expect(latestHintRecord.hint).toHaveProperty('reasoning');
                expect(latestHintRecord.hint).toHaveProperty('expectedInformation');

                // Verify timestamp is recent (within last few seconds)
                const now = new Date();
                const timeDiff = now.getTime() - latestHintRecord.timestamp.getTime();
                expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
              }
            }

            // Verify final state: hint tracking should persist all recorded hints
            expect(gameLogic.getHintsUsedCount()).toBe(hintsGenerated);
            expect(gameLogic.getHintHistory()).toHaveLength(hintsGenerated);

            // Verify hint history is immutable (returns copy, not reference)
            const history1 = gameLogic.getHintHistory();
            const history2 = gameLogic.getHintHistory();
            expect(history1).not.toBe(history2); // Different object references
            expect(history1).toEqual(history2); // Same content

            // Verify chronological ordering of hints
            const finalHistory = gameLogic.getHintHistory();
            for (let i = 1; i < finalHistory.length; i++) {
              const prevTimestamp = finalHistory[i - 1].timestamp.getTime();
              const currTimestamp = finalHistory[i].timestamp.getTime();
              expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 8: Optimal probabilistic choice**
     * **Validates: Requirements 2.3**
     */
    it('should recommend the cell with lowest mine probability when no safe moves exist', () => {
      fc.assert(
        fc.property(
          // Generate board configuration with no guaranteed safe moves
          fc.record({
            width: fc.integer({ min: 3, max: 6 }),
            height: fc.integer({ min: 3, max: 6 }),
          }).chain(({ width, height }) => 
            fc.record({
              width: fc.constant(width),
              height: fc.constant(height),
              mineCount: fc.integer({ min: 2, max: Math.floor(width * height * 0.4) }),
              // Generate probability values that ensure no safe moves (all > 0)
              probabilityValues: fc.array(
                fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }), // No 0.0 or 1.0 values (no safe moves)
                { minLength: 3, maxLength: 8 }
              )
            })
          ),
          (config) => {
            // Create a game board
            const gameBoard = new GameBoard({
              width: config.width,
              height: config.height,
              mineCount: config.mineCount,
              level: DifficultyLevel.CUSTOM
            });

            // Reveal one cell to create some game state (avoid mines)
            let revealedSafely = false;
            for (let y = 0; y < gameBoard.getHeight() && !revealedSafely; y++) {
              for (let x = 0; x < gameBoard.getWidth() && !revealedSafely; x++) {
                const cell = gameBoard.getCell(x, y);
                if (cell && !cell.isMine) {
                  gameBoard.revealCell(x, y);
                  revealedSafely = true;
                }
              }
            }

            // Skip if we couldn't reveal any cell safely or game ended
            if (!revealedSafely || gameBoard.getGameState() !== GameState.PLAYING) {
              return true;
            }

            // Create a probability map with no safe moves (all probabilities > 0 and < 1)
            const cellProbabilities = new Map<string, number>();
            const unrevealed: Array<{x: number, y: number}> = [];
            
            // Collect unrevealed cells
            for (let y = 0; y < gameBoard.getHeight(); y++) {
              for (let x = 0; x < gameBoard.getWidth(); x++) {
                const cell = gameBoard.getCell(x, y);
                if (cell && !cell.isRevealed && !cell.isFlagged) {
                  unrevealed.push({ x, y });
                }
              }
            }

            // Skip if no unrevealed cells
            if (unrevealed.length === 0) {
              return true;
            }

            // Assign probabilities ensuring no safe moves exist
            let minProbability = 1.0;
            let cellsWithMinProbability: Array<{x: number, y: number}> = [];
            
            for (let i = 0; i < unrevealed.length && i < config.probabilityValues.length; i++) {
              const cell = unrevealed[i];
              const probability = config.probabilityValues[i];
              const key = `${cell.x},${cell.y}`;
              cellProbabilities.set(key, probability);
              
              // Track minimum probability and cells that have it
              if (probability < minProbability) {
                minProbability = probability;
                cellsWithMinProbability = [cell];
              } else if (Math.abs(probability - minProbability) < 0.001) {
                cellsWithMinProbability.push(cell);
              }
            }

            // Skip if we don't have enough cells with probabilities
            if (cellProbabilities.size < 2) {
              return true;
            }

            const probabilities: ProbabilityMap = {
              cellProbabilities,
              lastUpdated: new Date(),
              calculationMethod: 'exact'
            };

            // Verify no safe moves exist (all probabilities > threshold)
            const safeMoves = hintEngine.findSafeMoves(gameBoard, probabilities);
            
            // Skip this test case if safe moves were found (contradicts our setup)
            if (safeMoves.length > 0) {
              return true;
            }

            // Generate hint using the probabilistic method
            const hint = hintEngine.generateHint(gameBoard, probabilities);

            // A hint should be generated when moves are available
            if (hint === null) {
              return false; // This should not happen when moves are available
            }

            // Verify the hint targets a cell with the minimum probability
            const hintKey = `${hint.cell.x},${hint.cell.y}`;
            const hintProbability = cellProbabilities.get(hintKey);
            
            expect(hintProbability).toBeDefined();
            expect(hintProbability).toBeCloseTo(minProbability, 3);

            // Verify the hint is for a reveal action (not flag, since no cell has probability 1.0)
            expect(hint.action).toBe('reveal');

            // Verify confidence is calculated correctly (1 - probability)
            const expectedConfidence = Math.max(0, 1 - minProbability);
            expect(hint.confidence).toBeCloseTo(expectedConfidence, 3);

            // Verify reasoning mentions it's the safest available move
            expect(hint.reasoning).toContain('safest available move');
            expect(hint.reasoning).toContain(`${(minProbability * 100).toFixed(2)}%`);

            // Test the findBestProbabilisticMove method directly
            const bestMove = hintEngine.findBestProbabilisticMove(gameBoard, probabilities);
            expect(bestMove).not.toBeNull();
            
            if (bestMove) {
              const bestMoveKey = `${bestMove.cell.x},${bestMove.cell.y}`;
              const bestMoveProbability = cellProbabilities.get(bestMoveKey);
              expect(bestMoveProbability).toBeCloseTo(minProbability, 3);
            }

            // Verify that among all cells with minimum probability, the choice is consistent
            // (should pick the same cell given the same input)
            const hint2 = hintEngine.generateHint(gameBoard, probabilities);
            if (hint2) {
              expect(hint2.cell).toEqual(hint.cell);
              expect(hint2.action).toBe(hint.action);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 6: Hint validity**
     * **Validates: Requirements 2.1**
     */
    it('should always suggest valid, legal moves when moves are possible', () => {
      fc.assert(
        fc.property(
          // Generate board dimensions
          fc.record({
            width: fc.integer({ min: 3, max: 10 }),
            height: fc.integer({ min: 3, max: 10 }),
          }).chain(({ width, height }) => 
            fc.record({
              width: fc.constant(width),
              height: fc.constant(height),
              mineCount: fc.integer({ min: 1, max: Math.floor(width * height * 0.3) }),
              revealedCells: fc.array(
                fc.record({
                  x: fc.integer({ min: 0, max: width - 1 }),
                  y: fc.integer({ min: 0, max: height - 1 })
                }),
                { minLength: 0, maxLength: Math.min(5, width * height - 1) }
              )
            })
          ),
          (config) => {
            // Create a game board with the generated configuration
            const gameBoard = new GameBoard({
              width: config.width,
              height: config.height,
              mineCount: config.mineCount,
              level: DifficultyLevel.CUSTOM
            });

            // Reveal some cells to create a game state (but avoid mines to keep game active)
            let revealedCount = 0;
            for (const cellPos of config.revealedCells) {
              const cell = gameBoard.getCell(cellPos.x, cellPos.y);
              if (cell && !cell.isMine && revealedCount < 3) {
                gameBoard.revealCell(cellPos.x, cellPos.y);
                revealedCount++;
                // Stop if game ended (shouldn't happen since we avoid mines, but safety check)
                if (gameBoard.getGameState() !== GameState.PLAYING && gameBoard.getGameState() !== GameState.READY) {
                  break;
                }
              }
            }

            // Skip if game is already over or no moves are possible
            const gameState = gameBoard.getGameState();
            if (gameState === GameState.WON || gameState === GameState.LOST) {
              return true; // Skip this test case
            }

            // Check if there are any unrevealed, unflagged cells (moves possible)
            let movesAvailable = false;
            for (let y = 0; y < gameBoard.getHeight(); y++) {
              for (let x = 0; x < gameBoard.getWidth(); x++) {
                const cell = gameBoard.getCell(x, y);
                if (cell && !cell.isRevealed && !cell.isFlagged) {
                  movesAvailable = true;
                  break;
                }
              }
              if (movesAvailable) break;
            }

            // Skip if no moves are available
            if (!movesAvailable) {
              return true;
            }

            // Calculate probabilities and generate hint
            const probabilityCalculator = new ProbabilityCalculator();
            const probabilities = probabilityCalculator.calculateProbabilities(gameBoard);
            const hint = hintEngine.generateHint(gameBoard, probabilities);

            // If moves are possible, a hint should be generated
            if (hint === null) {
              // This might be acceptable if no probabilities were calculated
              // (e.g., no revealed cells to constrain the problem)
              return probabilities.cellProbabilities.size === 0;
            }

            // Validate the hint structure
            expect(hint).toHaveProperty('cell');
            expect(hint).toHaveProperty('action');
            expect(hint).toHaveProperty('confidence');
            expect(hint).toHaveProperty('reasoning');
            expect(hint).toHaveProperty('expectedInformation');

            // Validate cell coordinates are within bounds
            expect(hint.cell.x).toBeGreaterThanOrEqual(0);
            expect(hint.cell.x).toBeLessThan(gameBoard.getWidth());
            expect(hint.cell.y).toBeGreaterThanOrEqual(0);
            expect(hint.cell.y).toBeLessThan(gameBoard.getHeight());

            // Validate the target cell exists and is actionable
            const targetCell = gameBoard.getCell(hint.cell.x, hint.cell.y);
            expect(targetCell).not.toBeNull();
            expect(targetCell!.isRevealed).toBe(false); // Cannot act on revealed cells

            // Validate action type
            expect(['reveal', 'flag']).toContain(hint.action);

            // If action is reveal, cell should not be flagged
            if (hint.action === 'reveal') {
              expect(targetCell!.isFlagged).toBe(false);
            }

            // Validate confidence is in valid range
            expect(hint.confidence).toBeGreaterThanOrEqual(0);
            expect(hint.confidence).toBeLessThanOrEqual(1);

            // Validate reasoning is provided
            expect(hint.reasoning).toBeTruthy();
            expect(typeof hint.reasoning).toBe('string');
            expect(hint.reasoning.length).toBeGreaterThan(0);

            // Validate expected information is non-negative
            expect(hint.expectedInformation).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});