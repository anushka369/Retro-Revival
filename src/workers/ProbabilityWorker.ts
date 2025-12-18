/**
 * Web Worker for probability calculations to avoid blocking the main UI thread
 */

import { Cell, ProbabilityMap } from '@/types';

interface WorkerMessage {
  id: string;
  type: 'calculateProbabilities' | 'calculateCellProbability';
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

class ProbabilityWorkerEngine {
  private calculationTimeout: number = 5000;

  calculateProbabilities(boardData: BoardData): ProbabilityMap {
    try {
      // Try exact CSP calculation first
      const exactResult = this.calculateExactProbabilities(boardData);
      if (exactResult) {
        return {
          cellProbabilities: exactResult,
          lastUpdated: new Date(),
          calculationMethod: 'exact'
        };
      }
    } catch (error) {
      console.warn('CSP calculation failed in worker, falling back to Monte Carlo:', error);
    }

    // Fallback to Monte Carlo simulation
    const monteCarloResult = this.calculateMonteCarloProbabilities(boardData);
    return {
      cellProbabilities: monteCarloResult,
      lastUpdated: new Date(),
      calculationMethod: 'monte_carlo'
    };
  }

  private calculateExactProbabilities(boardData: BoardData): Map<string, number> | null {
    const startTime = Date.now();
    
    try {
      const constraints = this.extractConstraints(boardData);
      const unknownCells = this.getUnknownCells(boardData);
      
      if (unknownCells.length === 0) {
        return new Map();
      }

      // Check for timeout
      if (Date.now() - startTime > this.calculationTimeout / 2) {
        throw new Error('Calculation timeout during setup');
      }

      // For small problem spaces, enumerate all solutions
      if (unknownCells.length <= 15) { // Reduced threshold for worker
        return this.enumerateAllSolutions(constraints, unknownCells, boardData, startTime);
      }

      // For larger spaces, use constraint propagation
      return this.solveWithConstraintPropagation(constraints, unknownCells, boardData);
    } catch (error) {
      console.error('Exact probability calculation failed in worker:', error);
      return null;
    }
  }

  private calculateMonteCarloProbabilities(boardData: BoardData): Map<string, number> {
    const probabilities = new Map<string, number>();
    const unknownCells = this.getUnknownCells(boardData);
    const totalRemainingMines = Math.max(0, boardData.remainingMines);
    const simulations = Math.min(5000, unknownCells.length * 500); // Reduced for worker
    
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
      // Check for timeout every 500 simulations
      if (sim % 500 === 0 && Date.now() - startTime > this.calculationTimeout) {
        console.warn(`Monte Carlo simulation timeout in worker after ${sim} iterations`);
        break;
      }

      const assignment = this.generateRandomValidAssignment(unknownCells, totalRemainingMines, boardData);
      
      if (assignment) {
        validSimulations++;
        assignment.forEach((hasMine, key) => {
          if (hasMine) {
            probabilities.set(key, (probabilities.get(key) || 0) + 1);
          }
        });
      }
    }

    // Convert counts to probabilities
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
  }

  private extractConstraints(boardData: BoardData): Array<{ cells: Cell[]; mineCount: number }> {
    const constraints: Array<{ cells: Cell[]; mineCount: number }> = [];
    const { cells, width, height } = boardData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        
        if (cell.isRevealed && !cell.isMine) {
          const adjacentCells = this.getAdjacentCells(x, y, boardData);
          const unknownAdjacent = adjacentCells.filter(c => !c.isRevealed && !c.isFlagged);
          const flaggedAdjacent = adjacentCells.filter(c => c.isFlagged);
          
          if (unknownAdjacent.length > 0) {
            const remainingMines = cell.adjacentMines - flaggedAdjacent.length;
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

  private getUnknownCells(boardData: BoardData): Cell[] {
    const unknown: Cell[] = [];
    const { cells, width, height } = boardData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        if (!cell.isRevealed && !cell.isFlagged) {
          unknown.push(cell);
        }
      }
    }

    return unknown;
  }

  private getAdjacentCells(x: number, y: number, boardData: BoardData): Cell[] {
    const adjacent: Cell[] = [];
    const { cells, width, height } = boardData;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          adjacent.push(cells[ny][nx]);
        }
      }
    }

    return adjacent;
  }

  private enumerateAllSolutions(
    constraints: Array<{ cells: Cell[]; mineCount: number }>,
    unknownCells: Cell[],
    boardData: BoardData,
    startTime: number
  ): Map<string, number> {
    const probabilities = new Map<string, number>();
    const totalRemainingMines = boardData.remainingMines;
    
    // Initialize probabilities
    unknownCells.forEach(cell => {
      probabilities.set(`${cell.x},${cell.y}`, 0);
    });

    let validSolutions = 0;
    const maxCombinations = Math.min(Math.pow(2, unknownCells.length), 100000); // Limit for worker
    
    // Enumerate possible mine assignments
    for (let i = 0; i < maxCombinations; i++) {
      // Check timeout periodically
      if (i % 1000 === 0 && Date.now() - startTime > this.calculationTimeout) {
        console.warn('Enumeration timeout in worker');
        break;
      }

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

  private solveWithConstraintPropagation(
    constraints: Array<{ cells: Cell[]; mineCount: number }>,
    unknownCells: Cell[],
    boardData: BoardData
  ): Map<string, number> {
    const probabilities = new Map<string, number>();
    const totalRemainingMines = Math.max(0, boardData.remainingMines);
    const totalUnknownCells = unknownCells.length;
    
    if (totalUnknownCells === 0) {
      return probabilities;
    }

    // Base probability assuming uniform distribution
    const baseProbability = totalRemainingMines / totalUnknownCells;
    
    // Initialize with base probability
    unknownCells.forEach(cell => {
      probabilities.set(`${cell.x},${cell.y}`, baseProbability);
    });

    // Adjust probabilities based on local constraints
    for (const constraint of constraints) {
      const safeMineCount = Math.max(0, constraint.mineCount);
      const localProbability = constraint.cells.length > 0 ? safeMineCount / constraint.cells.length : 0;
      
      constraint.cells.forEach(cell => {
        const key = `${cell.x},${cell.y}`;
        const currentProb = probabilities.get(key) || 0;
        const newProb = Math.max(0, Math.min(1, (currentProb + localProbability) / 2));
        probabilities.set(key, newProb);
      });
    }

    return probabilities;
  }

  private satisfiesConstraints(
    assignment: Map<string, boolean>,
    constraints: Array<{ cells: Cell[]; mineCount: number }>
  ): boolean {
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

  private generateRandomValidAssignment(
    unknownCells: Cell[],
    totalMines: number,
    boardData: BoardData
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

    // Check if assignment is valid
    if (this.isValidAssignment(assignment, boardData)) {
      return assignment;
    }

    return null;
  }

  private isValidAssignment(assignment: Map<string, boolean>, boardData: BoardData): boolean {
    const { cells, width, height } = boardData;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        
        if (cell.isRevealed && !cell.isMine) {
          const adjacentCells = this.getAdjacentCells(x, y, boardData);
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

// Worker message handling
const workerEngine = new ProbabilityWorkerEngine();

self.onmessage = function(event: MessageEvent<WorkerMessage>) {
  const { id, type, data } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'calculateProbabilities':
        result = workerEngine.calculateProbabilities(data.boardData);
        // Convert Map to object for serialization
        result.cellProbabilities = Object.fromEntries(result.cellProbabilities);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    const response: WorkerResponse = {
      id,
      success: true,
      result
    };
    
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    self.postMessage(response);
  }
};