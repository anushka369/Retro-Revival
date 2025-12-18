import { ProbabilityMap, HintSuggestion } from '@/types';
import { IHintEngine } from '@/interfaces/AIEngine';
import { IGameBoard } from '@/interfaces/GameEngine';

export class HintEngine implements IHintEngine {
  private readonly SAFE_PROBABILITY_THRESHOLD = 0.0001; // Cells with probability <= this are considered safe

  generateHint(board: IGameBoard, probabilities: ProbabilityMap): HintSuggestion | null {
    // First, try to find guaranteed safe moves
    const safeMoves = this.findSafeMoves(board, probabilities);
    
    if (safeMoves.length > 0) {
      // Rank safe moves by information gain and return the best one
      const rankedSafeMoves = this.rankMoves(safeMoves);
      return rankedSafeMoves[0];
    }

    // If no safe moves, find the best probabilistic move
    return this.findBestProbabilisticMove(board, probabilities);
  }

  findSafeMoves(board: IGameBoard, probabilities: ProbabilityMap): HintSuggestion[] {
    const safeMoves: HintSuggestion[] = [];
    const cells = board.getCells();

    // Check for cells that are guaranteed safe (probability = 0)
    for (let y = 0; y < board.getHeight(); y++) {
      for (let x = 0; x < board.getWidth(); x++) {
        const cell = cells[y][x];
        
        if (!cell.isRevealed && !cell.isFlagged) {
          const key = `${x},${y}`;
          // Only consider cells that have been calculated in the probability map
          if (probabilities.cellProbabilities.has(key)) {
            const probability = probabilities.cellProbabilities.get(key)!;
            
            if (probability <= this.SAFE_PROBABILITY_THRESHOLD) {
              const informationGain = this.calculateInformationGain(board, x, y);
              
              safeMoves.push({
                cell: { x, y },
                action: 'reveal',
                confidence: 1.0, // 100% confidence for safe moves
                reasoning: `This cell has a ${(probability * 100).toFixed(2)}% chance of containing a mine, making it safe to reveal.`,
                expectedInformation: informationGain
              });
            } else if (probability >= (1 - this.SAFE_PROBABILITY_THRESHOLD)) {
              safeMoves.push({
                cell: { x, y },
                action: 'flag',
                confidence: 1.0,
                reasoning: `This cell has a ${(probability * 100).toFixed(2)}% chance of containing a mine, making it certain to be a mine.`,
                expectedInformation: 0 // Flagging doesn't reveal new information about other cells
              });
            }
          }
        }
      }
    }

    return safeMoves;
  }

  findBestProbabilisticMove(board: IGameBoard, probabilities: ProbabilityMap): HintSuggestion | null {
    const cells = board.getCells();
    let bestMove: HintSuggestion | null = null;
    let lowestProbability = 1.0;

    for (let y = 0; y < board.getHeight(); y++) {
      for (let x = 0; x < board.getWidth(); x++) {
        const cell = cells[y][x];
        
        if (!cell.isRevealed && !cell.isFlagged) {
          const key = `${x},${y}`;
          // Only consider cells that have been calculated in the probability map
          if (probabilities.cellProbabilities.has(key)) {
            const probability = probabilities.cellProbabilities.get(key)!;
            
            if (probability < lowestProbability) {
              const informationGain = this.calculateInformationGain(board, x, y);
              
              lowestProbability = probability;
              bestMove = {
                cell: { x, y },
                action: 'reveal',
                confidence: Math.max(0, 1 - probability), // Higher confidence for lower probability
                reasoning: `This is the safest available move with a ${(probability * 100).toFixed(2)}% chance of containing a mine.`,
                expectedInformation: informationGain
              };
            }
          }
        }
      }
    }

    return bestMove;
  }

  calculateInformationGain(board: IGameBoard, x: number, y: number): number {
    const cell = board.getCell(x, y);
    if (!cell || cell.isRevealed || cell.isFlagged) {
      return 0;
    }

    // Information gain is based on how many unknown cells this move could potentially reveal
    // and how much it would constrain the probability space

    let potentialRevealCount = 1; // The cell itself
    let constraintValue = 0;

    // If this cell is revealed and is not a mine, it will:
    // 1. Potentially auto-reveal adjacent cells if it's a 0
    // 2. Add a new constraint (number) that helps narrow down mine locations

    const adjacentCells = board.getAdjacentCells(x, y);
    const unknownAdjacentCells = adjacentCells.filter(c => !c.isRevealed && !c.isFlagged);
    
    // Estimate potential cascade reveals (assuming this might be a 0)
    // This is a heuristic - we can't know for sure without revealing
    const revealedAdjacentCells = adjacentCells.filter(c => c.isRevealed);
    const avgAdjacentMines = revealedAdjacentCells.length > 0 
      ? revealedAdjacentCells.reduce((sum, c) => sum + c.adjacentMines, 0) / revealedAdjacentCells.length
      : board.getMineCount() / (board.getWidth() * board.getHeight());

    // If the average suggests this might be a low number, it could cascade
    if (avgAdjacentMines < 2) {
      potentialRevealCount += unknownAdjacentCells.length * 0.3; // 30% chance of cascade
    }

    // Constraint value: how much this number would help narrow down adjacent mines
    constraintValue = unknownAdjacentCells.length > 0 ? unknownAdjacentCells.length * 0.5 : 0;

    // Bonus for cells that are adjacent to many revealed numbers (more constrained area)
    const adjacentRevealedNumbers = adjacentCells.filter(c => c.isRevealed && !c.isMine).length;
    const constraintBonus = adjacentRevealedNumbers * 0.2;

    // Bonus for cells near the edge of revealed area (frontier cells)
    const frontierBonus = this.isFrontierCell(board, x, y) ? 0.5 : 0;

    return potentialRevealCount + constraintValue + constraintBonus + frontierBonus;
  }

  private isFrontierCell(board: IGameBoard, x: number, y: number): boolean {
    // A frontier cell is an unrevealed cell adjacent to at least one revealed cell
    const adjacentCells = board.getAdjacentCells(x, y);
    return adjacentCells.some(cell => cell.isRevealed);
  }

  rankMoves(moves: HintSuggestion[]): HintSuggestion[] {
    return moves.sort((a, b) => {
      // Primary sort: by confidence (higher is better)
      if (Math.abs(a.confidence - b.confidence) > 0.01) {
        return b.confidence - a.confidence;
      }

      // Secondary sort: by expected information gain (higher is better)
      if (Math.abs(a.expectedInformation - b.expectedInformation) > 0.01) {
        return b.expectedInformation - a.expectedInformation;
      }

      // Tertiary sort: prefer reveal actions over flag actions for equal moves
      if (a.action !== b.action) {
        return a.action === 'reveal' ? -1 : 1;
      }

      // Final sort: by position (top-left first for consistency)
      if (a.cell.y !== b.cell.y) {
        return a.cell.y - b.cell.y;
      }
      return a.cell.x - b.cell.x;
    });
  }
}