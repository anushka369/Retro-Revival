import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/game/GameLogic';
import { ProbabilityCalculator } from '@/ai/ProbabilityCalculator';
import { HintEngine } from '@/ai/HintEngine';
import { DifficultyLevel } from '@/types';

describe('Hint System Integration', () => {
  let gameLogic: GameLogic;
  let probabilityCalculator: ProbabilityCalculator;
  let hintEngine: HintEngine;
  let testSettings: any;

  beforeEach(() => {
    gameLogic = new GameLogic();
    probabilityCalculator = new ProbabilityCalculator();
    hintEngine = new HintEngine();
    testSettings = {
      width: 5,
      height: 5,
      mineCount: 3,
      level: DifficultyLevel.BEGINNER
    };
  });

  it('should integrate hint generation with game logic tracking', () => {
    // Create a new game
    const board = gameLogic.createBoard(testSettings);
    
    // Calculate probabilities
    const probabilities = probabilityCalculator.calculateProbabilities(board);
    
    // Generate a hint
    const hint = hintEngine.generateHint(board, probabilities);
    
    // Verify hint was generated
    expect(hint).toBeTruthy();
    
    if (hint) {
      // Record the hint usage
      gameLogic.recordHintUsage(hint);
      
      // Verify hint tracking
      expect(gameLogic.getHintsUsedCount()).toBe(1);
      const hintHistory = gameLogic.getHintHistory();
      expect(hintHistory).toHaveLength(1);
      expect(hintHistory[0].hint).toEqual(hint);
      
      // Verify hint properties
      expect(hint.cell).toBeDefined();
      expect(hint.cell.x).toBeGreaterThanOrEqual(0);
      expect(hint.cell.x).toBeLessThan(board.getWidth());
      expect(hint.cell.y).toBeGreaterThanOrEqual(0);
      expect(hint.cell.y).toBeLessThan(board.getHeight());
      expect(['reveal', 'flag']).toContain(hint.action);
      expect(hint.confidence).toBeGreaterThan(0);
      expect(hint.confidence).toBeLessThanOrEqual(1);
      expect(hint.reasoning).toBeTruthy();
      expect(hint.expectedInformation).toBeGreaterThanOrEqual(0);
    }
  });

  it('should track hints across multiple game actions', () => {
    const board = gameLogic.createBoard(testSettings);
    
    // Make some moves and generate hints
    for (let i = 0; i < 3; i++) {
      // Calculate probabilities
      const probabilities = probabilityCalculator.calculateProbabilities(board);
      
      // Generate and record hint
      const hint = hintEngine.generateHint(board, probabilities);
      if (hint) {
        gameLogic.recordHintUsage(hint);
      }
      
      // Make a move (flag a corner cell to avoid auto-reveals)
      const x = i % board.getWidth();
      const y = Math.floor(i / board.getWidth());
      gameLogic.makeMove(board, x, y, 'flag');
    }
    
    // Verify multiple hints were tracked
    expect(gameLogic.getHintsUsedCount()).toBeGreaterThan(0);
    expect(gameLogic.getHintsUsedCount()).toBeLessThanOrEqual(3);
    
    const hintHistory = gameLogic.getHintHistory();
    expect(hintHistory.length).toBe(gameLogic.getHintsUsedCount());
    
    // Verify each hint record has proper structure
    hintHistory.forEach((record, index) => {
      expect(record.hint).toBeDefined();
      expect(record.timestamp).toBeInstanceOf(Date);
      expect(record.gameState).toBe(index); // Should match the move count when hint was requested
    });
  });

  it('should reset hint tracking on new game', () => {
    // First game
    const board1 = gameLogic.createBoard(testSettings);
    const probabilities1 = probabilityCalculator.calculateProbabilities(board1);
    const hint1 = hintEngine.generateHint(board1, probabilities1);
    
    if (hint1) {
      gameLogic.recordHintUsage(hint1);
    }
    
    expect(gameLogic.getHintsUsedCount()).toBeGreaterThan(0);
    
    // New game should reset hint tracking
    gameLogic.createBoard(testSettings);
    expect(gameLogic.getHintsUsedCount()).toBe(0);
    expect(gameLogic.getHintHistory()).toHaveLength(0);
  });
});