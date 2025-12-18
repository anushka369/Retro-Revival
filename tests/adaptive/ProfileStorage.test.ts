import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileStorage } from '../../src/adaptive/ProfileStorage.js';
import { PlayerProfile } from '../../src/adaptive/PlayerProfile.js';

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

describe('ProfileStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('saveProfile and loadProfile', () => {
    it('should save and load a profile correctly', () => {
      const profile = new PlayerProfile('test-player');
      profile.skillRating = 1200;
      
      ProfileStorage.saveProfile(profile);
      const loadedProfile = ProfileStorage.loadProfile('test-player');
      
      expect(loadedProfile).not.toBeNull();
      expect(loadedProfile!.playerId).toBe('test-player');
      expect(loadedProfile!.skillRating).toBe(1200);
    });

    it('should return null for non-existent profile', () => {
      const loadedProfile = ProfileStorage.loadProfile('non-existent');
      expect(loadedProfile).toBeNull();
    });
  });

  describe('getOrCreateProfile', () => {
    it('should create a new profile if none exists', () => {
      const profile = ProfileStorage.getOrCreateProfile('new-player');
      
      expect(profile.playerId).toBe('new-player');
      expect(profile.skillRating).toBe(1000); // Default value
      
      // Should be saved automatically
      const loadedProfile = ProfileStorage.loadProfile('new-player');
      expect(loadedProfile).not.toBeNull();
    });

    it('should return existing profile if it exists', () => {
      // Create and save a profile first
      const originalProfile = new PlayerProfile('existing-player');
      originalProfile.skillRating = 1500;
      ProfileStorage.saveProfile(originalProfile);
      
      // Get or create should return the existing one
      const profile = ProfileStorage.getOrCreateProfile('existing-player');
      expect(profile.skillRating).toBe(1500);
    });
  });

  describe('deleteProfile', () => {
    it('should delete a profile successfully', () => {
      const profile = new PlayerProfile('to-delete');
      ProfileStorage.saveProfile(profile);
      
      // Verify it exists
      expect(ProfileStorage.loadProfile('to-delete')).not.toBeNull();
      
      // Delete it
      const result = ProfileStorage.deleteProfile('to-delete');
      expect(result).toBe(true);
      
      // Verify it's gone
      expect(ProfileStorage.loadProfile('to-delete')).toBeNull();
    });
  });

  describe('listProfiles', () => {
    it('should list all stored profiles', () => {
      const profile1 = new PlayerProfile('player1');
      const profile2 = new PlayerProfile('player2');
      
      ProfileStorage.saveProfile(profile1);
      ProfileStorage.saveProfile(profile2);
      
      const profiles = ProfileStorage.listProfiles();
      expect(profiles).toContain('player1');
      expect(profiles).toContain('player2');
      expect(profiles.length).toBe(2);
    });

    it('should return empty array when no profiles exist', () => {
      const profiles = ProfileStorage.listProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('clearAllProfiles', () => {
    it('should clear all profiles', () => {
      const profile1 = new PlayerProfile('player1');
      const profile2 = new PlayerProfile('player2');
      
      ProfileStorage.saveProfile(profile1);
      ProfileStorage.saveProfile(profile2);
      
      expect(ProfileStorage.listProfiles().length).toBe(2);
      
      ProfileStorage.clearAllProfiles();
      
      expect(ProfileStorage.listProfiles().length).toBe(0);
    });
  });

  describe('storage availability', () => {
    it('should detect storage availability', () => {
      expect(ProfileStorage.isStorageAvailable()).toBe(true);
    });

    it('should calculate storage usage', () => {
      const profile = new PlayerProfile('test-player');
      ProfileStorage.saveProfile(profile);
      
      const info = ProfileStorage.getStorageInfo();
      expect(info.available).toBe(true);
      expect(info.used).toBeGreaterThan(0);
    });
  });
});