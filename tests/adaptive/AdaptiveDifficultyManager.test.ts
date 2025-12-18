import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AdaptiveDifficultyManager } from '../../src/adaptive/AdaptiveDifficultyManager.js';
import { ProfileManager } from '../../src/adaptive/ProfileManager.js';
import { PlayerProfile, GameResult } from '../../src/adaptive/PlayerProfile.js';
import { DifficultyLevel } from '../../src/types/index.js';

describe('AdaptiveDifficultyManager', () => {
  let profileManager: ProfileManager;
  let difficultyManager: AdaptiveDifficultyManager;
  let profile: PlayerProfile;

  beforeEach(() => {
    profileManager = new ProfileManager(false); // Disable auto-save for tests
    profile = profileManager.initialize('test-player');
    difficultyManager = new AdaptiveDifficultyManager(profileManager);
  });

  describe('initialization', () => {
    it('should initialize with beginner difficulty by default', () => {
      const difficulty = difficultyManager.getCurrentDifficulty();
      expect(difficulty.level).toBe(DifficultyLevel.BEGINNER);
      expect(difficulty.width).toBe(9);
      expect(difficulty.height).toBe(9);
      expect(difficulty.mineCount).toBe(10);
    });

    it('should initialize with profile preferred difficulty', () => {
      profile.preferredDifficulty = DifficultyLevel.INTERMEDIATE;
      const newManager = new AdaptiveDifficultyManager(profileManager);
      const difficulty = newManager.getCurrentDifficulty();
      expect(difficulty.level).toBe(DifficultyLevel.INTERMEDIATE);
    });
  });

  describe('manual difficulty setting', () => {
    it('should allow manual difficulty override', () => {
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty);
      const current = difficultyManager.getCurrentDifficulty();
      
      expect(current.width).toBe(12);
      expect(current.height).toBe(12);
      expect(current.mineCount).toBe(20);
      expect(current.level).toBe(DifficultyLevel.CUSTOM);
    });
  });

  describe('difficulty adjustment', () => {
    it('should not adjust difficulty during cooldown period', () => {
      // Create a winning game result
      const gameResult: GameResult = {
        gameId: 'test-1',
        won: true,
        playTime: 60,
        hintsUsed: 1,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };

      // Record multiple wins to trigger adjustment
      for (let i = 0; i < 5; i++) {
        profile.recordGameResult({ ...gameResult, gameId: `test-${i}` });
      }

      // First adjustment should work
      const adjustment1 = difficultyManager.processGameResult(gameResult);
      expect(adjustment1).toBeTruthy();

      // Second adjustment should be blocked by cooldown
      const adjustment2 = difficultyManager.processGameResult(gameResult);
      expect(adjustment2).toBeNull();
    });

    it('should track adjustment history', () => {
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty);
      const history = difficultyManager.getAdjustmentHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0].reason).toBe('Manual override');
      expect(history[0].newDifficulty.width).toBe(12);
    });
  });

  describe('difficulty scaling', () => {
    it('should identify minimum difficulty correctly', () => {
      const minDifficulty = {
        width: 8,
        height: 8,
        mineCount: 5,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(minDifficulty);
      
      // Create losing games to trigger decrease attempt
      const gameResult: GameResult = {
        gameId: 'test-loss',
        won: false,
        playTime: 30,
        hintsUsed: 0,
        difficulty: DifficultyLevel.CUSTOM,
        timestamp: new Date(),
        boardSize: { width: 8, height: 8 },
        mineCount: 5
      };

      // Record losses to trigger decrease
      for (let i = 0; i < 5; i++) {
        profile.recordGameResult({ ...gameResult, gameId: `loss-${i}` });
      }

      // Should not decrease further when at minimum
      const adjustment = difficultyManager.processGameResult(gameResult);
      expect(adjustment).toBeNull();
    });

    it('should identify maximum difficulty correctly', () => {
      const maxDifficulty = {
        width: 30,
        height: 20,
        mineCount: 150, // 25% of 600 cells
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(maxDifficulty);
      
      // Create winning games to trigger increase attempt
      const gameResult: GameResult = {
        gameId: 'test-win',
        won: true,
        playTime: 300,
        hintsUsed: 1,
        difficulty: DifficultyLevel.CUSTOM,
        timestamp: new Date(),
        boardSize: { width: 30, height: 20 },
        mineCount: 150
      };

      // Record wins to trigger increase
      for (let i = 0; i < 5; i++) {
        profile.recordGameResult({ ...gameResult, gameId: `win-${i}` });
      }

      // Should not increase further when at maximum
      const adjustment = difficultyManager.processGameResult(gameResult);
      expect(adjustment).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        successStreakThreshold: 5,
        failureStreakThreshold: 2,
        enableNotifications: false
      };

      difficultyManager.updateConfig(newConfig);
      const config = difficultyManager.getConfig();
      
      expect(config.successStreakThreshold).toBe(5);
      expect(config.failureStreakThreshold).toBe(2);
      expect(config.enableNotifications).toBe(false);
    });

    it('should provide difficulty presets', () => {
      const beginnerPreset = AdaptiveDifficultyManager.getDifficultyPreset(DifficultyLevel.BEGINNER);
      expect(beginnerPreset.width).toBe(9);
      expect(beginnerPreset.height).toBe(9);
      expect(beginnerPreset.mineCount).toBe(10);

      const expertPreset = AdaptiveDifficultyManager.getDifficultyPreset(DifficultyLevel.EXPERT);
      expect(expertPreset.width).toBe(30);
      expect(expertPreset.height).toBe(16);
      expect(expertPreset.mineCount).toBe(99);
    });
  });

  describe('cooldown management', () => {
    it('should calculate time until next adjustment', () => {
      // Initially should be 0 (no previous adjustment)
      expect(difficultyManager.getTimeUntilNextAdjustment()).toBe(0);

      // After manual adjustment, should have cooldown
      difficultyManager.setDifficulty({
        width: 10,
        height: 10,
        mineCount: 15,
        level: DifficultyLevel.CUSTOM
      });

      const timeUntilNext = difficultyManager.getTimeUntilNextAdjustment();
      expect(timeUntilNext).toBeGreaterThan(0);
    });
  });

  describe('notification system', () => {
    it('should create notifications for automatic difficulty changes', () => {
      // Enable notifications
      difficultyManager.updateConfig({ enableNotifications: true, adjustmentCooldown: 0 });
      
      // Create winning games to trigger increase
      const gameResult: GameResult = {
        gameId: 'test-win',
        won: true,
        playTime: 60,
        hintsUsed: 1,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };

      // Build up win streak
      for (let i = 0; i < 5; i++) {
        profile.recordGameResult({ ...gameResult, gameId: `win-${i}` });
      }

      const adjustment = difficultyManager.processGameResult(gameResult);
      
      if (adjustment) {
        const notifications = difficultyManager.getUnacknowledgedNotifications();
        expect(notifications.length).toBeGreaterThan(0);
        
        const notification = notifications[0];
        expect(notification.type).toBe('increase');
        expect(notification.message).toContain('Difficulty increased');
        expect(notification.acknowledged).toBe(false);
      }
    });

    it('should create notifications for manual difficulty changes', () => {
      difficultyManager.updateConfig({ enableNotifications: true });
      
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty);
      
      const notifications = difficultyManager.getUnacknowledgedNotifications();
      expect(notifications.length).toBe(1);
      
      const notification = notifications[0];
      expect(notification.type).toBe('manual_override');
      expect(notification.message).toContain('manually set');
      expect(notification.acknowledged).toBe(false);
    });

    it('should allow acknowledging notifications', () => {
      difficultyManager.updateConfig({ enableNotifications: true });
      
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty);
      
      const notifications = difficultyManager.getUnacknowledgedNotifications();
      expect(notifications.length).toBe(1);
      
      const notificationId = notifications[0].id;
      const acknowledged = difficultyManager.acknowledgeNotification(notificationId);
      expect(acknowledged).toBe(true);
      
      const unacknowledged = difficultyManager.getUnacknowledgedNotifications();
      expect(unacknowledged.length).toBe(0);
    });

    it('should allow acknowledging all notifications', () => {
      difficultyManager.updateConfig({ enableNotifications: true });
      
      // Create multiple notifications
      difficultyManager.setDifficulty({
        width: 10, height: 10, mineCount: 15, level: DifficultyLevel.CUSTOM
      });
      difficultyManager.setDifficulty({
        width: 12, height: 12, mineCount: 20, level: DifficultyLevel.CUSTOM
      });
      
      expect(difficultyManager.getUnacknowledgedNotifications().length).toBe(2);
      
      difficultyManager.acknowledgeAllNotifications();
      expect(difficultyManager.getUnacknowledgedNotifications().length).toBe(0);
    });

    it('should not create notifications when disabled', () => {
      difficultyManager.updateConfig({ enableNotifications: false });
      
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty);
      
      const notifications = difficultyManager.getUnacknowledgedNotifications();
      expect(notifications.length).toBe(0);
    });
  });

  describe('manual override baseline', () => {
    it('should set manual override baseline when manually setting difficulty', () => {
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty, true);
      
      expect(difficultyManager.hasManualOverrideBaseline()).toBe(true);
      
      const baseline = difficultyManager.getManualOverrideBaseline();
      expect(baseline).toEqual(customDifficulty);
    });

    it('should not set baseline when setAsBaseline is false', () => {
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty, false);
      
      expect(difficultyManager.hasManualOverrideBaseline()).toBe(false);
      expect(difficultyManager.getManualOverrideBaseline()).toBeNull();
    });

    it('should allow clearing manual override baseline', () => {
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      difficultyManager.setDifficulty(customDifficulty);
      expect(difficultyManager.hasManualOverrideBaseline()).toBe(true);
      
      difficultyManager.clearManualOverrideBaseline();
      expect(difficultyManager.hasManualOverrideBaseline()).toBe(false);
    });

    it('should reset to manual baseline when available', () => {
      const customDifficulty = {
        width: 12,
        height: 12,
        mineCount: 20,
        level: DifficultyLevel.CUSTOM
      };

      // Set manual baseline
      difficultyManager.setDifficulty(customDifficulty);
      
      // Change difficulty without setting as baseline
      difficultyManager.setDifficulty({
        width: 15, height: 15, mineCount: 30, level: DifficultyLevel.CUSTOM
      }, false);
      
      // Reset should go back to manual baseline
      difficultyManager.resetToBaseline();
      
      const current = difficultyManager.getCurrentDifficulty();
      expect(current.width).toBe(12);
      expect(current.height).toBe(12);
      expect(current.mineCount).toBe(20);
    });
  });

  describe('difficulty history and statistics', () => {
    it('should track difficulty history with filtering', () => {
      // Make some manual adjustments
      difficultyManager.setDifficulty({
        width: 10, height: 10, mineCount: 15, level: DifficultyLevel.CUSTOM
      });
      difficultyManager.setDifficulty({
        width: 12, height: 12, mineCount: 20, level: DifficultyLevel.CUSTOM
      });
      
      const allHistory = difficultyManager.getDifficultyHistory();
      expect(allHistory.length).toBe(2);
      
      const manualOnly = difficultyManager.getDifficultyHistory({ includeAutomatic: false });
      expect(manualOnly.length).toBe(2);
      expect(manualOnly.every(adj => adj.isManual)).toBe(true);
      
      const limited = difficultyManager.getDifficultyHistory({ limit: 1 });
      expect(limited.length).toBe(1);
    });

    it('should provide difficulty statistics', () => {
      // Get initial difficulty to compare against
      const initialDifficulty = difficultyManager.getCurrentDifficulty();
      
      // Make some adjustments
      difficultyManager.setDifficulty({
        width: 10, height: 10, mineCount: 15, level: DifficultyLevel.CUSTOM
      });
      difficultyManager.setDifficulty({
        width: 12, height: 12, mineCount: 20, level: DifficultyLevel.CUSTOM
      });
      
      const stats = difficultyManager.getDifficultyStatistics();
      expect(stats.totalAdjustments).toBe(2);
      expect(stats.manualAdjustments).toBe(2);
      expect(stats.automaticAdjustments).toBe(0);
      expect(stats.increases).toBeGreaterThanOrEqual(1); // At least one increase
      expect(stats.currentBaseline).not.toBeNull();
    });

    it('should filter history by date', () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      
      difficultyManager.setDifficulty({
        width: 10, height: 10, mineCount: 15, level: DifficultyLevel.CUSTOM
      });
      
      difficultyManager.setDifficulty({
        width: 12, height: 12, mineCount: 20, level: DifficultyLevel.CUSTOM
      });
      
      const recentHistory = difficultyManager.getDifficultyHistory({ since: pastDate });
      expect(recentHistory.length).toBe(2);
      
      // Filter with a future date should return nothing
      const futureDate = new Date(Date.now() + 60000);
      const futureHistory = difficultyManager.getDifficultyHistory({ since: futureDate });
      expect(futureHistory.length).toBe(0);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: ai-minesweeper, Property 11: Success-based difficulty increase**
     * 
     * For any sequence of successful games above a threshold, the adaptive difficulty system should increase mine density or board size parameters
     * **Validates: Requirements 3.1**
     */
    it('Property 11: Success-based difficulty increase', () => {
      fc.assert(
        fc.property(
          // Generate initial difficulty settings
          fc.record({
            width: fc.integer({ min: 8, max: 25 }),
            height: fc.integer({ min: 8, max: 18 }),
            mineCount: fc.integer({ min: 5, max: 80 }),
            level: fc.constantFrom(
              DifficultyLevel.BEGINNER,
              DifficultyLevel.INTERMEDIATE,
              DifficultyLevel.EXPERT,
              DifficultyLevel.CUSTOM
            )
          }),
          // Generate number of successful games (above threshold)
          fc.integer({ min: 3, max: 10 }),
          // Generate player performance data
          fc.record({
            winRate: fc.float({ min: 70, max: 95 }), // High win rate to trigger increase
            playTime: fc.integer({ min: 30, max: 300 }),
            hintsUsed: fc.integer({ min: 0, max: 5 })
          }),
          
          (initialDifficulty, successCount, performanceData) => {
            // Ensure mine count is reasonable for board size
            const totalCells = initialDifficulty.width * initialDifficulty.height;
            const maxReasonableMines = Math.floor(totalCells * 0.2);
            const adjustedMineCount = Math.min(initialDifficulty.mineCount, maxReasonableMines);
            
            const adjustedDifficulty = {
              ...initialDifficulty,
              mineCount: adjustedMineCount
            };
            
            // Create a fresh profile manager and difficulty manager
            const profileManager = new ProfileManager(false);
            const profile = profileManager.initialize('test-player');
            const difficultyManager = new AdaptiveDifficultyManager(profileManager);
            
            // Set initial difficulty
            difficultyManager.setDifficulty(adjustedDifficulty);
            const initialSettings = difficultyManager.getCurrentDifficulty();
            
            // Build up win rate ensuring both overall and recent performance are strong
            // We need recent trend to also be >= 70%, so we'll structure the games carefully
            
            // First add some losses (older games) if needed to reach the target overall win rate
            const totalGames = 15; // Use more games for better statistics
            const targetWins = Math.floor((performanceData.winRate / 100) * totalGames);
            const recentWins = Math.min(5, targetWins); // Ensure recent 5 games have high win rate
            const olderGames = totalGames - 5;
            const olderWins = targetWins - recentWins;
            
            // Add older games (losses first, then some wins)
            for (let i = 0; i < olderGames; i++) {
              const gameResult: GameResult = {
                gameId: `older-${i}`,
                won: i < olderWins,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(Date.now() - (olderGames + 5 - i) * 60000),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Add recent games (mostly wins to ensure good recent trend)
            for (let i = 0; i < 5; i++) {
              const gameResult: GameResult = {
                gameId: `recent-${i}`,
                won: i < recentWins, // Most recent games are wins
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(Date.now() - (5 - i) * 30000),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Clear the cooldown from the initial setDifficulty call
            // by waiting or resetting the last adjustment time
            // We need to bypass the cooldown for testing purposes
            const config = difficultyManager.getConfig();
            difficultyManager.updateConfig({ adjustmentCooldown: 0 });
            
            // Now simulate the success streak
            let lastAdjustment = null;
            for (let i = 0; i < successCount; i++) {
              const gameResult: GameResult = {
                gameId: `success-${i}`,
                won: true,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              
              profile.recordGameResult(gameResult);
              lastAdjustment = difficultyManager.processGameResult(gameResult);
              
              // If we got an adjustment, break to avoid processing more
              if (lastAdjustment) {
                break;
              }
            }
            
            // Restore original cooldown config
            difficultyManager.updateConfig({ adjustmentCooldown: config.adjustmentCooldown });
            
            const finalSettings = difficultyManager.getCurrentDifficulty();
            
            // Check if we're at maximum difficulty (should not increase further)
            const isAtMaxDifficulty = initialSettings.width >= 30 && 
                                    initialSettings.height >= 20 && 
                                    initialSettings.mineCount >= Math.floor(totalCells * 0.25);
            
            if (isAtMaxDifficulty) {
              // If already at max, no adjustment should occur
              expect(lastAdjustment).toBeNull();
              expect(finalSettings.width).toBe(initialSettings.width);
              expect(finalSettings.height).toBe(initialSettings.height);
              expect(finalSettings.mineCount).toBe(initialSettings.mineCount);
            } else {
              // If not at max and we have sufficient success streak with good win rate,
              // difficulty should increase
              const currentStreak = profile.metrics.currentStreak;
              const currentWinRate = profile.winRate;
              
              if (currentStreak >= 3 && currentWinRate >= 70) {
                // Should have triggered an increase
                expect(lastAdjustment).not.toBeNull();
                expect(lastAdjustment!.reason).toContain('Success streak');
                
                // Difficulty should have increased (either mine count or board size)
                const difficultyIncreased = 
                  finalSettings.mineCount > initialSettings.mineCount ||
                  finalSettings.width > initialSettings.width ||
                  finalSettings.height > initialSettings.height;
                
                expect(difficultyIncreased).toBe(true);
                
                // The increase should be reasonable (not too drastic)
                expect(finalSettings.width).toBeLessThanOrEqual(initialSettings.width + 4);
                expect(finalSettings.height).toBeLessThanOrEqual(initialSettings.height + 4);
                expect(finalSettings.mineCount).toBeLessThanOrEqual(initialSettings.mineCount * 1.5);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 12: Failure-based difficulty decrease**
     * 
     * For any sequence of consecutive game failures above a threshold, the adaptive difficulty system should reduce difficulty parameters
     * **Validates: Requirements 3.2**
     */
    it('Property 12: Failure-based difficulty decrease', () => {
      fc.assert(
        fc.property(
          // Generate initial difficulty settings (not at minimum)
          fc.record({
            width: fc.integer({ min: 10, max: 30 }),
            height: fc.integer({ min: 10, max: 20 }),
            mineCount: fc.integer({ min: 15, max: 120 }),
            level: fc.constantFrom(
              DifficultyLevel.INTERMEDIATE,
              DifficultyLevel.EXPERT,
              DifficultyLevel.CUSTOM
            )
          }),
          // Generate number of consecutive failures (above threshold)
          fc.integer({ min: 3, max: 8 }),
          // Generate player performance data (poor performance)
          fc.record({
            winRate: fc.float({ min: 5, max: 25 }), // Low win rate to trigger decrease
            playTime: fc.integer({ min: 15, max: 120 }), // Shorter times (quick losses)
            hintsUsed: fc.integer({ min: 0, max: 3 })
          }),
          
          (initialDifficulty, failureCount, performanceData) => {
            // Ensure mine count is reasonable for board size
            const totalCells = initialDifficulty.width * initialDifficulty.height;
            const maxReasonableMines = Math.floor(totalCells * 0.2);
            const minReasonableMines = Math.max(15, Math.floor(totalCells * 0.05));
            const adjustedMineCount = Math.min(maxReasonableMines, Math.max(minReasonableMines, initialDifficulty.mineCount));
            
            const adjustedDifficulty = {
              ...initialDifficulty,
              mineCount: adjustedMineCount
            };
            
            // Create a fresh profile manager and difficulty manager
            const profileManager = new ProfileManager(false);
            const profile = profileManager.initialize('test-player');
            const difficultyManager = new AdaptiveDifficultyManager(profileManager);
            
            // Set initial difficulty (ensure it's not at minimum)
            difficultyManager.setDifficulty(adjustedDifficulty);
            const initialSettings = difficultyManager.getCurrentDifficulty();
            
            // Build up poor win rate ensuring both overall and recent performance are poor
            const totalGames = 15; // Use more games for better statistics
            const targetWins = Math.floor((performanceData.winRate / 100) * totalGames);
            const recentLosses = Math.min(5, totalGames - targetWins); // Ensure recent 5 games have low win rate
            const olderGames = totalGames - 5;
            const olderWins = Math.max(0, targetWins - (5 - recentLosses));
            
            // Add older games (mix of wins and losses to reach target win rate)
            for (let i = 0; i < olderGames; i++) {
              const gameResult: GameResult = {
                gameId: `older-${i}`,
                won: i < olderWins,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(Date.now() - (olderGames + 5 - i) * 60000),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Add recent games (mostly losses to ensure poor recent trend)
            for (let i = 0; i < 5; i++) {
              const gameResult: GameResult = {
                gameId: `recent-${i}`,
                won: i >= recentLosses, // Most recent games are losses
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(Date.now() - (5 - i) * 30000),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Clear the cooldown from the initial setDifficulty call
            const config = difficultyManager.getConfig();
            difficultyManager.updateConfig({ adjustmentCooldown: 0 });
            
            // Now simulate the failure streak
            let lastAdjustment = null;
            for (let i = 0; i < failureCount; i++) {
              const gameResult: GameResult = {
                gameId: `failure-${i}`,
                won: false,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              
              profile.recordGameResult(gameResult);
              lastAdjustment = difficultyManager.processGameResult(gameResult);
              
              // If we got an adjustment, break to avoid processing more
              if (lastAdjustment) {
                break;
              }
            }
            
            // Restore original cooldown config
            difficultyManager.updateConfig({ adjustmentCooldown: config.adjustmentCooldown });
            
            const finalSettings = difficultyManager.getCurrentDifficulty();
            
            // Check if we're at minimum difficulty (should not decrease further)
            const isAtMinDifficulty = initialSettings.width <= 8 && 
                                    initialSettings.height <= 8 && 
                                    initialSettings.mineCount <= 5;
            
            if (isAtMinDifficulty) {
              // If already at min, no adjustment should occur
              expect(lastAdjustment).toBeNull();
              expect(finalSettings.width).toBe(initialSettings.width);
              expect(finalSettings.height).toBe(initialSettings.height);
              expect(finalSettings.mineCount).toBe(initialSettings.mineCount);
            } else {
              // If not at min and we have sufficient failure streak with poor win rate,
              // difficulty should decrease
              const currentStreak = profile.metrics.currentStreak;
              const currentWinRate = profile.winRate;
              
              if (currentStreak <= -3 && currentWinRate <= 30) {
                // Should have triggered a decrease
                expect(lastAdjustment).not.toBeNull();
                expect(lastAdjustment!.reason).toContain('Failure streak');
                
                // Difficulty should have decreased (either mine count or board size)
                const difficultyDecreased = 
                  finalSettings.mineCount < initialSettings.mineCount ||
                  finalSettings.width < initialSettings.width ||
                  finalSettings.height < initialSettings.height;
                
                expect(difficultyDecreased).toBe(true);
                
                // The decrease should be reasonable (not too drastic)
                expect(finalSettings.width).toBeGreaterThanOrEqual(Math.max(8, initialSettings.width - 4));
                expect(finalSettings.height).toBeGreaterThanOrEqual(Math.max(8, initialSettings.height - 4));
                expect(finalSettings.mineCount).toBeGreaterThanOrEqual(Math.max(5, Math.floor(initialSettings.mineCount * 0.7)));
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 14: Difficulty change notification**
     * 
     * For any automatic difficulty adjustment, the system should display a notification informing the player of the change
     * **Validates: Requirements 3.4**
     */
    it('Property 14: Difficulty change notification', () => {
      fc.assert(
        fc.property(
          // Generate initial difficulty settings
          fc.record({
            width: fc.integer({ min: 9, max: 25 }),
            height: fc.integer({ min: 9, max: 18 }),
            mineCount: fc.integer({ min: 10, max: 80 }),
            level: fc.constantFrom(
              DifficultyLevel.BEGINNER,
              DifficultyLevel.INTERMEDIATE,
              DifficultyLevel.EXPERT,
              DifficultyLevel.CUSTOM
            )
          }),
          // Generate adjustment trigger type (success or failure)
          fc.constantFrom('success', 'failure'),
          // Generate performance data that will trigger adjustment
          fc.record({
            streakLength: fc.integer({ min: 3, max: 8 }),
            playTime: fc.integer({ min: 30, max: 300 }),
            hintsUsed: fc.integer({ min: 0, max: 5 })
          }),
          
          (initialDifficulty, adjustmentType, performanceData) => {
            // Ensure mine count is reasonable for board size
            const totalCells = initialDifficulty.width * initialDifficulty.height;
            const maxReasonableMines = Math.floor(totalCells * 0.2);
            const minReasonableMines = Math.max(8, Math.floor(totalCells * 0.05));
            const adjustedMineCount = Math.min(maxReasonableMines, Math.max(minReasonableMines, initialDifficulty.mineCount));
            
            const adjustedDifficulty = {
              ...initialDifficulty,
              mineCount: adjustedMineCount
            };
            
            // Create a fresh profile manager and difficulty manager
            const profileManager = new ProfileManager(false);
            const profile = profileManager.initialize('test-player');
            const difficultyManager = new AdaptiveDifficultyManager(profileManager);
            
            // Enable notifications and disable cooldown for testing
            difficultyManager.updateConfig({ 
              enableNotifications: true, 
              adjustmentCooldown: 0 
            });
            
            // Set initial difficulty
            difficultyManager.setDifficulty(adjustedDifficulty);
            const initialSettings = difficultyManager.getCurrentDifficulty();
            
            // Clear any notifications from the manual difficulty setting
            difficultyManager.clearNotifications();
            
            // Check if we're at boundary conditions
            const isAtMaxDifficulty = initialSettings.width >= 30 && 
                                    initialSettings.height >= 20 && 
                                    initialSettings.mineCount >= Math.floor(totalCells * 0.25);
            const isAtMinDifficulty = initialSettings.width <= 8 && 
                                    initialSettings.height <= 8 && 
                                    initialSettings.mineCount <= 5;
            
            // Skip test if we're at boundaries and trying to adjust in that direction
            if ((adjustmentType === 'success' && isAtMaxDifficulty) ||
                (adjustmentType === 'failure' && isAtMinDifficulty)) {
              return true; // Skip this test case
            }
            
            // Build up performance history to trigger adjustment
            const totalGames = 15;
            let targetWinRate: number;
            let recentWinRate: number;
            
            if (adjustmentType === 'success') {
              targetWinRate = 80; // High win rate for success-based increase
              recentWinRate = 80;
            } else {
              targetWinRate = 20; // Low win rate for failure-based decrease
              recentWinRate = 20;
            }
            
            const targetWins = Math.floor((targetWinRate / 100) * totalGames);
            const recentWins = Math.floor((recentWinRate / 100) * 5);
            const olderGames = totalGames - 5;
            const olderWins = targetWins - recentWins;
            
            // Add older games
            for (let i = 0; i < olderGames; i++) {
              const gameResult: GameResult = {
                gameId: `older-${i}`,
                won: i < olderWins,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(Date.now() - (olderGames + 5 - i) * 60000),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Add recent games to establish trend
            for (let i = 0; i < 5; i++) {
              const gameResult: GameResult = {
                gameId: `recent-${i}`,
                won: i < recentWins,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(Date.now() - (5 - i) * 30000),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Get initial notification count
            const initialNotificationCount = difficultyManager.getAllNotifications().length;
            
            // Trigger the adjustment with a streak of games
            let adjustment = null;
            for (let i = 0; i < performanceData.streakLength; i++) {
              const gameResult: GameResult = {
                gameId: `trigger-${i}`,
                won: adjustmentType === 'success',
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedDifficulty.level,
                timestamp: new Date(),
                boardSize: { width: adjustedDifficulty.width, height: adjustedDifficulty.height },
                mineCount: adjustedDifficulty.mineCount
              };
              
              profile.recordGameResult(gameResult);
              adjustment = difficultyManager.processGameResult(gameResult);
              
              // If we got an adjustment, break
              if (adjustment) {
                break;
              }
            }
            
            const finalNotificationCount = difficultyManager.getAllNotifications().length;
            const notifications = difficultyManager.getUnacknowledgedNotifications();
            
            if (adjustment) {
              // If an automatic adjustment occurred, there should be a notification
              expect(finalNotificationCount).toBeGreaterThan(initialNotificationCount);
              expect(notifications.length).toBeGreaterThan(0);
              
              // Find the notification related to this adjustment
              const adjustmentNotification = notifications.find(n => 
                n.type === (adjustmentType === 'success' ? 'increase' : 'decrease')
              );
              
              expect(adjustmentNotification).toBeDefined();
              expect(adjustmentNotification!.message).toContain('Difficulty');
              expect(adjustmentNotification!.acknowledged).toBe(false);
              expect(adjustmentNotification!.adjustment).toEqual(adjustment);
              
              // Verify the notification type matches the adjustment
              if (adjustmentType === 'success') {
                expect(adjustmentNotification!.type).toBe('increase');
                expect(adjustmentNotification!.message).toContain('increased');
              } else {
                expect(adjustmentNotification!.type).toBe('decrease');
                expect(adjustmentNotification!.message).toContain('decreased');
              }
            } else {
              // If no adjustment occurred, notification count should remain the same
              expect(finalNotificationCount).toBe(initialNotificationCount);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 15: Manual difficulty override**
     * 
     * For any manually selected difficulty setting, the adaptive system should use that as the new baseline for future adjustments
     * **Validates: Requirements 3.5**
     */
    it('Property 15: Manual difficulty override', () => {
      fc.assert(
        fc.property(
          // Generate initial difficulty settings
          fc.record({
            width: fc.integer({ min: 9, max: 25 }),
            height: fc.integer({ min: 9, max: 18 }),
            mineCount: fc.integer({ min: 10, max: 80 }),
            level: fc.constantFrom(
              DifficultyLevel.BEGINNER,
              DifficultyLevel.INTERMEDIATE,
              DifficultyLevel.EXPERT,
              DifficultyLevel.CUSTOM
            )
          }),
          // Generate manual override difficulty settings (different from initial)
          fc.record({
            width: fc.integer({ min: 8, max: 30 }),
            height: fc.integer({ min: 8, max: 20 }),
            mineCount: fc.integer({ min: 5, max: 120 }),
            level: fc.constantFrom(
              DifficultyLevel.BEGINNER,
              DifficultyLevel.INTERMEDIATE,
              DifficultyLevel.EXPERT,
              DifficultyLevel.CUSTOM
            )
          }),
          // Generate performance data that would trigger automatic adjustment
          fc.record({
            adjustmentType: fc.constantFrom('success', 'failure'),
            streakLength: fc.integer({ min: 3, max: 8 }),
            playTime: fc.integer({ min: 30, max: 300 }),
            hintsUsed: fc.integer({ min: 0, max: 5 })
          }),
          
          (initialDifficulty, manualDifficulty, performanceData) => {
            // Ensure mine counts are reasonable for board sizes
            const initialTotalCells = initialDifficulty.width * initialDifficulty.height;
            const manualTotalCells = manualDifficulty.width * manualDifficulty.height;
            
            const adjustedInitialDifficulty = {
              ...initialDifficulty,
              mineCount: Math.min(
                Math.floor(initialTotalCells * 0.2),
                Math.max(5, initialDifficulty.mineCount)
              )
            };
            
            const adjustedManualDifficulty = {
              ...manualDifficulty,
              mineCount: Math.min(
                Math.floor(manualTotalCells * 0.2),
                Math.max(5, manualDifficulty.mineCount)
              )
            };
            
            // Skip if manual difficulty is the same as initial (no override to test)
            if (adjustedInitialDifficulty.width === adjustedManualDifficulty.width &&
                adjustedInitialDifficulty.height === adjustedManualDifficulty.height &&
                adjustedInitialDifficulty.mineCount === adjustedManualDifficulty.mineCount) {
              return true; // Skip this test case
            }
            
            // Create a fresh profile manager and difficulty manager
            const profileManager = new ProfileManager(false);
            const profile = profileManager.initialize('test-player');
            const difficultyManager = new AdaptiveDifficultyManager(profileManager);
            
            // Set initial difficulty
            difficultyManager.setDifficulty(adjustedInitialDifficulty);
            
            // Manually override the difficulty (this should become the new baseline)
            difficultyManager.setDifficulty(adjustedManualDifficulty, true);
            
            // Verify the manual override was applied
            const currentDifficulty = difficultyManager.getCurrentDifficulty();
            expect(currentDifficulty.width).toBe(adjustedManualDifficulty.width);
            expect(currentDifficulty.height).toBe(adjustedManualDifficulty.height);
            expect(currentDifficulty.mineCount).toBe(adjustedManualDifficulty.mineCount);
            
            // Verify the manual override baseline was set
            expect(difficultyManager.hasManualOverrideBaseline()).toBe(true);
            const baseline = difficultyManager.getManualOverrideBaseline();
            expect(baseline).not.toBeNull();
            expect(baseline!.width).toBe(adjustedManualDifficulty.width);
            expect(baseline!.height).toBe(adjustedManualDifficulty.height);
            expect(baseline!.mineCount).toBe(adjustedManualDifficulty.mineCount);
            
            // Build up performance history to trigger automatic adjustment
            const totalGames = 15;
            let targetWinRate: number;
            let recentWinRate: number;
            
            if (performanceData.adjustmentType === 'success') {
              targetWinRate = 80; // High win rate for success-based increase
              recentWinRate = 80;
            } else {
              targetWinRate = 20; // Low win rate for failure-based decrease
              recentWinRate = 20;
            }
            
            const targetWins = Math.floor((targetWinRate / 100) * totalGames);
            const recentWins = Math.floor((recentWinRate / 100) * 5);
            const olderGames = totalGames - 5;
            const olderWins = targetWins - recentWins;
            
            // Add older games to establish overall performance
            for (let i = 0; i < olderGames; i++) {
              const gameResult: GameResult = {
                gameId: `older-${i}`,
                won: i < olderWins,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedManualDifficulty.level,
                timestamp: new Date(Date.now() - (olderGames + 5 - i) * 60000),
                boardSize: { width: adjustedManualDifficulty.width, height: adjustedManualDifficulty.height },
                mineCount: adjustedManualDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Add recent games to establish trend
            for (let i = 0; i < 5; i++) {
              const gameResult: GameResult = {
                gameId: `recent-${i}`,
                won: i < recentWins,
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedManualDifficulty.level,
                timestamp: new Date(Date.now() - (5 - i) * 30000),
                boardSize: { width: adjustedManualDifficulty.width, height: adjustedManualDifficulty.height },
                mineCount: adjustedManualDifficulty.mineCount
              };
              profile.recordGameResult(gameResult);
            }
            
            // Clear cooldown for testing
            const config = difficultyManager.getConfig();
            difficultyManager.updateConfig({ adjustmentCooldown: 0 });
            
            // Trigger automatic adjustment by creating a performance streak
            let automaticAdjustment = null;
            for (let i = 0; i < performanceData.streakLength; i++) {
              const gameResult: GameResult = {
                gameId: `trigger-${i}`,
                won: performanceData.adjustmentType === 'success',
                playTime: performanceData.playTime,
                hintsUsed: performanceData.hintsUsed,
                difficulty: adjustedManualDifficulty.level,
                timestamp: new Date(),
                boardSize: { width: adjustedManualDifficulty.width, height: adjustedManualDifficulty.height },
                mineCount: adjustedManualDifficulty.mineCount
              };
              
              profile.recordGameResult(gameResult);
              automaticAdjustment = difficultyManager.processGameResult(gameResult);
              
              // If we got an adjustment, break
              if (automaticAdjustment) {
                break;
              }
            }
            
            // Restore original cooldown config
            difficultyManager.updateConfig({ adjustmentCooldown: config.adjustmentCooldown });
            
            // Check if automatic adjustment occurred
            if (automaticAdjustment) {
              // Verify that the automatic adjustment was relative to the manual baseline
              // The adjustment should have started from the manual override difficulty, not the original
              expect(automaticAdjustment.previousDifficulty.width).toBe(adjustedManualDifficulty.width);
              expect(automaticAdjustment.previousDifficulty.height).toBe(adjustedManualDifficulty.height);
              expect(automaticAdjustment.previousDifficulty.mineCount).toBe(adjustedManualDifficulty.mineCount);
              
              // The adjustment should be marked as automatic (not manual)
              expect(automaticAdjustment.isManual).toBe(false);
              
              // The new difficulty should be different from the manual baseline
              const newDifficulty = difficultyManager.getCurrentDifficulty();
              const difficultyChanged = 
                newDifficulty.width !== adjustedManualDifficulty.width ||
                newDifficulty.height !== adjustedManualDifficulty.height ||
                newDifficulty.mineCount !== adjustedManualDifficulty.mineCount;
              
              expect(difficultyChanged).toBe(true);
              
              // The manual baseline should still be preserved
              expect(difficultyManager.hasManualOverrideBaseline()).toBe(true);
              const preservedBaseline = difficultyManager.getManualOverrideBaseline();
              expect(preservedBaseline!.width).toBe(adjustedManualDifficulty.width);
              expect(preservedBaseline!.height).toBe(adjustedManualDifficulty.height);
              expect(preservedBaseline!.mineCount).toBe(adjustedManualDifficulty.mineCount);
            }
            
            // Test reset to baseline functionality
            difficultyManager.resetToBaseline();
            const resetDifficulty = difficultyManager.getCurrentDifficulty();
            
            // After reset, should return to the manual override baseline
            expect(resetDifficulty.width).toBe(adjustedManualDifficulty.width);
            expect(resetDifficulty.height).toBe(adjustedManualDifficulty.height);
            expect(resetDifficulty.mineCount).toBe(adjustedManualDifficulty.mineCount);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});