import { PlayerProfile } from './PlayerProfile.js';
import { ErrorHandler, ErrorType, safeSync } from '@/utils/ErrorHandler';

/**
 * Handles persistence of player profiles using localStorage
 */
export class ProfileStorage {
  private static readonly STORAGE_KEY_PREFIX = 'ai_minesweeper_profile_';
  private static readonly DEFAULT_PROFILE_ID = 'default';

  /**
   * Save a player profile to localStorage
   */
  static saveProfile(profile: PlayerProfile): void {
    const errorHandler = ErrorHandler.getInstance();
    
    safeSync(
      () => {
        if (!profile) {
          throw new Error('Profile is null or undefined');
        }

        if (!this.isStorageAvailable()) {
          throw new Error('localStorage is not available');
        }

        const key = this.getStorageKey(profile.playerId);
        const jsonData = profile.toJSON();
        
        // Validate JSON data
        if (!jsonData || jsonData.length === 0) {
          throw new Error('Profile serialization produced empty data');
        }

        // Check storage quota before saving
        try {
          localStorage.setItem(key, jsonData);
        } catch (quotaError) {
          if (quotaError.name === 'QuotaExceededError') {
            // Try to free up space and retry
            this.cleanupOldProfiles();
            localStorage.setItem(key, jsonData);
          } else {
            throw quotaError;
          }
        }
      },
      ErrorType.DATA_PERSISTENCE,
      undefined,
      'ProfileStorage.saveProfile'
    );
  }

  /**
   * Load a player profile from localStorage
   */
  static loadProfile(playerId: string = this.DEFAULT_PROFILE_ID): PlayerProfile | null {
    return safeSync(
      () => {
        if (!playerId || playerId.trim().length === 0) {
          throw new Error('Invalid player ID');
        }

        if (!this.isStorageAvailable()) {
          console.warn('localStorage not available, returning null profile');
          return null;
        }

        const key = this.getStorageKey(playerId);
        const jsonData = localStorage.getItem(key);
        
        if (!jsonData) {
          return null;
        }

        // Validate JSON data before parsing
        try {
          JSON.parse(jsonData); // Test if valid JSON
        } catch (parseError) {
          console.error('Corrupted profile data detected, removing:', key);
          localStorage.removeItem(key);
          throw new Error(`Corrupted profile data for player ${playerId}`);
        }
        
        const profile = PlayerProfile.fromJSON(jsonData);
        
        // Validate loaded profile
        if (!profile || profile.playerId !== playerId) {
          throw new Error('Profile validation failed after loading');
        }
        
        return profile;
      },
      ErrorType.DATA_PERSISTENCE,
      null,
      'ProfileStorage.loadProfile'
    );
  }

  /**
   * Get or create a player profile
   */
  static getOrCreateProfile(playerId: string = this.DEFAULT_PROFILE_ID): PlayerProfile {
    return safeSync(
      () => {
        const existingProfile = this.loadProfile(playerId);
        
        if (existingProfile) {
          return existingProfile;
        }
        
        // Create new profile
        const newProfile = new PlayerProfile(playerId);
        
        // Try to save the new profile
        try {
          this.saveProfile(newProfile);
        } catch (saveError) {
          console.warn('Failed to save new profile, continuing with in-memory profile');
          // Continue with in-memory profile even if save fails
        }
        
        return newProfile;
      },
      ErrorType.DATA_PERSISTENCE,
      new PlayerProfile(playerId), // Fallback to basic profile
      'ProfileStorage.getOrCreateProfile'
    ) || new PlayerProfile(playerId);
  }

  /**
   * Delete a player profile from localStorage
   */
  static deleteProfile(playerId: string): boolean {
    try {
      const key = this.getStorageKey(playerId);
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to delete player profile:', error);
      return false;
    }
  }

  /**
   * List all stored player profile IDs
   */
  static listProfiles(): string[] {
    const profiles: string[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
          const playerId = key.substring(this.STORAGE_KEY_PREFIX.length);
          profiles.push(playerId);
        }
      }
    } catch (error) {
      console.error('Failed to list player profiles:', error);
    }
    
    return profiles;
  }

  /**
   * Clear all player profiles from storage
   */
  static clearAllProfiles(): void {
    const profiles = this.listProfiles();
    profiles.forEach(playerId => this.deleteProfile(playerId));
  }

  /**
   * Get the storage key for a player ID
   */
  private static getStorageKey(playerId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${playerId}`;
  }

  /**
   * Check if storage is available
   */
  static isStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage usage information
   */
  static getStorageInfo(): { used: number; available: boolean; quota?: number } {
    return safeSync(
      () => {
        const available = this.isStorageAvailable();
        let used = 0;
        let quota: number | undefined;
        
        if (available) {
          const profiles = this.listProfiles();
          profiles.forEach(playerId => {
            const key = this.getStorageKey(playerId);
            const data = localStorage.getItem(key);
            if (data) {
              used += data.length;
            }
          });

          // Try to estimate storage quota
          if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(estimate => {
              quota = estimate.quota;
            }).catch(() => {
              // Quota estimation not available
            });
          }
        }
        
        return { used, available, quota };
      },
      ErrorType.DATA_PERSISTENCE,
      { used: 0, available: false },
      'ProfileStorage.getStorageInfo'
    ) || { used: 0, available: false };
  }

  /**
   * Clean up old profiles to free storage space
   */
  private static cleanupOldProfiles(): void {
    safeSync(
      () => {
        const profiles = this.listProfiles();
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        let cleanedCount = 0;
        profiles.forEach(playerId => {
          if (playerId === this.DEFAULT_PROFILE_ID) {
            return; // Never delete default profile
          }
          
          try {
            const profile = this.loadProfile(playerId);
            if (profile && profile.lastPlayed && profile.lastPlayed.getTime() < thirtyDaysAgo) {
              this.deleteProfile(playerId);
              cleanedCount++;
            }
          } catch (error) {
            // If profile is corrupted, delete it
            this.deleteProfile(playerId);
            cleanedCount++;
          }
        });
        
        console.log(`Cleaned up ${cleanedCount} old profiles`);
      },
      ErrorType.DATA_PERSISTENCE,
      undefined,
      'ProfileStorage.cleanupOldProfiles'
    );
  }

  /**
   * Validate profile data integrity
   */
  static validateProfileIntegrity(playerId: string): boolean {
    return safeSync(
      () => {
        const profile = this.loadProfile(playerId);
        if (!profile) {
          return false;
        }

        // Basic validation checks
        return (
          profile.playerId === playerId &&
          typeof profile.skillRating === 'number' &&
          typeof profile.gamesPlayed === 'number' &&
          profile.gamesPlayed >= 0 &&
          profile.skillRating >= 0
        );
      },
      ErrorType.DATA_PERSISTENCE,
      false,
      'ProfileStorage.validateProfileIntegrity'
    ) || false;
  }

  /**
   * Repair corrupted profile data
   */
  static repairProfile(playerId: string): PlayerProfile | null {
    return safeSync(
      () => {
        console.log(`Attempting to repair profile: ${playerId}`);
        
        // Try to load raw data
        const key = this.getStorageKey(playerId);
        const rawData = localStorage.getItem(key);
        
        if (!rawData) {
          return null;
        }

        try {
          const data = JSON.parse(rawData);
          
          // Create new profile with repaired data
          const repairedProfile = new PlayerProfile(playerId);
          
          // Safely copy valid fields
          if (typeof data.skillRating === 'number' && data.skillRating >= 0) {
            repairedProfile.skillRating = data.skillRating;
          }
          
          if (typeof data.gamesPlayed === 'number' && data.gamesPlayed >= 0) {
            repairedProfile.gamesPlayed = data.gamesPlayed;
          }
          
          if (Array.isArray(data.gameHistory)) {
            // Validate and copy game history
            repairedProfile.gameHistory = data.gameHistory.filter((game: any) => 
              game && typeof game.won === 'boolean' && typeof game.playTime === 'number'
            );
          }
          
          // Save repaired profile
          this.saveProfile(repairedProfile);
          console.log(`Successfully repaired profile: ${playerId}`);
          
          return repairedProfile;
        } catch (error) {
          console.error(`Failed to repair profile ${playerId}:`, error);
          // Remove corrupted data
          localStorage.removeItem(key);
          return null;
        }
      },
      ErrorType.DATA_PERSISTENCE,
      null,
      'ProfileStorage.repairProfile'
    );
  }
}
