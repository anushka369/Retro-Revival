import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerProfile, GameResult } from '../../src/adaptive/PlayerProfile.js';
import { DifficultyLevel, SkillArea } from '../../src/types/index.js';

describe('PlayerProfile', () => {
  let profile: PlayerProfile;

  beforeEach(() => {
    profile = new PlayerProfile('test-player');
  });

  describe('initialization', () => {
    it('should create a new profile with default values', () => {
      expect(profile.playerId).toBe('test-player');
      expect(profile.skillRating).toBe(1000);
      expect(profile.preferredDifficulty).toBe(DifficultyLevel.BEGINNER);
      expect(profile.improvementAreas).toEqual([]);
      expect(profile.metrics.gamesPlayed).toBe(0);
      expect(profile.winRate).toBe(0);
      expect(profile.averageTime).toBe(0);
    });
  });

  describe('game result recording', () => {
    it('should record a winning game correctly', () => {
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

      profile.recordGameResult(gameResult);

      expect(profile.metrics.gamesPlayed).toBe(1);
      expect(profile.metrics.gamesWon).toBe(1);
      expect(profile.winRate).toBe(100);
      expect(profile.metrics.currentStreak).toBe(1);
      expect(profile.metrics.totalPlayTime).toBe(120);
      expect(profile.averageTime).toBe(120);
      expect(profile.metrics.bestTime).toBe(120);
    });

    it('should record a losing game correctly', () => {
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: false,
        playTime: 60,
        hintsUsed: 1,
        difficulty: DifficultyLevel.BEGINNER,
        timestamp: new Date(),
        boardSize: { width: 9, height: 9 },
        mineCount: 10
      };

      profile.recordGameResult(gameResult);

      expect(profile.metrics.gamesPlayed).toBe(1);
      expect(profile.metrics.gamesWon).toBe(0);
      expect(profile.winRate).toBe(0);
      expect(profile.metrics.currentStreak).toBe(-1);
      expect(profile.metrics.bestTime).toBe(Infinity);
    });

    it('should update skill rating based on performance', () => {
      const initialRating = profile.skillRating;
      
      const winningGame: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 60, // Fast completion
        hintsUsed: 1, // Low hint usage
        difficulty: DifficultyLevel.INTERMEDIATE,
        timestamp: new Date(),
        boardSize: { width: 16, height: 16 },
        mineCount: 40
      };

      profile.recordGameResult(winningGame);
      
      expect(profile.skillRating).toBeGreaterThan(initialRating);
    });

    it('should maintain recent games history (max 10)', () => {
      // Add 12 games
      for (let i = 0; i < 12; i++) {
        const gameResult: GameResult = {
          gameId: `game-${i}`,
          won: i % 2 === 0,
          playTime: 120,
          hintsUsed: 2,
          difficulty: DifficultyLevel.BEGINNER,
          timestamp: new Date(),
          boardSize: { width: 9, height: 9 },
          mineCount: 10
        };
        profile.recordGameResult(gameResult);
      }

      expect(profile.metrics.recentGames.length).toBe(10);
      expect(profile.metrics.recentGames[0].gameId).toBe('game-2'); // First two should be removed
    });
  });

  describe('difficulty recommendation', () => {
    it('should recommend beginner for new players', () => {
      expect(profile.getRecommendedDifficulty()).toBe(DifficultyLevel.BEGINNER);
    });

    it('should recommend intermediate for good performers', () => {
      // Simulate moderate performance (70% win rate, moderate skill rating)
      profile.skillRating = 1050;
      for (let i = 0; i < 10; i++) {
        const gameResult: GameResult = {
          gameId: `game-${i}`,
          won: i < 7, // Win 7 out of 10 games (70% win rate)
          playTime: 180, // Slower time to avoid big rating bonuses
          hintsUsed: 3, // More hints to avoid big rating bonuses
          difficulty: DifficultyLevel.BEGINNER,
          timestamp: new Date(),
          boardSize: { width: 9, height: 9 },
          mineCount: 10
        };
        profile.recordGameResult(gameResult);
      }

      expect(profile.getRecommendedDifficulty()).toBe(DifficultyLevel.INTERMEDIATE);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      // Add some data to the profile
      const gameResult: GameResult = {
        gameId: 'game-1',
        won: true,
        playTime: 120,
        hintsUsed: 2,
        difficulty: DifficultyLevel.INTERMEDIATE,
        timestamp: new Date(),
        boardSize: { width: 16, height: 16 },
        mineCount: 40
      };
      profile.recordGameResult(gameResult);
      profile.improvementAreas = [SkillArea.PATTERN_RECOGNITION];

      const jsonData = profile.toJSON();
      const deserializedProfile = PlayerProfile.fromJSON(jsonData);

      expect(deserializedProfile.playerId).toBe(profile.playerId);
      expect(deserializedProfile.skillRating).toBe(profile.skillRating);
      expect(deserializedProfile.metrics.gamesPlayed).toBe(profile.metrics.gamesPlayed);
      expect(deserializedProfile.improvementAreas).toEqual(profile.improvementAreas);
      expect(deserializedProfile.metrics.recentGames.length).toBe(1);
      expect(deserializedProfile.metrics.recentGames[0].gameId).toBe('game-1');
    });
  });

  describe('improvement areas', () => {
    it('should identify pattern recognition issues for low win rate', () => {
      // Simulate poor performance
      for (let i = 0; i < 5; i++) {
        const gameResult: GameResult = {
          gameId: `game-${i}`,
          won: i === 4, // Only win the last game (20% win rate)
          playTime: 120,
          hintsUsed: 2,
          difficulty: DifficultyLevel.BEGINNER,
          timestamp: new Date(),
          boardSize: { width: 9, height: 9 },
          mineCount: 10
        };
        profile.recordGameResult(gameResult);
      }

      expect(profile.improvementAreas).toContain(SkillArea.PATTERN_RECOGNITION);
    });

    it('should identify probability analysis issues for high hint usage', () => {
      // Simulate high hint usage
      for (let i = 0; i < 5; i++) {
        const gameResult: GameResult = {
          gameId: `game-${i}`,
          won: true,
          playTime: 120,
          hintsUsed: 8, // High hint usage
          difficulty: DifficultyLevel.BEGINNER,
          timestamp: new Date(),
          boardSize: { width: 9, height: 9 },
          mineCount: 10
        };
        profile.recordGameResult(gameResult);
      }

      expect(profile.improvementAreas).toContain(SkillArea.PROBABILITY_ANALYSIS);
    });
  });
});