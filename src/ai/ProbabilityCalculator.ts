import { Cell, ProbabilityMap } from '@/types';
import { IProbabilityCalculator } from '@/interfaces/AIEngine';
import { IGameBoard } from '@/interfaces/GameEngine';
import { ErrorHandler, ErrorType, safeAsync, safeSync } from '@/utils/ErrorHandler';

interface Constraint {
  cells: Cell[];
  mineCount: number;
}



export class ProbabilityCalculator implements IProbabilityCalculator {
  private calculationTimeout: number = 5000; // 5 seconds default timeout
  private lastCalculation: ProbabilityMap | null = null;

  calculateProbabilities(board: IGameBoard): ProbabilityMap {
    const startTime = Date.now();
    const errorHandler = ErrorHandler.getInstance();
    
    try {
      // Validate input
      if (!board) {
        throw new Error('Board is null or undefined');
      }

      // Try exact CSP calculation first
      const exactResult = safeSync(
        () => this.calculateExactProbabilities(board),
        ErrorType.AI_CALCULATION,
        undefined,
        'ProbabilityCalculator.calculateExactProbabilities'
      );

      if (exactResult && (Date.now() - startTime) < this.calculationTimeout) {
        this.lastCalculation = {
          cellProbabilities: exactResult,
          lastUpdated: new Date(),
          calculationMethod: 'exact'
        };
        return this.lastCalculation;
      }
    } catch (error) {
      errorHandler.handleError(
        ErrorType.AI_CALCULATION,
        'CSP calculation failed, falling back to Monte Carlo',
        { error: error.message, timeout: this.calculationTimeout },
        'ProbabilityCalculator.calculateProbabilities',
        error as Error
      );
    }

    // Fallback to Monte Carlo simulation with error handling
    const monteCarloResult = safeSync(
      () => this.calculateMonteCarloProbabilities(board),
      ErrorType.AI_CALCULATION,
      this.getEmptyProbabilityMap(), // Fallback to empty map
      'ProbabilityCalculator.calculateMonteCarloProbabilities'
    );

    this.lastCalculation = {
      cellProbabilities: monteCarloResult || new Map(),
      lastUpdated: new Date(),
      calculationMethod: 'monte_carlo'
    };
    
    return this.lastCalculation;
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
          this.calculateProbabilities(board);
        }

        const key = `${x},${y}`;
        return this.lastCalculation?.cellProbabilities.get(key) || 0;
      },
      ErrorType.AI_CALCULATION,
      0, // Fallback to 0 probability
      'ProbabilityCalculator.getCellProbability'
    ) || 0;
  }

  updateProbabilities(board: IGameBoard): void {
    safeSync(
      () => {
        if (!board) {
          throw new Error('Board is null or undefined');
        }
        this.calculateProbabilities(board);
      },
      ErrorType.AI_CALCULATION,
      undefined,
      'ProbabilityCalculator.updateProbabilities'
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
   * Get empty probability map as fallback
   */
  private getEmptyProbabilityMap(): Map<string, number> {
    return new Map<string, number>();
  }

  private calculateExactProbabilities(board: IGameBoard): Map<string, number> {
    try {
      const constraints = this.extractConstraints(board);
      const unknownCells = this.getUnknownCells(board);
      
      if (unknownCells.length === 0) {
        return new Map();
      }

      // Check for timeout during calculation
      const startTime = Date.now();
      
      // For small problem spaces, enumerate all solutions
      if (unknownCells.length <= 20) {
        if (Date.now() - startTime > this.calculationTimeout / 2) {
          throw new Error('Calculation timeout during enumeration setup');
        }
        return this.enumerateAllSolutions(constraints, unknownCells, board);
      }

      // For larger spaces, use constraint propagation
      if (Date.now() - startTime > this.calculationTimeout / 2) {
        throw new Error('Calculation timeout during constraint propagation setup');
      }
      return this.solveWithConstraintPropagation(constraints, unknownCells, board);
    } catch (error) {
      console.error('Exact probability calculation failed:', error);
      throw error;
    }
  }

  private extractConstraints(board: IGameBoard): Constraint[] {
    const constraints: Constraint[] = [];
    const cells = board.getCells();

    for (let y = 0; y < board.getHeight(); y++) {
      for (let x = 0; x < board.getWidth(); x++) {
        const cell = cells[y][x];
        
        if (cell.isRevealed && !cell.isMine) {
          const adjacentCells = board.getAdjacentCells(x, y);
          const unknownAdjacent = adjacentCells.filter(c => !c.isRevealed && !c.isFlagged);
          const flaggedAdjacent = adjacentCells.filter(c => c.isFlagged);
          
          if (unknownAdjacent.length > 0) {
            const remainingMines = cell.adjacentMines - flaggedAdjacent.length;
            // Only add constraints with valid mine counts
            const safeMineCount = Math.max(0, Math.min(remainingMines, unknownAdjacent.length));
            constraints.push({
              cells: unknownAdjacent,
              mineCount: safeMineCount
            });
          }
        }
      }
    }

    return constraints;
  }

  private getUnknownCells(board: IGameBoard): Cell[] {
    const unknown: Cell[] = [];
    const cells = board.getCells();

    for (let y = 0; y < board.getHeight(); y++) {
      for (let x = 0; x < board.getWidth(); x++) {
        const cell = cells[y][x];
        if (!cell.isRevealed && !cell.isFlagged) {
          unknown.push(cell);
        }
      }
    }

    return unknown;
  }

  private enumerateAllSolutions(
    constraints: Constraint[], 
    unknownCells: Cell[], 
    board: IGameBoard
  ): Map<string, number> {
    const probabilities = new Map<string, number>();
    const totalRemainingMines = board.getRemainingMines();
    
    // Initialize probabilities
    unknownCells.forEach(cell => {
      probabilities.set(`${cell.x},${cell.y}`, 0);
    });

    let validSolutions = 0;
    const totalCombinations = Math.pow(2, unknownCells.length);
    
    // Enumerate all possible mine assignments
    for (let i = 0; i < totalCombinations; i++) {
      const assignment = new Map<string, boolean>();
      let mineCount = 0;
      
      // Convert binary representation to mine assignment
      for (let j = 0; j < unknownCells.length; j++) {
        const hasMine = (i & (1 << j)) !== 0;
        const cell = unknownCells[j];
        assignment.set(`${cell.x},${cell.y}`, hasMine);
        if (hasMine) mineCount++;
      }
      
      // Check if this assignment satisfies all constraints
      if (mineCount === totalRemainingMines && this.satisfiesConstraints(assignment, constraints)) {
        validSolutions++;
        
        // Add to probability counts
        assignment.forEach((hasMine, key) => {
          if (hasMine) {
            probabilities.set(key, (probabilities.get(key) || 0) + 1);
          }
        });
      }
    }

    // Convert counts to probabilities
    if (validSolutions > 0) {
      probabilities.forEach((count, key) => {
        probabilities.set(key, count / validSolutions);
      });
    }

    return probabilities;
  }

  private satisfiesConstraints(assignment: Map<string, boolean>, constraints: Constraint[]): boolean {
    for (const constraint of constraints) {
      let mineCount = 0;
      
      for (const cell of constraint.cells) {
        const key = `${cell.x},${cell.y}`;
        if (assignment.get(key)) {
          mineCount++;
        }
      }
      
      if (mineCount !== constraint.mineCount) {
        return false;
      }
    }
    
    return true;
  }

  private solveWithConstraintPropagation(
    constraints: Constraint[], 
    unknownCells: Cell[], 
    board: IGameBoard
  ): Map<string, number> {
    // For complex scenarios, use a simplified approach
    // This could be enhanced with more sophisticated CSP algorithms
    const probabilities = new Map<string, number>();
    const totalRemainingMines = board.getRemainingMines();
    const totalUnknownCells = unknownCells.length;
    
    if (totalUnknownCells === 0) {
      return probabilities;
    }

    // Ensure we don't have negative remaining mines
    const safeTotalRemainingMines = Math.max(0, totalRemainingMines);
    
    // Base probability assuming uniform distribution
    const baseProbability = safeTotalRemainingMines / totalUnknownCells;
    
    // Initialize with base probability
    unknownCells.forEach(cell => {
      probabilities.set(`${cell.x},${cell.y}`, baseProbability);
    });

    // Adjust probabilities based on local constraints
    for (const constraint of constraints) {
      // Ensure constraint mine count is non-negative
      const safeMineCount = Math.max(0, constraint.mineCount);
      const localProbability = constraint.cells.length > 0 ? safeMineCount / constraint.cells.length : 0;
      
      constraint.cells.forEach(cell => {
        const key = `${cell.x},${cell.y}`;
        const currentProb = probabilities.get(key) || 0;
        // Weighted average of base and local probability, ensuring result is non-negative
        const newProb = Math.max(0, Math.min(1, (currentProb + localProbability) / 2));
        probabilities.set(key, newProb);
      });
    }

    // Final validation: ensure all probabilities are in valid range [0, 1]
    probabilities.forEach((prob, key) => {
      probabilities.set(key, Math.max(0, Math.min(1, prob)));
    });

    return probabilities;
  }

  private calculateMonteCarloProbabilities(board: IGameBoard): Map<string, number> {
    try {
      const probabilities = new Map<string, number>();
      const unknownCells = this.getUnknownCells(board);
      const totalRemainingMines = Math.max(0, board.getRemainingMines()); // Ensure non-negative
      const simulations = Math.min(10000, unknownCells.length * 1000); // Adaptive simulation count
      
      if (unknownCells.length === 0) {
        return probabilities;
      }

      // Initialize counters
      unknownCells.forEach(cell => {
        probabilities.set(`${cell.x},${cell.y}`, 0);
      });

      let validSimulations = 0;
      const startTime = Date.now();

      // Run Monte Carlo simulations with timeout protection
      for (let sim = 0; sim < simulations; sim++) {
        // Check for timeout every 1000 simulations
        if (sim % 1000 === 0 && Date.now() - startTime > this.calculationTimeout) {
          console.warn(`Monte Carlo simulation timeout after ${sim} iterations`);
          break;
        }

        const assignment = this.generateRandomValidAssignment(unknownCells, totalRemainingMines, board);
        
        if (assignment) {
          validSimulations++;
          assignment.forEach((hasMine, key) => {
            if (hasMine) {
              probabilities.set(key, (probabilities.get(key) || 0) + 1);
            }
          });
        }
      }

      // Convert counts to probabilities, handle case where no valid simulations
      if (validSimulations > 0) {
        probabilities.forEach((count, key) => {
          probabilities.set(key, Math.max(0, Math.min(1, count / validSimulations)));
        });
      } else {
        // Fallback to uniform distribution
        const uniformProbability = totalRemainingMines / unknownCells.length;
        unknownCells.forEach(cell => {
          probabilities.set(`${cell.x},${cell.y}`, Math.max(0, Math.min(1, uniformProbability)));
        });
      }

      return probabilities;
    } catch (error) {
      console.error('Monte Carlo probability calculation failed:', error);
      throw error;
    }
  }

  private generateRandomValidAssignment(
    unknownCells: Cell[], 
    totalMines: number, 
    board: IGameBoard
  ): Map<string, boolean> | null {
    const assignment = new Map<string, boolean>();
    
    // Initialize all as non-mines
    unknownCells.forEach(cell => {
      assignment.set(`${cell.x},${cell.y}`, false);
    });

    // Randomly place mines
    const shuffled = [...unknownCells].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(totalMines, shuffled.length); i++) {
      const cell = shuffled[i];
      assignment.set(`${cell.x},${cell.y}`, true);
    }

    // Check if assignment is valid (satisfies revealed number constraints)
    if (this.isValidAssignment(assignment, board)) {
      return assignment;
    }

    return null;
  }

  private isValidAssignment(assignment: Map<string, boolean>, board: IGameBoard): boolean {
    const cells = board.getCells();
    
    for (let y = 0; y < board.getHeight(); y++) {
      for (let x = 0; x < board.getWidth(); x++) {
        const cell = cells[y][x];
        
        if (cell.isRevealed && !cell.isMine) {
          const adjacentCells = board.getAdjacentCells(x, y);
          let mineCount = 0;
          
          for (const adjCell of adjacentCells) {
            if (adjCell.isFlagged) {
              mineCount++;
            } else if (!adjCell.isRevealed) {
              const key = `${adjCell.x},${adjCell.y}`;
              if (assignment.get(key)) {
                mineCount++;
              }
            } else if (adjCell.isMine) {
              mineCount++;
            }
          }
          
          if (mineCount !== cell.adjacentMines) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
}