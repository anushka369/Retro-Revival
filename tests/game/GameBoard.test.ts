import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GameBoard } from '@/game/GameBoard';
import { GameState, DifficultySettings, DifficultyLevel } from '@/types';

describe('GameBoard Property Tests', () => {
  // Generator for valid difficulty settings
  const difficultySettingsArb = fc.record({
    width: fc.integer({ min: 3, max: 30 }),
    height: fc.integer({ min: 3, max: 30 }),
    mineCount: fc.integer({ min: 1, max: 50 }),
    level: fc.constantFrom(DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.EXPERT)
  }).filter(settings => settings.mineCount < settings.width * settings.height);

  // Generator for valid coordinates given board dimensions
  const coordinatesArb = (width: number, height: number) => fc.record({
    x: fc.integer({ min: 0, max: width - 1 }),
    y: fc.integer({ min: 0, max: height - 1 })
  });

  /**
   * **Feature: ai-minesweeper, Property 1: Cell revelation correctness**
   * For any valid game board and cell coordinate, clicking on a cell should reveal that cell and display its correct content (mine, number, or empty)
   * **Validates: Requirements 1.1**
   */
  it('Property 1: Cell revelation correctness', () => {
    fc.assert(
      fc.property(
        difficultySettingsArb,
        (settings) => {
          const board = new GameBoard(settings);
          
          return fc.assert(
            fc.property(
              coordinatesArb(settings.width, settings.height),
              ({ x, y }) => {
                // Get the cell before revelation
                const cellBefore = board.getCell(x, y);
                if (!cellBefore) return false;
                
                // Store the original state
                const wasRevealed = cellBefore.isRevealed;
                const wasFlagged = cellBefore.isFlagged;
                const isMine = cellBefore.isMine;
                const adjacentMines = cellBefore.adjacentMines;
                
                // Skip if cell is already revealed or flagged
                if (wasRevealed || wasFlagged) {
                  return true;
                }
                
                // Reveal the cell
                const revealResult = board.revealCell(x, y);
                
                // Get the cell after revelation
                const cellAfter = board.getCell(x, y);
                if (!cellAfter) return false;
                
                // Verify the cell is now revealed
                const isNowRevealed = cellAfter.isRevealed;
                
                // Verify the content is correctly displayed
                const contentCorrect = 
                  cellAfter.isMine === isMine && 
                  cellAfter.adjacentMines === adjacentMines;
                
                // If it was a mine, game should be lost
                const gameStateCorrect = isMine ? 
                  board.getGameState() === GameState.LOST : 
                  true;
                
                return revealResult && isNowRevealed && contentCorrect && gameStateCorrect;
              }
            ),
            { numRuns: 10 } // Fewer runs per board since we're testing multiple coordinates
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-minesweeper, Property 4: Flag toggle functionality**
   * For any unrevealed cell, right-clicking should toggle the flag state without affecting the cell's underlying content
   * **Validates: Requirements 1.4**
   */
  it('Property 4: Flag toggle functionality', () => {
    fc.assert(
      fc.property(
        difficultySettingsArb,
        (settings) => {
          const board = new GameBoard(settings);
          
          return fc.assert(
            fc.property(
              coordinatesArb(settings.width, settings.height),
              ({ x, y }) => {
                const cell = board.getCell(x, y);
                if (!cell) return false;
                
                // Skip if cell is already revealed (can't flag revealed cells)
                if (cell.isRevealed) {
                  return true;
                }
                
                // Store the original state
                const originalIsMine = cell.isMine;
                const originalAdjacentMines = cell.adjacentMines;
                const originalIsRevealed = cell.isRevealed;
                const originalIsFlagged = cell.isFlagged;
                
                // Toggle flag state
                const flagResult = board.flagCell(x, y);
                
                // Get the cell after flagging
                const cellAfter = board.getCell(x, y);
                if (!cellAfter) return false;
                
                // Verify the flag operation was successful
                if (!flagResult) return false;
                
                // Verify the flag state was toggled
                const flagStateToggled = cellAfter.isFlagged === !originalIsFlagged;
                
                // Verify underlying content is unchanged
                const contentUnchanged = 
                  cellAfter.isMine === originalIsMine &&
                  cellAfter.adjacentMines === originalAdjacentMines &&
                  cellAfter.isRevealed === originalIsRevealed;
                
                // Test toggling back
                const unflagResult = board.flagCell(x, y);
                const cellAfterUnflag = board.getCell(x, y);
                if (!cellAfterUnflag) return false;
                
                // Verify unflag operation was successful
                if (!unflagResult) return false;
                
                // Verify flag state returned to original
                const flagStateRestored = cellAfterUnflag.isFlagged === originalIsFlagged;
                
                // Verify content still unchanged after unflagging
                const contentStillUnchanged = 
                  cellAfterUnflag.isMine === originalIsMine &&
                  cellAfterUnflag.adjacentMines === originalAdjacentMines &&
                  cellAfterUnflag.isRevealed === originalIsRevealed;
                
                return flagStateToggled && contentUnchanged && flagStateRestored && contentStillUnchanged;
              }
            ),
            { numRuns: 10 } // Fewer runs per board since we're testing multiple coordinates
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-minesweeper, Property 5: Adjacent mine counting accuracy**
   * For any revealed number cell, the displayed count should exactly equal the number of mines in the eight adjacent cells
   * **Validates: Requirements 1.5**
   */
  it('Property 5: Adjacent mine counting accuracy', () => {
    fc.assert(
      fc.property(
        difficultySettingsArb,
        (settings) => {
          const board = new GameBoard(settings);
          
          // Test all cells on the board
          for (let y = 0; y < settings.height; y++) {
            for (let x = 0; x < settings.width; x++) {
              const cell = board.getCell(x, y);
              if (!cell || cell.isMine) {
                continue; // Skip mines, we only test number cells
              }
              
              // Count adjacent mines manually
              const adjacentCells = board.getAdjacentCells(x, y);
              const actualAdjacentMineCount = adjacentCells.filter(adjCell => adjCell.isMine).length;
              
              // Verify that the cell's adjacentMines property matches our manual count
              if (cell.adjacentMines !== actualAdjacentMineCount) {
                return false;
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});