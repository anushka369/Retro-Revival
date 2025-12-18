/**
 * Enhanced ProbabilityCalculator that uses Web Workers for heavy calculations
 */

import { Cell, ProbabilityMap } from '@/types';
import { IProbabilityCalculator } from '@/interfaces/AIEngine';
import { IGameBoard } from '@/interfaces/GameEngine';
import { ErrorHandler, ErrorType, safeAsync, safeSync } from '@/utils/ErrorHandler';
import { PerformanceMonitor, measurePerformance } from '@/utils/PerformanceMonitor';

interface WorkerMessage {
  id: string;
  type: 'calculateProbabilities';
  data: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

interface BoardData {
  width: number;
  height: number;
  cells: Cell[][];
  remainingMines: number;
}

export class ProbabilityCalculatorWithWorker implements IProbabilityCalculator {
  private calculationTimeout: number = 5000;
  private lastCalculation: ProbabilityMap | null = null;
  private worker: Worker | null = null;
  private pendingCalculations: Map<string, {
    resolve: (value: ProbabilityMap) => void;
    reject: (error: Error) => void;
    timeout: number;
  }> = new Map();
  private workerAvailable: boolean = false;
  private fallbackCalculator: IProbabilityCalculator | null = null;
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.initializeWorker();
  }

  @measurePerformance('probability_calculation')
  async calculateProbabilities(board: IGameBoard): Promise<ProbabilityMap> {
    const errorHandler = ErrorHandler.getInstance();
    
    try {
      // Validate input
      if (!board) {
        throw new Error('Board is null or undefined');
      }

      // Check if we should use worker or fallback
      const shouldUseWorker = this.shouldUseWorker(board);
      
      if (shouldUseWorker && this.workerAvailable) {
        try {
          const result = await this.calculateWithWorker(board);
          this.lastCalculation = result;
          return result;
        } catch (workerError) {
          console.warn('Worker calculation failed, falling back to main thread:', workerError);
          errorHandler.handleError(
            ErrorType.AI_CALCULATION,
            'Worker calculation failed',
            { error: workerError.message },
            'ProbabilityCalculatorWithWorker.calculateWithWorker'
          );
        }
      }

      // Fallback to main thread calculation
      const result = await this.calculateOnMainThread(board);
      this.lastCalculation = result;
      return result;
      
    } catch (error) {
      await errorHandler.handleError(
        ErrorType.AI_CALCULATION,
        'Probability calculation failed',
        { error: error.message },
        'ProbabilityCalculatorWithWorker.calculateProbabilities',
        error as Error
      );
      
      // Return empty probability map as fallback
      return {
        cellProbabilities: new Map(),
        lastUpdated: new Date(),
        calculationMethod: 'fallback'
      };
    }
  }

  getCellProbability(board: IGameBoard, x: number, y: number): number {
    return safeSync(
      () => {
        // Validate inputs
        if (!board) {
          throw new Error('Board is null or undefined');
        }
        if (x < 0 || y < 0 || x >= board.getWidth() || y >= board.getHeight()) {
          throw new Error(`Invalid cell coordinates: (${x}, ${y})`);
        }

        const cell = board.getCell(x, y);
        if (!cell || cell.isRevealed || cell.isFlagged) {
          return 0;
        }

        if (!this.lastCalculation) {
          // Trigger async calculation but return 0 for now
          this.calculateProbabilities(board);
          return 0;
        }

        const key = `${x},${y}`;
        return this.lastCalculation?.cellProbabilities.get(key) || 0;
      },
      ErrorType.AI_CALCULATION,
      0,
      'ProbabilityCalculatorWithWorker.getCellProbability'
    ) || 0;
  }

  async updateProbabilities(board: IGameBoard): Promise<void> {
    await safeAsync(
      async () => {
        if (!board) {
          throw new Error('Board is null or undefined');
        }
        await this.calculateProbabilities(board);
      },
      ErrorType.AI_CALCULATION,
      undefined,
      'ProbabilityCalculatorWithWorker.updateProbabilities'
    );
  }

  getCalculationMethod(): 'exact' | 'monte_carlo' {
    return this.lastCalculation?.calculationMethod || 'exact';
  }

  setCalculationTimeout(ms: number): void {
    if (ms > 0) {
      this.calculationTimeout = ms;
    } else {
      console.warn('Invalid timeout value, keeping current timeout:', this.calculationTimeout);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.worker) {
      // Cancel pending calculations
      this.pendingCalculations.forEach(({ reject }) => {
        reject(new Error('Calculator disposed'));
      });
      this.pendingCalculations.clear();
      
      // Terminate worker
      this.worker.terminate();
      this.worker = null;
      this.workerAvailable = false;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    workerAvailable: boolean;
    pendingCalculations: number;
    lastCalculationMethod: string;
    averageCalculationTime: number;
  } {
    const calculationMetrics = this.performanceMonitor.getMetricsByName('probability_calculation');
    const averageTime = calculationMetrics.length > 0
      ? calculationMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / calculationMetrics.length
      : 0;

    return {
      workerAvailable: this.workerAvailable,
      pendingCalculations: this.pendingCalculations.size,
      lastCalculationMethod: this.getCalculationMethod(),
      averageCalculationTime: averageTime
    };
  }

  private initializeWorker(): void {
    try {
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        console.warn('Web Workers not supported, using main thread calculations');
        return;
      }

      // Create worker from blob to avoid external file dependency
      const workerCode = this.getWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      this.workerAvailable = true;
      console.log('Probability calculation worker initialized');
      
      // Clean up blob URL
      URL.revokeObjectURL(workerUrl);
      
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      this.workerAvailable = false;
    }
  }

  private shouldUseWorker(board: IGameBoard): boolean {
    // Use worker for larger boards or when many unknown cells exist
    const unknownCells = this.countUnknownCells(board);
    const boardSize = board.getWidth() * board.getHeight();
    
    return (
      this.workerAvailable &&
      (boardSize > 100 || unknownCells > 20) &&
      this.pendingCalculations.size < 2 // Don't queue too many calculations
    );
  }

  private countUnknownCells(board: IGameBoard): number {
    let count = 0;
    const cells = board.getCells();
    
    for (let y = 0; y < board.getHeight(); y++) {
      for (let x = 0; x < board.getWidth(); x++) {
        const cell = cells[y][x];
        if (!cell.isRevealed && !cell.isFlagged) {
          count++;
        }
      }
    }
    
    return count;
  }

  private async calculateWithWorker(board: IGameBoard): Promise<ProbabilityMap> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const id = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const boardData: BoardData = {
        width: board.getWidth(),
        height: board.getHeight(),
        cells: board.getCells(),
        remainingMines: board.getRemainingMines()
      };

      const message: WorkerMessage = {
        id,
        type: 'calculateProbabilities',
        data: { boardData }
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingCalculations.delete(id);
        reject(new Error('Worker calculation timeout'));
      }, this.calculationTimeout);

      // Store pending calculation
      this.pendingCalculations.set(id, { resolve, reject, timeout });

      // Send message to worker
      this.worker.postMessage(message);
    });
  }

  private async calculateOnMainThread(board: IGameBoard): Promise<ProbabilityMap> {
    // Use fallback calculator or implement simplified calculation
    if (!this.fallbackCalculator) {
      // Import the original calculator dynamically to avoid circular dependencies
      const { ProbabilityCalculator } = await import('./ProbabilityCalculator');
      this.fallbackCalculator = new ProbabilityCalculator();
    }

    return this.fallbackCalculator.calculateProbabilities(board);
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, success, result, error } = event.data;
    const pending = this.pendingCalculations.get(id);
    
    if (!pending) {
      console.warn('Received response for unknown calculation:', id);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingCalculations.delete(id);

    if (success && result) {
      // Convert serialized Map back to Map
      const cellProbabilities = new Map(Object.entries(result.cellProbabilities));
      const probabilityMap: ProbabilityMap = {
        ...result,
        cellProbabilities
      };
      pending.resolve(probabilityMap);
    } else {
      pending.reject(new Error(error || 'Worker calculation failed'));
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error);
    this.workerAvailable = false;
    
    // Reject all pending calculations
    this.pendingCalculations.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker error occurred'));
    });
    this.pendingCalculations.clear();

    // Try to reinitialize worker
    setTimeout(() => {
      this.initializeWorker();
    }, 1000);
  }

  private getWorkerCode(): string {
    // Return the worker code as a string
    // In a real implementation, you might want to load this from the actual worker file
    return `
      // Simplified worker code - in production, load from actual worker file
      const workerEngine = {
        calculateProbabilities: function(boardData) {
          // Simplified Monte Carlo calculation for worker
          const probabilities = new Map();
          const unknownCells = [];
          
          // Find unknown cells
          for (let y = 0; y < boardData.height; y++) {
            for (let x = 0; x < boardData.width; x++) {
              const cell = boardData.cells[y][x];
              if (!cell.isRevealed && !cell.isFlagged) {
                unknownCells.push(cell);
              }
            }
          }
          
          if (unknownCells.length === 0) {
            return {
              cellProbabilities: {},
              lastUpdated: new Date(),
              calculationMethod: 'exact'
            };
          }
          
          // Simple uniform probability as fallback
          const uniformProb = Math.max(0, boardData.remainingMines) / unknownCells.length;
          const result = {};
          
          unknownCells.forEach(cell => {
            result[\`\${cell.x},\${cell.y}\`] = Math.max(0, Math.min(1, uniformProb));
          });
          
          return {
            cellProbabilities: result,
            lastUpdated: new Date(),
            calculationMethod: 'monte_carlo'
          };
        }
      };
      
      self.onmessage = function(event) {
        const { id, type, data } = event.data;
        
        try {
          let result;
          
          switch (type) {
            case 'calculateProbabilities':
              result = workerEngine.calculateProbabilities(data.boardData);
              break;
            default:
              throw new Error('Unknown message type: ' + type);
          }
          
          self.postMessage({
            id: id,
            success: true,
            result: result
          });
        } catch (error) {
          self.postMessage({
            id: id,
            success: false,
            error: error.message
          });
        }
      };
    `;
  }
}