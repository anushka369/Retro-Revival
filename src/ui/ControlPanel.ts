import { IControlPanel, GameStats } from '@/interfaces/UIComponents';
import { GameConfig, DifficultyLevel, DifficultySettings } from '@/types';
import { AdaptiveDifficultyManager } from '@/adaptive/AdaptiveDifficultyManager';

export interface ControlPanelConfig {
  containerId: string;
  onNewGame?: () => void;
  onHintRequest?: () => void;
  onDifficultyChange?: (difficulty: DifficultyLevel) => void;
  onSettingsChange?: (settings: Partial<GameConfig>) => void;
  onPauseToggle?: () => void;
  onReset?: () => void;
}

export class ControlPanel implements IControlPanel {
  private container: HTMLElement;
  private config: ControlPanelConfig;
  private gameConfig: GameConfig;
  private gameStats: GameStats;
  private isPaused: boolean = false;
  private gameTimer: number | null = null;
  private startTime: Date | null = null;
  private elapsedTime: number = 0;

  constructor(config: ControlPanelConfig) {
    this.config = config;
    
    const container = document.getElementById(config.containerId);
    if (!container) {
      throw new Error(`Container element with id '${config.containerId}' not found`);
    }
    this.container = container;
    
    // Initialize default game config
    this.gameConfig = {
      difficulty: {
        width: 9,
        height: 9,
        mineCount: 10,
        level: DifficultyLevel.BEGINNER
      },
      enableHints: true,
      showProbabilities: true,
      enableAdaptiveDifficulty: true
    };
    
    // Initialize default game stats
    this.gameStats = {
      minesRemaining: 10,
      timeElapsed: 0,
      hintsUsed: 0,
      gameState: 'ready'
    };
    
    this.createControlPanel();
  }

  /**
   * Initialize the control panel with configuration
   */
  initialize(config: GameConfig): void {
    this.gameConfig = { ...config };
    this.updateConfigurationDisplay();
  }

  /**
   * Register callback for new game events
   */
  onNewGame(callback: () => void): void {
    this.config.onNewGame = callback;
  }

  /**
   * Register callback for hint request events
   */
  onHintRequest(callback: () => void): void {
    this.config.onHintRequest = callback;
  }

  /**
   * Register callback for difficulty change events
   */
  onDifficultyChange(callback: (difficulty: DifficultyLevel) => void): void {
    this.config.onDifficultyChange = callback;
  }

  /**
   * Register callback for settings change events
   */
  onSettingsChange(callback: (settings: Partial<GameConfig>) => void): void {
    this.config.onSettingsChange = callback;
  }

  /**
   * Update game statistics display
   */
  updateGameStats(stats: GameStats): void {
    this.gameStats = { ...stats };
    this.updateStatsDisplay();
    
    // Start/stop timer based on game state
    if (stats.gameState === 'playing' && !this.gameTimer) {
      this.startTimer();
    } else if (stats.gameState !== 'playing' && this.gameTimer) {
      this.stopTimer();
    }
  }

  /**
   * Show notification message
   */
  showNotification(message: string, type: 'info' | 'warning' | 'success' | 'error'): void {
    const notificationContainer = this.container.querySelector('.notification-area') as HTMLElement;
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
    
    // Add slide-in animation
    notification.style.animation = 'slideInFromTop 0.3s ease-out';
  }

  /**
   * Create the complete control panel UI
   */
  private createControlPanel(): void {
    this.container.innerHTML = `
      <div class="control-panel">
        <!-- Game Controls Section -->
        <div class="control-section game-controls">
          <h3>Game Controls</h3>
          <div class="control-buttons">
            <button id="newGameBtn" class="control-btn primary">
              <span class="btn-icon">🎮</span>
              New Game
            </button>
            <button id="pauseBtn" class="control-btn secondary">
              <span class="btn-icon">⏸️</span>
              Pause
            </button>
            <button id="resetBtn" class="control-btn secondary">
              <span class="btn-icon">🔄</span>
              Reset
            </button>
            <button id="hintBtn" class="control-btn hint">
              <span class="btn-icon">💡</span>
              Get Hint
            </button>
          </div>
        </div>

        <!-- Game Statistics Section -->
        <div class="control-section game-stats">
          <h3>Game Statistics</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">Mines Remaining</div>
              <div class="stat-value" id="minesRemaining">10</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Time Elapsed</div>
              <div class="stat-value" id="timeElapsed">00:00</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Hints Used</div>
              <div class="stat-value" id="hintsUsed">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Game Status</div>
              <div class="stat-value status" id="gameStatus">Ready</div>
            </div>
          </div>
          <div class="performance-stats">
            <div class="stat-item">
              <div class="stat-label">Win Rate</div>
              <div class="stat-value" id="winRate">--</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Average Time</div>
              <div class="stat-value" id="averageTime">--</div>
            </div>
          </div>
        </div>

        <!-- Difficulty Settings Section -->
        <div class="control-section difficulty-settings">
          <h3>Difficulty Settings</h3>
          <div class="difficulty-controls">
            <div class="difficulty-presets">
              <button class="difficulty-btn" data-difficulty="${DifficultyLevel.BEGINNER}">
                Beginner<br><small>9×9, 10 mines</small>
              </button>
              <button class="difficulty-btn" data-difficulty="${DifficultyLevel.INTERMEDIATE}">
                Intermediate<br><small>16×16, 40 mines</small>
              </button>
              <button class="difficulty-btn" data-difficulty="${DifficultyLevel.EXPERT}">
                Expert<br><small>30×16, 99 mines</small>
              </button>
            </div>
            <div class="custom-difficulty">
              <h4>Custom Settings</h4>
              <div class="custom-inputs">
                <div class="input-group">
                  <label for="customWidth">Width:</label>
                  <input type="number" id="customWidth" min="5" max="30" value="9">
                </div>
                <div class="input-group">
                  <label for="customHeight">Height:</label>
                  <input type="number" id="customHeight" min="5" max="24" value="9">
                </div>
                <div class="input-group">
                  <label for="customMines">Mines:</label>
                  <input type="number" id="customMines" min="1" max="200" value="10">
                </div>
                <button id="applyCustomBtn" class="control-btn secondary">Apply Custom</button>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Features Section -->
        <div class="control-section ai-features">
          <h3>AI Features</h3>
          <div class="feature-toggles">
            <label class="toggle-label">
              <input type="checkbox" id="enableHints" checked>
              <span class="toggle-slider"></span>
              Enable AI Hints
            </label>
            <label class="toggle-label">
              <input type="checkbox" id="showProbabilities" checked>
              <span class="toggle-slider"></span>
              Show Probabilities
            </label>
            <label class="toggle-label">
              <input type="checkbox" id="enableAdaptiveDifficulty" checked>
              <span class="toggle-slider"></span>
              Adaptive Difficulty
            </label>
          </div>
        </div>

        <!-- Adaptive Difficulty Display -->
        <div class="control-section adaptive-difficulty">
          <h3>Adaptive Difficulty</h3>
          <div class="adaptive-info">
            <div class="current-difficulty">
              <div class="difficulty-label">Current Level:</div>
              <div class="difficulty-value" id="currentDifficultyLevel">Beginner</div>
            </div>
            <div class="difficulty-details" id="difficultyDetails">
              9×9 grid, 10 mines (12.3% density)
            </div>
            <div class="adaptive-status" id="adaptiveStatus">
              Monitoring performance...
            </div>
          </div>
          <div class="difficulty-override">
            <button id="overrideDifficultyBtn" class="control-btn secondary">
              Manual Override
            </button>
          </div>
        </div>

        <!-- Notifications Area -->
        <div class="control-section notifications">
          <h3>Notifications</h3>
          <div class="notification-area" id="notificationArea">
            <!-- Notifications will be dynamically added here -->
          </div>
        </div>
      </div>
    `;

    this.addStyles();
    this.attachEventListeners();
    this.updateConfigurationDisplay();
  }

  /**
   * Add CSS styles for the control panel
   */
  private addStyles(): void {
    const styleId = 'control-panel-styles';
    
    // Check if styles already exist
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .control-panel {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 12px;
        padding: 20px;
        margin: 10px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        max-width: 400px;
      }
      
      .control-section {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e9ecef;
      }
      
      .control-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }
      
      .control-section h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #495057;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .control-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      
      .control-btn {
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s ease;
        min-height: 44px;
      }
      
      .control-btn.primary {
        background-color: #007bff;
        color: white;
      }
      
      .control-btn.primary:hover {
        background-color: #0056b3;
        transform: translateY(-1px);
      }
      
      .control-btn.secondary {
        background-color: #6c757d;
        color: white;
      }
      
      .control-btn.secondary:hover {
        background-color: #545b62;
        transform: translateY(-1px);
      }
      
      .control-btn.hint {
        background-color: #ffc107;
        color: #212529;
      }
      
      .control-btn.hint:hover {
        background-color: #e0a800;
        transform: translateY(-1px);
      }
      
      .control-btn:disabled {
        background-color: #e9ecef;
        color: #6c757d;
        cursor: not-allowed;
        transform: none;
      }
      
      .btn-icon {
        font-size: 16px;
      }
      
      .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }
      
      .performance-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid #e9ecef;
      }
      
      .stat-item {
        text-align: center;
        padding: 8px;
        background: white;
        border-radius: 6px;
        border: 1px solid #e9ecef;
      }
      
      .stat-label {
        font-size: 12px;
        color: #6c757d;
        margin-bottom: 4px;
        font-weight: 500;
      }
      
      .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: #495057;
      }
      
      .stat-value.status {
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        text-transform: capitalize;
      }
      
      .stat-value.status.ready { background-color: #e2e3e5; color: #495057; }
      .stat-value.status.playing { background-color: #d1ecf1; color: #0c5460; }
      .stat-value.status.won { background-color: #d4edda; color: #155724; }
      .stat-value.status.lost { background-color: #f8d7da; color: #721c24; }
      
      .difficulty-presets {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .difficulty-btn {
        padding: 12px;
        border: 2px solid #dee2e6;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .difficulty-btn:hover {
        border-color: #007bff;
        background-color: #f8f9ff;
      }
      
      .difficulty-btn.active {
        border-color: #007bff;
        background-color: #007bff;
        color: white;
      }
      
      .difficulty-btn small {
        display: block;
        font-size: 12px;
        opacity: 0.8;
        margin-top: 2px;
      }
      
      .custom-difficulty {
        padding-top: 16px;
        border-top: 1px solid #e9ecef;
      }
      
      .custom-difficulty h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #495057;
      }
      
      .custom-inputs {
        display: grid;
        gap: 8px;
      }
      
      .input-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .input-group label {
        flex: 1;
        font-size: 14px;
        color: #495057;
      }
      
      .input-group input {
        flex: 2;
        padding: 6px 8px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .feature-toggles {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .toggle-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        font-size: 14px;
        color: #495057;
      }
      
      .toggle-label input[type="checkbox"] {
        display: none;
      }
      
      .toggle-slider {
        width: 44px;
        height: 24px;
        background-color: #ccc;
        border-radius: 12px;
        position: relative;
        margin-right: 12px;
        transition: background-color 0.2s ease;
      }
      
      .toggle-slider::before {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: white;
        top: 2px;
        left: 2px;
        transition: transform 0.2s ease;
      }
      
      .toggle-label input[type="checkbox"]:checked + .toggle-slider {
        background-color: #007bff;
      }
      
      .toggle-label input[type="checkbox"]:checked + .toggle-slider::before {
        transform: translateX(20px);
      }
      
      .adaptive-info {
        background: white;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #e9ecef;
        margin-bottom: 12px;
      }
      
      .current-difficulty {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .difficulty-label {
        font-size: 14px;
        color: #6c757d;
        font-weight: 500;
      }
      
      .difficulty-value {
        font-size: 16px;
        font-weight: 600;
        color: #007bff;
      }
      
      .difficulty-details {
        font-size: 12px;
        color: #6c757d;
        margin-bottom: 8px;
      }
      
      .adaptive-status {
        font-size: 12px;
        color: #28a745;
        font-style: italic;
      }
      
      .notification-area {
        min-height: 40px;
        max-height: 200px;
        overflow-y: auto;
      }
      
      .notification {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        margin-bottom: 8px;
        animation: slideInFromTop 0.3s ease-out;
      }
      
      .notification.notification-info {
        border-left: 4px solid #17a2b8;
      }
      
      .notification.notification-success {
        border-left: 4px solid #28a745;
      }
      
      .notification.notification-warning {
        border-left: 4px solid #ffc107;
      }
      
      .notification.notification-error {
        border-left: 4px solid #dc3545;
      }
      
      .notification-content {
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .notification-message {
        font-size: 13px;
        color: #495057;
        flex: 1;
      }
      
      .notification-close {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #6c757d;
        padding: 0;
        margin-left: 8px;
      }
      
      .notification-close:hover {
        color: #495057;
      }
      
      @keyframes slideInFromTop {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Mobile responsive */
      @media (max-width: 768px) {
        .control-panel {
          max-width: none;
          margin: 5px 0;
          padding: 16px;
        }
        
        .control-buttons {
          grid-template-columns: 1fr;
        }
        
        .stats-grid {
          grid-template-columns: 1fr;
        }
        
        .performance-stats {
          grid-template-columns: 1fr;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners to control elements
   */
  private attachEventListeners(): void {
    // Game control buttons
    const newGameBtn = this.container.querySelector('#newGameBtn') as HTMLButtonElement;
    const pauseBtn = this.container.querySelector('#pauseBtn') as HTMLButtonElement;
    const resetBtn = this.container.querySelector('#resetBtn') as HTMLButtonElement;
    const hintBtn = this.container.querySelector('#hintBtn') as HTMLButtonElement;

    newGameBtn?.addEventListener('click', () => {
      this.config.onNewGame?.();
    });

    pauseBtn?.addEventListener('click', () => {
      this.togglePause();
    });

    resetBtn?.addEventListener('click', () => {
      this.config.onReset?.();
    });

    hintBtn?.addEventListener('click', () => {
      this.config.onHintRequest?.();
    });

    // Difficulty preset buttons
    const difficultyBtns = this.container.querySelectorAll('.difficulty-btn');
    difficultyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const difficulty = target.getAttribute('data-difficulty') as DifficultyLevel;
        this.selectDifficulty(difficulty);
      });
    });

    // Custom difficulty
    const applyCustomBtn = this.container.querySelector('#applyCustomBtn') as HTMLButtonElement;
    applyCustomBtn?.addEventListener('click', () => {
      this.applyCustomDifficulty();
    });

    // AI feature toggles
    const enableHintsToggle = this.container.querySelector('#enableHints') as HTMLInputElement;
    const showProbabilitiesToggle = this.container.querySelector('#showProbabilities') as HTMLInputElement;
    const enableAdaptiveDifficultyToggle = this.container.querySelector('#enableAdaptiveDifficulty') as HTMLInputElement;

    enableHintsToggle?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.updateSetting('enableHints', target.checked);
    });

    showProbabilitiesToggle?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.updateSetting('showProbabilities', target.checked);
    });

    enableAdaptiveDifficultyToggle?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.updateSetting('enableAdaptiveDifficulty', target.checked);
    });

    // Difficulty override
    const overrideDifficultyBtn = this.container.querySelector('#overrideDifficultyBtn') as HTMLButtonElement;
    overrideDifficultyBtn?.addEventListener('click', () => {
      this.showDifficultyOverrideDialog();
    });
  }

  /**
   * Toggle pause state
   */
  private togglePause(): void {
    this.isPaused = !this.isPaused;
    const pauseBtn = this.container.querySelector('#pauseBtn') as HTMLButtonElement;
    
    if (this.isPaused) {
      pauseBtn.innerHTML = '<span class="btn-icon">▶️</span>Resume';
      this.stopTimer();
      this.config.onPauseToggle?.();
    } else {
      pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span>Pause';
      if (this.gameStats.gameState === 'playing') {
        this.startTimer();
      }
      this.config.onPauseToggle?.();
    }
  }

  /**
   * Select difficulty preset
   */
  private selectDifficulty(difficulty: DifficultyLevel): void {
    // Update active button
    const difficultyBtns = this.container.querySelectorAll('.difficulty-btn');
    difficultyBtns.forEach(btn => btn.classList.remove('active'));
    
    const selectedBtn = this.container.querySelector(`[data-difficulty="${difficulty}"]`);
    selectedBtn?.classList.add('active');
    
    // Update game config
    const difficultySettings = AdaptiveDifficultyManager.getDifficultyPreset(difficulty);
    this.gameConfig.difficulty = difficultySettings;
    
    this.config.onDifficultyChange?.(difficulty);
  }

  /**
   * Apply custom difficulty settings
   */
  private applyCustomDifficulty(): void {
    const widthInput = this.container.querySelector('#customWidth') as HTMLInputElement;
    const heightInput = this.container.querySelector('#customHeight') as HTMLInputElement;
    const minesInput = this.container.querySelector('#customMines') as HTMLInputElement;
    
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);
    const mineCount = parseInt(minesInput.value);
    
    // Validate inputs
    if (width < 5 || width > 30 || height < 5 || height > 24) {
      this.showNotification('Invalid board dimensions. Width: 5-30, Height: 5-24', 'error');
      return;
    }
    
    const maxMines = Math.floor((width * height) * 0.8); // Max 80% mines
    if (mineCount < 1 || mineCount > maxMines) {
      this.showNotification(`Invalid mine count. Must be between 1 and ${maxMines}`, 'error');
      return;
    }
    
    // Clear active difficulty buttons
    const difficultyBtns = this.container.querySelectorAll('.difficulty-btn');
    difficultyBtns.forEach(btn => btn.classList.remove('active'));
    
    // Update game config
    this.gameConfig.difficulty = {
      width,
      height,
      mineCount,
      level: DifficultyLevel.CUSTOM
    };
    
    this.config.onDifficultyChange?.(DifficultyLevel.CUSTOM);
    this.showNotification(`Custom difficulty applied: ${width}×${height}, ${mineCount} mines`, 'success');
  }

  /**
   * Update a game setting
   */
  private updateSetting(setting: keyof GameConfig, value: any): void {
    this.gameConfig[setting] = value;
    this.config.onSettingsChange?.({ [setting]: value });
    
    // Update UI based on setting
    if (setting === 'enableHints') {
      const hintBtn = this.container.querySelector('#hintBtn') as HTMLButtonElement;
      hintBtn.disabled = !value;
    }
  }

  /**
   * Show difficulty override dialog
   */
  private showDifficultyOverrideDialog(): void {
    // This would typically open a modal dialog
    // For now, we'll show a notification
    this.showNotification('Manual difficulty override activated. Adaptive difficulty temporarily disabled.', 'info');
  }

  /**
   * Update configuration display
   */
  private updateConfigurationDisplay(): void {
    // Update difficulty buttons
    const difficultyBtns = this.container.querySelectorAll('.difficulty-btn');
    difficultyBtns.forEach(btn => btn.classList.remove('active'));
    
    if (this.gameConfig.difficulty.level !== DifficultyLevel.CUSTOM) {
      const activeBtn = this.container.querySelector(`[data-difficulty="${this.gameConfig.difficulty.level}"]`);
      activeBtn?.classList.add('active');
    }
    
    // Update custom inputs
    const widthInput = this.container.querySelector('#customWidth') as HTMLInputElement;
    const heightInput = this.container.querySelector('#customHeight') as HTMLInputElement;
    const minesInput = this.container.querySelector('#customMines') as HTMLInputElement;
    
    if (widthInput) widthInput.value = this.gameConfig.difficulty.width.toString();
    if (heightInput) heightInput.value = this.gameConfig.difficulty.height.toString();
    if (minesInput) minesInput.value = this.gameConfig.difficulty.mineCount.toString();
    
    // Update feature toggles
    const enableHintsToggle = this.container.querySelector('#enableHints') as HTMLInputElement;
    const showProbabilitiesToggle = this.container.querySelector('#showProbabilities') as HTMLInputElement;
    const enableAdaptiveDifficultyToggle = this.container.querySelector('#enableAdaptiveDifficulty') as HTMLInputElement;
    
    if (enableHintsToggle) enableHintsToggle.checked = this.gameConfig.enableHints;
    if (showProbabilitiesToggle) showProbabilitiesToggle.checked = this.gameConfig.showProbabilities;
    if (enableAdaptiveDifficultyToggle) enableAdaptiveDifficultyToggle.checked = this.gameConfig.enableAdaptiveDifficulty;
    
    // Update adaptive difficulty display
    this.updateAdaptiveDifficultyDisplay();
  }

  /**
   * Update statistics display
   */
  private updateStatsDisplay(): void {
    const minesRemainingEl = this.container.querySelector('#minesRemaining') as HTMLElement;
    const timeElapsedEl = this.container.querySelector('#timeElapsed') as HTMLElement;
    const hintsUsedEl = this.container.querySelector('#hintsUsed') as HTMLElement;
    const gameStatusEl = this.container.querySelector('#gameStatus') as HTMLElement;
    const winRateEl = this.container.querySelector('#winRate') as HTMLElement;
    const averageTimeEl = this.container.querySelector('#averageTime') as HTMLElement;
    
    if (minesRemainingEl) minesRemainingEl.textContent = this.gameStats.minesRemaining.toString();
    if (timeElapsedEl) timeElapsedEl.textContent = this.formatTime(this.gameStats.timeElapsed);
    if (hintsUsedEl) hintsUsedEl.textContent = this.gameStats.hintsUsed.toString();
    
    if (gameStatusEl) {
      gameStatusEl.textContent = this.gameStats.gameState;
      gameStatusEl.className = `stat-value status ${this.gameStats.gameState}`;
    }
    
    if (winRateEl && this.gameStats.winRate !== undefined) {
      winRateEl.textContent = `${(this.gameStats.winRate * 100).toFixed(1)}%`;
    }
    
    if (averageTimeEl && this.gameStats.averageTime !== undefined) {
      averageTimeEl.textContent = this.formatTime(this.gameStats.averageTime);
    }
  }

  /**
   * Update adaptive difficulty display
   */
  private updateAdaptiveDifficultyDisplay(): void {
    const currentDifficultyLevelEl = this.container.querySelector('#currentDifficultyLevel') as HTMLElement;
    const difficultyDetailsEl = this.container.querySelector('#difficultyDetails') as HTMLElement;
    const adaptiveStatusEl = this.container.querySelector('#adaptiveStatus') as HTMLElement;
    
    if (currentDifficultyLevelEl) {
      currentDifficultyLevelEl.textContent = this.gameConfig.difficulty.level.charAt(0).toUpperCase() + 
                                           this.gameConfig.difficulty.level.slice(1);
    }
    
    if (difficultyDetailsEl) {
      const { width, height, mineCount } = this.gameConfig.difficulty;
      const density = ((mineCount / (width * height)) * 100).toFixed(1);
      difficultyDetailsEl.textContent = `${width}×${height} grid, ${mineCount} mines (${density}% density)`;
    }
    
    if (adaptiveStatusEl) {
      if (this.gameConfig.enableAdaptiveDifficulty) {
        adaptiveStatusEl.textContent = 'Monitoring performance...';
        adaptiveStatusEl.style.color = '#28a745';
      } else {
        adaptiveStatusEl.textContent = 'Adaptive difficulty disabled';
        adaptiveStatusEl.style.color = '#6c757d';
      }
    }
  }

  /**
   * Start the game timer
   */
  private startTimer(): void {
    if (this.gameTimer) return;
    
    this.startTime = new Date();
    this.gameTimer = window.setInterval(() => {
      if (!this.isPaused && this.startTime) {
        this.elapsedTime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
        this.gameStats.timeElapsed = this.elapsedTime;
        this.updateStatsDisplay();
      }
    }, 1000);
  }

  /**
   * Stop the game timer
   */
  private stopTimer(): void {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
  }

  /**
   * Format time in MM:SS format
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Update adaptive difficulty notification
   */
  updateAdaptiveDifficultyNotification(message: string, type: 'increase' | 'decrease' | 'manual_override'): void {
    let notificationType: 'info' | 'warning' | 'success' | 'error' = 'info';
    
    switch (type) {
      case 'increase':
        notificationType = 'success';
        break;
      case 'decrease':
        notificationType = 'warning';
        break;
      case 'manual_override':
        notificationType = 'info';
        break;
    }
    
    this.showNotification(message, notificationType);
    this.updateAdaptiveDifficultyDisplay();
  }

  /**
   * Get current configuration
   */
  getConfig(): GameConfig {
    return { ...this.gameConfig };
  }

  /**
   * Get current game statistics
   */
  getStats(): GameStats {
    return { ...this.gameStats };
  }

  /**
   * Destroy the control panel and clean up
   */
  destroy(): void {
    this.stopTimer();
    this.container.innerHTML = '';
  }
}