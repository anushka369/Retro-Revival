import { IGameAnalyzer } from '@/interfaces/AIEngine';
import { IGameBoard } from '@/interfaces/GameEngine';
import { GameAnalysis, Move, SkillArea } from '@/types';

export class GameAnalyzer implements IGameAnalyzer {
  constructor() {
    // Future: Initialize AI components for advanced analysis
  }

  analyzeGame(moves: Move[], finalBoard: IGameBoard): GameAnalysis {
    const gameId = this.generateGameId();
    const totalMoves = moves.length;
    
    // Analyze each move for optimality
    const analyzedMoves = this.analyzeMovesForOptimality(moves);
    const optimalMoves = analyzedMoves.filter(move => move.wasOptimal).length;
    
    // Identify critical mistakes and missed opportunities
    const criticalMistakes = this.identifyCriticalMistakes(analyzedMoves, finalBoard);
    const missedOpportunities = this.identifyMissedOpportunities(analyzedMoves);
    
    // Generate strategic insights
    const strategicInsights = this.generateStrategicInsights(analyzedMoves, finalBoard);
    
    // Determine demonstrated skills
    const skillDemonstrated = this.identifyDemonstratedSkills(analyzedMoves, finalBoard);
    
    // Count hints used
    const hintsUsed = this.countHintsUsed(moves);

    return {
      gameId,
      totalMoves,
      optimalMoves,
      hintsUsed,
      criticalMistakes,
      missedOpportunities,
      strategicInsights,
      skillDemonstrated
    };
  }

  identifySuboptimalMoves(moves: Move[]): Move[] {
    return this.analyzeMovesForOptimality(moves).filter(move => !move.wasOptimal);
  }

  generateImprovementSuggestions(analysis: GameAnalysis): string[] {
    const suggestions: string[] = [];
    
    // Analyze move efficiency
    const efficiency = analysis.totalMoves > 0 ? analysis.optimalMoves / analysis.totalMoves : 0;
    
    if (efficiency < 0.7) {
      suggestions.push("Focus on analyzing the board state more carefully before making moves. Look for guaranteed safe cells first.");
    }
    
    if (analysis.criticalMistakes.length > 0) {
      suggestions.push("Avoid rushing into moves. Take time to count adjacent mines and verify your deductions.");
    }
    
    if (analysis.missedOpportunities.length > 2) {
      suggestions.push("Practice identifying patterns where multiple cells can be safely revealed or flagged simultaneously.");
    }
    
    // Analyze hint usage
    const hintRatio = analysis.totalMoves > 0 ? analysis.hintsUsed / analysis.totalMoves : 0;
    if (hintRatio > 0.3) {
      suggestions.push("Try to develop your pattern recognition skills to reduce reliance on hints.");
    } else if (hintRatio < 0.1 && efficiency < 0.8) {
      suggestions.push("Consider using hints when stuck to learn optimal strategies.");
    }
    
    // Skill-specific suggestions
    if (!analysis.skillDemonstrated.includes(SkillArea.PATTERN_RECOGNITION)) {
      suggestions.push("Work on recognizing common Minesweeper patterns like 1-2-1 sequences and corner configurations.");
    }
    
    if (!analysis.skillDemonstrated.includes(SkillArea.PROBABILITY_ANALYSIS)) {
      suggestions.push("Practice calculating mine probabilities in ambiguous situations to make better educated guesses.");
    }
    
    if (!analysis.skillDemonstrated.includes(SkillArea.STRATEGIC_PLANNING)) {
      suggestions.push("Plan your moves to maximize information gain - prioritize cells that will reveal the most about surrounding areas.");
    }
    
    // Ensure we always provide at least one suggestion
    if (suggestions.length === 0) {
      if (efficiency >= 0.9) {
        suggestions.push("Excellent performance! Continue to practice advanced techniques to maintain your high skill level.");
      } else if (efficiency >= 0.8) {
        suggestions.push("Good job! Focus on consistency to improve your success rate further.");
      } else {
        suggestions.push("Keep practicing to improve your strategic thinking and pattern recognition skills.");
      }
    }
    
    return suggestions;
  }

  trackPerformanceTrends(analyses: GameAnalysis[]): string[] {
    if (analyses.length < 2) {
      return ["Not enough games to identify trends. Play more games for detailed analysis."];
    }
    
    const trends: string[] = [];
    
    // Analyze efficiency trend
    const efficiencies = analyses.map(a => a.totalMoves > 0 ? a.optimalMoves / a.totalMoves : 0);
    const recentEfficiency = this.calculateRecentAverage(efficiencies, 5);
    const overallEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
    
    if (recentEfficiency > overallEfficiency + 0.1) {
      trends.push("Your move efficiency has improved significantly in recent games.");
    } else if (recentEfficiency < overallEfficiency - 0.1) {
      trends.push("Your move efficiency has declined recently. Consider slowing down and analyzing more carefully.");
    }
    
    // Analyze hint usage trend
    const hintUsages = analyses.map(a => a.hintsUsed);
    const recentHintUsage = this.calculateRecentAverage(hintUsages, 5);
    const overallHintUsage = hintUsages.reduce((sum, hints) => sum + hints, 0) / hintUsages.length;
    
    if (recentHintUsage < overallHintUsage - 1) {
      trends.push("You're becoming more independent and using fewer hints over time.");
    } else if (recentHintUsage > overallHintUsage + 1) {
      trends.push("You've been relying on hints more frequently in recent games.");
    }
    
    // Analyze mistake patterns
    const recentMistakes = analyses.slice(-5).reduce((sum, a) => sum + a.criticalMistakes.length, 0);
    const overallMistakes = analyses.reduce((sum, a) => sum + a.criticalMistakes.length, 0) / analyses.length;
    
    if (recentMistakes / 5 < overallMistakes - 0.5) {
      trends.push("You're making fewer critical mistakes - your risk assessment is improving.");
    }
    
    // Identify skill development
    const skillProgress = this.analyzeSkillProgression(analyses);
    trends.push(...skillProgress);
    
    // Analyze common mistake patterns
    const mistakePatterns = this.identifyMistakePatterns(analyses);
    trends.push(...mistakePatterns);
    
    // Analyze performance consistency
    const consistencyAnalysis = this.analyzePerformanceConsistency(analyses);
    trends.push(...consistencyAnalysis);
    
    // Ensure we always provide at least one trend for multiple games
    if (trends.length === 0) {
      const overallEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
      const avgHints = hintUsages.reduce((sum, hints) => sum + hints, 0) / hintUsages.length;
      
      if (overallEfficiency >= 0.8) {
        trends.push("Your performance is consistent with good efficiency across games.");
      } else if (overallEfficiency >= 0.6) {
        trends.push("Your performance shows room for improvement in efficiency. Focus on strategic planning.");
      } else {
        trends.push("Your performance indicates opportunities to improve efficiency through practice.");
      }
      
      if (avgHints > 2) {
        trends.push("Your hints usage pattern shows regular reliance on assistance.");
      }
    }
    
    return trends;
  }

  generateGameReplay(moves: Move[]): string[] {
    const commentary: string[] = [];
    
    // Add game overview
    if (moves.length > 0) {
      commentary.push(`=== Game Replay Analysis (${moves.length} moves) ===`);
      
      const optimalCount = moves.filter(m => m.wasOptimal).length;
      const efficiency = moves.length > 0 ? (optimalCount / moves.length * 100).toFixed(1) : '0';
      commentary.push(`Overall efficiency: ${efficiency}% (${optimalCount}/${moves.length} optimal moves)`);
    }
    
    moves.forEach((move, index) => {
      const moveNumber = index + 1;
      const action = move.action === 'reveal' ? 'revealed' : 'flagged';
      const position = `(${move.cell.x}, ${move.cell.y})`;
      
      let comment = `Move ${moveNumber}: ${action} cell ${position}`;
      
      // Add strategic context
      const strategicContext = this.generateStrategicContext(move, index, moves);
      if (strategicContext) {
        comment += ` ${strategicContext}`;
      }
      
      // Add move evaluation
      if (move.wasOptimal) {
        comment += " ✓ Excellent choice!";
        
        if (move.alternativeOptions.length > 0) {
          const bestAlt = move.alternativeOptions[0];
          if (bestAlt.confidence > 0.9) {
            comment += ` This was one of ${move.alternativeOptions.length} safe moves available.`;
          } else if (bestAlt.confidence > 0.7) {
            comment += ` Good strategic thinking - this move had ${(bestAlt.confidence * 100).toFixed(0)}% confidence.`;
          }
        }
        
        // Add learning insights for good moves
        if (move.action === 'flag') {
          comment += " Flagging suspected mines helps with logical deduction.";
        } else if (index === 0) {
          comment += " Good opening move - starting with corner or edge cells is often safe.";
        }
      } else {
        comment += " ⚠ Suboptimal move.";
        
        if (move.alternativeOptions.length > 0) {
          const bestAlt = move.alternativeOptions[0];
          const confidenceDiff = bestAlt.confidence - 0.5; // Assuming current move had ~50% confidence
          
          if (confidenceDiff > 0.3) {
            comment += ` Much safer option available: ${bestAlt.action} (${bestAlt.cell.x}, ${bestAlt.cell.y}) with ${(bestAlt.confidence * 100).toFixed(0)}% confidence.`;
          } else {
            comment += ` Better option: ${bestAlt.action} (${bestAlt.cell.x}, ${bestAlt.cell.y}) - ${bestAlt.reasoning}`;
          }
          
          // Add learning tip
          if (bestAlt.expectedInformation > 2) {
            comment += " This alternative would have revealed more information about the board.";
          }
        }
        
        // Add specific advice for suboptimal moves
        if (move.action === 'reveal' && index > 0) {
          comment += " Consider using flags to mark suspected mines before revealing uncertain cells.";
        }
      }
      
      // Add timing context
      if (index > 0) {
        const timeDiff = move.timestamp.getTime() - moves[index - 1].timestamp.getTime();
        if (timeDiff > 30000) { // More than 30 seconds
          comment += ` [Took ${Math.round(timeDiff / 1000)}s - careful consideration]`;
        } else if (timeDiff < 2000) { // Less than 2 seconds
          comment += " [Quick decision]";
        }
      }
      
      commentary.push(comment);
      
      // Add pattern recognition insights
      if (index > 0 && index % 5 === 0) {
        const recentMoves = moves.slice(Math.max(0, index - 4), index + 1);
        const recentOptimal = recentMoves.filter(m => m.wasOptimal).length;
        
        if (recentOptimal === recentMoves.length) {
          commentary.push(`   💡 Excellent sequence! ${recentOptimal} optimal moves in a row.`);
        } else if (recentOptimal < recentMoves.length / 2) {
          commentary.push(`   💭 Consider slowing down - recent moves could be more strategic.`);
        }
      }
    });
    
    // Add game conclusion
    if (moves.length > 0) {
      commentary.push('=== Game Summary ===');
      
      const lastMove = moves[moves.length - 1];
      const gameEndTime = lastMove.timestamp;
      const gameStartTime = moves[0].timestamp;
      const gameDuration = Math.round((gameEndTime.getTime() - gameStartTime.getTime()) / 1000);
      
      commentary.push(`Game duration: ${gameDuration} seconds`);
      commentary.push(`Average time per move: ${(gameDuration / moves.length).toFixed(1)} seconds`);
      
      const flagMoves = moves.filter(m => m.action === 'flag').length;
      const revealMoves = moves.filter(m => m.action === 'reveal').length;
      
      commentary.push(`Move distribution: ${revealMoves} reveals, ${flagMoves} flags`);
      
      if (flagMoves === 0) {
        commentary.push('💡 Tip: Using flags can help with logical deduction and reduce mistakes.');
      } else if (flagMoves > revealMoves) {
        commentary.push('💡 Good use of flags! This conservative approach helps avoid mistakes.');
      }
    }
    
    return commentary;
  }

  private generateStrategicContext(move: Move, index: number, allMoves: Move[]): string {
    // Opening move context
    if (index === 0) {
      return "[Opening move]";
    }
    
    // Pattern recognition context
    if (index > 0) {
      const prevMove = allMoves[index - 1];
      
      // Check for flag-then-reveal pattern
      if (prevMove.action === 'flag' && move.action === 'reveal') {
        return "[Following flag with reveal - good pattern]";
      }
      
      // Check for consecutive reveals
      if (prevMove.action === 'reveal' && move.action === 'reveal') {
        const distance = Math.abs(move.cell.x - prevMove.cell.x) + Math.abs(move.cell.y - prevMove.cell.y);
        if (distance === 1) {
          return "[Adjacent reveal - systematic approach]";
        }
      }
      
      // Check for flag clustering
      if (move.action === 'flag') {
        const nearbyFlags = allMoves.slice(0, index).filter(m => {
          if (m.action !== 'flag') return false;
          const distance = Math.abs(move.cell.x - m.cell.x) + Math.abs(move.cell.y - m.cell.y);
          return distance <= 2;
        });
        
        if (nearbyFlags.length > 0) {
          return "[Flagging near other flags - pattern recognition]";
        }
      }
    }
    
    return "";
  }

  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private analyzeMovesForOptimality(moves: Move[]): Move[] {
    // For now, we'll use a simplified analysis
    // In a full implementation, we would reconstruct the board state at each move
    // and use the HintEngine to determine the optimal move
    
    return moves.map(move => {
      // If wasOptimal is already set (e.g., from previous analysis), preserve it
      // Otherwise, use simplified optimality check
      let wasOptimal = move.wasOptimal;
      
      if (wasOptimal === undefined) {
        // Simplified optimality check - this would be more sophisticated in practice
        // For now, we'll assume moves are optimal if they have alternative options
        // (indicating the AI analyzed them) or if they're early game moves
        wasOptimal = move.alternativeOptions.length > 0 || 
                     this.isLikelyOptimalMove(move);
      }
      
      return {
        ...move,
        wasOptimal
      };
    });
  }

  private isLikelyOptimalMove(move: Move): boolean {
    // Heuristic for determining if a move is likely optimal
    // This is a simplified version - real implementation would use board reconstruction
    
    // Flag actions are generally safer and more likely to be optimal
    if (move.action === 'flag') {
      return true;
    }
    
    // Early moves (first few) are often optimal as they're usually safe
    // This is a simplification - we'd need move context for better analysis
    return false;
  }

  private identifyCriticalMistakes(moves: Move[], finalBoard: IGameBoard): Move[] {
    // Identify moves that led to immediate game loss or significant setbacks
    const criticalMistakes: Move[] = [];
    
    // Check if the game was lost (mine revealed)
    const gameState = finalBoard.getGameState();
    if (gameState === 'lost') {
      // The last move that revealed a mine is a critical mistake
      const lastMove = moves[moves.length - 1];
      if (lastMove && lastMove.action === 'reveal') {
        criticalMistakes.push(lastMove);
      }
    }
    
    // Identify other critical mistakes based on move analysis
    moves.forEach(move => {
      if (!move.wasOptimal && move.alternativeOptions.length > 0) {
        const bestAlternative = move.alternativeOptions[0];
        // If there was a much safer alternative, it's a critical mistake
        if (bestAlternative.confidence > 0.9 && move.action === 'reveal') {
          criticalMistakes.push(move);
        }
      }
    });
    
    return criticalMistakes;
  }

  private identifyMissedOpportunities(moves: Move[]): Move[] {
    const missedOpportunities: Move[] = [];
    
    moves.forEach(move => {
      // If there were multiple good alternatives and the player chose a suboptimal one
      if (move.alternativeOptions.length > 1 && !move.wasOptimal) {
        const betterOptions = move.alternativeOptions.filter(alt => alt.confidence > 0.8);
        if (betterOptions.length > 0) {
          missedOpportunities.push(move);
        }
      }
    });
    
    return missedOpportunities;
  }

  private generateStrategicInsights(moves: Move[], finalBoard: IGameBoard): string[] {
    const insights: string[] = [];
    
    // Analyze move patterns
    const revealMoves = moves.filter(m => m.action === 'reveal').length;
    const flagMoves = moves.filter(m => m.action === 'flag').length;
    
    if (flagMoves === 0) {
      insights.push("Consider using flags to mark suspected mines - they help with logical deduction.");
    } else if (flagMoves > revealMoves) {
      insights.push("You're using flags effectively, but don't be afraid to make reveal moves when you're confident.");
    }
    
    // Analyze timing patterns
    if (moves.length > 0) {
      const gameState = finalBoard.getGameState();
      if (gameState === 'won') {
        insights.push("Congratulations on winning! Your systematic approach paid off.");
      } else if (gameState === 'lost') {
        insights.push("Don't be discouraged by the loss - each game is a learning opportunity.");
      }
    }
    
    // Analyze move efficiency
    const efficiency = moves.length > 0 ? moves.filter(m => m.wasOptimal).length / moves.length : 0;
    if (efficiency > 0.8) {
      insights.push("Excellent move efficiency! You're making consistently good decisions.");
    } else if (efficiency < 0.5) {
      insights.push("Focus on taking more time to analyze each move before committing.");
    }
    
    return insights;
  }

  private identifyDemonstratedSkills(moves: Move[], finalBoard: IGameBoard): SkillArea[] {
    const skills: SkillArea[] = [];
    
    // Pattern recognition: effective use of flags and logical deduction
    const flagMoves = moves.filter(m => m.action === 'flag');
    const optimalFlags = flagMoves.filter(m => m.wasOptimal);
    if (optimalFlags.length > 0 && optimalFlags.length / flagMoves.length > 0.7) {
      skills.push(SkillArea.PATTERN_RECOGNITION);
    }
    
    // Probability analysis: making good choices in uncertain situations
    const uncertainMoves = moves.filter(m => 
      m.alternativeOptions.length > 0 && 
      m.alternativeOptions[0].confidence < 0.9
    );
    const goodUncertainMoves = uncertainMoves.filter(m => m.wasOptimal);
    if (goodUncertainMoves.length > uncertainMoves.length * 0.6) {
      skills.push(SkillArea.PROBABILITY_ANALYSIS);
    }
    
    // Strategic planning: efficient move sequences
    const efficiency = moves.length > 0 ? moves.filter(m => m.wasOptimal).length / moves.length : 0;
    if (efficiency > 0.75) {
      skills.push(SkillArea.STRATEGIC_PLANNING);
    }
    
    // Risk assessment: avoiding critical mistakes
    const criticalMistakes = this.identifyCriticalMistakes(moves, finalBoard);
    if (criticalMistakes.length === 0 && moves.length > 5) {
      skills.push(SkillArea.RISK_ASSESSMENT);
    }
    
    return skills;
  }

  private countHintsUsed(moves: Move[]): number {
    // This would typically be tracked separately in the game logic
    // For now, we'll estimate based on moves with alternative options
    return moves.filter(move => move.alternativeOptions.length > 0).length;
  }

  private calculateRecentAverage(values: number[], recentCount: number): number {
    const recentValues = values.slice(-recentCount);
    return recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  }

  private analyzeSkillProgression(analyses: GameAnalysis[]): string[] {
    const progression: string[] = [];
    
    if (analyses.length < 5) {
      return progression;
    }
    
    // Track skill demonstration over time
    const skillCounts = new Map<SkillArea, number[]>();
    
    analyses.forEach(analysis => {
      Object.values(SkillArea).forEach(skill => {
        if (!skillCounts.has(skill)) {
          skillCounts.set(skill, []);
        }
        skillCounts.get(skill)!.push(analysis.skillDemonstrated.includes(skill) ? 1 : 0);
      });
    });
    
    // Analyze trends for each skill
    skillCounts.forEach((counts, skill) => {
      const recentAvg = this.calculateRecentAverage(counts, 3);
      const overallAvg = counts.reduce((sum, val) => sum + val, 0) / counts.length;
      
      if (recentAvg > overallAvg + 0.3) {
        progression.push(`Your ${skill.replace('_', ' ')} skills are showing significant improvement.`);
      }
    });
    
    return progression;
  }

  private identifyMistakePatterns(analyses: GameAnalysis[]): string[] {
    const patterns: string[] = [];
    
    if (analyses.length < 5) {
      return patterns;
    }
    
    // Analyze critical mistake frequency patterns
    const mistakeCounts = analyses.map(a => a.criticalMistakes.length);
    const recentMistakes = mistakeCounts.slice(-3);
    const earlierMistakes = mistakeCounts.slice(0, -3);
    
    // Check for increasing mistake pattern
    const recentAvg = recentMistakes.reduce((sum, count) => sum + count, 0) / recentMistakes.length;
    const earlierAvg = earlierMistakes.reduce((sum, count) => sum + count, 0) / earlierMistakes.length;
    
    if (recentAvg > earlierAvg + 0.5) {
      patterns.push("You've been making more critical mistakes recently. Consider taking breaks between games to maintain focus.");
    }
    
    // Analyze missed opportunity patterns
    const missedOpportunityCounts = analyses.map(a => a.missedOpportunities.length);
    const avgMissedOpportunities = missedOpportunityCounts.reduce((sum, count) => sum + count, 0) / missedOpportunityCounts.length;
    
    if (avgMissedOpportunities > 2) {
      patterns.push("You frequently miss opportunities for efficient moves. Practice looking for cells that can be safely revealed together.");
    }
    
    // Analyze hint dependency patterns
    const hintUsages = analyses.map(a => a.hintsUsed);
    const hintVariability = this.calculateVariability(hintUsages);
    
    if (hintVariability > 2) {
      patterns.push("Your hint usage varies significantly between games. Try to develop more consistent problem-solving approaches.");
    }
    
    // Check for skill demonstration consistency
    const skillConsistency = this.analyzeSkillConsistency(analyses);
    if (skillConsistency.length > 0) {
      patterns.push(...skillConsistency);
    }
    
    return patterns;
  }

  private analyzePerformanceConsistency(analyses: GameAnalysis[]): string[] {
    const consistency: string[] = [];
    
    if (analyses.length < 5) {
      return consistency;
    }
    
    // Analyze efficiency consistency
    const efficiencies = analyses.map(a => a.totalMoves > 0 ? a.optimalMoves / a.totalMoves : 0);
    const efficiencyVariability = this.calculateVariability(efficiencies);
    
    if (efficiencyVariability < 0.1) {
      consistency.push("Your performance is very consistent - you've developed reliable strategies.");
    } else if (efficiencyVariability > 0.3) {
      consistency.push("Your performance varies significantly between games. Focus on developing more consistent approaches.");
    }
    
    // Analyze move count consistency (for similar difficulty levels)
    const moveCounts = analyses.map(a => a.totalMoves);
    const moveVariability = this.calculateVariability(moveCounts);
    const avgMoves = moveCounts.reduce((sum, count) => sum + count, 0) / moveCounts.length;
    
    if (moveVariability / avgMoves > 0.5) {
      consistency.push("Your game length varies considerably. This might indicate inconsistent strategic approaches.");
    }
    
    return consistency;
  }

  private analyzeSkillConsistency(analyses: GameAnalysis[]): string[] {
    const skillConsistency: string[] = [];
    
    // Track how often each skill is demonstrated
    const skillFrequency = new Map<SkillArea, number>();
    
    analyses.forEach(analysis => {
      Object.values(SkillArea).forEach(skill => {
        const current = skillFrequency.get(skill) || 0;
        skillFrequency.set(skill, current + (analysis.skillDemonstrated.includes(skill) ? 1 : 0));
      });
    });
    
    // Identify skills that are inconsistently demonstrated
    skillFrequency.forEach((count, skill) => {
      const frequency = count / analyses.length;
      
      if (frequency > 0.2 && frequency < 0.8) {
        const skillName = skill.replace('_', ' ').toLowerCase();
        skillConsistency.push(`Your ${skillName} skills are inconsistent. Focus on applying these skills more regularly.`);
      }
    });
    
    return skillConsistency;
  }

  private calculateVariability(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }
}