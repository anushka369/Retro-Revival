import { IGameRenderer } from '@/interfaces/UIComponents';
import { IGameBoard } from '@/interfaces/GameEngine';
import { ProbabilityMap, Cell, GameState, HintSuggestion } from '@/types';
import { ProbabilityVisualizer } from './ProbabilityVisualizer';
import { ErrorHandler, ErrorType, safeSync, safeAsync } from '@/utils/ErrorHandler';

export class GameRenderer implements IGameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private probabilityVisualizer: ProbabilityVisualizer;
  private cellSize: number = 40;
  private offsetX: number = 10;
  private offsetY: number = 10;
  private animationEnabled: boolean = true;
  
  // Touch control properties
  private isTouchDevice: boolean = false;
  private touchStartTime: number = 0;
  private touchStartPosition: { x: number; y: number } | null = null;
  private longPressThreshold: number = 500; // ms for long press to trigger flag
  private touchMoveThreshold: number = 10; // pixels before considering it a drag
  private longPressTimer: number | null = null;
  
  // Accessibility properties
  private focusedCell: { x: number; y: number } | null = null;
  private highContrastMode: boolean = false;
  private colorBlindFriendlyMode: boolean = false;
  private screenReaderEnabled: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    const errorHandler = ErrorHandler.getInstance();
    
    try {
      if (!canvas) {
        throw new Error('Canvas element is null or undefined');
      }

      this.canvas = canvas;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D context from canvas - WebGL may be disabled or unavailable');
      }
      this.ctx = context;
      
      // Setup error recovery for canvas context loss
      this.setupCanvasErrorHandling();
      
      this.probabilityVisualizer = new ProbabilityVisualizer(canvas);
      this.probabilityVisualizer.setCellSize(this.cellSize);
      this.probabilityVisualizer.setOffset(this.offsetX, this.offsetY);
      
      // Detect touch device and adapt cell size
      this.detectTouchDevice();
      this.adaptForMobile();
      
      // Setup accessibility features
      this.setupAccessibility();
    } catch (error) {
      errorHandler.handleError(
        ErrorType.CANVAS_RENDERING,
        'Failed to initialize GameRenderer',
        { error: error.message },
        'GameRenderer.constructor',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Render the complete game board
   */
  render(board: IGameBoard, probabilities?: ProbabilityMap): void {
    safeSync(
      () => {
        if (!board) {
          throw new Error('Board is null or undefined');
        }

        // Check if canvas context is still valid
        if (!this.ctx || this.ctx.canvas !== this.canvas) {
          this.recoverCanvasContext();
        }

        this.clearCanvas();
        
        // Calculate canvas size based on board dimensions
        const boardWidth = board.getWidth() * this.cellSize + this.offsetX * 2;
        const boardHeight = board.getHeight() * this.cellSize + this.offsetY * 2;
        
        if (this.canvas.width !== boardWidth || this.canvas.height !== boardHeight) {
          this.resize(boardWidth, boardHeight);
        }

        // Render all cells
        const cells = board.getCells();
        for (let y = 0; y < board.getHeight(); y++) {
          for (let x = 0; x < board.getWidth(); x++) {
            this.renderCell(x, y, cells[y][x]);
          }
        }

        // Render probabilities if available
        if (probabilities) {
          this.renderProbabilities(probabilities, board);
        }

        // Render game state overlay if needed
        this.renderGameStateOverlay(board.getGameState());
        
        // Render focus indicator if keyboard navigation is active
        if (this.focusedCell) {
          this.renderFocusIndicator(this.focusedCell.x, this.focusedCell.y);
        }
      },
      ErrorType.CANVAS_RENDERING,
      undefined,
      'GameRenderer.render'
    );
  }

  /**
   * Render a single cell
   */
  renderCell(x: number, y: number, cell: Cell): void {
    safeSync(
      () => {
        if (!cell) {
          throw new Error(`Cell at (${x}, ${y}) is null or undefined`);
        }

        const screenX = this.offsetX + x * this.cellSize;
        const screenY = this.offsetY + y * this.cellSize;

        // Validate screen coordinates
        if (screenX < 0 || screenY < 0 || screenX > this.canvas.width || screenY > this.canvas.height) {
          console.warn(`Cell (${x}, ${y}) is outside canvas bounds`);
          return;
        }

        // Draw cell background
        if (cell.isRevealed) {
          if (cell.isMine) {
            this.ctx.fillStyle = this.highContrastMode ? '#ff0000' : '#ff4444';
          } else {
            this.ctx.fillStyle = this.highContrastMode ? '#ffffff' : '#e8e8e8';
          }
        } else {
          this.ctx.fillStyle = this.highContrastMode ? '#cccccc' : '#c0c0c0';
        }
        
        this.ctx.fillRect(screenX, screenY, this.cellSize, this.cellSize);

        // Draw cell border
        this.ctx.strokeStyle = this.highContrastMode ? '#000000' : '#808080';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(screenX, screenY, this.cellSize, this.cellSize);

        // Draw cell content
        if (cell.isRevealed) {
          if (cell.isMine) {
            this.drawMine(screenX, screenY);
          } else if (cell.adjacentMines > 0) {
            this.drawNumber(screenX, screenY, cell.adjacentMines);
          }
        } else if (cell.isFlagged) {
          this.drawFlag(screenX, screenY);
        }

        // Draw raised effect for unrevealed cells
        if (!cell.isRevealed) {
          this.drawRaisedEffect(screenX, screenY);
        }
      },
      ErrorType.CANVAS_RENDERING,
      undefined,
      'GameRenderer.renderCell'
    );
  }

  /**
   * Draw a mine symbol
   */
  private drawMine(screenX: number, screenY: number): void {
    const centerX = screenX + this.cellSize / 2;
    const centerY = screenY + this.cellSize / 2;
    const radius = this.cellSize * 0.3;

    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw mine spikes
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    const spikeLength = radius * 0.6;
    
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const startX = centerX + Math.cos(angle) * radius;
      const startY = centerY + Math.sin(angle) * radius;
      const endX = centerX + Math.cos(angle) * (radius + spikeLength);
      const endY = centerY + Math.sin(angle) * (radius + spikeLength);
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    }
  }

  /**
   * Draw a number
   */
  private drawNumber(screenX: number, screenY: number, number: number): void {
    const colors = [
      '', '#0000ff', '#008000', '#ff0000', '#800080',
      '#800000', '#008080', '#000000', '#808080'
    ];
    
    this.ctx.fillStyle = colors[number] || '#000';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      number.toString(),
      screenX + this.cellSize / 2,
      screenY + this.cellSize / 2
    );
  }

  /**
   * Draw a flag
   */
  private drawFlag(screenX: number, screenY: number): void {
    const centerX = screenX + this.cellSize / 2;
    const centerY = screenY + this.cellSize / 2;
    
    // Flag pole
    this.ctx.strokeStyle = '#654321';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY - this.cellSize * 0.3);
    this.ctx.lineTo(centerX, centerY + this.cellSize * 0.3);
    this.ctx.stroke();
    
    // Flag
    this.ctx.fillStyle = '#ff0000';
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY - this.cellSize * 0.3);
    this.ctx.lineTo(centerX + this.cellSize * 0.25, centerY - this.cellSize * 0.15);
    this.ctx.lineTo(centerX, centerY);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Draw raised effect for unrevealed cells
   */
  private drawRaisedEffect(screenX: number, screenY: number): void {
    // Light edge (top and left)
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(screenX, screenY + this.cellSize);
    this.ctx.lineTo(screenX, screenY);
    this.ctx.lineTo(screenX + this.cellSize, screenY);
    this.ctx.stroke();
    
    // Dark edge (bottom and right)
    this.ctx.strokeStyle = '#808080';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(screenX + this.cellSize, screenY);
    this.ctx.lineTo(screenX + this.cellSize, screenY + this.cellSize);
    this.ctx.lineTo(screenX, screenY + this.cellSize);
    this.ctx.stroke();
  }

  /**
   * Render probabilities using the probability visualizer
   */
  renderProbabilities(probabilities: ProbabilityMap, board?: IGameBoard): void {
    if (board) {
      this.probabilityVisualizer.renderProbabilities(board, probabilities);
    }
  }

  /**
   * Render a hint highlight
   */
  renderHint(hint: HintSuggestion): void {
    const screenX = this.offsetX + hint.cell.x * this.cellSize;
    const screenY = this.offsetY + hint.cell.y * this.cellSize;
    
    // Draw bright highlight border
    this.ctx.strokeStyle = '#ffff00';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(screenX - 2, screenY - 2, this.cellSize + 4, this.cellSize + 4);
    
    // Draw inner glow effect
    this.ctx.strokeStyle = '#ffff00';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(screenX + 1, screenY + 1, this.cellSize - 2, this.cellSize - 2);
    
    // Add action indicator
    const centerX = screenX + this.cellSize / 2;
    const centerY = screenY + this.cellSize / 2;
    
    if (hint.action === 'flag') {
      // Draw flag indicator
      this.ctx.fillStyle = '#ff0000';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('F', centerX, centerY - this.cellSize * 0.3);
    } else if (hint.action === 'reveal') {
      // Draw reveal indicator (arrow pointing down)
      this.ctx.fillStyle = '#00ff00';
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY - this.cellSize * 0.2);
      this.ctx.lineTo(centerX - this.cellSize * 0.1, centerY - this.cellSize * 0.3);
      this.ctx.lineTo(centerX + this.cellSize * 0.1, centerY - this.cellSize * 0.3);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  /**
   * Render game state overlay (win/lose messages)
   */
  private renderGameStateOverlay(gameState: GameState): void {
    if (gameState === GameState.WON || gameState === GameState.LOST) {
      // Semi-transparent overlay
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Message text
      const message = gameState === GameState.WON ? 'YOU WON!' : 'GAME OVER';
      const color = gameState === GameState.WON ? '#00ff00' : '#ff0000';
      
      this.ctx.fillStyle = color;
      this.ctx.font = 'bold 48px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        message,
        this.canvas.width / 2,
        this.canvas.height / 2
      );
    }
  }

  /**
   * Clear the canvas
   */
  clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#f0f0f0';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Resize the canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Enable/disable animations
   */
  setAnimationEnabled(enabled: boolean): void {
    this.animationEnabled = enabled;
  }

  /**
   * Animate cell reveal
   */
  async animateCellReveal(x: number, y: number): Promise<void> {
    if (!this.animationEnabled) {
      return;
    }

    const screenX = this.offsetX + x * this.cellSize;
    const screenY = this.offsetY + y * this.cellSize;
    
    // Simple scale animation
    const duration = 200;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const scale = 0.8 + 0.2 * (1 - Math.pow(1 - progress, 3));
        
        // Clear and redraw the cell with scaling
        this.ctx.save();
        this.ctx.translate(screenX + this.cellSize / 2, screenY + this.cellSize / 2);
        this.ctx.scale(scale, scale);
        this.ctx.translate(-this.cellSize / 2, -this.cellSize / 2);
        
        // Redraw cell (simplified for animation)
        this.ctx.fillStyle = '#e8e8e8';
        this.ctx.fillRect(0, 0, this.cellSize, this.cellSize);
        this.ctx.strokeStyle = '#808080';
        this.ctx.strokeRect(0, 0, this.cellSize, this.cellSize);
        
        this.ctx.restore();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      animate();
    });
  }

  /**
   * Handle mouse hover for probability tooltips
   */
  handleMouseMove(mouseX: number, mouseY: number, board: IGameBoard, probabilities?: ProbabilityMap): void {
    const cellCoords = this.probabilityVisualizer.screenToCell(mouseX, mouseY);
    
    if (cellCoords && board.isValidPosition(cellCoords.x, cellCoords.y)) {
      const cell = board.getCell(cellCoords.x, cellCoords.y);
      
      if (cell && !cell.isRevealed && !cell.isFlagged && probabilities) {
        const key = `${cellCoords.x},${cellCoords.y}`;
        const probability = probabilities.cellProbabilities.get(key) || 0;
        
        this.probabilityVisualizer.setHoveredCell(cellCoords.x, cellCoords.y);
        
        // Re-render to show tooltip
        this.render(board, probabilities);
        this.probabilityVisualizer.renderTooltip(cellCoords.x, cellCoords.y, probability);
      } else {
        this.probabilityVisualizer.setHoveredCell(null, null);
      }
    } else {
      this.probabilityVisualizer.setHoveredCell(null, null);
    }
  }

  /**
   * Get the probability visualizer
   */
  getProbabilityVisualizer(): ProbabilityVisualizer {
    return this.probabilityVisualizer;
  }

  /**
   * Convert screen coordinates to cell coordinates
   */
  screenToCell(screenX: number, screenY: number): { x: number; y: number } | null {
    return this.probabilityVisualizer.screenToCell(screenX, screenY);
  }

  /**
   * Set cell size and update visualizer
   */
  setCellSize(size: number): void {
    this.cellSize = size;
    this.probabilityVisualizer.setCellSize(size);
  }

  /**
   * Set rendering offset and update visualizer
   */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
    this.probabilityVisualizer.setOffset(x, y);
  }

  /**
   * Detect if device supports touch
   */
  private detectTouchDevice(): void {
    this.isTouchDevice = 'ontouchstart' in window || 
                        navigator.maxTouchPoints > 0 || 
                        (navigator as any).msMaxTouchPoints > 0;
  }

  /**
   * Adapt UI for mobile devices
   */
  private adaptForMobile(): void {
    if (this.isTouchDevice) {
      // Increase cell size for better touch targets
      this.cellSize = Math.max(50, this.cellSize);
      this.probabilityVisualizer.setCellSize(this.cellSize);
      
      // Add touch event listeners
      this.setupTouchEventListeners();
    }
  }

  /**
   * Setup touch event listeners for mobile interaction
   */
  private setupTouchEventListeners(): void {
    // Prevent default touch behaviors that interfere with game
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
    
    // Prevent context menu on long press
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Handle touch start events
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      
      this.touchStartTime = Date.now();
      this.touchStartPosition = { x: touchX, y: touchY };
      
      // Start long press timer for flagging
      this.longPressTimer = window.setTimeout(() => {
        this.handleLongPress(touchX, touchY);
      }, this.longPressThreshold);
      
      // Provide visual feedback for touch
      this.showTouchFeedback(touchX, touchY);
    }
  }

  /**
   * Handle touch move events
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    if (event.touches.length === 1 && this.touchStartPosition) {
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      
      // Check if touch has moved beyond threshold
      const deltaX = Math.abs(touchX - this.touchStartPosition.x);
      const deltaY = Math.abs(touchY - this.touchStartPosition.y);
      
      if (deltaX > this.touchMoveThreshold || deltaY > this.touchMoveThreshold) {
        // Cancel long press if touch moves too much
        this.cancelLongPress();
      }
    }
  }

  /**
   * Handle touch end events
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    if (this.touchStartPosition && this.longPressTimer) {
      const touchDuration = Date.now() - this.touchStartTime;
      
      // If it was a short tap (not a long press), treat as reveal
      if (touchDuration < this.longPressThreshold) {
        this.handleTouchTap(this.touchStartPosition.x, this.touchStartPosition.y);
      }
    }
    
    this.cancelLongPress();
    this.clearTouchFeedback();
  }

  /**
   * Handle touch cancel events
   */
  private handleTouchCancel(event: TouchEvent): void {
    event.preventDefault();
    this.cancelLongPress();
    this.clearTouchFeedback();
  }

  /**
   * Handle long press for flagging
   */
  private handleLongPress(x: number, y: number): void {
    const cellCoords = this.screenToCell(x, y);
    if (cellCoords) {
      // Dispatch custom event for long press (flag action)
      const event = new CustomEvent('cellLongPress', {
        detail: { x: cellCoords.x, y: cellCoords.y }
      });
      this.canvas.dispatchEvent(event);
      
      // Provide haptic feedback if available
      this.provideHapticFeedback();
    }
    this.longPressTimer = null;
  }

  /**
   * Handle tap for revealing
   */
  private handleTouchTap(x: number, y: number): void {
    const cellCoords = this.screenToCell(x, y);
    if (cellCoords) {
      // Dispatch custom event for tap (reveal action)
      const event = new CustomEvent('cellTap', {
        detail: { x: cellCoords.x, y: cellCoords.y }
      });
      this.canvas.dispatchEvent(event);
    }
  }

  /**
   * Cancel long press timer
   */
  private cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.touchStartPosition = null;
  }

  /**
   * Show visual feedback for touch
   */
  private showTouchFeedback(x: number, y: number): void {
    const cellCoords = this.screenToCell(x, y);
    if (cellCoords) {
      const screenX = this.offsetX + cellCoords.x * this.cellSize;
      const screenY = this.offsetY + cellCoords.y * this.cellSize;
      
      // Draw touch feedback overlay
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
      this.ctx.fillRect(screenX, screenY, this.cellSize, this.cellSize);
      this.ctx.restore();
    }
  }

  /**
   * Clear touch feedback
   */
  private clearTouchFeedback(): void {
    // Touch feedback is cleared on next render
  }

  /**
   * Provide haptic feedback if available
   */
  private provideHapticFeedback(): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Short vibration for flag action
    }
  }

  /**
   * Check if device is touch-enabled
   */
  isTouchEnabled(): boolean {
    return this.isTouchDevice;
  }

  /**
   * Get optimal cell size for current device
   */
  getOptimalCellSize(): number {
    if (this.isTouchDevice) {
      // Larger cells for touch devices
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const minDimension = Math.min(screenWidth, screenHeight);
      
      // Calculate cell size based on screen size, ensuring minimum touch target
      return Math.max(50, Math.min(80, Math.floor(minDimension / 12)));
    }
    return 40; // Default for desktop
  }

  /**
   * Adapt layout for current screen size
   */
  adaptLayoutForScreen(): void {
    const optimalCellSize = this.getOptimalCellSize();
    this.setCellSize(optimalCellSize);
    
    // Adjust canvas size for mobile
    if (this.isTouchDevice) {
      const maxWidth = Math.min(window.innerWidth - 40, 600);
      const maxHeight = Math.min(window.innerHeight - 200, 600);
      
      this.canvas.style.maxWidth = `${maxWidth}px`;
      this.canvas.style.maxHeight = `${maxHeight}px`;
    }
  }

  /**
   * Setup accessibility features
   */
  private setupAccessibility(): void {
    // Make canvas focusable for keyboard navigation
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('role', 'grid');
    this.canvas.setAttribute('aria-label', 'Minesweeper game board');
    
    // Add keyboard event listeners
    this.setupKeyboardNavigation();
    
    // Detect screen reader
    this.detectScreenReader();
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    this.canvas.addEventListener('keydown', (e) => {
      this.handleKeyboardInput(e);
    });
    
    this.canvas.addEventListener('focus', () => {
      // Initialize focus to center of board if not set
      if (!this.focusedCell) {
        this.focusedCell = { x: 4, y: 4 }; // Default to center
      }
    });
  }

  /**
   * Handle keyboard input for navigation and actions
   */
  private handleKeyboardInput(event: KeyboardEvent): void {
    if (!this.focusedCell) {
      this.focusedCell = { x: 0, y: 0 };
    }

    let newX = this.focusedCell.x;
    let newY = this.focusedCell.y;
    let actionTaken = false;

    switch (event.key) {
      case 'ArrowUp':
        newY = Math.max(0, newY - 1);
        actionTaken = true;
        break;
      case 'ArrowDown':
        newY = Math.min(15, newY + 1); // Assuming max 16x16 board
        actionTaken = true;
        break;
      case 'ArrowLeft':
        newX = Math.max(0, newX - 1);
        actionTaken = true;
        break;
      case 'ArrowRight':
        newX = Math.min(15, newX + 1); // Assuming max 16x16 board
        actionTaken = true;
        break;
      case 'Enter':
      case ' ':
        // Reveal cell
        this.dispatchCellAction(this.focusedCell.x, this.focusedCell.y, 'reveal');
        actionTaken = true;
        break;
      case 'f':
      case 'F':
        // Flag cell
        this.dispatchCellAction(this.focusedCell.x, this.focusedCell.y, 'flag');
        actionTaken = true;
        break;
      case 'h':
      case 'H':
        // Request hint
        this.dispatchHintRequest();
        actionTaken = true;
        break;
    }

    if (actionTaken) {
      event.preventDefault();
      
      // Update focused cell position
      if (newX !== this.focusedCell.x || newY !== this.focusedCell.y) {
        this.focusedCell = { x: newX, y: newY };
        this.announceCell(newX, newY);
      }
    }
  }

  /**
   * Dispatch cell action event
   */
  private dispatchCellAction(x: number, y: number, action: 'reveal' | 'flag'): void {
    const eventName = action === 'reveal' ? 'cellTap' : 'cellLongPress';
    const event = new CustomEvent(eventName, {
      detail: { x, y }
    });
    this.canvas.dispatchEvent(event);
  }

  /**
   * Dispatch hint request event
   */
  private dispatchHintRequest(): void {
    const event = new CustomEvent('hintRequest');
    this.canvas.dispatchEvent(event);
  }

  /**
   * Render focus indicator for keyboard navigation
   */
  private renderFocusIndicator(x: number, y: number): void {
    const screenX = this.offsetX + x * this.cellSize;
    const screenY = this.offsetY + y * this.cellSize;
    
    // Draw focus ring
    this.ctx.strokeStyle = this.highContrastMode ? '#ffffff' : '#0066cc';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(screenX - 1, screenY - 1, this.cellSize + 2, this.cellSize + 2);
    this.ctx.setLineDash([]); // Reset line dash
  }

  /**
   * Announce cell information for screen readers
   */
  private announceCell(x: number, y: number): void {
    if (!this.screenReaderEnabled) return;
    
    // Create announcement text
    const announcement = `Cell ${x + 1}, ${y + 1}`;
    
    // Use aria-live region for announcements
    let liveRegion = document.getElementById('minesweeper-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'minesweeper-announcements';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
    
    liveRegion.textContent = announcement;
  }

  /**
   * Detect screen reader presence
   */
  private detectScreenReader(): void {
    // Simple heuristic to detect screen reader
    this.screenReaderEnabled = window.navigator.userAgent.includes('NVDA') ||
                              window.navigator.userAgent.includes('JAWS') ||
                              window.speechSynthesis !== undefined;
  }

  /**
   * Set high contrast mode
   */
  setHighContrastMode(enabled: boolean): void {
    this.highContrastMode = enabled;
  }

  /**
   * Set colorblind friendly mode
   */
  setColorBlindFriendlyMode(enabled: boolean): void {
    this.colorBlindFriendlyMode = enabled;
  }

  /**
   * Get current accessibility settings
   */
  getAccessibilitySettings(): {
    highContrast: boolean;
    colorBlindFriendly: boolean;
    screenReader: boolean;
  } {
    return {
      highContrast: this.highContrastMode,
      colorBlindFriendly: this.colorBlindFriendlyMode,
      screenReader: this.screenReaderEnabled
    };
  }

  /**
   * Set focused cell for keyboard navigation
   */
  setFocusedCell(x: number, y: number): void {
    this.focusedCell = { x, y };
  }

  /**
   * Get currently focused cell
   */
  getFocusedCell(): { x: number; y: number } | null {
    return this.focusedCell;
  }

  /**
   * Focus the canvas for keyboard navigation
   */
  focus(): void {
    safeSync(
      () => {
        if (this.canvas && typeof this.canvas.focus === 'function') {
          this.canvas.focus();
        }
      },
      ErrorType.USER_INPUT,
      undefined,
      'GameRenderer.focus'
    );
  }

  /**
   * Setup canvas error handling for context loss and recovery
   */
  private setupCanvasErrorHandling(): void {
    // Handle context loss
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('Canvas context lost');
      
      ErrorHandler.getInstance().handleError(
        ErrorType.CANVAS_RENDERING,
        'Canvas context lost',
        { contextLost: true },
        'GameRenderer.contextLost'
      );
    });

    // Handle context restoration
    this.canvas.addEventListener('webglcontextrestored', () => {
      console.log('Canvas context restored');
      this.recoverCanvasContext();
    });
  }

  /**
   * Attempt to recover canvas context
   */
  private recoverCanvasContext(): boolean {
    try {
      const newContext = this.canvas.getContext('2d');
      if (newContext) {
        this.ctx = newContext;
        console.log('Canvas context successfully recovered');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to recover canvas context:', error);
      return false;
    }
  }

  /**
   * Create DOM-based fallback renderer
   */
  private createDOMFallback(): HTMLElement {
    const fallbackContainer = document.createElement('div');
    fallbackContainer.className = 'game-board-fallback';
    fallbackContainer.style.cssText = `
      display: grid;
      gap: 1px;
      background-color: #808080;
      border: 2px solid #404040;
      max-width: 100%;
      overflow: auto;
    `;
    
    // Insert fallback after canvas
    this.canvas.parentNode?.insertBefore(fallbackContainer, this.canvas.nextSibling);
    
    // Hide canvas
    this.canvas.style.display = 'none';
    
    return fallbackContainer;
  }

  /**
   * Check if canvas is healthy and functional
   */
  isCanvasHealthy(): boolean {
    try {
      if (!this.canvas || !this.ctx) {
        return false;
      }

      // Test basic canvas operations
      this.ctx.save();
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, 1, 1);
      this.ctx.restore();
      
      return true;
    } catch (error) {
      console.error('Canvas health check failed:', error);
      return false;
    }
  }

  /**
   * Get renderer performance metrics
   */
  getPerformanceMetrics(): {
    canvasHealthy: boolean;
    lastRenderTime?: number;
    totalRenders: number;
    errorCount: number;
  } {
    const errorHandler = ErrorHandler.getInstance();
    const renderingErrors = errorHandler.getErrorsByType(ErrorType.CANVAS_RENDERING);
    
    return {
      canvasHealthy: this.isCanvasHealthy(),
      totalRenders: 0, // Could be tracked if needed
      errorCount: renderingErrors.length
    };
  }
}