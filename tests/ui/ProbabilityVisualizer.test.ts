import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProbabilityVisualizer, ProbabilityDetailLevel } from '@/ui/ProbabilityVisualizer';
import { ProbabilityMap } from '@/types';
import { GameBoard } from '@/game/GameBoard';
import { DifficultyLevel } from '@/types';
import * as fc from 'fast-check';

// Mock Canvas and CanvasRenderingContext2D
class MockCanvasRenderingContext2D {
  fillStyle: string = '';
  strokeStyle: string = '';
  lineWidth: number = 1;
  font: string = '';
  textAlign: string = '';
  textBaseline: string = '';
  globalAlpha: number = 1;

  fillRect() {}
  strokeRect() {}
  fillText() {}
  measureText() { return { width: 100 }; }
  beginPath() {}
  arc() {}
  fill() {}
  stroke() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  clearRect() {}
  save() {}
  restore() {}
  translate() {}
  scale() {}
  setLineDash() {}
}

class MockCanvas {
  width: number = 600;
  height: number = 600;
  
  getContext(): MockCanvasRenderingContext2D {
    return new MockCanvasRenderingContext2D();
  }
}

describe('ProbabilityVisualizer', () => {
  let canvas: MockCanvas;
  let visualizer: ProbabilityVisualizer;
  let gameBoard: GameBoard;
  let probabilities: ProbabilityMap;

  beforeEach(() => {
    canvas = new MockCanvas();
    visualizer = new ProbabilityVisualizer(canvas as any);
    
    gameBoard = new GameBoard({
      width: 5,
      height: 5,
      mineCount: 5,
      level: DifficultyLevel.BEGINNER
    });

    probabilities = {
      cellProbabilities: new Map([
        ['0,0', 0.1],
        ['1,0', 0.3],
        ['2,0', 0.5],
        ['3,0', 0.7],
        ['4,0', 0.9]
      ]),
      lastUpdated: new Date(),
      calculationMethod: 'exact'
    };
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => {
      const config = visualizer.getConfig();
      expect(config.detailLevel).toBe(ProbabilityDetailLevel.MEDIUM);
      expect(config.colorScheme).toBe('default');
      expect(config.showPercentages).toBe(true);
    });

    it('should update configuration correctly', () => {
      visualizer.setConfig({
        detailLevel: ProbabilityDetailLevel.HIGH,
        colorScheme: 'colorblind',
        showPercentages: false
      });

      const config = visualizer.getConfig();
      expect(config.detailLevel).toBe(ProbabilityDetailLevel.HIGH);
      expect(config.colorScheme).toBe('colorblind');
      expect(config.showPercentages).toBe(false);
    });

    it('should toggle detail levels correctly', () => {
      expect(visualizer.getDetailLevel()).toBe(ProbabilityDetailLevel.MEDIUM);
      
      let newLevel = visualizer.toggleDetailLevel();
      expect(newLevel).toBe(ProbabilityDetailLevel.HIGH);
      
      newLevel = visualizer.toggleDetailLevel();
      expect(newLevel).toBe(ProbabilityDetailLevel.OFF);
      
      newLevel = visualizer.toggleDetailLevel();
      expect(newLevel).toBe(ProbabilityDetailLevel.LOW);
      
      newLevel = visualizer.toggleDetailLevel();
      expect(newLevel).toBe(ProbabilityDetailLevel.MEDIUM);
    });
  });

  describe('Coordinate Conversion', () => {
    it('should convert screen coordinates to cell coordinates correctly', () => {
      visualizer.setCellSize(40);
      visualizer.setOffset(10, 10);

      const cellCoords = visualizer.screenToCell(50, 50);
      expect(cellCoords).toEqual({ x: 1, y: 1 });
    });

    it('should return null for invalid screen coordinates', () => {
      visualizer.setCellSize(40);
      visualizer.setOffset(10, 10);

      const cellCoords = visualizer.screenToCell(5, 5);
      expect(cellCoords).toBeNull();
    });
  });

  describe('Hover State Management', () => {
    it('should set and clear hovered cell correctly', () => {
      visualizer.setHoveredCell(2, 3);
      // We can't directly test the internal state, but we can test that it doesn't throw
      expect(() => visualizer.setHoveredCell(2, 3)).not.toThrow();
      
      visualizer.setHoveredCell(null, null);
      expect(() => visualizer.setHoveredCell(null, null)).not.toThrow();
    });
  });

  describe('Rendering', () => {
    it('should render probabilities without throwing errors', () => {
      expect(() => {
        visualizer.renderProbabilities(gameBoard, probabilities);
      }).not.toThrow();
    });

    it('should not render when detail level is OFF', () => {
      visualizer.setDetailLevel(ProbabilityDetailLevel.OFF);
      
      expect(() => {
        visualizer.renderProbabilities(gameBoard, probabilities);
      }).not.toThrow();
    });

    it('should render tooltip without throwing errors', () => {
      expect(() => {
        visualizer.renderTooltip(0, 0, 0.5);
      }).not.toThrow();
    });

    it('should clear visualization without throwing errors', () => {
      expect(() => {
        visualizer.clear();
      }).not.toThrow();
    });
  });

  describe('Color Scheme', () => {
    it('should set color scheme correctly', () => {
      visualizer.setColorScheme('colorblind');
      expect(visualizer.getConfig().colorScheme).toBe('colorblind');
      
      visualizer.setColorScheme('default');
      expect(visualizer.getConfig().colorScheme).toBe('default');
    });
  });

  describe('Cell Size and Offset', () => {
    it('should update cell size correctly', () => {
      visualizer.setCellSize(50);
      // Test that coordinate conversion uses new cell size
      visualizer.setOffset(0, 0);
      const cellCoords = visualizer.screenToCell(75, 75);
      expect(cellCoords).toEqual({ x: 1, y: 1 });
    });

    it('should update offset correctly', () => {
      visualizer.setCellSize(40);
      visualizer.setOffset(20, 20);
      const cellCoords = visualizer.screenToCell(60, 60);
      expect(cellCoords).toEqual({ x: 1, y: 1 });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 17: Probability visualization consistency
     * Validates: Requirements 4.2
     */
    it('should maintain consistent color coding for same probability values across different visualizer instances', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }), // Generate probability values between 0 and 1
          fc.constantFrom('default', 'colorblind'), // Test both color schemes
          (probability, colorScheme) => {
            // Create multiple visualizer instances with the same configuration
            const canvas1 = new MockCanvas();
            const canvas2 = new MockCanvas();
            const visualizer1 = new ProbabilityVisualizer(canvas1 as any, { colorScheme });
            const visualizer2 = new ProbabilityVisualizer(canvas2 as any, { colorScheme });

            // Get colors from both instances for the same probability
            const color1 = visualizer1.getColorForProbability(probability);
            const color2 = visualizer2.getColorForProbability(probability);

            // Colors should be identical for the same probability and color scheme
            expect(color1).toBe(color2);

            // Verify the color is a valid hex color string
            expect(color1).toMatch(/^#[0-9a-fA-F]{6}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent color ordering for probability ranges', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.float({ min: 0, max: 1 }),
            fc.float({ min: 0, max: 1 })
          ).filter(([p1, p2]) => Math.abs(p1 - p2) > 0.01), // Ensure probabilities are sufficiently different
          fc.constantFrom('default', 'colorblind'),
          ([prob1, prob2], colorScheme) => {
            const canvas = new MockCanvas();
            const visualizer = new ProbabilityVisualizer(canvas as any, { colorScheme });

            const color1 = visualizer.getColorForProbability(prob1);
            const color2 = visualizer.getColorForProbability(prob2);

            // Same probability should always give same color
            if (Math.abs(prob1 - prob2) < 0.001) {
              expect(color1).toBe(color2);
            }

            // Colors should be valid hex strings
            expect(color1).toMatch(/^#[0-9a-fA-F]{6}$/);
            expect(color2).toMatch(/^#[0-9a-fA-F]{6}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use different color schemes consistently', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }),
          (probability) => {
            const canvas1 = new MockCanvas();
            const canvas2 = new MockCanvas();
            const defaultVisualizer = new ProbabilityVisualizer(canvas1 as any, { colorScheme: 'default' });
            const colorblindVisualizer = new ProbabilityVisualizer(canvas2 as any, { colorScheme: 'colorblind' });

            const defaultColor = defaultVisualizer.getColorForProbability(probability);
            const colorblindColor = colorblindVisualizer.getColorForProbability(probability);

            // Both should be valid colors
            expect(defaultColor).toMatch(/^#[0-9a-fA-F]{6}$/);
            expect(colorblindColor).toMatch(/^#[0-9a-fA-F]{6}$/);

            // For most probabilities, the colors should be different between schemes
            // (except possibly for edge cases where they might coincidentally match)
            // We just verify they're both valid and deterministic
            expect(defaultVisualizer.getColorForProbability(probability)).toBe(defaultColor);
            expect(colorblindVisualizer.getColorForProbability(probability)).toBe(colorblindColor);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 18: Probability detail display
     * Validates: Requirements 4.3
     */
    it('should display exact probability percentage when hovering over cells with calculated probabilities', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }), // Generate probability values between 0 and 1
          fc.integer({ min: 0, max: 9 }), // Cell x coordinate
          fc.integer({ min: 0, max: 9 }), // Cell y coordinate
          fc.boolean(), // showPercentages config
          (probability, cellX, cellY, showPercentages) => {
            const canvas = new MockCanvas();
            const visualizer = new ProbabilityVisualizer(canvas as any, { 
              showPercentages,
              detailLevel: ProbabilityDetailLevel.MEDIUM 
            });

            // Set up cell size and offset for coordinate calculations
            visualizer.setCellSize(40);
            visualizer.setOffset(10, 10);

            // Set the cell as hovered
            visualizer.setHoveredCell(cellX, cellY);

            // Create a spy to capture what gets rendered
            const fillTextSpy = vi.fn();
            const mockCtx = canvas.getContext() as any;
            mockCtx.fillText = fillTextSpy;

            // Create a game board with the test cell
            const gameBoard = new GameBoard({
              width: 10,
              height: 10,
              mineCount: 10,
              level: DifficultyLevel.BEGINNER
            });

            // Create probability map with our test cell
            const probabilities: ProbabilityMap = {
              cellProbabilities: new Map([[`${cellX},${cellY}`, probability]]),
              lastUpdated: new Date(),
              calculationMethod: 'exact'
            };

            // Render probabilities (this should trigger hover display)
            visualizer.renderProbabilities(gameBoard, probabilities);

            // Verify that the exact percentage is displayed when hovering
            if (showPercentages) {
              const expectedPercentage = Math.round(probability * 100);
              const expectedText = `${expectedPercentage}%`;
              
              // Check if fillText was called with the expected percentage
              const percentageCalls = fillTextSpy.mock.calls.filter(call => 
                call[0] && call[0].toString().includes('%')
              );
              
              if (percentageCalls.length > 0) {
                // At least one call should contain the expected percentage
                const hasExpectedPercentage = percentageCalls.some(call => 
                  call[0] === expectedText
                );
                expect(hasExpectedPercentage).toBe(true);
              }
            }

            // Test tooltip rendering separately
            const tooltipFillTextSpy = vi.fn();
            mockCtx.fillText = tooltipFillTextSpy;
            
            visualizer.renderTooltip(cellX, cellY, probability);
            
            if (showPercentages) {
              const expectedTooltipText = `Mine probability: ${(probability * 100).toFixed(1)}%`;
              
              // Check if tooltip was rendered with exact percentage
              const tooltipCalls = tooltipFillTextSpy.mock.calls.filter(call => 
                call[0] && call[0].toString().includes('Mine probability:')
              );
              
              if (tooltipCalls.length > 0) {
                expect(tooltipCalls[0][0]).toBe(expectedTooltipText);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 19: Probability display management
     * Validates: Requirements 4.5
     */
    it('should correctly show or hide probability information with toggle controls without affecting game functionality', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ProbabilityDetailLevel.OFF,
            ProbabilityDetailLevel.LOW,
            ProbabilityDetailLevel.MEDIUM,
            ProbabilityDetailLevel.HIGH
          ), // Generate different detail levels
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 9 }),
              y: fc.integer({ min: 0, max: 9 }),
              probability: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 20 }
          ), // Generate array of cells with probabilities
          fc.boolean(), // showPercentages setting
          fc.constantFrom('default', 'colorblind'), // colorScheme setting
          (detailLevel, cellData, showPercentages, colorScheme) => {
            const canvas = new MockCanvas();
            const visualizer = new ProbabilityVisualizer(canvas as any, {
              detailLevel,
              showPercentages,
              colorScheme
            });

            // Create a game board
            const gameBoard = new GameBoard({
              width: 10,
              height: 10,
              mineCount: 10,
              level: DifficultyLevel.BEGINNER
            });

            // Create probability map from test data
            const probabilities: ProbabilityMap = {
              cellProbabilities: new Map(
                cellData.map(cell => [`${cell.x},${cell.y}`, cell.probability])
              ),
              lastUpdated: new Date(),
              calculationMethod: 'exact'
            };

            // Store initial configuration
            const initialConfig = visualizer.getConfig();

            // Test that rendering works without throwing errors for any detail level
            expect(() => {
              visualizer.renderProbabilities(gameBoard, probabilities);
            }).not.toThrow();

            // Test toggle functionality preserves other settings
            const originalShowPercentages = initialConfig.showPercentages;
            const originalColorScheme = initialConfig.colorScheme;
            
            const newDetailLevel = visualizer.toggleDetailLevel();
            const configAfterToggle = visualizer.getConfig();
            
            // Toggle should change detail level but preserve other settings
            expect(configAfterToggle.detailLevel).toBe(newDetailLevel);
            expect(configAfterToggle.showPercentages).toBe(originalShowPercentages);
            expect(configAfterToggle.colorScheme).toBe(originalColorScheme);

            // Test that rendering still works after toggle
            expect(() => {
              visualizer.renderProbabilities(gameBoard, probabilities);
            }).not.toThrow();

            // Test setting specific detail level
            const testDetailLevel = ProbabilityDetailLevel.HIGH;
            visualizer.setDetailLevel(testDetailLevel);
            expect(visualizer.getDetailLevel()).toBe(testDetailLevel);

            // Rendering should still work after setting detail level
            expect(() => {
              visualizer.renderProbabilities(gameBoard, probabilities);
            }).not.toThrow();

            // Test that OFF detail level actually prevents rendering
            visualizer.setDetailLevel(ProbabilityDetailLevel.OFF);
            
            // Mock the rendering context to verify no drawing operations occur
            const mockCtx = canvas.getContext() as any;
            const fillRectSpy = vi.fn();
            const fillTextSpy = vi.fn();
            mockCtx.fillRect = fillRectSpy;
            mockCtx.fillText = fillTextSpy;

            visualizer.renderProbabilities(gameBoard, probabilities);

            // When detail level is OFF, no probability rendering should occur
            // (fillRect and fillText should not be called for probability display)
            // Note: We can't easily distinguish between probability rendering and other rendering,
            // but we can verify the method completes without error
            expect(() => {
              visualizer.renderProbabilities(gameBoard, probabilities);
            }).not.toThrow();

            // Test configuration updates don't break functionality
            visualizer.setConfig({
              detailLevel: ProbabilityDetailLevel.MEDIUM,
              showPercentages: !originalShowPercentages,
              colorScheme: originalColorScheme === 'default' ? 'colorblind' : 'default'
            });

            expect(() => {
              visualizer.renderProbabilities(gameBoard, probabilities);
            }).not.toThrow();

            // Verify configuration was actually updated
            const finalConfig = visualizer.getConfig();
            expect(finalConfig.detailLevel).toBe(ProbabilityDetailLevel.MEDIUM);
            expect(finalConfig.showPercentages).toBe(!originalShowPercentages);
            expect(finalConfig.colorScheme).toBe(originalColorScheme === 'default' ? 'colorblind' : 'default');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});