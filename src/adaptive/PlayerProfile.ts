import { DifficultyLevel, SkillArea } from '../types/index.js';

export interface PerformanceMetrics {
  gamesPlayed: number;
  gamesWon: number;
  totalPlayTime: number; // in seconds
  hintsUsed: number;
  averageHintsPerGame: number;
  bestTime: number; // fastest completion time in seconds
  currentStreak: number; // current win/loss streak (positive for wins, negative for losses)
  longestWinStreak: number;
  recentGames: GameResult[]; // last 10 games for trend analysis
}

export interface GameResult {
  gameId: string;
  won: boolean;
  playTime: number; // in seconds
  hintsUsed: number;
  difficulty: DifficultyLevel;
  timestamp: Date;
  boardSize: { width: number; height: number };
  mineCount: number;
}

export class PlayerProfile {
  public readonly playerId: string;
  public skillRating: number;
  public preferredDifficulty: DifficultyLevel;
  public improvementAreas: SkillArea[];
  public metrics: PerformanceMetrics;
  public createdAt: Date;
  public lastUpdated: Date;

  constructor(playerId: string = 'default') {
    this.playerId = playerId;
    this.skillRating = 1000; // Starting ELO-style rating
    this.preferredDifficulty = DifficultyLevel.BEGINNER;
    this.improvementAreas = [];
    this.createdAt = new Date();
    this.lastUpdated = new Date();
    
    this.metrics = {
      gamesPlayed: 0,
      gamesWon: 0,
      totalPlayTime: 0,
      hintsUsed: 0,
      averageHintsPerGame: 0,
      bestTime: Infinity,
      currentStreak: 0,
      longestWinStreak: 0,
      recentGames: []
    };
  }

  /**
   * Calculate current win rate as a percentage
   */
  get winRate(): number {
    if (this.metrics.gamesPlayed === 0) return 0;
    return (this.metrics.gamesWon / this.metrics.gamesPlayed) * 100;
  }

  /**
   * Calculate average play time per game in seconds
   */
  get averageTime(): number {
    if (this.metrics.gamesPlayed === 0) return 0;
    return this.metrics.totalPlayTime / this.metrics.gamesPlayed;
  }

  /**
   * Record the result of a completed game
   */
  recordGameResult(result: GameResult): void {
    // Update basic metrics
    this.metrics.gamesPlayed++;
    if (result.won) {
      this.metrics.gamesWon++;
    }
    
    this.metrics.totalPlayTime += result.playTime;
    this.metrics.hintsUsed += result.hintsUsed;
    
    // Update averages
    this.metrics.averageHintsPerGame = this.metrics.hintsUsed / this.metrics.gamesPlayed;
    
    // Update best time (only for wins)
    if (result.won && result.playTime < this.metrics.bestTime) {
      this.metrics.bestTime = result.playTime;
    }
    
    // Update streaks
    if (result.won) {
      if (this.metrics.currentStreak >= 0) {
        this.metrics.currentStreak++;
      } else {
        this.metrics.currentStreak = 1; // Reset from loss streak
      }
      
      if (this.metrics.currentStreak > this.metrics.longestWinStreak) {
        this.metrics.longestWinStreak = this.metrics.currentStreak;
      }
    } else {
      if (this.metrics.currentStreak <= 0) {
        this.metrics.currentStreak--;
      } else {
        this.metrics.currentStreak = -1; // Reset from win streak
      }
    }
    
    // Add to recent games (keep only last 10)
    this.metrics.recentGames.push(result);
    if (this.metrics.recentGames.length > 10) {
      this.metrics.recentGames.shift();
    }
    
    // Update skill rating based on performance
    this.updateSkillRating(result);
    
    // Update improvement areas based on recent performance
    this.updateImprovementAreas();
    
    this.lastUpdated = new Date();
  }

  /**
   * Update skill rating using a modified ELO system
   */
  private updateSkillRating(result: GameResult): void {
    const K_FACTOR = 32; // How much rating can change per game
    const difficultyMultiplier = this.getDifficultyMultiplier(result.difficulty);
    const timeBonus = this.getTimeBonus(result);
    const hintPenalty = this.getHintPenalty(result);
    
    let ratingChange = 0;
    
    if (result.won) {
      // Base points for winning
      ratingChange = K_FACTOR * difficultyMultiplier;
      
      // Bonus for fast completion
      ratingChange += timeBonus;
      
      // Penalty for excessive hint usage
      ratingChange -= hintPenalty;
    } else {
      // Smaller penalty for losing, modified by difficulty
      ratingChange = -K_FACTOR * 0.5 * difficultyMultiplier;
    }
    
    this.skillRating = Math.max(0, this.skillRating + ratingChange);
  }

  /**
   * Get difficulty multiplier for rating calculations
   */
  private getDifficultyMultiplier(difficulty: DifficultyLevel): number {
    switch (difficulty) {
      case DifficultyLevel.BEGINNER: return 0.8;
      case DifficultyLevel.INTERMEDIATE: return 1.0;
      case DifficultyLevel.EXPERT: return 1.5;
      case DifficultyLevel.CUSTOM: return 1.2;
      default: return 1.0;
    }
  }

  /**
   * Calculate time bonus for fast completion
   */
  private getTimeBonus(result: GameResult): number {
    if (!result.won) return 0;
    
    // Expected times by difficulty (in seconds)
    const expectedTimes = {
      [DifficultyLevel.BEGINNER]: 120,
      [DifficultyLevel.INTERMEDIATE]: 300,
      [DifficultyLevel.EXPERT]: 600,
      [DifficultyLevel.CUSTOM]: 300
    };
    
    const expected = expectedTimes[result.difficulty];
    const ratio = expected / result.playTime;
    
    // Bonus for being faster than expected
    return Math.max(0, (ratio - 1) * 10);
  }

  /**
   * Calculate hint penalty for excessive hint usage
   */
  private getHintPenalty(result: GameResult): number {
    // Expected hints by difficulty
    const expectedHints = {
      [DifficultyLevel.BEGINNER]: 2,
      [DifficultyLevel.INTERMEDIATE]: 4,
      [DifficultyLevel.EXPERT]: 6,
      [DifficultyLevel.CUSTOM]: 4
    };
    
    const expected = expectedHints[result.difficulty];
    const excess = Math.max(0, result.hintsUsed - expected);
    
    return excess * 2; // 2 points penalty per excess hint
  }

  /**
   * Update improvement areas based on recent performance patterns
   */
  private updateImprovementAreas(): void {
    this.improvementAreas = [];
    
    if (this.metrics.recentGames.length < 3) return;
    
    const recentGames = this.metrics.recentGames.slice(-5); // Last 5 games
    const recentWinRate = recentGames.filter(g => g.won).length / recentGames.length;
    const averageHints = recentGames.reduce((sum, g) => sum + g.hintsUsed, 0) / recentGames.length;
    
    // Analyze patterns and suggest improvements
    if (recentWinRate < 0.4) {
      this.improvementAreas.push(SkillArea.PATTERN_RECOGNITION);
    }
    
    if (averageHints > 5) {
      this.improvementAreas.push(SkillArea.PROBABILITY_ANALYSIS);
    }
    
    if (this.metrics.currentStreak < -2) {
      this.improvementAreas.push(SkillArea.STRATEGIC_PLANNING);
    }
    
    // Check for risk assessment issues (losing games quickly)
    const quickLosses = recentGames.filter(g => !g.won && g.playTime < 30).length;
    if (quickLosses > 1) {
      this.improvementAreas.push(SkillArea.RISK_ASSESSMENT);
    }
  }

  /**
   * Get recommended difficulty based on current performance
   */
  getRecommendedDifficulty(): DifficultyLevel {
    const winRate = this.winRate;
    const skillRating = this.skillRating;
    
    // Use both win rate and skill rating to determine difficulty
    if (winRate > 80 && skillRating > 1200) {
      return DifficultyLevel.EXPERT;
    } else if (winRate > 60 && skillRating > 1000) {
      return DifficultyLevel.INTERMEDIATE;
    } else {
      return DifficultyLevel.BEGINNER;
    }
  }

  /**
   * Serialize profile to JSON for persistence
   */
  toJSON(): string {
    return JSON.stringify({
      playerId: this.playerId,
      skillRating: this.skillRating,
      preferredDifficulty: this.preferredDifficulty,
      improvementAreas: this.improvementAreas,
      metrics: {
        ...this.metrics,
        recentGames: this.metrics.recentGames.map(game => ({
          ...game,
          timestamp: game.timestamp.toISOString()
        }))
      },
      createdAt: this.createdAt.toISOString(),
      lastUpdated: this.lastUpdated.toISOString()
    });
  }

  /**
   * Create PlayerProfile from JSON data
   */
  static fromJSON(jsonData: string): PlayerProfile {
    const data = JSON.parse(jsonData);
    const profile = new PlayerProfile(data.playerId);
    
    profile.skillRating = data.skillRating;
    profile.preferredDifficulty = data.preferredDifficulty;
    profile.improvementAreas = data.improvementAreas || [];
    profile.createdAt = new Date(data.createdAt);
    profile.lastUpdated = new Date(data.lastUpdated);
    
    // Restore metrics
    profile.metrics = {
      ...data.metrics,
      recentGames: data.metrics.recentGames.map((game: any) => ({
        ...game,
        timestamp: new Date(game.timestamp)
      }))
    };
    
    return profile;
  }
}