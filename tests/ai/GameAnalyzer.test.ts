import { describe, it, expect, beforeEach } from 'vitest';
import { GameAnalyzer } from '@/ai/GameAnalyzer';
import { GameBoard } from '@/game/GameBoard';
import { DifficultyLevel, Move, GameAnalysis, SkillArea } from '@/types';
import * as fc from 'fast-check';

describe('GameAnalyzer', () => {
  let analyzer: GameAnalyzer;

  beforeEach(() => {
    analyzer = new GameAnalyzer();
  });

  describe('analyzeGame', () => {
    it('should return a valid GameAnalysis object', () => {
      const board = new GameBoard({
        width: 5,
        height: 5,
        mineCount: 5,
        level: DifficultyLevel.BEGINNER
      });

      const moves: Move[] = [
        {
          cell: { x: 0, y: 0 },
          action: 'reveal',
          timestamp: new Date(),
          boardState: board.serialize(),
          wasOptimal: true,
          alternativeOptions: []
        }
      ];

      const analysis = analyzer.analyzeGame(moves, board);

      expect(analysis).toHaveProperty('gameId');
      expect(analysis).toHaveProperty('totalMoves');
      expect(analysis).toHaveProperty('optimalMoves');
      expect(analysis).toHaveProperty('hintsUsed');
      expect(analysis).toHaveProperty('criticalMistakes');
      expect(analysis).toHaveProperty('missedOpportunities');
      expect(analysis).toHaveProperty('strategicInsights');
      expect(analysis).toHaveProperty('skillDemonstrated');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: ai-minesweeper, Property 20: Post-game analysis generation**
     * **Validates: Requirements 5.1**
     * 
     * For any completed game, the system should identify and analyze key decision points with alternative move suggestions
     */
    it('Property 20: Post-game analysis generation - should analyze any completed game and identify key decision points', () => {
      fc.assert(
        fc.property(
          // Generate board configuration
          fc.record({
            width: fc.integer({ min: 3, max: 10 }),
            height: fc.integer({ min: 3, max: 10 }),
            mineCount: fc.integer({ min: 1, max: 10 })
          }),
          // Generate move sequence
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 9 }),
              y: fc.integer({ min: 0, max: 9 }),
              action: fc.constantFrom('reveal' as const, 'flag' as const),
              wasOptimal: fc.boolean()
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (boardConfig, moveData) => {
            // Ensure mine count doesn't exceed board size
            const maxMines = Math.floor(boardConfig.width * boardConfig.height * 0.8);
            const safeMineCount = Math.min(boardConfig.mineCount, maxMines);

            // Create board
            const board = new GameBoard({
              width: boardConfig.width,
              height: boardConfig.height,
              mineCount: safeMineCount,
              level: DifficultyLevel.CUSTOM
            });

            // Create moves from generated data
            const moves: Move[] = moveData
              .filter(m => m.x < boardConfig.width && m.y < boardConfig.height)
              .map(m => ({
                cell: { x: m.x, y: m.y },
                action: m.action,
                timestamp: new Date(),
                boardState: board.serialize(),
                wasOptimal: m.wasOptimal,
                alternativeOptions: []
              }));

            // Skip if no valid moves
            if (moves.length === 0) {
              return true;
            }

            // Analyze the game
            const analysis = analyzer.analyzeGame(moves, board);

            // Property: Analysis should always be generated for any completed game
            expect(analysis).toBeDefined();
            expect(analysis.gameId).toBeDefined();
            expect(typeof analysis.gameId).toBe('string');
            expect(analysis.gameId.length).toBeGreaterThan(0);

            // Property: Total moves should match input
            expect(analysis.totalMoves).toBe(moves.length);

            // Property: Optimal moves count should be <= total moves
            expect(analysis.optimalMoves).toBeLessThanOrEqual(analysis.totalMoves);
            expect(analysis.optimalMoves).toBeGreaterThanOrEqual(0);

            // Property: Hints used should be non-negative
            expect(analysis.hintsUsed).toBeGreaterThanOrEqual(0);

            // Property: Critical mistakes should be an array
            expect(Array.isArray(analysis.criticalMistakes)).toBe(true);
            expect(analysis.criticalMistakes.length).toBeLessThanOrEqual(moves.length);

            // Property: Missed opportunities should be an array
            expect(Array.isArray(analysis.missedOpportunities)).toBe(true);
            expect(analysis.missedOpportunities.length).toBeLessThanOrEqual(moves.length);

            // Property: Strategic insights should be an array of strings
            expect(Array.isArray(analysis.strategicInsights)).toBe(true);
            analysis.strategicInsights.forEach(insight => {
              expect(typeof insight).toBe('string');
            });

            // Property: Skill demonstrated should be an array of valid SkillArea values
            expect(Array.isArray(analysis.skillDemonstrated)).toBe(true);
            analysis.skillDemonstrated.forEach(skill => {
              expect(Object.values(SkillArea)).toContain(skill);
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 21: Suboptimal move identification**
     * **Validates: Requirements 5.2**
     * 
     * For any completed game containing suboptimal moves, the analysis should highlight these moves with explanatory reasoning
     */
    it('Property 21: Suboptimal move identification - should identify suboptimal moves in any completed game', () => {
      fc.assert(
        fc.property(
          // Generate board configuration
          fc.record({
            width: fc.integer({ min: 3, max: 8 }),
            height: fc.integer({ min: 3, max: 8 }),
            mineCount: fc.integer({ min: 1, max: 8 })
          }),
          // Generate move sequence with known optimal/suboptimal moves
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 7 }),
              y: fc.integer({ min: 0, max: 7 }),
              action: fc.constantFrom('reveal' as const, 'flag' as const),
              wasOptimal: fc.boolean()
            }),
            { minLength: 2, maxLength: 15 }
          ),
          (boardConfig, moveData) => {
            // Ensure mine count doesn't exceed board size
            const maxMines = Math.floor(boardConfig.width * boardConfig.height * 0.7);
            const safeMineCount = Math.min(boardConfig.mineCount, maxMines);

            // Create board
            const board = new GameBoard({
              width: boardConfig.width,
              height: boardConfig.height,
              mineCount: safeMineCount,
              level: DifficultyLevel.CUSTOM
            });

            // Create moves from generated data, ensuring they're within bounds
            const moves: Move[] = moveData
              .filter(m => m.x < boardConfig.width && m.y < boardConfig.height)
              .map(m => ({
                cell: { x: m.x, y: m.y },
                action: m.action,
                timestamp: new Date(),
                boardState: board.serialize(),
                wasOptimal: m.wasOptimal,
                alternativeOptions: []
              }));

            // Skip if no valid moves
            if (moves.length === 0) {
              return true;
            }

            // Count expected suboptimal moves
            const expectedSuboptimal = moves.filter(m => !m.wasOptimal).length;

            // Identify suboptimal moves
            const suboptimalMoves = analyzer.identifySuboptimalMoves(moves);

            // Property: Should identify exactly the moves marked as suboptimal
            expect(suboptimalMoves.length).toBe(expectedSuboptimal);

            // Property: All identified moves should actually be suboptimal
            suboptimalMoves.forEach(move => {
              expect(move.wasOptimal).toBe(false);
            });

            // Property: Should return subset of original moves
            expect(suboptimalMoves.length).toBeLessThanOrEqual(moves.length);

            // Property: Each suboptimal move should be from the original move set
            suboptimalMoves.forEach(suboptimalMove => {
              const originalMove = moves.find(m => 
                m.cell.x === suboptimalMove.cell.x && 
                m.cell.y === suboptimalMove.cell.y &&
                m.action === suboptimalMove.action
              );
              expect(originalMove).toBeDefined();
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 22: Improvement suggestion generation**
     * **Validates: Requirements 5.3**
     * 
     * For any analyzed game, the system should generate specific, actionable suggestions for strategic improvement
     */
    it('Property 22: Improvement suggestion generation - should generate actionable improvement suggestions for any game analysis', () => {
      fc.assert(
        fc.property(
          // Generate game analysis data
          fc.record({
            gameId: fc.string({ minLength: 1, maxLength: 20 }),
            totalMoves: fc.integer({ min: 1, max: 50 }),
            optimalMoves: fc.integer({ min: 0, max: 50 }),
            hintsUsed: fc.integer({ min: 0, max: 20 }),
            criticalMistakes: fc.array(
              fc.record({
                cell: fc.record({
                  x: fc.integer({ min: 0, max: 10 }),
                  y: fc.integer({ min: 0, max: 10 })
                }),
                action: fc.constantFrom('reveal' as const, 'flag' as const),
                timestamp: fc.date(),
                boardState: fc.string(),
                wasOptimal: fc.constant(false),
                alternativeOptions: fc.array(fc.record({
                  cell: fc.record({
                    x: fc.integer({ min: 0, max: 10 }),
                    y: fc.integer({ min: 0, max: 10 })
                  }),
                  action: fc.constantFrom('reveal' as const, 'flag' as const),
                  confidence: fc.float({ min: 0, max: 1 }),
                  reasoning: fc.string(),
                  expectedInformation: fc.float({ min: 0, max: 10 })
                }))
              }),
              { maxLength: 5 }
            ),
            missedOpportunities: fc.array(
              fc.record({
                cell: fc.record({
                  x: fc.integer({ min: 0, max: 10 }),
                  y: fc.integer({ min: 0, max: 10 })
                }),
                action: fc.constantFrom('reveal' as const, 'flag' as const),
                timestamp: fc.date(),
                boardState: fc.string(),
                wasOptimal: fc.constant(false),
                alternativeOptions: fc.array(fc.record({
                  cell: fc.record({
                    x: fc.integer({ min: 0, max: 10 }),
                    y: fc.integer({ min: 0, max: 10 })
                  }),
                  action: fc.constantFrom('reveal' as const, 'flag' as const),
                  confidence: fc.float({ min: 0, max: 1 }),
                  reasoning: fc.string(),
                  expectedInformation: fc.float({ min: 0, max: 10 })
                }))
              }),
              { maxLength: 5 }
            ),
            strategicInsights: fc.array(fc.string(), { maxLength: 5 }),
            skillDemonstrated: fc.array(
              fc.constantFrom(...Object.values(SkillArea)),
              { maxLength: 4 }
            )
          }),
          (analysisData) => {
            // Ensure optimalMoves doesn't exceed totalMoves
            const safeOptimalMoves = Math.min(analysisData.optimalMoves, analysisData.totalMoves);
            
            const analysis: GameAnalysis = {
              ...analysisData,
              optimalMoves: safeOptimalMoves
            };

            // Generate improvement suggestions
            const suggestions = analyzer.generateImprovementSuggestions(analysis);

            // Property: Should always return an array of suggestions
            expect(Array.isArray(suggestions)).toBe(true);

            // Property: Should generate at least one suggestion for any game
            expect(suggestions.length).toBeGreaterThan(0);

            // Property: All suggestions should be strings
            suggestions.forEach(suggestion => {
              expect(typeof suggestion).toBe('string');
              expect(suggestion.length).toBeGreaterThan(0);
            });

            // Property: Suggestions should be actionable (contain specific advice)
            // Check that suggestions contain actionable words/phrases
            const actionableWords = [
              'focus', 'practice', 'try', 'consider', 'work on', 'avoid', 
              'develop', 'improve', 'learn', 'analyze', 'take time'
            ];
            
            const hasActionableContent = suggestions.some(suggestion => 
              actionableWords.some(word => 
                suggestion.toLowerCase().includes(word.toLowerCase())
              )
            );
            expect(hasActionableContent).toBe(true);

            // Property: Should provide different suggestions based on analysis content
            // If efficiency is low, should suggest improvement
            const efficiency = analysis.totalMoves > 0 ? analysis.optimalMoves / analysis.totalMoves : 0;
            if (efficiency < 0.7) {
              const hasEfficiencySuggestion = suggestions.some(s => 
                s.toLowerCase().includes('analyzing') || 
                s.toLowerCase().includes('carefully') ||
                s.toLowerCase().includes('safe')
              );
              expect(hasEfficiencySuggestion).toBe(true);
            }

            // Property: Should suggest hint-related advice based on hint usage
            const hintRatio = analysis.totalMoves > 0 ? analysis.hintsUsed / analysis.totalMoves : 0;
            if (hintRatio > 0.3 || (hintRatio < 0.1 && efficiency < 0.8)) {
              const hasHintSuggestion = suggestions.some(s => 
                s.toLowerCase().includes('hint') || 
                s.toLowerCase().includes('pattern recognition')
              );
              expect(hasHintSuggestion).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 23: Performance trend tracking**
     * **Validates: Requirements 5.4**
     * 
     * For any series of multiple games, the system should identify and track performance patterns and trends over time
     */
    it('Property 23: Performance trend tracking - should identify performance patterns and trends across multiple games', () => {
      fc.assert(
        fc.property(
          // Generate multiple game analyses
          fc.array(
            fc.record({
              gameId: fc.string({ minLength: 1, maxLength: 10 }),
              totalMoves: fc.integer({ min: 1, max: 30 }),
              optimalMoves: fc.integer({ min: 0, max: 30 }),
              hintsUsed: fc.integer({ min: 0, max: 10 }),
              criticalMistakes: fc.array(
                fc.record({
                  cell: fc.record({
                    x: fc.integer({ min: 0, max: 10 }),
                    y: fc.integer({ min: 0, max: 10 })
                  }),
                  action: fc.constantFrom('reveal' as const, 'flag' as const),
                  timestamp: fc.date(),
                  boardState: fc.string(),
                  wasOptimal: fc.constant(false),
                  alternativeOptions: fc.array(fc.record({
                    cell: fc.record({
                      x: fc.integer({ min: 0, max: 10 }),
                      y: fc.integer({ min: 0, max: 10 })
                    }),
                    action: fc.constantFrom('reveal' as const, 'flag' as const),
                    confidence: fc.float({ min: 0, max: 1 }),
                    reasoning: fc.string(),
                    expectedInformation: fc.float({ min: 0, max: 10 })
                  }))
                }),
                { maxLength: 3 }
              ),
              missedOpportunities: fc.array(
                fc.record({
                  cell: fc.record({
                    x: fc.integer({ min: 0, max: 10 }),
                    y: fc.integer({ min: 0, max: 10 })
                  }),
                  action: fc.constantFrom('reveal' as const, 'flag' as const),
                  timestamp: fc.date(),
                  boardState: fc.string(),
                  wasOptimal: fc.constant(false),
                  alternativeOptions: fc.array(fc.record({
                    cell: fc.record({
                      x: fc.integer({ min: 0, max: 10 }),
                      y: fc.integer({ min: 0, max: 10 })
                    }),
                    action: fc.constantFrom('reveal' as const, 'flag' as const),
                    confidence: fc.float({ min: 0, max: 1 }),
                    reasoning: fc.string(),
                    expectedInformation: fc.float({ min: 0, max: 10 })
                  }))
                }),
                { maxLength: 3 }
              ),
              strategicInsights: fc.array(fc.string(), { maxLength: 3 }),
              skillDemonstrated: fc.array(
                fc.constantFrom(...Object.values(SkillArea)),
                { maxLength: 4 }
              )
            }),
            { minLength: 2, maxLength: 15 }
          ),
          (analysesData) => {
            // Ensure optimalMoves doesn't exceed totalMoves for each analysis
            const analyses: GameAnalysis[] = analysesData.map(data => ({
              ...data,
              optimalMoves: Math.min(data.optimalMoves, data.totalMoves)
            }));

            // Track performance trends
            const trends = analyzer.trackPerformanceTrends(analyses);

            // Property: Should always return an array of trends
            expect(Array.isArray(trends)).toBe(true);

            // Property: Should generate at least one trend for multiple games
            expect(trends.length).toBeGreaterThan(0);

            // Property: All trends should be strings
            trends.forEach(trend => {
              expect(typeof trend).toBe('string');
              expect(trend.length).toBeGreaterThan(0);
            });

            // Property: For insufficient data, should return appropriate message
            if (analyses.length < 2) {
              expect(trends[0]).toContain('Not enough games');
            } else {
              // Property: Should provide meaningful trend analysis for sufficient data
              const hasMeaningfulTrends = trends.some(trend => 
                trend.includes('efficiency') || 
                trend.includes('hints') || 
                trend.includes('mistakes') ||
                trend.includes('skill') ||
                trend.includes('performance') ||
                trend.includes('consistent')
              );
              expect(hasMeaningfulTrends).toBe(true);
            }

            // Property: Trends should be relevant to the data
            // For sufficient data, trends should contain performance-related keywords
            if (analyses.length >= 3) {
              const hasPerformanceRelatedTrend = trends.some(trend => {
                const lowerTrend = trend.toLowerCase();
                return lowerTrend.includes('efficiency') || 
                       lowerTrend.includes('hints') || 
                       lowerTrend.includes('mistakes') ||
                       lowerTrend.includes('skill') ||
                       lowerTrend.includes('performance') ||
                       lowerTrend.includes('consistent') ||
                       lowerTrend.includes('improvement') ||
                       lowerTrend.includes('pattern');
              });
              expect(hasPerformanceRelatedTrend).toBe(true);
            }

            // Property: Should not contain duplicate trends
            const uniqueTrends = new Set(trends);
            expect(uniqueTrends.size).toBe(trends.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-minesweeper, Property 24: Game replay with commentary**
     * **Validates: Requirements 5.5**
     * 
     * For any completed game, the replay system should accurately reproduce the move sequence with appropriate AI commentary
     */
    it('Property 24: Game replay with commentary - should generate accurate replay with AI commentary for any move sequence', () => {
      fc.assert(
        fc.property(
          // Generate move sequence
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: 15 }),
              y: fc.integer({ min: 0, max: 15 }),
              action: fc.constantFrom('reveal' as const, 'flag' as const),
              wasOptimal: fc.boolean(),
              timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2024-12-31') })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (moveData) => {
            // Create moves from generated data
            const moves: Move[] = moveData.map((m, index) => ({
              cell: { x: m.x, y: m.y },
              action: m.action,
              timestamp: new Date(m.timestamp.getTime() + index * 1000), // Ensure chronological order
              boardState: `board_state_${index}`,
              wasOptimal: m.wasOptimal,
              alternativeOptions: m.wasOptimal ? [] : [
                {
                  cell: { x: Math.max(0, m.x - 1), y: Math.max(0, m.y - 1) },
                  action: 'reveal' as const,
                  confidence: 0.8,
                  reasoning: 'Safer alternative move',
                  expectedInformation: 2.5
                }
              ]
            }));

            // Generate game replay
            const replay = analyzer.generateGameReplay(moves);

            // Property: Should always return an array of commentary
            expect(Array.isArray(replay)).toBe(true);

            // Property: Should generate commentary for non-empty move sequences
            expect(replay.length).toBeGreaterThan(0);

            // Property: All commentary should be strings
            replay.forEach(comment => {
              expect(typeof comment).toBe('string');
              expect(comment.length).toBeGreaterThan(0);
            });

            // Property: Should include game overview for multiple moves
            if (moves.length > 1) {
              const hasOverview = replay.some(comment => 
                comment.includes('Game Replay Analysis') || 
                comment.includes('efficiency') ||
                comment.includes('Overall')
              );
              expect(hasOverview).toBe(true);
            }

            // Property: Should comment on each move
            const moveComments = replay.filter(comment => 
              comment.match(/Move \d+:/) !== null
            );
            expect(moveComments.length).toBe(moves.length);

            // Property: Should accurately reflect move sequence
            moves.forEach((move, index) => {
              const moveNumber = index + 1;
              const expectedMovePattern = new RegExp(`Move ${moveNumber}:.*${move.action}.*\\(${move.cell.x}, ${move.cell.y}\\)`);
              const hasMoveComment = replay.some(comment => 
                expectedMovePattern.test(comment)
              );
              expect(hasMoveComment).toBe(true);
            });

            // Property: Should provide different commentary for optimal vs suboptimal moves
            const optimalMoves = moves.filter(m => m.wasOptimal);
            const suboptimalMoves = moves.filter(m => !m.wasOptimal);

            if (optimalMoves.length > 0) {
              const hasPositiveCommentary = replay.some(comment => 
                comment.includes('Excellent') || 
                comment.includes('Good') || 
                comment.includes('✓')
              );
              expect(hasPositiveCommentary).toBe(true);
            }

            if (suboptimalMoves.length > 0) {
              const hasImprovementCommentary = replay.some(comment => 
                comment.includes('Suboptimal') || 
                comment.includes('Better option') || 
                comment.includes('⚠') ||
                comment.includes('Consider')
              );
              expect(hasImprovementCommentary).toBe(true);
            }

            // Property: Should include game summary for longer games
            if (moves.length > 3) {
              const hasSummary = replay.some(comment => 
                comment.includes('Game Summary') || 
                comment.includes('duration') ||
                comment.includes('Move distribution')
              );
              expect(hasSummary).toBe(true);
            }

            // Property: Should maintain chronological order in commentary
            const moveCommentIndices = replay
              .map((comment, index) => ({ comment, index }))
              .filter(({ comment }) => comment.match(/Move \d+:/))
              .map(({ index }) => index);
            
            for (let i = 1; i < moveCommentIndices.length; i++) {
              expect(moveCommentIndices[i]).toBeGreaterThan(moveCommentIndices[i - 1]);
            }

            // Property: Should not contain duplicate move commentary
            const moveNumbers = replay
              .filter(comment => comment.match(/Move \d+:/))
              .map(comment => {
                const match = comment.match(/Move (\d+):/);
                return match ? parseInt(match[1]) : -1;
              })
              .filter(num => num > 0);
            
            const uniqueMoveNumbers = new Set(moveNumbers);
            expect(uniqueMoveNumbers.size).toBe(moveNumbers.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('identifySuboptimalMoves', () => {
    it('should identify moves that were not optimal', () => {
      const board = new GameBoard({
        width: 5,
        height: 5,
        mineCount: 5,
        level: DifficultyLevel.BEGINNER
      });

      const moves: Move[] = [
        {
          cell: { x: 0, y: 0 },
          action: 'reveal',
          timestamp: new Date(),
          boardState: board.serialize(),
          wasOptimal: true,
          alternativeOptions: []
        },
        {
          cell: { x: 1, y: 1 },
          action: 'reveal',
          timestamp: new Date(),
          boardState: board.serialize(),
          wasOptimal: false,
          alternativeOptions: []
        }
      ];

      const suboptimal = analyzer.identifySuboptimalMoves(moves);
      expect(suboptimal.length).toBe(1);
      expect(suboptimal[0].cell).toEqual({ x: 1, y: 1 });
    });
  });

  describe('generateImprovementSuggestions', () => {
    it('should generate suggestions based on analysis', () => {
      const analysis: GameAnalysis = {
        gameId: 'test-game',
        totalMoves: 10,
        optimalMoves: 5,
        hintsUsed: 2,
        criticalMistakes: [],
        missedOpportunities: [],
        strategicInsights: [],
        skillDemonstrated: []
      };

      const suggestions = analyzer.generateImprovementSuggestions(analysis);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(typeof suggestion).toBe('string');
      });
    });
  });

  describe('trackPerformanceTrends', () => {
    it('should return message for insufficient data', () => {
      const analyses: GameAnalysis[] = [
        {
          gameId: 'game1',
          totalMoves: 10,
          optimalMoves: 8,
          hintsUsed: 1,
          criticalMistakes: [],
          missedOpportunities: [],
          strategicInsights: [],
          skillDemonstrated: []
        }
      ];

      const trends = analyzer.trackPerformanceTrends(analyses);
      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toContain('Not enough games');
    });

    it('should identify trends with multiple games', () => {
      const analyses: GameAnalysis[] = Array.from({ length: 10 }, (_, i) => ({
        gameId: `game${i}`,
        totalMoves: 10,
        optimalMoves: 5 + i,
        hintsUsed: 2,
        criticalMistakes: [],
        missedOpportunities: [],
        strategicInsights: [],
        skillDemonstrated: []
      }));

      const trends = analyzer.trackPerformanceTrends(analyses);
      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBeGreaterThan(0);
    });
  });

  describe('generateGameReplay', () => {
    it('should generate commentary for each move', () => {
      const board = new GameBoard({
        width: 5,
        height: 5,
        mineCount: 5,
        level: DifficultyLevel.BEGINNER
      });

      const moves: Move[] = [
        {
          cell: { x: 0, y: 0 },
          action: 'reveal',
          timestamp: new Date(),
          boardState: board.serialize(),
          wasOptimal: true,
          alternativeOptions: []
        },
        {
          cell: { x: 1, y: 1 },
          action: 'flag',
          timestamp: new Date(),
          boardState: board.serialize(),
          wasOptimal: false,
          alternativeOptions: []
        }
      ];

      const replay = analyzer.generateGameReplay(moves);
      expect(Array.isArray(replay)).toBe(true);
      expect(replay.length).toBeGreaterThan(moves.length); // Includes overview and summary
      replay.forEach(comment => {
        expect(typeof comment).toBe('string');
        expect(comment.length).toBeGreaterThan(0);
      });
      
      // Should have commentary for each move
      const moveComments = replay.filter(comment => comment.match(/Move \d+:/));
      expect(moveComments.length).toBe(moves.length);
    });
  });
});
