import { ProbabilityMap } from '@/types';
import { IGameBoard } from '@/interfaces/GameEngine';

export enum ProbabilityDetailLevel {
  OFF = 'off',
  LOW = 'low',      // Just color coding
  MEDIUM = 'medium', // Color + percentage on hover
  HIGH = 'high'      // Color + percentage always visible
}

export interface ProbabilityVisualizerConfig {
  detailLevel: ProbabilityDetailLevel;
  colorScheme: 'default' | 'colorblind';
  showPercentages: boolean;
}

export class ProbabilityVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: ProbabilityVisualizerConfig;
  private hoveredCell: { x: number; y: number } | null = null;
  private cellSize: number = 40;
  private offsetX: number = 0;
  private offsetY: number = 0;

  constructor(canvas: HTMLCanvasElement, config?: Partial<ProbabilityVisualizerConfig>) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = context;
    
    this.config = {
      detailLevel: config?.detailLevel || ProbabilityDetailLevel.MEDIUM,
      colorScheme: config?.colorScheme || 'default',
      showPercentages: config?.showPercentages !== undefined ? config.showPercentages : true
    };
  }

  /**
   * Render probability visualization on the canvas
   */
  renderProbabilities(
    board: IGameBoard, 
    probabilities: ProbabilityMap
  ): void {
    if (this.config.detailLevel === ProbabilityDetailLevel.OFF) {
      return;
    }

    const cells = board.getCells();
    
    for (let y = 0; y < board.getHeight(); y++) {
      for (let x = 0; x < board.getWidth(); x++) {
        const cell = cells[y][x];
        
        // Only show probabilities for unrevealed, unflagged cells
        if (!cell.isRevealed && !cell.isFlagged) {
          const key = `${x},${y}`;
          const probability = probabilities.cellProbabilities.get(key) || 0;
          
          this.renderCellProbability(x, y, probability);
        }
      }
    }
  }

  /**
   * Render probability for a single cell
   */
  private renderCellProbability(
    x: number, 
    y: number, 
    probability: number
  ): void {
    const screenX = this.offsetX + x * this.cellSize;
    const screenY = this.offsetY + y * this.cellSize;

    // Draw color-coded background
    const color = this.getProbabilityColor(probability);
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.6;
    this.ctx.fillRect(screenX + 2, screenY + 2, this.cellSize - 4, this.cellSize - 4);
    this.ctx.globalAlpha = 1.0;

    // Show percentage based on detail level
    const isHovered = this.hoveredCell?.x === x && this.hoveredCell?.y === y;
    
    if (this.config.detailLevel === ProbabilityDetailLevel.HIGH || 
        (this.config.detailLevel === ProbabilityDetailLevel.MEDIUM && isHovered)) {
      this.renderProbabilityText(screenX, screenY, probability);
    }
  }

  /**
   * Render probability percentage text
   */
  private renderProbabilityText(screenX: number, screenY: number, probability: number): void {
    const percentage = Math.round(probability * 100);
    
    this.ctx.fillStyle = '#000';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    this.ctx.fillText(
      `${percentage}%`, 
      screenX + this.cellSize / 2, 
      screenY + this.cellSize / 2
    );
  }

  /**
   * Get color for probability value
   */
  private getProbabilityColor(probability: number): string {
    if (this.config.colorScheme === 'colorblind') {
      return this.getColorblindFriendlyColor(probability);
    }
    
    return this.getDefaultColor(probability);
  }

  /**
   * Default color scheme (green to red)
   */
  private getDefaultColor(probability: number): string {
    if (probability <= 0.1) {
      return '#00ff00'; // Green - very safe
    } else if (probability <= 0.25) {
      return '#7fff00'; // Yellow-green - safe
    } else if (probability <= 0.5) {
      return '#ffff00'; // Yellow - moderate risk
    } else if (probability <= 0.75) {
      return '#ff7f00'; // Orange - risky
    } else {
      return '#ff0000'; // Red - very risky
    }
  }

  /**
   * Colorblind-friendly color scheme
   */
  private getColorblindFriendlyColor(probability: number): string {
    if (probability <= 0.1) {
      return '#0077bb'; // Blue - very safe
    } else if (probability <= 0.25) {
      return '#33bbee'; // Light blue - safe
    } else if (probability <= 0.5) {
      return '#009988'; // Teal - moderate risk
    } else if (probability <= 0.75) {
      return '#ee7733'; // Orange - risky
    } else {
      return '#cc3311'; // Red - very risky
    }
  }

  /**
   * Render hover tooltip with exact probability
   */
  renderTooltip(x: number, y: number, probability: number): void {
    if (!this.config.showPercentages) {
      return;
    }

    const screenX = this.offsetX + x * this.cellSize;
    const screenY = this.offsetY + y * this.cellSize;
    
    const percentage = (probability * 100).toFixed(1);
    const tooltipText = `Mine probability: ${percentage}%`;
    
    // Measure text for tooltip sizing
    this.ctx.font = '14px Arial';
    const textWidth = this.ctx.measureText(tooltipText).width;
    const tooltipWidth = textWidth + 20;
    const tooltipHeight = 30;
    
    // Position tooltip above the cell
    let tooltipX = screenX + this.cellSize / 2 - tooltipWidth / 2;
    let tooltipY = screenY - tooltipHeight - 5;
    
    // Keep tooltip within canvas bounds
    tooltipX = Math.max(5, Math.min(tooltipX, this.canvas.width - tooltipWidth - 5));
    tooltipY = Math.max(5, tooltipY);
    
    // Draw tooltip background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    
    // Draw tooltip border
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    
    // Draw tooltip text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      tooltipText, 
      tooltipX + tooltipWidth / 2, 
      tooltipY + tooltipHeight / 2
    );
  }

  /**
   * Set the hovered cell for tooltip display
   */
  setHoveredCell(x: number | null, y: number | null): void {
    if (x === null || y === null) {
      this.hoveredCell = null;
    } else {
      this.hoveredCell = { x, y };
    }
  }

  /**
   * Update visualization configuration
   */
  setConfig(config: Partial<ProbabilityVisualizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ProbabilityVisualizerConfig {
    return { ...this.config };
  }

  /**
   * Set detail level
   */
  setDetailLevel(level: ProbabilityDetailLevel): void {
    this.config.detailLevel = level;
  }

  /**
   * Get current detail level
   */
  getDetailLevel(): ProbabilityDetailLevel {
    return this.config.detailLevel;
  }

  /**
   * Toggle to next detail level
   */
  toggleDetailLevel(): ProbabilityDetailLevel {
    const levels = [
      ProbabilityDetailLevel.OFF,
      ProbabilityDetailLevel.LOW,
      ProbabilityDetailLevel.MEDIUM,
      ProbabilityDetailLevel.HIGH
    ];
    
    const currentIndex = levels.indexOf(this.config.detailLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    this.config.detailLevel = levels[nextIndex];
    
    return this.config.detailLevel;
  }

  /**
   * Set color scheme
   */
  setColorScheme(scheme: 'default' | 'colorblind'): void {
    this.config.colorScheme = scheme;
  }

  /**
   * Set cell rendering parameters
   */
  setCellSize(size: number): void {
    this.cellSize = size;
  }

  /**
   * Set rendering offset
   */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * Convert screen coordinates to cell coordinates
   */
  screenToCell(screenX: number, screenY: number): { x: number; y: number } | null {
    const cellX = Math.floor((screenX - this.offsetX) / this.cellSize);
    const cellY = Math.floor((screenY - this.offsetY) / this.cellSize);
    
    if (cellX < 0 || cellY < 0) {
      return null;
    }
    
    return { x: cellX, y: cellY };
  }

  /**
   * Clear the visualization
   */
  clear(): void {
    // This method is called when probabilities should be cleared
    // The actual canvas clearing is handled by the main renderer
  }

  /**
   * Get the color for a given probability (exposed for testing)
   */
  getColorForProbability(probability: number): string {
    return this.getProbabilityColor(probability);
  }
}
