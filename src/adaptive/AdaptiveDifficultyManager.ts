import { DifficultyLevel, DifficultySettings } from '../types/index.js';
import { PlayerProfile, GameResult } from './PlayerProfile.js';
import { ProfileManager } from './ProfileManager.js';

export interface DifficultyAdjustment {
  previousDifficulty: DifficultySettings;
  newDifficulty: DifficultySettings;
  reason: string;
  timestamp: Date;
  isManual: boolean;
}

export interface DifficultyNotification {
  id: string;
  type: 'increase' | 'decrease' | 'manual_override';
  message: string;
  adjustment: DifficultyAdjustment;
  timestamp: Date;
  acknowledged: boolean;
}

export interface AdaptiveDifficultyConfig {
  successStreakThreshold: number; // Number of wins to trigger difficulty increase
  failureStreakThreshold: number; // Number of losses to trigger difficulty decrease
  minWinRateForIncrease: number; // Minimum win rate (0-1) to allow difficulty increase
  maxWinRateForDecrease: number; // Maximum win rate (0-1) to trigger difficulty decrease
  adjustmentCooldown: number; // Minimum time between adjustments (in milliseconds)
  enableNotifications: boolean; // Whether to show difficulty change notifications
}

/**
 * Manages adaptive difficulty adjustment based on player performance
 */
export class AdaptiveDifficultyManager {
  private profileManager: ProfileManager;
  private config: AdaptiveDifficultyConfig;
  private lastAdjustmentTime: Date | null = null;
  private adjustmentHistory: DifficultyAdjustment[] = [];
  private currentDifficulty: DifficultySettings;
  private notifications: DifficultyNotification[] = [];
  private manualOverrideBaseline: DifficultySettings | null = null;

  // Default difficulty presets
  private static readonly DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultySettings> = {
    [DifficultyLevel.BEGINNER]: {
      width: 9,
      height: 9,
      mineCount: 10,
      level: DifficultyLevel.BEGINNER
    },
    [DifficultyLevel.INTERMEDIATE]: {
      width: 16,
      height: 16,
      mineCount: 40,
      level: DifficultyLevel.INTERMEDIATE
    },
    [DifficultyLevel.EXPERT]: {
      width: 30,
      height: 16,
      mineCount: 99,
      level: DifficultyLevel.EXPERT
    },
    [DifficultyLevel.CUSTOM]: {
      width: 16,
      height: 16,
      mineCount: 40,
      level: DifficultyLevel.CUSTOM
    }
  };

  constructor(profileManager: ProfileManager, config?: Partial<AdaptiveDifficultyConfig>) {
    this.profileManager = profileManager;
    
    // Default configuration
    this.config = {
      successStreakThreshold: 3,
      failureStreakThreshold: 3,
      minWinRateForIncrease: 0.7, // 70% win rate
      maxWinRateForDecrease: 0.3, // 30% win rate
      adjustmentCooldown: 5 * 60 * 1000, // 5 minutes
      enableNotifications: true,
      ...config
    };

    // Initialize with current profile's preferred difficulty
    const profile = this.profileManager.getCurrentProfile();
    this.currentDifficulty = profile 
      ? AdaptiveDifficultyManager.DIFFICULTY_PRESETS[profile.preferredDifficulty]
      : AdaptiveDifficultyManager.DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER];
  }

  /**
   * Get the current difficulty settings
   */
  getCurrentDifficulty(): DifficultySettings {
    return { ...this.currentDifficulty };
  }

  /**
   * Set the current difficulty (manual override)
   */
  setDifficulty(difficulty: DifficultySettings, setAsBaseline: boolean = true): void {
    const previousDifficulty = { ...this.currentDifficulty };
    this.currentDifficulty = { ...difficulty };
    
    // Set as new baseline for future adaptive adjustments
    if (setAsBaseline) {
      this.manualOverrideBaseline = { ...difficulty };
    }
    
    // Update profile's preferred difficulty if it matches a preset
    const profile = this.profileManager.getCurrentProfile();
    if (profile) {
      const matchingLevel = this.findMatchingDifficultyLevel(difficulty);
      if (matchingLevel) {
        this.profileManager.updatePreferredDifficulty(matchingLevel);
      }
    }

    // Record the manual adjustment
    const adjustment = this.recordAdjustment(previousDifficulty, difficulty, 'Manual override', true);
    this.adjustmentHistory.push(adjustment);
    this.lastAdjustmentTime = new Date();
    
    // Create notification for manual override
    if (this.config.enableNotifications) {
      this.createNotification('manual_override', adjustment);
    }
    
    // Keep only last 20 adjustments
    if (this.adjustmentHistory.length > 20) {
      this.adjustmentHistory.shift();
    }
  }

  /**
   * Process a game result and potentially adjust difficulty
   */
  processGameResult(gameResult: GameResult): DifficultyAdjustment | null {
    const profile = this.profileManager.getCurrentProfile();
    if (!profile) {
      return null;
    }

    // Check if we're in cooldown period
    if (this.isInCooldownPeriod()) {
      return null;
    }

    // Analyze performance and determine if adjustment is needed
    const adjustment = this.analyzePerformanceAndAdjust(profile, gameResult);
    
    if (adjustment) {
      this.lastAdjustmentTime = new Date();
      this.adjustmentHistory.push(adjustment);
      
      // Keep only last 20 adjustments
      if (this.adjustmentHistory.length > 20) {
        this.adjustmentHistory.shift();
      }
    }

    return adjustment;
  }

  /**
   * Analyze player performance and determine if difficulty adjustment is needed
   */
  private analyzePerformanceAndAdjust(profile: PlayerProfile, gameResult: GameResult): DifficultyAdjustment | null {
    const currentStreak = profile.metrics.currentStreak;
    const winRate = profile.winRate / 100; // Convert percentage to decimal
    const recentTrend = this.profileManager.getRecentTrend();

    // Check for success-based difficulty increase
    if (this.shouldIncreaseDifficulty(currentStreak, winRate, recentTrend)) {
      const reason = gameResult.won ? 
        `Success streak of ${currentStreak} wins` : 
        'Strong overall performance';
      return this.increaseDifficulty(reason);
    }

    // Check for failure-based difficulty decrease
    if (this.shouldDecreaseDifficulty(currentStreak, winRate, recentTrend)) {
      const reason = !gameResult.won ? 
        `Failure streak of ${Math.abs(currentStreak)} losses` : 
        'Poor overall performance';
      return this.decreaseDifficulty(reason);
    }

    return null;
  }

  /**
   * Check if difficulty should be increased
   */
  private shouldIncreaseDifficulty(
    currentStreak: number, 
    winRate: number, 
    recentTrend: any
  ): boolean {
    // Must have a positive win streak
    if (currentStreak < this.config.successStreakThreshold) {
      return false;
    }

    // Overall win rate must be above threshold
    if (winRate < this.config.minWinRateForIncrease) {
      return false;
    }

    // Recent performance should also be strong
    if (recentTrend && recentTrend.winRate < this.config.minWinRateForIncrease * 100) {
      return false;
    }

    // Don't increase if already at maximum difficulty
    return !this.isAtMaximumDifficulty();
  }

  /**
   * Check if difficulty should be decreased
   */
  private shouldDecreaseDifficulty(
    currentStreak: number, 
    winRate: number, 
    recentTrend: any
  ): boolean {
    // Must have a negative loss streak
    if (currentStreak > -this.config.failureStreakThreshold) {
      return false;
    }

    // Overall win rate should be below threshold OR recent performance is poor
    const poorOverallPerformance = winRate < this.config.maxWinRateForDecrease;
    const poorRecentPerformance = recentTrend && recentTrend.winRate < this.config.maxWinRateForDecrease * 100;

    if (!poorOverallPerformance && !poorRecentPerformance) {
      return false;
    }

    // Don't decrease if already at minimum difficulty
    return !this.isAtMinimumDifficulty();
  }

  /**
   * Increase difficulty by scaling parameters
   */
  private increaseDifficulty(reason: string): DifficultyAdjustment {
    const previousDifficulty = { ...this.currentDifficulty };
    const newDifficulty = this.scaleDifficultyUp(this.currentDifficulty);
    
    this.currentDifficulty = newDifficulty;
    
    const adjustment = this.recordAdjustment(previousDifficulty, newDifficulty, reason, false);
    
    // Create notification for automatic increase
    if (this.config.enableNotifications) {
      this.createNotification('increase', adjustment);
    }
    
    return adjustment;
  }

  /**
   * Decrease difficulty by scaling parameters
   */
  private decreaseDifficulty(reason: string): DifficultyAdjustment {
    const previousDifficulty = { ...this.currentDifficulty };
    const newDifficulty = this.scaleDifficultyDown(this.currentDifficulty);
    
    this.currentDifficulty = newDifficulty;
    
    const adjustment = this.recordAdjustment(previousDifficulty, newDifficulty, reason, false);
    
    // Create notification for automatic decrease
    if (this.config.enableNotifications) {
      this.createNotification('decrease', adjustment);
    }
    
    return adjustment;
  }

  /**
   * Scale difficulty parameters upward
   */
  private scaleDifficultyUp(current: DifficultySettings): DifficultySettings {
    const newSettings = { ...current };
    
    // Increase mine density first (up to 25% of total cells)
    const totalCells = current.width * current.height;
    const maxMines = Math.floor(totalCells * 0.25);
    
    if (current.mineCount < maxMines) {
      // Increase mine count by 10-20%
      const increase = Math.max(1, Math.floor(current.mineCount * 0.15));
      newSettings.mineCount = Math.min(maxMines, current.mineCount + increase);
    } else {
      // If mine density is at max, increase board size
      if (current.width < 30 || current.height < 20) {
        // Increase width first, then height
        if (current.width <= current.height) {
          newSettings.width = Math.min(30, current.width + 2);
        } else {
          newSettings.height = Math.min(20, current.height + 2);
        }
        
        // Adjust mine count proportionally
        const newTotalCells = newSettings.width * newSettings.height;
        const currentDensity = current.mineCount / totalCells;
        newSettings.mineCount = Math.floor(newTotalCells * currentDensity);
      }
    }

    // Update difficulty level based on new parameters
    newSettings.level = this.findMatchingDifficultyLevel(newSettings) || DifficultyLevel.CUSTOM;
    
    return newSettings;
  }

  /**
   * Scale difficulty parameters downward
   */
  private scaleDifficultyDown(current: DifficultySettings): DifficultySettings {
    const newSettings = { ...current };
    
    // Decrease mine count first
    if (current.mineCount > 5) {
      // Decrease mine count by 10-20%
      const decrease = Math.max(1, Math.floor(current.mineCount * 0.15));
      newSettings.mineCount = Math.max(5, current.mineCount - decrease);
    } else {
      // If mine count is at minimum, decrease board size
      if (current.width > 8 || current.height > 8) {
        // Decrease larger dimension first
        if (current.width >= current.height && current.width > 8) {
          newSettings.width = Math.max(8, current.width - 2);
        } else if (current.height > 8) {
          newSettings.height = Math.max(8, current.height - 2);
        }
        
        // Adjust mine count proportionally
        const totalCells = current.width * current.height;
        const newTotalCells = newSettings.width * newSettings.height;
        const currentDensity = current.mineCount / totalCells;
        newSettings.mineCount = Math.max(5, Math.floor(newTotalCells * currentDensity));
      }
    }

    // Update difficulty level based on new parameters
    newSettings.level = this.findMatchingDifficultyLevel(newSettings) || DifficultyLevel.CUSTOM;
    
    return newSettings;
  }

  /**
   * Find matching difficulty level for given settings
   */
  private findMatchingDifficultyLevel(settings: DifficultySettings): DifficultyLevel | null {
    for (const [level, preset] of Object.entries(AdaptiveDifficultyManager.DIFFICULTY_PRESETS)) {
      if (preset.width === settings.width && 
          preset.height === settings.height && 
          preset.mineCount === settings.mineCount) {
        return level as DifficultyLevel;
      }
    }
    return null;
  }

  /**
   * Check if currently at maximum difficulty
   */
  private isAtMaximumDifficulty(): boolean {
    const totalCells = this.currentDifficulty.width * this.currentDifficulty.height;
    const maxMines = Math.floor(totalCells * 0.25);
    
    return this.currentDifficulty.width >= 30 && 
           this.currentDifficulty.height >= 20 && 
           this.currentDifficulty.mineCount >= maxMines;
  }

  /**
   * Check if currently at minimum difficulty
   */
  private isAtMinimumDifficulty(): boolean {
    return this.currentDifficulty.width <= 8 && 
           this.currentDifficulty.height <= 8 && 
           this.currentDifficulty.mineCount <= 5;
  }

  /**
   * Check if we're in the cooldown period for adjustments
   */
  private isInCooldownPeriod(): boolean {
    if (!this.lastAdjustmentTime) {
      return false;
    }
    
    const timeSinceLastAdjustment = Date.now() - this.lastAdjustmentTime.getTime();
    return timeSinceLastAdjustment < this.config.adjustmentCooldown;
  }

  /**
   * Record a difficulty adjustment
   */
  private recordAdjustment(
    previousDifficulty: DifficultySettings, 
    newDifficulty: DifficultySettings, 
    reason: string,
    isManual: boolean = false
  ): DifficultyAdjustment {
    return {
      previousDifficulty,
      newDifficulty,
      reason,
      timestamp: new Date(),
      isManual
    };
  }

  /**
   * Get adjustment history
   */
  getAdjustmentHistory(): DifficultyAdjustment[] {
    return [...this.adjustmentHistory];
  }

  /**
   * Get configuration
   */
  getConfig(): AdaptiveDifficultyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdaptiveDifficultyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset to profile-based difficulty
   */
  resetToProfileDifficulty(): void {
    const profile = this.profileManager.getCurrentProfile();
    if (profile) {
      const profileDifficulty = AdaptiveDifficultyManager.DIFFICULTY_PRESETS[profile.preferredDifficulty];
      this.setDifficulty(profileDifficulty);
    }
  }

  /**
   * Get difficulty preset by level
   */
  static getDifficultyPreset(level: DifficultyLevel): DifficultySettings {
    return { ...AdaptiveDifficultyManager.DIFFICULTY_PRESETS[level] };
  }

  /**
   * Check if notifications are enabled
   */
  shouldNotify(): boolean {
    return this.config.enableNotifications;
  }

  /**
   * Get time until next adjustment is allowed
   */
  getTimeUntilNextAdjustment(): number {
    if (!this.lastAdjustmentTime) {
      return 0;
    }
    
    const timeSinceLastAdjustment = Date.now() - this.lastAdjustmentTime.getTime();
    const remainingCooldown = this.config.adjustmentCooldown - timeSinceLastAdjustment;
    
    return Math.max(0, remainingCooldown);
  }

  /**
   * Create a notification for difficulty changes
   */
  private createNotification(
    type: 'increase' | 'decrease' | 'manual_override',
    adjustment: DifficultyAdjustment
  ): void {
    const notification: DifficultyNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message: this.generateNotificationMessage(type, adjustment),
      adjustment,
      timestamp: new Date(),
      acknowledged: false
    };

    this.notifications.push(notification);
    
    // Keep only last 10 notifications
    if (this.notifications.length > 10) {
      this.notifications.shift();
    }
  }

  /**
   * Generate notification message based on adjustment type
   */
  private generateNotificationMessage(
    type: 'increase' | 'decrease' | 'manual_override',
    adjustment: DifficultyAdjustment
  ): string {
    const { previousDifficulty, newDifficulty, reason } = adjustment;
    
    switch (type) {
      case 'increase':
        return `Difficulty increased! ${this.describeDifficultyChange(previousDifficulty, newDifficulty)} Reason: ${reason}`;
      case 'decrease':
        return `Difficulty decreased. ${this.describeDifficultyChange(previousDifficulty, newDifficulty)} Reason: ${reason}`;
      case 'manual_override':
        return `Difficulty manually set to ${this.describeDifficulty(newDifficulty)}. This will be your new baseline for adaptive adjustments.`;
      default:
        return `Difficulty changed from ${this.describeDifficulty(previousDifficulty)} to ${this.describeDifficulty(newDifficulty)}`;
    }
  }

  /**
   * Describe difficulty settings in human-readable format
   */
  private describeDifficulty(difficulty: DifficultySettings): string {
    const { width, height, mineCount, level } = difficulty;
    const density = ((mineCount / (width * height)) * 100).toFixed(1);
    
    if (level !== DifficultyLevel.CUSTOM) {
      return `${level} (${width}×${height}, ${mineCount} mines, ${density}% density)`;
    } else {
      return `Custom (${width}×${height}, ${mineCount} mines, ${density}% density)`;
    }
  }

  /**
   * Describe the change between two difficulty settings
   */
  private describeDifficultyChange(previous: DifficultySettings, current: DifficultySettings): string {
    const changes: string[] = [];
    
    if (previous.width !== current.width || previous.height !== current.height) {
      changes.push(`Board size: ${previous.width}×${previous.height} → ${current.width}×${current.height}`);
    }
    
    if (previous.mineCount !== current.mineCount) {
      changes.push(`Mines: ${previous.mineCount} → ${current.mineCount}`);
    }
    
    const prevDensity = ((previous.mineCount / (previous.width * previous.height)) * 100).toFixed(1);
    const currDensity = ((current.mineCount / (current.width * current.height)) * 100).toFixed(1);
    
    if (prevDensity !== currDensity) {
      changes.push(`Density: ${prevDensity}% → ${currDensity}%`);
    }
    
    return changes.join(', ');
  }

  /**
   * Get all unacknowledged notifications
   */
  getUnacknowledgedNotifications(): DifficultyNotification[] {
    return this.notifications.filter(n => !n.acknowledged);
  }

  /**
   * Get all notifications
   */
  getAllNotifications(): DifficultyNotification[] {
    return [...this.notifications];
  }

  /**
   * Acknowledge a notification by ID
   */
  acknowledgeNotification(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Acknowledge all notifications
   */
  acknowledgeAllNotifications(): void {
    this.notifications.forEach(n => n.acknowledged = true);
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this.notifications = [];
  }

  /**
   * Get the manual override baseline difficulty
   */
  getManualOverrideBaseline(): DifficultySettings | null {
    return this.manualOverrideBaseline ? { ...this.manualOverrideBaseline } : null;
  }

  /**
   * Clear the manual override baseline (return to profile-based adaptation)
   */
  clearManualOverrideBaseline(): void {
    this.manualOverrideBaseline = null;
  }

  /**
   * Check if there's an active manual override baseline
   */
  hasManualOverrideBaseline(): boolean {
    return this.manualOverrideBaseline !== null;
  }

  /**
   * Get difficulty history with filtering options
   */
  getDifficultyHistory(options?: {
    limit?: number;
    includeManual?: boolean;
    includeAutomatic?: boolean;
    since?: Date;
  }): DifficultyAdjustment[] {
    let history = [...this.adjustmentHistory];
    
    if (options) {
      // Filter by type
      if (options.includeManual === false) {
        history = history.filter(adj => !adj.isManual);
      }
      if (options.includeAutomatic === false) {
        history = history.filter(adj => adj.isManual);
      }
      
      // Filter by date
      if (options.since) {
        history = history.filter(adj => adj.timestamp >= options.since!);
      }
      
      // Limit results
      if (options.limit && options.limit > 0) {
        history = history.slice(-options.limit);
      }
    }
    
    return history;
  }

  /**
   * Get difficulty statistics
   */
  getDifficultyStatistics(): {
    totalAdjustments: number;
    manualAdjustments: number;
    automaticAdjustments: number;
    increases: number;
    decreases: number;
    averageTimeBetweenAdjustments: number;
    currentBaseline: DifficultySettings | null;
  } {
    const manual = this.adjustmentHistory.filter(adj => adj.isManual);
    const automatic = this.adjustmentHistory.filter(adj => !adj.isManual);
    
    // Calculate increases and decreases based on mine count changes
    let increases = 0;
    let decreases = 0;
    
    for (const adj of this.adjustmentHistory) {
      const prevDensity = adj.previousDifficulty.mineCount / (adj.previousDifficulty.width * adj.previousDifficulty.height);
      const newDensity = adj.newDifficulty.mineCount / (adj.newDifficulty.width * adj.newDifficulty.height);
      
      if (newDensity > prevDensity) {
        increases++;
      } else if (newDensity < prevDensity) {
        decreases++;
      }
    }
    
    // Calculate average time between adjustments
    let averageTime = 0;
    if (this.adjustmentHistory.length > 1) {
      const times = this.adjustmentHistory.map(adj => adj.timestamp.getTime());
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      averageTime = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    }
    
    return {
      totalAdjustments: this.adjustmentHistory.length,
      manualAdjustments: manual.length,
      automaticAdjustments: automatic.length,
      increases,
      decreases,
      averageTimeBetweenAdjustments: averageTime,
      currentBaseline: this.getManualOverrideBaseline()
    };
  }

  /**
   * Reset difficulty to baseline (manual override baseline or profile preference)
   */
  resetToBaseline(): void {
    if (this.manualOverrideBaseline) {
      // Reset to manual override baseline
      const previousDifficulty = { ...this.currentDifficulty };
      this.currentDifficulty = { ...this.manualOverrideBaseline };
      
      const adjustment = this.recordAdjustment(
        previousDifficulty, 
        this.currentDifficulty, 
        'Reset to manual baseline',
        true
      );
      
      this.adjustmentHistory.push(adjustment);
      
      if (this.config.enableNotifications) {
        this.createNotification('manual_override', adjustment);
      }
    } else {
      // Reset to profile-based difficulty
      this.resetToProfileDifficulty();
    }
  }
}