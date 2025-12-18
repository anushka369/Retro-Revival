// Main entry point for AI Minesweeper
import { DifficultyLevel, HintSuggestion, GameState } from '@/types';
import { IGameBoard } from '@/interfaces/GameEngine';
import { GameLogic } from '@/game/GameLogic';
import { ProbabilityCalculator } from '@/ai/ProbabilityCalculator';
import { ProbabilityCalculatorWithWorker } from '@/ai/ProbabilityCalculatorWithWorker';
import { HintEngine } from '@/ai/HintEngine';
import { GameRenderer } from '@/ui/GameRenderer';
import { ProbabilityControls } from '@/ui/ProbabilityControls';
import { ProbabilityDetailLevel } from '@/ui/ProbabilityVisualizer';
import { AdaptiveDifficultyManager } from '@/adaptive/AdaptiveDifficultyManager';
import { ProfileManager } from '@/adaptive/ProfileManager';
import { GameResult } from '@/adaptive/PlayerProfile';
import { ErrorHandler, ErrorType } from '@/utils/ErrorHandler';
import { PerformanceMonitor, MemoryManager } from '@/utils/PerformanceMonitor';

console.log('AI Minesweeper initializing...');

// Initialize error handling and performance monitoring
const errorHandler = ErrorHandler.getInstance();
const performanceMonitor = PerformanceMonitor.getInstance();

// Setup error handling for the application
errorHandler.addErrorListener((error) => {
  console.log(`Error handled: ${error.type} - ${error.message}`);
  
  // Show user-friendly error messages for critical errors
  if (error.severity === 'critical' && !error.recovered) {
    showErrorNotification('A critical error occurred. The game will attempt to recover.');
  }
});

// Start memory management
MemoryManager.startAutoCleanup();

// Register cleanup callbacks
MemoryManager.registerCleanupCallback(() => {
  // Clear old game data
  if (currentBoard) {
    console.log('Cleaning up game data for memory optimization');
  }
});

// Initialize game components with error handling
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
  errorHandler.handleError(
    ErrorType.CANVAS_RENDERING,
    'Canvas element not found in DOM',
    { elementId: 'gameCanvas' },
    'main.ts initialization'
  );
  throw new Error('Canvas element not found');
}

let renderer: GameRenderer;
let probabilityCalculator: ProbabilityCalculator | ProbabilityCalculatorWithWorker;
let hintEngine: HintEngine;
let gameLogic: GameLogic;

try {
  renderer = new GameRenderer(canvas);
  
  // Use Web Worker calculator for better performance on larger boards
  const useWorkerCalculator = true; // Could be a setting
  probabilityCalculator = useWorkerCalculator 
    ? new ProbabilityCalculatorWithWorker()
    : new ProbabilityCalculator();
    
  hintEngine = new HintEngine();
  gameLogic = new GameLogic();
  
  console.log('Game components initialized successfully');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  errorHandler.handleError(
    ErrorType.GAME_LOGIC,
    'Failed to initialize game components',
    { error: errorMessage },
    'main.ts initialization',
    error instanceof Error ? error : new Error(String(error))
  );
  throw error;
}

// Initialize adaptive difficulty system
const profileManager = new ProfileManager();
profileManager.initialize('default'); // Initialize with default profile
const adaptiveDifficultyManager = new AdaptiveDifficultyManager(profileManager);

// Game state
let currentBoard: IGameBoard | null = null;
let currentProbabilities: any = null;
let currentHint: HintSuggestion | null = null;
let gameStartTime: Date | null = null;
let currentGameId: string | null = null;

// Initialize probability controls
const probabilityControls = new ProbabilityControls({
  containerId: 'probabilityControls',
  onDetailLevelChange: (level: ProbabilityDetailLevel) => {
    renderer.getProbabilityVisualizer().setDetailLevel(level);
    if (currentBoard && currentProbabilities) {
      renderer.render(currentBoard, currentProbabilities);
    }
  },
  onColorSchemeChange: (scheme: 'default' | 'colorblind') => {
    renderer.getProbabilityVisualizer().setColorScheme(scheme);
    if (currentBoard && currentProbabilities) {
      renderer.render(currentBoard, currentProbabilities);
    }
  },
  onPercentageToggle: (show: boolean) => {
    const config = renderer.getProbabilityVisualizer().getConfig();
    config.showPercentages = show;
    renderer.getProbabilityVisualizer().setConfig(config);
    if (currentBoard && currentProbabilities) {
      renderer.render(currentBoard, currentProbabilities);
    }
  }
});

// Create a new game
async function createNewGame(): Promise<void> {
  const measureId = performanceMonitor.startMeasure('create_new_game');
  
  try {
    // Get current difficulty from adaptive difficulty manager
    const difficulty = adaptiveDifficultyManager.getCurrentDifficulty();
    
    currentBoard = gameLogic.createBoard(difficulty);
    if (currentBoard) {
      // Use async calculation if available
      if (probabilityCalculator instanceof ProbabilityCalculatorWithWorker) {
        currentProbabilities = await probabilityCalculator.calculateProbabilities(currentBoard);
      } else {
        currentProbabilities = probabilityCalculator.calculateProbabilities(currentBoard);
      }
    }
    currentHint = null;
    gameStartTime = new Date();
    currentGameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    updateUI();
    updateDifficultyDisplay();
    
    console.log('New game created with difficulty:', difficulty);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errorHandler.handleError(
      ErrorType.GAME_LOGIC,
      'Failed to create new game',
      { error: errorMessage },
      'createNewGame',
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    performanceMonitor.endMeasure(measureId);
  }
}

// Handle cell clicks
async function handleCellClick(x: number, y: number, isRightClick: boolean = false): Promise<void> {
  if (!currentBoard) return;
  
  const measureId = performanceMonitor.startMeasure('handle_cell_click', { x, y, isRightClick });
  
  try {
    const action = isRightClick ? 'flag' : 'reveal';
    const moveSuccessful = gameLogic.makeMove(currentBoard, x, y, action);
    
    if (moveSuccessful) {
      // Clear current hint when a move is made
      currentHint = null;
      
      // Recalculate probabilities after move (async if using worker)
      if (probabilityCalculator instanceof ProbabilityCalculatorWithWorker) {
        currentProbabilities = await probabilityCalculator.calculateProbabilities(currentBoard);
      } else {
        currentProbabilities = probabilityCalculator.calculateProbabilities(currentBoard);
      }
      
      // Check if game is finished and process result
      const gameState = currentBoard.getGameState();
      if (gameState === GameState.WON || gameState === GameState.LOST) {
        processGameCompletion(gameState === GameState.WON);
      }
      
      updateUI();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errorHandler.handleError(
      ErrorType.GAME_LOGIC,
      'Failed to handle cell click',
      { x, y, isRightClick, error: errorMessage },
      'handleCellClick',
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    performanceMonitor.endMeasure(measureId);
  }
}

// Process game completion and update difficulty
function processGameCompletion(won: boolean): void {
  if (!currentBoard || !gameStartTime || !currentGameId) return;
  
  const endTime = new Date();
  const playTime = Math.floor((endTime.getTime() - gameStartTime.getTime()) / 1000);
  const hintsUsed = gameLogic.getHintsUsedCount();
  const difficulty = adaptiveDifficultyManager.getCurrentDifficulty();
  
  // Create game result
  const gameResult: GameResult = {
    gameId: currentGameId,
    won,
    playTime,
    hintsUsed,
    difficulty: difficulty.level,
    timestamp: endTime,
    boardSize: { width: currentBoard.getWidth(), height: currentBoard.getHeight() },
    mineCount: currentBoard.getMineCount()
  };
  
  // Record result in profile manager
  profileManager.recordGameResult(gameResult);
  
  // Process result through adaptive difficulty manager
  const difficultyAdjustment = adaptiveDifficultyManager.processGameResult(gameResult);
  
  if (difficultyAdjustment) {
    console.log('Difficulty adjusted:', difficultyAdjustment);
    updateDifficultyDisplay();
  }
  
  // Display notifications
  displayDifficultyNotifications();
  
  console.log(`Game ${won ? 'won' : 'lost'} in ${playTime}s with ${hintsUsed} hints`);
}

// Handle hint request
function handleHintRequest(): void {
  if (!currentBoard || !currentProbabilities) return;
  
  // Generate hint using the hint engine
  const hint = hintEngine.generateHint(currentBoard, currentProbabilities);
  
  if (hint) {
    currentHint = hint;
    
    // Store hint in game logic for analysis
    gameLogic.recordHintUsage(hint);
    
    console.log(`Hint generated: ${hint.action} cell (${hint.cell.x}, ${hint.cell.y}) - ${hint.reasoning}`);
    
    updateUI();
  } else {
    console.log('No hint available');
  }
}

// Update UI elements
function updateUI(): void {
  if (!currentBoard) return;
  
  // Render the game board
  renderer.render(currentBoard, currentProbabilities);
  
  // Render hint if available
  if (currentHint) {
    renderer.renderHint(currentHint);
  }
  
  // Update game info
  updateGameInfo();
}

// Update game information display
function updateGameInfo(): void {
  if (!currentBoard) return;
  
  const mineCountElement = document.getElementById('mineCount');
  const gameStatusElement = document.getElementById('gameStatus');
  const hintsUsedElement = document.getElementById('hintsUsed');
  
  if (mineCountElement) {
    mineCountElement.textContent = currentBoard.getRemainingMines().toString();
  }
  
  if (gameStatusElement) {
    const gameState = currentBoard.getGameState();
    gameStatusElement.textContent = gameState.charAt(0).toUpperCase() + gameState.slice(1);
  }
  
  if (hintsUsedElement) {
    hintsUsedElement.textContent = gameLogic.getHintsUsedCount().toString();
  }
}

// Update difficulty display
function updateDifficultyDisplay(): void {
  const difficultyElement = document.getElementById('currentDifficulty');
  if (difficultyElement) {
    const difficulty = adaptiveDifficultyManager.getCurrentDifficulty();
    const density = ((difficulty.mineCount / (difficulty.width * difficulty.height)) * 100).toFixed(1);
    difficultyElement.textContent = `${difficulty.level} (${difficulty.width}×${difficulty.height}, ${difficulty.mineCount} mines, ${density}% density)`;
  }
}

// Display difficulty notifications
function displayDifficultyNotifications(): void {
  const notifications = adaptiveDifficultyManager.getUnacknowledgedNotifications();
  const notificationContainer = document.getElementById('difficultyNotifications');
  
  if (!notificationContainer || notifications.length === 0) return;
  
  // Clear existing notifications
  notificationContainer.innerHTML = '';
  
  notifications.forEach(notification => {
    const notificationElement = document.createElement('div');
    notificationElement.className = `notification notification-${notification.type}`;
    notificationElement.innerHTML = `
      <div class="notification-content">
        <p>${notification.message}</p>
        <button onclick="acknowledgeNotification('${notification.id}')">OK</button>
      </div>
    `;
    notificationContainer.appendChild(notificationElement);
  });
}

// Acknowledge a notification
function acknowledgeNotification(notificationId: string): void {
  adaptiveDifficultyManager.acknowledgeNotification(notificationId);
  displayDifficultyNotifications();
}

// Handle manual difficulty selection
function handleDifficultyChange(level: DifficultyLevel): void {
  const difficulty = AdaptiveDifficultyManager.getDifficultyPreset(level);
  adaptiveDifficultyManager.setDifficulty(difficulty, true);
  updateDifficultyDisplay();
  
  // Start a new game with the new difficulty
  createNewGame();
}

// Create difficulty controls
function createDifficultyControls(): void {
  const controlsContainer = document.getElementById('difficultyControls');
  if (!controlsContainer) return;
  
  const difficulties = [
    { level: DifficultyLevel.BEGINNER, label: 'Beginner' },
    { level: DifficultyLevel.INTERMEDIATE, label: 'Intermediate' },
    { level: DifficultyLevel.EXPERT, label: 'Expert' }
  ];
  
  controlsContainer.innerHTML = `
    <h3>Difficulty Settings</h3>
    <div class="difficulty-buttons">
      ${difficulties.map(diff => 
        `<button onclick="handleDifficultyChange('${diff.level}')">${diff.label}</button>`
      ).join('')}
    </div>
    <p>Current: <span id="currentDifficulty">Loading...</span></p>
    <div class="adaptive-info">
      <p><small>Difficulty automatically adjusts based on your performance</small></p>
    </div>
  `;
}

// Canvas event listeners for mouse
canvas.addEventListener('click', async (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const cellCoords = renderer.screenToCell(mouseX, mouseY);
  if (cellCoords) {
    await handleCellClick(cellCoords.x, cellCoords.y, false);
  }
});

canvas.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const cellCoords = renderer.screenToCell(mouseX, mouseY);
  if (cellCoords) {
    await handleCellClick(cellCoords.x, cellCoords.y, true);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!currentBoard) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  renderer.handleMouseMove(mouseX, mouseY, currentBoard, currentProbabilities);
});

// Canvas event listeners for touch
canvas.addEventListener('cellTap', async (e: Event) => {
  const customEvent = e as CustomEvent;
  const { x, y } = customEvent.detail;
  await handleCellClick(x, y, false);
});

canvas.addEventListener('cellLongPress', async (e: Event) => {
  const customEvent = e as CustomEvent;
  const { x, y } = customEvent.detail;
  await handleCellClick(x, y, true);
});

// Canvas event listeners for accessibility
canvas.addEventListener('hintRequest', () => {
  handleHintRequest();
});

// Handle window resize for responsive layout
window.addEventListener('resize', () => {
  renderer.adaptLayoutForScreen();
  updateUI();
});

// Initial layout adaptation
renderer.adaptLayoutForScreen();

// Control button event listeners
document.getElementById('newGameBtn')?.addEventListener('click', async () => {
  await createNewGame();
});

document.getElementById('hintBtn')?.addEventListener('click', () => {
  handleHintRequest();
});

document.getElementById('toggleProbabilityBtn')?.addEventListener('click', () => {
  const visualizer = renderer.getProbabilityVisualizer();
  const newLevel = visualizer.toggleDetailLevel();
  console.log(`Probability display toggled to: ${newLevel}`);
  
  updateUI();
});

// Accessibility control event listeners
document.getElementById('highContrastToggle')?.addEventListener('change', (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  renderer.setHighContrastMode(enabled);
  updateUI();
});

document.getElementById('colorBlindToggle')?.addEventListener('change', (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  renderer.setColorBlindFriendlyMode(enabled);
  updateUI();
});

document.getElementById('focusGameBtn')?.addEventListener('click', () => {
  renderer.focus();
});

// Helper function to show error notifications
function showErrorNotification(message: string): void {
  const notificationContainer = document.getElementById('errorNotifications');
  if (!notificationContainer) return;
  
  const notification = document.createElement('div');
  notification.className = 'notification notification-error';
  notification.innerHTML = `
    <div class="notification-content">
      <p>${message}</p>
      <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
    </div>
  `;
  notificationContainer.appendChild(notification);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

// Performance monitoring UI
function showPerformanceStats(): void {
  const report = performanceMonitor.getPerformanceReport();
  console.log('Performance Report:', report);
  
  if (report.healthScore < 50) {
    const optimization = performanceMonitor.optimizePerformance();
    console.warn('Performance issues detected:', optimization.recommendations);
  }
}

// Add performance stats button (if element exists)
document.getElementById('performanceStatsBtn')?.addEventListener('click', () => {
  showPerformanceStats();
});

// Periodic performance check
setInterval(() => {
  const report = performanceMonitor.getPerformanceReport();
  if (report.healthScore < 30) {
    console.warn('Critical performance issues detected');
    const optimization = performanceMonitor.optimizePerformance();
    
    // Apply automatic optimizations
    if (optimization.actions.includes('cleanup_memory')) {
      MemoryManager.performCleanup();
    }
    
    if (optimization.actions.includes('reduce_visual_effects')) {
      renderer.setAnimationEnabled(false);
    }
  }
}, 60000); // Check every minute

// Make functions available globally for HTML onclick handlers
(window as any).acknowledgeNotification = acknowledgeNotification;
(window as any).handleDifficultyChange = handleDifficultyChange;
(window as any).showPerformanceStats = showPerformanceStats;

// Initialize difficulty controls and game
createDifficultyControls();
createNewGame();

// Log successful initialization
console.log('AI Minesweeper setup complete!');
console.log('Probability controls initialized:', probabilityControls.getConfig());
console.log('Adaptive difficulty initialized with profile:', profileManager.getCurrentProfile());
console.log('Error handling and performance monitoring active');

// Log system health
const healthReport = errorHandler.getHealthReport();
console.log('System health:', healthReport.healthy ? 'Good' : 'Issues detected', healthReport);