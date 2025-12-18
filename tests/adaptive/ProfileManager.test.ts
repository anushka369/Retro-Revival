import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ProfileManager } from '../../src/adaptive/ProfileManager.js';
import { PlayerProfile, GameResult } from '../../src/adaptive/PlayerProfile.js';
import { DifficultyLevel } from '../../src/types/index.js';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    get length() {
      return Object.keys(store).length;
    }
  };
})();

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('ProfileManager', () => {
  let manager: ProfileManager;

  beforeEach(() => {
    localStorageMock.clear();
    manager = new ProfileManager(true); // Enable auto-save
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('initialization', () => {
    it('should initialize with a new profile', () => {
      const profile = manager.initialize('test-player');
      
      expect(profile.playerId).toBe('test-player');
      expect(manager.getCurrentProfile()).toBe(profile);
    });

    it('should initialize with default profile if no ID provided', () => {
      const profile = manager.initialize();
      
      expect(profile.playerId).toBe('default');
    });
  });

  describe('profile switching', () => {
    it('should switch between profiles', () => {
      const profile1 = manager.initialize('player1');
      const profile2 = manager.switchProfile('player2');
      
      expect(profile2.playerId).toBe('player2');
      expect(manager.getCurrentProfile()).toBe(profile2);
      expect(profile1).not.toBe(profile2);
    });
  });

  describe('game result recording', () => {
    it('should record game results', () => {
      manager.initialize('test-player');
      
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };
      
      manager.recordGameResult(gameResult);
      
      const profile = manager.getCurrentProfile()!;
      expect(profile.metrics.gamesPlayed).toBe(1);
      expect(profile.metrics.gamesWon).toBe(1);
    });

    it('should throw error when recording without active profile', () => {
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };
      
      expect(() => manager.recordGameResult(gameResult)).toThrow('No active profile');
    });
  });

  describe('performance statistics', () => {
    it('should return performance stats for active profile', () => {
      manager.initialize('test-player');
      
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };
      
      manager.recordGameResult(gameResult);
      
      const stats = manager.getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.winRate).toBe(100);
      expect(stats!.gamesPlayed).toBe(1);
      expect(stats!.averageTime).toBe(120);
    });

    it('should return null when no active profile', () => {
      const stats = manager.getPerformanceStats();
      expect(stats).toBeNull();
    });
  });

  describe('difficulty management', () => {
    it('should update preferred difficulty', () => {
      const profile = manager.initialize('test-player');
      
      manager.updatePreferredDifficulty(DifficultyLevel.EXPERT);
      
      expect(profile.preferredDifficulty).toBe(DifficultyLevel.EXPERT);
    });

    it('should get recommended difficulty', () => {
      manager.initialize('test-player');
      
      const recommended = manager.getRecommendedDifficulty();
      expect(recommended).toBe(DifficultyLevel.BEGINNER); // Default for new player
    });

    it('should detect when difficulty change notification is needed', () => {
      const profile = manager.initialize('test-player');
      
      // Simulate good performance to change recommendation
      profile.skillRating = 1200;
      for (let i = 0; i < 10; i++) {
        const gameResult: GameResult = {
          gameId: `game-${i}`,
          won: true,
          playTime: 60,
          hintsUsed: 1,
          difficulty: DifficultyLevel.BEGINNER,
          timestamp: new Date(),
          boardSize: { width: 9, height: 9 },
          mineCount: 10
        };
        manager.recordGameResult(gameResult);
      }
      
      expect(manager.shouldNotifyDifficultyChange()).toBe(true);
    });
  });

  describe('recent trends', () => {
    it('should calculate recent performance trends', () => {
      manager.initialize('test-player');
      
      // Add some games
      for (let i = 0; i < 5; i++) {
        const gameResult: GameResult = {
          gameId: `game-${i}`,
          won: i < 3, // Win first 3, lose last 2 (60% win rate)
          playTime: 120,
          hintsUsed: 2,
          difficulty: DifficultyLevel.BEGINNER,
          timestamp: new Date(),
          boardSize: { width: 9, height: 9 },
          mineCount: 10
        };
        manager.recordGameResult(gameResult);
      }
      
      const trend = manager.getRecentTrend();
      expect(trend).not.toBeNull();
      expect(trend!.winRate).toBe(60);
      expect(trend!.gamesCount).toBe(5);
      expect(trend!.averageHints).toBe(2);
    });

    it('should return null for no recent games', () => {
      manager.initialize('test-player');
      
      const trend = manager.getRecentTrend();
      expect(trend).toBeNull();
    });
  });

  describe('profile management', () => {
    it('should reset profile statistics', () => {
      const profile = manager.initialize('test-player');
      
      // Add a game result
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };
      manager.recordGameResult(gameResult);
      
      expect(profile.metrics.gamesPlayed).toBe(1);
      
      manager.resetProfile();
      
      const newProfile = manager.getCurrentProfile()!;
      expect(newProfile.metrics.gamesPlayed).toBe(0);
      expect(newProfile.playerId).toBe('test-player'); // Should keep same ID
    });

    it('should export and import profile data', () => {
      manager.initialize('test-player');
      
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };
      manager.recordGameResult(gameResult);
      
      const exportedData = manager.exportProfile();
      expect(exportedData).not.toBeNull();
      
      // Create new manager and import
      const newManager = new ProfileManager();
      const importedProfile = newManager.importProfile(exportedData!);
      
      expect(importedProfile.playerId).toBe('test-player');
      expect(importedProfile.metrics.gamesPlayed).toBe(1);
    });

    it('should list available profiles', () => {
      manager.initialize('player1');
      manager.switchProfile('player2');
      
      const profiles = manager.listAvailableProfiles();
      expect(profiles).toContain('player1');
      expect(profiles).toContain('player2');
    });

    it('should delete profiles (but not active one)', () => {
      manager.initialize('player1');
      manager.switchProfile('player2');
      
      // Should be able to delete inactive profile
      const result = manager.deleteProfile('player1');
      expect(result).toBe(true);
      
      // Should not be able to delete active profile
      expect(() => manager.deleteProfile('player2')).toThrow('Cannot delete the currently active profile');
    });
  });

  describe('auto-save functionality', () => {
    it('should auto-save when enabled', () => {
      const autoSaveManager = new ProfileManager(true);
      autoSaveManager.initialize('auto-save-test');
      
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };
      
      autoSaveManager.recordGameResult(gameResult);
      
      // Create new manager and load - should have the data
      const newManager = new ProfileManager();
      const loadedProfile = newManager.initialize('auto-save-test');
      expect(loadedProfile.metrics.gamesPlayed).toBe(1);
    });

    it('should not auto-save when disabled', () => {
      const noAutoSaveManager = new ProfileManager(false);
      noAutoSaveManager.initialize('no-auto-save-test');
      
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };
      
      noAutoSaveManager.recordGameResult(gameResult);
      
      // Create new manager and load - should not have the data
      const newManager = new ProfileManager();
      const loadedProfile = newManager.initialize('no-auto-save-test');
      expect(loadedProfile.metrics.gamesPlayed).toBe(0); // New profile
    });
  });

  describe('property-based tests', () => {
    /**
     * Property 13: Profile-based initialization
     * **Validates: Requirements 3.3**
     * 
     * For any player performance profile, starting a new session should initialize 
     * difficulty settings appropriate to the historical performance data
     */
    it('should initialize difficulty based on player performance profile for any valid profile data', () => {
      fc.assert(
        fc.property(
          // Generate player profile data
          fc.record({
            playerId: fc.string({ minLength: 1, maxLength: 20 }),
            skillRating: fc.integer({ min: 0, max: 2000 }),
            winRate: fc.float({ min: 0, max: 100 }),
            gamesPlayed: fc.integer({ min: 0, max: 1000 }),
            preferredDifficulty: fc.constantFrom(
              DifficultyLevel.BEGINNER,
              DifficultyLevel.INTERMEDIATE,
              DifficultyLevel.EXPERT,
              DifficultyLevel.CUSTOM
            )
          }),
          
          (profileData) => {
            // Create a profile with the generated data
            const profile = new PlayerProfile(profileData.playerId);
            profile.skillRating = profileData.skillRating;
            profile.preferredDifficulty = profileData.preferredDifficulty;
            
            // Simulate games to establish win rate
            if (profileData.gamesPlayed > 0) {
              const wins = Math.floor((profileData.winRate / 100) * profileData.gamesPlayed);
              
              for (let i = 0; i < profileData.gamesPlayed; i++) {
                const gameResult: GameResult = {
                  gameId: `game-${i}`,
                  won: i < wins,
                  playTime: 120,
                  hintsUsed: 2,
                  difficulty: profileData.preferredDifficulty,
                  timestamp: new Date(),
                  boardSize: { width: 9, height: 9 },
                  mineCount: 10
                };
                profile.recordGameResult(gameResult);
              }
            }
            
            // Save the profile to storage
            const manager = new ProfileManager(true);
            manager.initialize(profileData.playerId);
            const currentProfile = manager.getCurrentProfile()!;
            
            // Copy the generated data to the current profile
            currentProfile.skillRating = profile.skillRating;
            currentProfile.preferredDifficulty = profile.preferredDifficulty;
            currentProfile.metrics = { ...profile.metrics };
            manager.saveCurrentProfile();
            
            // Start a new session (initialize again)
            const newManager = new ProfileManager(true);
            const loadedProfile = newManager.initialize(profileData.playerId);
            
            // The loaded profile should have the same performance data
            expect(loadedProfile.playerId).toBe(profileData.playerId);
            expect(loadedProfile.skillRating).toBe(profile.skillRating);
            expect(loadedProfile.preferredDifficulty).toBe(profile.preferredDifficulty);
            
            // The recommended difficulty should be based on performance
            const recommendedDifficulty = loadedProfile.getRecommendedDifficulty();
            
            // Verify the difficulty recommendation logic is consistent with performance
            if (loadedProfile.winRate > 80 && loadedProfile.skillRating > 1200) {
              expect(recommendedDifficulty).toBe(DifficultyLevel.EXPERT);
            } else if (loadedProfile.winRate > 60 && loadedProfile.skillRating > 1000) {
              expect(recommendedDifficulty).toBe(DifficultyLevel.INTERMEDIATE);
            } else {
              expect(recommendedDifficulty).toBe(DifficultyLevel.BEGINNER);
            }
            
            // The system should be able to detect if difficulty change notification is needed
            const shouldNotify = newManager.shouldNotifyDifficultyChange();
            const expectedNotify = recommendedDifficulty !== loadedProfile.preferredDifficulty;
            expect(shouldNotify).toBe(expectedNotify);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});