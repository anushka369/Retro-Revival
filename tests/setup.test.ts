import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GameState, DifficultyLevel, Cell } from '@/types';

describe('Project Setup Verification', () => {
  it('should have working TypeScript types', () => {
    const gameState: GameState = GameState.READY;
    const difficulty: DifficultyLevel = DifficultyLevel.BEGINNER;
    
    expect(gameState).toBe('ready');
    expect(difficulty).toBe('beginner');
  });

  it('should have fast-check property testing available', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (num) => {
        return num >= 0 && num <= 100;
      }),
      { numRuns: 100 }
    );
  });

  it('should create valid Cell objects', () => {
    const cell: Cell = {
      x: 0,
      y: 0,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0
    };

    expect(cell.x).toBe(0);
    expect(cell.y).toBe(0);
    expect(cell.isMine).toBe(false);
    expect(cell.isRevealed).toBe(false);
    expect(cell.isFlagged).toBe(false);
    expect(cell.adjacentMines).toBe(0);
  });

  it('should support property-based testing for Cell coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer(0, 50),
        fc.integer(0, 50),
        (x, y) => {
          const cell: Cell = {
            x,
            y,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0
          };
          
          return cell.x === x && cell.y === y;
        }
      ),
      { numRuns: 100 }
    );
  });
});