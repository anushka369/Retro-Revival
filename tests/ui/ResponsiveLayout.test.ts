import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { GameRenderer } from '@/ui/GameRenderer';
import { GameBoard } from '@/game/GameBoard';
import { DifficultyLevel } from '@/types';

/**
 * **Feature: ai-minesweeper, Property 26: Responsive layout maintenance**
 * **Validates: Requirements 6.3**
 * 
 * Property-based tests for responsive layout functionality
 */

describe('Responsive Layout Maintenance Properties', () => {
  let canvas: HTMLCanvasElement;
  let renderer: GameRenderer;

  beforeEach(() => {
    // Create a mock canvas element
    canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    
    // Mock canvas context
    const mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      set fillStyle(value: string) {},
      get fillStyle() { return '#000000'; },
      set strokeStyle(value: string) {},
      get strokeStyle() { return '#000000'; },
      set lineWidth(value: number) {},
      get lineWidth() { return 1; },
      set font(value: string) {},
      get font() { return '12px Arial'; },
      set textAlign(value: string) {},
      get textAlign() { return 'start'; },
      set textBaseline(value: string) {},
      get textBaseline() { return 'alphabetic'; }
    };
    
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockContext as any);
    
    renderer = new GameRenderer(canvas);
  });

  /**
   * Property 26: Responsive layout maintenance
   * For any window resize operation, the game layout should remain functional 
   * and readable across different screen dimensions
   */
  it('should maintain functional layout across different screen sizes', () => {
    fc.assert(fc.property(
      fc.integer({ min: 320, max: 3840 }), // screen width (mobile to 4K)
      fc.integer({ min: 568, max: 2160 }), // screen height
      fc.integer({ min: 8, max: 16 }), // board width (reasonable size)
      fc.integer({ min: 8, max: 16 }), // board height (reasonable size)
      (screenWidth, screenHeight, boardWidth, boardHeight) => {
        // Mock window dimensions
        Object.defineProperty(window, 'innerWidth', {
          value: screenWidth,
          writable: true,
          configurable: true
        });
        Object.defineProperty(window, 'innerHeight', {
          value: screenHeight,
          writable: true,
          configurable: true
        });
        
        // Adapt layout for the screen size
        renderer.adaptLayoutForScreen();
        
        // Get the optimal cell size for this screen
        const cellSize = renderer.getOptimalCellSize();
        
        // Cell size should be reasonable for the screen
        expect(cellSize).toBeGreaterThan(0);
        expect(cellSize).toBeLessThanOrEqual(100);
        
        // For touch devices, cell size should be at least 50px
        if (renderer.isTouchEnabled()) {
          expect(cellSize).toBeGreaterThanOrEqual(50);
        }
        
        // Cell size should scale appropriately with screen size
        const minDimension = Math.min(screenWidth, screenHeight);
        const expectedCellSize = renderer.isTouchEnabled() ? 
          Math.max(50, Math.min(80, Math.floor(minDimension / 12))) : 40;
        
        expect(cellSize).toBe(expectedCellSize);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should maintain readable cell sizes after resize', () => {
    fc.assert(fc.property(
      fc.integer({ min: 320, max: 1920 }), // initial width
      fc.integer({ min: 568, max: 1080 }), // initial height
      fc.integer({ min: 320, max: 1920 }), // new width
      fc.integer({ min: 568, max: 1080 }), // new height
      (initialWidth, initialHeight, newWidth, newHeight) => {
        // Set initial dimensions
        Object.defineProperty(window, 'innerWidth', {
          value: initialWidth,
          writable: true,
          configurable: true
        });
        Object.defineProperty(window, 'innerHeight', {
          value: initialHeight,
          writable: true,
          configurable: true
        });
        
        renderer.adaptLayoutForScreen();
        const initialCellSize = renderer.getOptimalCellSize();
        
        // Resize window
        Object.defineProperty(window, 'innerWidth', {
          value: newWidth,
          writable: true,
          configurable: true
        });
        Object.defineProperty(window, 'innerHeight', {
          value: newHeight,
          writable: true,
          configurable: true
        });
        
        renderer.adaptLayoutForScreen();
        const newCellSize = renderer.getOptimalCellSize();
        
        // Cell size should remain within readable bounds
        expect(newCellSize).toBeGreaterThan(0);
        expect(newCellSize).toBeLessThanOrEqual(100);
        
        // Cell size should adapt appropriately to screen size changes
        const screenSizeRatio = Math.min(newWidth, newHeight) / Math.min(initialWidth, initialHeight);
        
        // If screen got significantly smaller, cell size should not increase
        if (screenSizeRatio < 0.7) {
          expect(newCellSize).toBeLessThanOrEqual(initialCellSize);
        }
        
        // If screen got significantly larger, cell size should not decrease
        if (screenSizeRatio > 1.3) {
          expect(newCellSize).toBeGreaterThanOrEqual(initialCellSize);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should adapt cell size appropriately for different screen sizes', () => {
    fc.assert(fc.property(
      fc.integer({ min: 320, max: 1920 }), // screen width
      fc.integer({ min: 568, max: 1080 }), // screen height
      (screenWidth, screenHeight) => {
        // Mock window dimensions
        Object.defineProperty(window, 'innerWidth', {
          value: screenWidth,
          writable: true,
          configurable: true
        });
        Object.defineProperty(window, 'innerHeight', {
          value: screenHeight,
          writable: true,
          configurable: true
        });
        
        // Adapt layout
        renderer.adaptLayoutForScreen();
        
        // Get the cell size after adaptation
        const cellSize = renderer.getOptimalCellSize();
        
        // Cell size should be appropriate for the screen size
        expect(cellSize).toBeGreaterThan(0);
        expect(cellSize).toBeLessThanOrEqual(100);
        
        // For touch devices, verify the calculation is correct
        if (renderer.isTouchEnabled()) {
          const minDimension = Math.min(screenWidth, screenHeight);
          const expectedCellSize = Math.max(50, Math.min(80, Math.floor(minDimension / 12)));
          expect(cellSize).toBe(expectedCellSize);
        } else {
          expect(cellSize).toBe(40); // Default for desktop
        }
        
        // Layout adaptation should not throw errors
        expect(() => renderer.adaptLayoutForScreen()).not.toThrow();
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should handle extreme screen size transitions gracefully', () => {
    fc.assert(fc.property(
      fc.constantFrom(
        { width: 320, height: 568 },   // iPhone SE
        { width: 375, height: 667 },   // iPhone 8
        { width: 414, height: 896 },   // iPhone 11
        { width: 768, height: 1024 },  // iPad
        { width: 1024, height: 768 },  // iPad landscape
        { width: 1920, height: 1080 }, // Full HD
        { width: 3840, height: 2160 }  // 4K
      ),
      fc.constantFrom(
        { width: 320, height: 568 },
        { width: 375, height: 667 },
        { width: 414, height: 896 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1920, height: 1080 },
        { width: 3840, height: 2160 }
      ),
      (initialSize, newSize) => {
        // Set initial size
        Object.defineProperty(window, 'innerWidth', {
          value: initialSize.width,
          writable: true,
          configurable: true
        });
        Object.defineProperty(window, 'innerHeight', {
          value: initialSize.height,
          writable: true,
          configurable: true
        });
        
        renderer.adaptLayoutForScreen();
        const initialCellSize = renderer.getOptimalCellSize();
        
        // Transition to new size
        Object.defineProperty(window, 'innerWidth', {
          value: newSize.width,
          writable: true,
          configurable: true
        });
        Object.defineProperty(window, 'innerHeight', {
          value: newSize.height,
          writable: true,
          configurable: true
        });
        
        renderer.adaptLayoutForScreen();
        const newCellSize = renderer.getOptimalCellSize();
        
        // Both cell sizes should be valid
        expect(initialCellSize).toBeGreaterThan(0);
        expect(newCellSize).toBeGreaterThan(0);
        
        // Cell sizes should be within reasonable bounds
        expect(initialCellSize).toBeLessThanOrEqual(100);
        expect(newCellSize).toBeLessThanOrEqual(100);
        
        // Layout should remain functional (no errors thrown)
        expect(() => renderer.adaptLayoutForScreen()).not.toThrow();
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should maintain coordinate mapping accuracy after resize', () => {
    fc.assert(fc.property(
      fc.integer({ min: 320, max: 1920 }), // screen width
      fc.integer({ min: 568, max: 1080 }), // screen height
      fc.integer({ min: 0, max: 15 }), // cell x
      fc.integer({ min: 0, max: 15 }), // cell y
      (screenWidth, screenHeight, cellX, cellY) => {
        // Mock window dimensions
        Object.defineProperty(window, 'innerWidth', {
          value: screenWidth,
          writable: true,
          configurable: true
        });
        Object.defineProperty(window, 'innerHeight', {
          value: screenHeight,
          writable: true,
          configurable: true
        });
        
        renderer.adaptLayoutForScreen();
        
        // Calculate screen coordinates from cell coordinates
        const cellSize = renderer.getOptimalCellSize();
        const screenX = 10 + cellX * cellSize + cellSize / 2; // Center of cell
        const screenY = 10 + cellY * cellSize + cellSize / 2;
        
        // Convert back to cell coordinates
        const convertedCell = renderer.screenToCell(screenX, screenY);
        
        // Conversion should be accurate
        if (convertedCell) {
          expect(convertedCell.x).toBe(cellX);
          expect(convertedCell.y).toBe(cellY);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });
});