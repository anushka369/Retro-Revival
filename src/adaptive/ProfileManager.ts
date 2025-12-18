import { PlayerProfile, GameResult } from './PlayerProfile.js';
import { ProfileStorage } from './ProfileStorage.js';
import { DifficultyLevel } from '../types/index.js';

/**
 * High-level manager for player profiles and performance tracking
 */
export class ProfileManager {
  private currentProfile: PlayerProfile | null = null;
  private autoSave: boolean = true;

  constructor(autoSave: boolean = true) {
    this.autoSave = autoSave;
  }

  /**
   * Initialize with a player profile
   */
  initialize(playerId: string = 'default'): PlayerProfile {
    this.currentProfile = ProfileStorage.getOrCreateProfile(playerId);
    return this.currentProfile;
  }

  /**
   * Get the current player profile
   */
  getCurrentProfile(): PlayerProfile | null {
    return this.currentProfile;
  }

  /**
   * Switch to a different player profile
   */
  switchProfile(playerId: string): PlayerProfile {
    // Save current profile if auto-save is enabled
    if (this.autoSave && this.currentProfile) {
      this.saveCurrentProfile();
    }
    
    this.currentProfile = ProfileStorage.getOrCreateProfile(playerId);
    return this.currentProfile;
  }

  /**
   * Record a game result for the current profile
   */
  recordGameResult(result: GameResult): void {
    if (!this.currentProfile) {
      throw new Error('No active profile. Call initialize() first.');
    }
    
    this.currentProfile.recordGameResult(result);
    
    if (this.autoSave) {
      this.saveCurrentProfile();
    }
  }

  /**
   * Save the current profile to storage
   */
  saveCurrentProfile(): void {
    if (!this.currentProfile) {
      throw new Error('No active profile to save.');
    }
    
    ProfileStorage.saveProfile(this.currentProfile);
  }

  /**
   * Update preferred difficulty for current profile
   */
  updatePreferredDifficulty(difficulty: DifficultyLevel): void {
    if (!this.currentProfile) {
      throw new Error('No active profile.');
    }
    
    this.currentProfile.preferredDifficulty = difficulty;
    this.currentProfile.lastUpdated = new Date();
    
    if (this.autoSave) {
      this.saveCurrentProfile();
    }
  }

  /**
   * Get performance statistics for the current profile
   */
  getPerformanceStats(): {
    winRate: number;
    averageTime: number;
    gamesPlayed: number;
    skillRating: number;
    currentStreak: number;
    improvementAreas: string[];
  } | null {
    if (!this.currentProfile) {
      return null;
    }
    
    return {
      winRate: this.currentProfile.winRate,
      averageTime: this.currentProfile.averageTime,
      gamesPlayed: this.currentProfile.metrics.gamesPlayed,
      skillRating: this.currentProfile.skillRating,
      currentStreak: this.currentProfile.metrics.currentStreak,
      improvementAreas: this.currentProfile.improvementAreas
    };
  }

  /**
   * Get recommended difficulty based on current performance
   */
  getRecommendedDifficulty(): DifficultyLevel | null {
    if (!this.currentProfile) {
      return null;
    }
    
    return this.currentProfile.getRecommendedDifficulty();
  }

  /**
   * Check if the player should be notified about difficulty changes
   */
  shouldNotifyDifficultyChange(): boolean {
    if (!this.currentProfile) {
      return false;
    }
    
    const recommended = this.currentProfile.getRecommendedDifficulty();
    return recommended !== this.currentProfile.preferredDifficulty;
  }

  /**
   * Get recent performance trend (last 5 games)
   */
  getRecentTrend(): {
    winRate: number;
    averageHints: number;
    averageTime: number;
    gamesCount: number;
  } | null {
    if (!this.currentProfile || this.currentProfile.metrics.recentGames.length === 0) {
      return null;
    }
    
    const recentGames = this.currentProfile.metrics.recentGames.slice(-5);
    const wins = recentGames.filter(g => g.won).length;
    const totalHints = recentGames.reduce((sum, g) => sum + g.hintsUsed, 0);
    const totalTime = recentGames.reduce((sum, g) => sum + g.playTime, 0);
    
    return {
      winRate: (wins / recentGames.length) * 100,
      averageHints: totalHints / recentGames.length,
      averageTime: totalTime / recentGames.length,
      gamesCount: recentGames.length
    };
  }

  /**
   * Reset the current profile statistics
   */
  resetProfile(): void {
    if (!this.currentProfile) {
      throw new Error('No active profile to reset.');
    }
    
    const playerId = this.currentProfile.playerId;
    this.currentProfile = new PlayerProfile(playerId);
    
    if (this.autoSave) {
      this.saveCurrentProfile();
    }
  }

  /**
   * Export profile data as JSON string
   */
  exportProfile(): string | null {
    if (!this.currentProfile) {
      return null;
    }
    
    return this.currentProfile.toJSON();
  }

  /**
   * Import profile data from JSON string
   */
  importProfile(jsonData: string): PlayerProfile {
    const profile = PlayerProfile.fromJSON(jsonData);
    this.currentProfile = profile;
    
    if (this.autoSave) {
      this.saveCurrentProfile();
    }
    
    return profile;
  }

  /**
   * List all available profiles
   */
  listAvailableProfiles(): string[] {
    return ProfileStorage.listProfiles();
  }

  /**
   * Delete a profile by ID
   */
  deleteProfile(playerId: string): boolean {
    // Don't delete the currently active profile
    if (this.currentProfile && this.currentProfile.playerId === playerId) {
      throw new Error('Cannot delete the currently active profile.');
    }
    
    return ProfileStorage.deleteProfile(playerId);
  }

  /**
   * Get storage information
   */
  getStorageInfo(): { used: number; available: boolean } {
    return ProfileStorage.getStorageInfo();
  }
}