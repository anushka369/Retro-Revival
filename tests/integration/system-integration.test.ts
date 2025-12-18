import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameLogic } from '@/game/GameLogic';
import { ProbabilityCalculator } from '@/ai/ProbabilityCalculator';
import { HintEngine } from '@/ai/HintEngine';
import { GameRenderer } from '@/ui/GameRenderer';
import { AdaptiveDifficultyManager } from '@/adaptive/AdaptiveDifficultyManager';
import { ProfileManager } from '@/adaptive/ProfileManager';
import { DifficultyLevel, GameState } from '@/types';
import { ErrorHandler } from '@/utils/ErrorHandler';
import { PerformanceMonitor } from '@/utils/PerformanceMonitor';

/**
 * System Integration Tests
 * 
 * These tests verify that all components work together seamlessly
 * and that complete game workflows function correctly.
 * 
 * **Feature: ai-minesweeper, Integration Testing**
 * **Validates: Requirements 7.1, 7.2**
 */

describe('System Integration Tests', () => {
  let gameLogic: GameLogic;
  let probabilityCalculator: ProbabilityCalculator;
  let hintEngine: HintEngine;
  let renderer: GameRenderer;
  let adaptiveDifficultyManager: AdaptiveDifficultyManager;
  let profileManager: ProfileManager;
  let canvas: HTMLCanvasElement;
  let mockContext: any;

  beforeEach(() => {
    // Create mock canvas and context
    mockContext = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      set fillStyle(value: string) {},
      set strokeStyle(value: string) {},
      set lineWidth(value: number) {},
      set font(value: string) {},
      set textAlign(value: string) {},
      set textBaseline(value: string) {},
    };

    canvas = {
      getContext: vi.fn(() => mockContext),
      width: 600,
      height: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 600, height: 600 })),
      focus: vi.fn(),
      blur: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      style: {},
    } as any;

    // Initialize components
    gameLogic = new GameLogic();
    probabilityCalculator = new ProbabilityCalculator();
    hintEngine = new HintEngine();
    renderer = new GameRenderer(canvas);
    profileManager = new ProfileManager();
    profileManager.initialize('test-profile');
    adaptiveDifficultyManager = new AdaptiveDifficultyManager(profileManager);

    // Initialize error handling and performance monitoring
    ErrorHandler.getInstance();
    PerformanceMonitor.getInstance();
  });

  describe('Complete Game Workflow Integration', () => {
    it('should complete a full game workflow from start to finish', () => {
      // 1. Create a new game
      const difficulty = adaptiveDifficultyManager.getCurrentDifficulty();
      const board = gameLogic.createBoard(difficulty);
      
      expect(board).toBeDefined();
      expect(board.getGameState()).toBe(GameState.READY);
      expect(board.getWidth()).toBe(difficulty.width);
      expect(board.getHeight()).toBe(difficulty.height);
      expect(board.getMineCount()).toBe(difficulty.mineCount);

      // 2. Calculate initial probabilities
      const probabilities = probabilityCalculator.calculateProbabilities(board);
      expect(probabilities).toBeDefined();
      expect(probabilities.cellProbabilities).toBeDefined();
      expect(probabilities.lastUpdated).toBeInstanceOf(Date);

      // 3. Render the initial game state
      expect(() => renderer.render(board, probabilities)).not.toThrow();

      // 4. Make a move to start the game
      const success = gameLogic.makeMove(board, 0, 0, 'reveal');
      expect(success).toBe(true);
      expect(board.getGameState()).toBe(GameState.PLAYING);

      // 5. Recalculate probabilities after move
      const updatedProbabilities = probabilityCalculator.calculateProbabilities(board);
      expect(updatedProbabilities.lastUpdated.getTime()).toBeGreaterThan(probabilities.lastUpdated.getTime());

      // 6. Generate a hint
      const hint = hintEngine.generateHint(board, updatedProbabilities);
      if (hint) {
        expect(hint.cell).toBeDefined();
        expect(hint.action).toMatch(/^(reveal|flag)$/);
        expect(hint.confidence).toBeGreaterThanOrEqual(0);
        expect(hint.confidence).toBeLessThanOrEqual(1);
        expect(hint.reasoning).toBeDefined();
      }

      // 7. Render updated state with hint
      if (hint) {
        expect(() => renderer.renderHint(hint)).not.toThrow();
      }
      expect(() => renderer.render(board, updatedProbabilities)).not.toThrow();
    });

    it('should handle game completion and difficulty adjustment', () => {
      // Create a small board for easier completion
      const smallDifficulty = {
        level: DifficultyLevel.BEGINNER,
        width: 3,
        height: 3,
        mineCount: 1
      };

      const board = gameLogic.createBoard(smallDifficulty);
      const initialDifficulty = adaptiveDifficultyManager.getCurrentDifficulty();

      // Simulate game completion
      const gameResult = {
        gameId: 'test-game-1',
        won: true,
        playTime: 30,
        hintsUsed: 1,
        difficulty: smallDifficulty.level,
        timestamp: new Date(),
        boardSize: { width: 3, height: 3 },
        mineCount: 1
      };

      // Process game result
      profileManager.recordGameResult(gameResult);
      const adjustment = adaptiveDifficultyManager.processGameResult(gameResult);

      // Verify the system processed the result
      expect(profileManager.getCurrentProfile().metrics.gamesPlayed).toBeGreaterThan(0);
      
      // Check if difficulty was adjusted (may or may not happen based on algorithm)
      const newDifficulty = adaptiveDifficultyManager.getCurrentDifficulty();
      expect(newDifficulty).toBeDefined();
    });
  });

  describe('Component Integration', () => {
    it('should integrate game logic with AI components seamlessly', () => {
      const board = gameLogic.createBoard({
        level: DifficultyLevel.BEGINNER,
        width: 9,
        height: 9,
        mineCount: 10
      });

      // Test game logic -> probability calculator integration
      const probabilities = probabilityCalculator.calculateProbabilities(board);
      expect(probabilities.cellProbabilities.size).toBeGreaterThanOrEqual(0);

      // Test probability calculator -> hint engine integration
      const hint = hintEngine.generateHint(board, probabilities);
      if (hint) {
        // Verify hint is valid for current board state
        const cell = board.getCell(hint.cell.x, hint.cell.y);
        expect(cell).toBeDefined();
        
        if (hint.action === 'reveal') {
          expect(cell.isRevealed).toBe(false);
        } else if (hint.action === 'flag') {
          expect(cell.isRevealed).toBe(false);
        }
      }

      // Test game logic -> adaptive difficulty integration
      gameLogic.makeMove(board, 0, 0, 'reveal');
      const gameState = board.getGameState();
      expect([GameState.PLAYING, GameState.WON, GameState.LOST]).toContain(gameState);
    });

    it('should integrate UI components with game state', () => {
      const board = gameLogic.createBoard({
        level: DifficultyLevel.BEGINNER,
        width: 5,
        height: 5,
        mineCount: 3
      });

      const probabilities = probabilityCalculator.calculateProbabilities(board);

      // Test renderer integration
      expect(() => renderer.render(board, probabilities)).not.toThrow();

      // Test screen coordinate conversion
      const cellCoords = renderer.screenToCell(50, 50);
      if (cellCoords) {
        expect(cellCoords.x).toBeGreaterThanOrEqual(0);
        expect(cellCoords.y).toBeGreaterThanOrEqual(0);
        expect(cellCoords.x).toBeLessThan(board.getWidth());
        expect(cellCoords.y).toBeLessThan(board.getHeight());
      }

      // Test responsive layout
      expect(() => renderer.adaptLayoutForScreen()).not.toThrow();
    });

    it('should integrate error handling across all components', () => {
      const errorHandler = ErrorHandler.getInstance();
      let errorsCaught = 0;

      errorHandler.addErrorListener(() => {
        errorsCaught++;
      });

      // Test error handling in game logic
      const board = gameLogic.createBoard({
        level: DifficultyLevel.BEGINNER,
        width: 5,
        height: 5,
        mineCount: 3
      });

      // Try invalid moves
      gameLogic.makeMove(board, -1, -1, 'reveal'); // Invalid coordinates
      gameLogic.makeMove(board, 100, 100, 'reveal'); // Out of bounds

      // Error handling should prevent crashes
      expect(() => probabilityCalculator.calculateProbabilities(board)).not.toThrow();
      expect(() => hintEngine.generateHint(board, { 
        cellProbabilities: new Map(), 
        lastUpdated: new Date(), 
        calculationMethod: 'exact' 
      })).not.toThrow();
    });

    it('should integrate performance monitoring across components', () => {
      const performanceMonitor = PerformanceMonitor.getInstance();
      
      // Create a larger board to trigger performance monitoring
      const board = gameLogic.createBoard({
        level: DifficultyLevel.EXPERT,
        width: 30,
        height: 16,
        mineCount: 99
      });

      // Perform operations that should be monitored
      const probabilities = probabilityCalculator.calculateProbabilities(board);
      const hint = hintEngine.generateHint(board, probabilities);
      renderer.render(board, probabilities);

      // Check that performance data is being collected
      const report = performanceMonitor.getPerformanceReport();
      expect(report).toBeDefined();
      expect(report.healthScore).toBeGreaterThanOrEqual(0);
      expect(report.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('UI Interaction Integration', () => {
    it('should handle complete user interaction workflows', () => {
      const board = gameLogic.createBoard({
        level: DifficultyLevel.BEGINNER,
        width: 9,
        height: 9,
        mineCount: 10
      });

      // Simulate mouse interaction workflow
      const probabilities = probabilityCalculator.calculateProbabilities(board);
      renderer.render(board, probabilities);

      // Test mouse move (hover)
      expect(() => renderer.handleMouseMove(100, 100, board, probabilities)).not.toThrow();

      // Test cell click simulation
      const cellCoords = renderer.screenToCell(100, 100);
      if (cellCoords) {
        const moveSuccess = gameLogic.makeMove(board, cellCoords.x, cellCoords.y, 'reveal');
        if (moveSuccess) {
          const updatedProbabilities = probabilityCalculator.calculateProbabilities(board);
          expect(() => renderer.render(board, updatedProbabilities)).not.toThrow();
        }
      }
    });

    it('should integrate accessibility features', () => {
      const board = gameLogic.createBoard({
        level: DifficultyLevel.BEGINNER,
        width: 5,
        height: 5,
        mineCount: 3
      });

      // Test accessibility mode integration
      expect(() => renderer.setHighContrastMode(true)).not.toThrow();
      expect(() => renderer.setColorBlindFriendlyMode(true)).not.toThrow();

      const probabilities = probabilityCalculator.calculateProbabilities(board);
      expect(() => renderer.render(board, probabilities)).not.toThrow();

      // Test keyboard navigation setup
      expect(() => renderer.focus()).not.toThrow();
    });
  });

  describe('Data Persistence Integration', () => {
    it('should integrate profile management with adaptive difficulty', () => {
      // Create a fresh profile manager for this test
      const testProfileManager = new ProfileManager();
      testProfileManager.initialize('integration-test-profile');
      const testAdaptiveDifficultyManager = new AdaptiveDifficultyManager(testProfileManager);
      
      const initialProfile = testProfileManager.getCurrentProfile();
      expect(initialProfile).toBeDefined();
      const initialGamesPlayed = initialProfile.metrics.gamesPlayed;

      // Simulate multiple games
      for (let i = 0; i < 3; i++) {
        const gameResult = {
          gameId: `test-game-${i}`,
          won: i % 2 === 0, // Alternate wins/losses
          playTime: 30 + i * 10,
          hintsUsed: i,
          difficulty: DifficultyLevel.BEGINNER,
          timestamp: new Date(),
          boardSize: { width: 9, height: 9 },
          mineCount: 10
        };

        testProfileManager.recordGameResult(gameResult);
        testAdaptiveDifficultyManager.processGameResult(gameResult);
      }

      const updatedProfile = testProfileManager.getCurrentProfile();
      expect(updatedProfile.metrics.gamesPlayed).toBe(initialGamesPlayed + 3);
      expect(updatedProfile.metrics.gamesPlayed).toBeGreaterThan(initialGamesPlayed);
    });
  });
});