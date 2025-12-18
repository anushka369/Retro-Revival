import { IAnalysisViewer } from '@/interfaces/UIComponents';
import { GameAnalysis, Move, HintSuggestion, ProbabilityMap, SkillArea } from '@/types';
import { IGameBoard } from '@/interfaces/GameEngine';

export interface AnalysisViewerConfig {
  containerId: string;
  onReplayMove?: (moveIndex: number) => void;
  onShowProbabilities?: (probabilities: ProbabilityMap) => void;
  onHighlightCell?: (x: number, y: number) => void;
}

export class AnalysisViewer implements IAnalysisViewer {
  private container: HTMLElement;
  private config: AnalysisViewerConfig;
  private currentAnalysis: GameAnalysis | null = null;
  private currentMoves: Move[] = [];
  private currentReplayIndex: number = 0;
  private isReplayActive: boolean = false;
  private replayTimer: number | null = null;

  constructor(config: AnalysisViewerConfig) {
    this.config = config;
    
    const container = document.getElementById(config.containerId);
    if (!container) {
      throw new Error(`Container element with id '${config.containerId}' not found`);
    }
    this.container = container;
    
    this.createAnalysisViewer();
  }

  /**
   * Display game analysis
   */
  displayAnalysis(analysis: GameAnalysis): void {
    this.currentAnalysis = analysis;
    this.updateAnalysisDisplay();
    this.showSection('overview');
  }

  /**
   * Show game replay with moves
   */
  showReplay(moves: Move[]): void {
    this.currentMoves = moves;
    this.currentReplayIndex = 0;
    this.updateReplayDisplay();
    this.showSection('replay');
  }

  /**
   * Render probability visualization controls
   */
  renderProbabilityVisualization(probabilities: ProbabilityMap): void {
    const probabilitySection = this.container.querySelector('.probability-visualization') as HTMLElement;
    if (!probabilitySection) return;
    
    // Update probability controls
    const probabilityInfo = probabilitySection.querySelector('.probability-info') as HTMLElement;
    if (probabilityInfo) {
      const method = probabilities.calculationMethod === 'exact' ? 'Exact Calculation' : 'Monte Carlo Simulation';
      const lastUpdated = probabilities.lastUpdated.toLocaleTimeString();
      const cellCount = probabilities.cellProbabilities.size;
      
      probabilityInfo.innerHTML = `
        <div class="probability-stats">
          <div class="stat-item">
            <span class="stat-label">Method:</span>
            <span class="stat-value">${method}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Cells Analyzed:</span>
            <span class="stat-value">${cellCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Last Updated:</span>
            <span class="stat-value">${lastUpdated}</span>
          </div>
        </div>
      `;
    }
    
    // Update probability distribution
    this.updateProbabilityDistribution(probabilities);
  }

  /**
   * Show move alternatives
   */
  showMoveAlternatives(move: Move, alternatives: HintSuggestion[]): void {
    const alternativesSection = this.container.querySelector('.move-alternatives') as HTMLElement;
    if (!alternativesSection) return;
    
    alternativesSection.innerHTML = `
      <h4>Move Analysis</h4>
      <div class="current-move">
        <h5>Selected Move:</h5>
        <div class="move-details">
          <span class="move-action ${move.action}">${move.action.toUpperCase()}</span>
          <span class="move-position">(${move.cell.x}, ${move.cell.y})</span>
          <span class="move-optimality ${move.wasOptimal ? 'optimal' : 'suboptimal'}">
            ${move.wasOptimal ? '✓ Optimal' : '⚠ Suboptimal'}
          </span>
        </div>
      </div>
      
      ${alternatives.length > 0 ? `
        <div class="alternative-moves">
          <h5>Alternative Options:</h5>
          <div class="alternatives-list">
            ${alternatives.map((alt, index) => `
              <div class="alternative-item" data-index="${index}">
                <div class="alternative-header">
                  <span class="alt-action ${alt.action}">${alt.action.toUpperCase()}</span>
                  <span class="alt-position">(${alt.cell.x}, ${alt.cell.y})</span>
                  <span class="alt-confidence">${(alt.confidence * 100).toFixed(1)}% confidence</span>
                </div>
                <div class="alt-reasoning">${alt.reasoning}</div>
                <div class="alt-info">Expected information gain: ${alt.expectedInformation.toFixed(2)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '<p class="no-alternatives">No alternative moves were available.</p>'}
    `;
    
    // Add click handlers for alternatives
    const alternativeItems = alternativesSection.querySelectorAll('.alternative-item');
    alternativeItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        const alternative = alternatives[index];
        this.config.onHighlightCell?.(alternative.cell.x, alternative.cell.y);
      });
    });
  }

  /**
   * Toggle analysis section visibility
   */
  toggleAnalysisSection(section: string): void {
    this.showSection(section);
  }

  /**
   * Create the analysis viewer UI
   */
  private createAnalysisViewer(): void {
    this.container.innerHTML = `
      <div class="analysis-viewer">
        <!-- Navigation Tabs -->
        <div class="analysis-nav">
          <button class="nav-tab active" data-section="overview">
            <span class="tab-icon">📊</span>
            Overview
          </button>
          <button class="nav-tab" data-section="moves">
            <span class="tab-icon">🎯</span>
            Move Analysis
          </button>
          <button class="nav-tab" data-section="replay">
            <span class="tab-icon">▶️</span>
            Replay
          </button>
          <button class="nav-tab" data-section="probabilities">
            <span class="tab-icon">🎲</span>
            Probabilities
          </button>
          <button class="nav-tab" data-section="insights">
            <span class="tab-icon">💡</span>
            Insights
          </button>
        </div>

        <!-- Analysis Content -->
        <div class="analysis-content">
          <!-- Overview Section -->
          <div class="analysis-section overview-section active" data-section="overview">
            <h3>Game Analysis Overview</h3>
            <div class="overview-stats">
              <div class="stat-card">
                <div class="stat-header">Performance</div>
                <div class="stat-grid">
                  <div class="stat-item">
                    <span class="stat-label">Total Moves:</span>
                    <span class="stat-value" id="totalMoves">--</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Optimal Moves:</span>
                    <span class="stat-value" id="optimalMoves">--</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Efficiency:</span>
                    <span class="stat-value" id="efficiency">--</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Hints Used:</span>
                    <span class="stat-value" id="hintsUsed">--</span>
                  </div>
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">Skills Demonstrated</div>
                <div class="skills-list" id="skillsList">
                  <!-- Skills will be populated here -->
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">Key Issues</div>
                <div class="issues-summary">
                  <div class="issue-item">
                    <span class="issue-label">Critical Mistakes:</span>
                    <span class="issue-count" id="criticalMistakes">--</span>
                  </div>
                  <div class="issue-item">
                    <span class="issue-label">Missed Opportunities:</span>
                    <span class="issue-count" id="missedOpportunities">--</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Move Analysis Section -->
          <div class="analysis-section moves-section" data-section="moves">
            <h3>Move-by-Move Analysis</h3>
            <div class="moves-container">
              <div class="moves-list" id="movesList">
                <!-- Moves will be populated here -->
              </div>
              <div class="move-alternatives">
                <!-- Move alternatives will be shown here -->
              </div>
            </div>
          </div>

          <!-- Replay Section -->
          <div class="analysis-section replay-section" data-section="replay">
            <h3>Game Replay</h3>
            <div class="replay-controls">
              <button id="replayStartBtn" class="replay-btn">
                <span class="btn-icon">⏮️</span>
                Start
              </button>
              <button id="replayPrevBtn" class="replay-btn">
                <span class="btn-icon">⏪</span>
                Previous
              </button>
              <button id="replayPlayBtn" class="replay-btn primary">
                <span class="btn-icon">▶️</span>
                Play
              </button>
              <button id="replayNextBtn" class="replay-btn">
                <span class="btn-icon">⏩</span>
                Next
              </button>
              <button id="replayEndBtn" class="replay-btn">
                <span class="btn-icon">⏭️</span>
                End
              </button>
            </div>
            
            <div class="replay-progress">
              <div class="progress-info">
                <span>Move <span id="currentMoveIndex">0</span> of <span id="totalMovesCount">0</span></span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
              <input type="range" id="replaySlider" class="replay-slider" min="0" max="100" value="0">
            </div>
            
            <div class="replay-commentary" id="replayCommentary">
              <h4>Move Commentary</h4>
              <div class="commentary-content">
                Select a move to see AI commentary and analysis.
              </div>
            </div>
          </div>

          <!-- Probability Visualization Section -->
          <div class="analysis-section probabilities-section" data-section="probabilities">
            <h3>Probability Analysis</h3>
            <div class="probability-visualization">
              <div class="probability-controls">
                <button id="showProbabilitiesBtn" class="control-btn">Show Current Probabilities</button>
                <button id="hideProbabilitiesBtn" class="control-btn secondary">Hide Probabilities</button>
              </div>
              
              <div class="probability-info">
                <!-- Probability information will be populated here -->
              </div>
              
              <div class="probability-distribution">
                <h4>Risk Distribution</h4>
                <div class="distribution-chart" id="distributionChart">
                  <!-- Distribution chart will be rendered here -->
                </div>
              </div>
            </div>
          </div>

          <!-- Strategic Insights Section -->
          <div class="analysis-section insights-section" data-section="insights">
            <h3>Strategic Insights & Recommendations</h3>
            <div class="insights-container">
              <div class="strategic-insights">
                <h4>Key Insights</h4>
                <div class="insights-list" id="strategicInsightsList">
                  <!-- Strategic insights will be populated here -->
                </div>
              </div>
              
              <div class="improvement-suggestions">
                <h4>Areas for Improvement</h4>
                <div class="suggestions-list" id="improvementSuggestionsList">
                  <!-- Improvement suggestions will be populated here -->
                </div>
              </div>
              
              <div class="pattern-analysis">
                <h4>Pattern Recognition</h4>
                <div class="patterns-content" id="patternsContent">
                  <!-- Pattern analysis will be populated here -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
    this.attachEventListeners();
  }

  /**
   * Add CSS styles for the analysis viewer
   */
  private addStyles(): void {
    const styleId = 'analysis-viewer-styles';
    
    // Check if styles already exist
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .analysis-viewer {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 12px;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        max-width: 800px;
        margin: 10px 0;
      }
      
      .analysis-nav {
        display: flex;
        background: #e9ecef;
        border-bottom: 1px solid #dee2e6;
        overflow-x: auto;
      }
      
      .nav-tab {
        padding: 12px 16px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #6c757d;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        transition: all 0.2s ease;
        border-bottom: 3px solid transparent;
      }
      
      .nav-tab:hover {
        background-color: #f8f9fa;
        color: #495057;
      }
      
      .nav-tab.active {
        background-color: #fff;
        color: #007bff;
        border-bottom-color: #007bff;
      }
      
      .tab-icon {
        font-size: 16px;
      }
      
      .analysis-content {
        padding: 20px;
        max-height: 600px;
        overflow-y: auto;
      }
      
      .analysis-section {
        display: none;
      }
      
      .analysis-section.active {
        display: block;
      }
      
      .analysis-section h3 {
        margin: 0 0 20px 0;
        font-size: 20px;
        font-weight: 600;
        color: #495057;
      }
      
      .overview-stats {
        display: grid;
        gap: 16px;
      }
      
      .stat-card {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 16px;
      }
      
      .stat-header {
        font-size: 16px;
        font-weight: 600;
        color: #495057;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e9ecef;
      }
      
      .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      
      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
      }
      
      .stat-label {
        font-size: 14px;
        color: #6c757d;
      }
      
      .stat-value {
        font-size: 16px;
        font-weight: 600;
        color: #495057;
      }
      
      .skills-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .skill-badge {
        background: #007bff;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }
      
      .skill-badge.pattern-recognition { background: #28a745; }
      .skill-badge.probability-analysis { background: #17a2b8; }
      .skill-badge.strategic-planning { background: #ffc107; color: #212529; }
      .skill-badge.risk-assessment { background: #dc3545; }
      
      .issues-summary {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .issue-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
      }
      
      .issue-label {
        font-size: 14px;
        color: #6c757d;
      }
      
      .issue-count {
        font-size: 16px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        background: #f8d7da;
        color: #721c24;
      }
      
      .moves-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      
      .moves-list {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .move-item {
        padding: 12px 16px;
        border-bottom: 1px solid #e9ecef;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .move-item:hover {
        background-color: #f8f9fa;
      }
      
      .move-item.selected {
        background-color: #e3f2fd;
        border-left: 4px solid #007bff;
      }
      
      .move-item:last-child {
        border-bottom: none;
      }
      
      .move-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      
      .move-number {
        font-size: 12px;
        font-weight: 600;
        color: #6c757d;
        min-width: 30px;
      }
      
      .move-action {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      
      .move-action.reveal {
        background: #d4edda;
        color: #155724;
      }
      
      .move-action.flag {
        background: #fff3cd;
        color: #856404;
      }
      
      .move-position {
        font-size: 12px;
        color: #495057;
        font-family: monospace;
      }
      
      .move-optimality {
        font-size: 11px;
        font-weight: 600;
        margin-left: auto;
      }
      
      .move-optimality.optimal {
        color: #28a745;
      }
      
      .move-optimality.suboptimal {
        color: #dc3545;
      }
      
      .move-alternatives {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 16px;
      }
      
      .current-move {
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e9ecef;
      }
      
      .current-move h5 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #495057;
      }
      
      .move-details {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .alternative-moves h5 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #495057;
      }
      
      .alternatives-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .alternative-item {
        padding: 8px 12px;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .alternative-item:hover {
        border-color: #007bff;
        background-color: #f8f9ff;
      }
      
      .alternative-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      
      .alt-confidence {
        margin-left: auto;
        font-size: 12px;
        font-weight: 600;
        color: #007bff;
      }
      
      .alt-reasoning {
        font-size: 12px;
        color: #6c757d;
        margin-bottom: 2px;
      }
      
      .alt-info {
        font-size: 11px;
        color: #6c757d;
        font-style: italic;
      }
      
      .no-alternatives {
        color: #6c757d;
        font-style: italic;
        text-align: center;
        padding: 20px;
      }
      
      .replay-controls {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 20px;
      }
      
      .replay-btn {
        padding: 8px 12px;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
      }
      
      .replay-btn:hover {
        background-color: #f8f9fa;
        border-color: #007bff;
      }
      
      .replay-btn.primary {
        background-color: #007bff;
        color: white;
        border-color: #007bff;
      }
      
      .replay-btn.primary:hover {
        background-color: #0056b3;
      }
      
      .replay-btn:disabled {
        background-color: #e9ecef;
        color: #6c757d;
        cursor: not-allowed;
        border-color: #e9ecef;
      }
      
      .btn-icon {
        font-size: 14px;
      }
      
      .replay-progress {
        margin-bottom: 20px;
      }
      
      .progress-info {
        text-align: center;
        margin-bottom: 8px;
        font-size: 14px;
        color: #495057;
      }
      
      .progress-bar {
        width: 100%;
        height: 6px;
        background-color: #e9ecef;
        border-radius: 3px;
        margin-bottom: 8px;
        overflow: hidden;
      }
      
      .progress-fill {
        height: 100%;
        background-color: #007bff;
        transition: width 0.3s ease;
        width: 0%;
      }
      
      .replay-slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #e9ecef;
        outline: none;
        -webkit-appearance: none;
      }
      
      .replay-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #007bff;
        cursor: pointer;
      }
      
      .replay-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #007bff;
        cursor: pointer;
        border: none;
      }
      
      .replay-commentary {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 16px;
      }
      
      .replay-commentary h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: #495057;
      }
      
      .commentary-content {
        font-size: 14px;
        line-height: 1.5;
        color: #495057;
      }
      
      .probability-controls {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .control-btn {
        padding: 8px 16px;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
      }
      
      .control-btn:hover {
        background-color: #f8f9fa;
        border-color: #007bff;
      }
      
      .control-btn.secondary {
        background-color: #6c757d;
        color: white;
        border-color: #6c757d;
      }
      
      .control-btn.secondary:hover {
        background-color: #545b62;
      }
      
      .probability-info {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }
      
      .probability-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }
      
      .distribution-chart {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 16px;
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6c757d;
        font-style: italic;
      }
      
      .insights-container {
        display: grid;
        gap: 20px;
      }
      
      .strategic-insights,
      .improvement-suggestions,
      .pattern-analysis {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 16px;
      }
      
      .strategic-insights h4,
      .improvement-suggestions h4,
      .pattern-analysis h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: #495057;
      }
      
      .insights-list,
      .suggestions-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .insight-item,
      .suggestion-item {
        padding: 8px 12px;
        background: #f8f9fa;
        border-left: 4px solid #007bff;
        border-radius: 4px;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .suggestion-item {
        border-left-color: #28a745;
      }
      
      .patterns-content {
        font-size: 14px;
        line-height: 1.5;
        color: #495057;
      }
      
      /* Mobile responsive */
      @media (max-width: 768px) {
        .analysis-viewer {
          margin: 5px 0;
        }
        
        .analysis-content {
          padding: 16px;
        }
        
        .moves-container {
          grid-template-columns: 1fr;
        }
        
        .stat-grid {
          grid-template-columns: 1fr;
        }
        
        .replay-controls {
          flex-wrap: wrap;
        }
        
        .probability-controls {
          flex-direction: column;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Navigation tabs
    const navTabs = this.container.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const section = target.getAttribute('data-section') || target.closest('.nav-tab')?.getAttribute('data-section');
        if (section) {
          this.showSection(section);
        }
      });
    });

    // Replay controls
    const replayStartBtn = this.container.querySelector('#replayStartBtn') as HTMLButtonElement;
    const replayPrevBtn = this.container.querySelector('#replayPrevBtn') as HTMLButtonElement;
    const replayPlayBtn = this.container.querySelector('#replayPlayBtn') as HTMLButtonElement;
    const replayNextBtn = this.container.querySelector('#replayNextBtn') as HTMLButtonElement;
    const replayEndBtn = this.container.querySelector('#replayEndBtn') as HTMLButtonElement;
    const replaySlider = this.container.querySelector('#replaySlider') as HTMLInputElement;

    replayStartBtn?.addEventListener('click', () => this.replayStart());
    replayPrevBtn?.addEventListener('click', () => this.replayPrevious());
    replayPlayBtn?.addEventListener('click', () => this.toggleReplayPlayback());
    replayNextBtn?.addEventListener('click', () => this.replayNext());
    replayEndBtn?.addEventListener('click', () => this.replayEnd());

    replaySlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const moveIndex = Math.floor((parseInt(target.value) / 100) * this.currentMoves.length);
      this.setReplayPosition(moveIndex);
    });

    // Probability controls
    const showProbabilitiesBtn = this.container.querySelector('#showProbabilitiesBtn') as HTMLButtonElement;
    const hideProbabilitiesBtn = this.container.querySelector('#hideProbabilitiesBtn') as HTMLButtonElement;

    showProbabilitiesBtn?.addEventListener('click', () => {
      // This would trigger showing probabilities on the main board
      this.config.onShowProbabilities?.(this.getCurrentProbabilities());
    });

    hideProbabilitiesBtn?.addEventListener('click', () => {
      // This would trigger hiding probabilities on the main board
      this.config.onShowProbabilities?.(null as any);
    });
  }

  /**
   * Show specific analysis section
   */
  private showSection(sectionName: string): void {
    // Update nav tabs
    const navTabs = this.container.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.getAttribute('data-section') === sectionName) {
        tab.classList.add('active');
      }
    });

    // Update content sections
    const sections = this.container.querySelectorAll('.analysis-section');
    sections.forEach(section => {
      section.classList.remove('active');
      if (section.getAttribute('data-section') === sectionName) {
        section.classList.add('active');
      }
    });
  }

  /**
   * Update analysis display
   */
  private updateAnalysisDisplay(): void {
    if (!this.currentAnalysis) return;

    const analysis = this.currentAnalysis;

    // Update overview stats
    const totalMovesEl = this.container.querySelector('#totalMoves') as HTMLElement;
    const optimalMovesEl = this.container.querySelector('#optimalMoves') as HTMLElement;
    const efficiencyEl = this.container.querySelector('#efficiency') as HTMLElement;
    const hintsUsedEl = this.container.querySelector('#hintsUsed') as HTMLElement;

    if (totalMovesEl) totalMovesEl.textContent = analysis.totalMoves.toString();
    if (optimalMovesEl) optimalMovesEl.textContent = analysis.optimalMoves.toString();
    if (efficiencyEl) {
      const efficiency = analysis.totalMoves > 0 ? (analysis.optimalMoves / analysis.totalMoves * 100).toFixed(1) : '0';
      efficiencyEl.textContent = `${efficiency}%`;
    }
    if (hintsUsedEl) hintsUsedEl.textContent = analysis.hintsUsed.toString();

    // Update skills list
    const skillsListEl = this.container.querySelector('#skillsList') as HTMLElement;
    if (skillsListEl) {
      skillsListEl.innerHTML = analysis.skillDemonstrated.length > 0 
        ? analysis.skillDemonstrated.map(skill => 
            `<span class="skill-badge ${skill.replace('_', '-')}">${skill.replace('_', ' ')}</span>`
          ).join('')
        : '<span class="skill-badge">No specific skills identified</span>';
    }

    // Update issues summary
    const criticalMistakesEl = this.container.querySelector('#criticalMistakes') as HTMLElement;
    const missedOpportunitiesEl = this.container.querySelector('#missedOpportunities') as HTMLElement;

    if (criticalMistakesEl) criticalMistakesEl.textContent = analysis.criticalMistakes.length.toString();
    if (missedOpportunitiesEl) missedOpportunitiesEl.textContent = analysis.missedOpportunities.length.toString();

    // Update strategic insights
    const strategicInsightsListEl = this.container.querySelector('#strategicInsightsList') as HTMLElement;
    if (strategicInsightsListEl) {
      strategicInsightsListEl.innerHTML = analysis.strategicInsights.length > 0
        ? analysis.strategicInsights.map(insight => 
            `<div class="insight-item">${insight}</div>`
          ).join('')
        : '<div class="insight-item">No specific strategic insights available.</div>';
    }
  }

  /**
   * Update replay display
   */
  private updateReplayDisplay(): void {
    if (this.currentMoves.length === 0) return;

    // Update moves list
    const movesListEl = this.container.querySelector('#movesList') as HTMLElement;
    if (movesListEl) {
      movesListEl.innerHTML = this.currentMoves.map((move, index) => `
        <div class="move-item ${index === this.currentReplayIndex ? 'selected' : ''}" data-index="${index}">
          <div class="move-header">
            <span class="move-number">${index + 1}</span>
            <span class="move-action ${move.action}">${move.action}</span>
            <span class="move-position">(${move.cell.x}, ${move.cell.y})</span>
            <span class="move-optimality ${move.wasOptimal ? 'optimal' : 'suboptimal'}">
              ${move.wasOptimal ? '✓' : '⚠'}
            </span>
          </div>
        </div>
      `).join('');

      // Add click handlers for moves
      const moveItems = movesListEl.querySelectorAll('.move-item');
      moveItems.forEach((item, index) => {
        item.addEventListener('click', () => {
          this.setReplayPosition(index);
        });
      });
    }

    // Update progress
    this.updateReplayProgress();

    // Update total moves count
    const totalMovesCountEl = this.container.querySelector('#totalMovesCount') as HTMLElement;
    if (totalMovesCountEl) totalMovesCountEl.textContent = this.currentMoves.length.toString();
  }

  /**
   * Update replay progress indicators
   */
  private updateReplayProgress(): void {
    const currentMoveIndexEl = this.container.querySelector('#currentMoveIndex') as HTMLElement;
    const progressFillEl = this.container.querySelector('#progressFill') as HTMLElement;
    const replaySliderEl = this.container.querySelector('#replaySlider') as HTMLInputElement;

    if (currentMoveIndexEl) {
      currentMoveIndexEl.textContent = (this.currentReplayIndex + 1).toString();
    }

    if (progressFillEl && this.currentMoves.length > 0) {
      const progress = ((this.currentReplayIndex + 1) / this.currentMoves.length) * 100;
      progressFillEl.style.width = `${progress}%`;
    }

    if (replaySliderEl && this.currentMoves.length > 0) {
      const sliderValue = (this.currentReplayIndex / Math.max(1, this.currentMoves.length - 1)) * 100;
      replaySliderEl.value = sliderValue.toString();
    }

    // Update move selection in list
    const moveItems = this.container.querySelectorAll('.move-item');
    moveItems.forEach((item, index) => {
      item.classList.toggle('selected', index === this.currentReplayIndex);
    });

    // Update commentary for current move
    this.updateMoveCommentary();
  }

  /**
   * Update move commentary
   */
  private updateMoveCommentary(): void {
    const commentaryContentEl = this.container.querySelector('.commentary-content') as HTMLElement;
    if (!commentaryContentEl || this.currentMoves.length === 0) return;

    const currentMove = this.currentMoves[this.currentReplayIndex];
    if (!currentMove) {
      commentaryContentEl.textContent = 'Select a move to see AI commentary and analysis.';
      return;
    }

    const moveNumber = this.currentReplayIndex + 1;
    const action = currentMove.action === 'reveal' ? 'revealed' : 'flagged';
    const position = `(${currentMove.cell.x}, ${currentMove.cell.y})`;
    
    let commentary = `<strong>Move ${moveNumber}:</strong> ${action} cell ${position}<br><br>`;
    
    if (currentMove.wasOptimal) {
      commentary += `<span style="color: #28a745;">✓ Optimal move!</span><br>`;
      commentary += `This was an excellent strategic choice. `;
    } else {
      commentary += `<span style="color: #dc3545;">⚠ Suboptimal move</span><br>`;
      commentary += `This move could have been improved. `;
    }

    if (currentMove.alternativeOptions.length > 0) {
      const bestAlt = currentMove.alternativeOptions[0];
      if (!currentMove.wasOptimal) {
        commentary += `A better option would have been to ${bestAlt.action} cell (${bestAlt.cell.x}, ${bestAlt.cell.y}) with ${(bestAlt.confidence * 100).toFixed(1)}% confidence.<br><br>`;
        commentary += `<strong>Reasoning:</strong> ${bestAlt.reasoning}`;
      } else {
        commentary += `Other good alternatives were available, showing multiple valid strategic paths.`;
      }
    }

    commentaryContentEl.innerHTML = commentary;

    // Show move alternatives
    this.showMoveAlternatives(currentMove, currentMove.alternativeOptions);
  }

  /**
   * Replay control methods
   */
  private replayStart(): void {
    this.setReplayPosition(0);
  }

  private replayPrevious(): void {
    if (this.currentReplayIndex > 0) {
      this.setReplayPosition(this.currentReplayIndex - 1);
    }
  }

  private replayNext(): void {
    if (this.currentReplayIndex < this.currentMoves.length - 1) {
      this.setReplayPosition(this.currentReplayIndex + 1);
    }
  }

  private replayEnd(): void {
    this.setReplayPosition(this.currentMoves.length - 1);
  }

  private toggleReplayPlayback(): void {
    const replayPlayBtn = this.container.querySelector('#replayPlayBtn') as HTMLButtonElement;
    
    if (this.isReplayActive) {
      this.stopReplayPlayback();
      replayPlayBtn.innerHTML = '<span class="btn-icon">▶️</span>Play';
    } else {
      this.startReplayPlayback();
      replayPlayBtn.innerHTML = '<span class="btn-icon">⏸️</span>Pause';
    }
  }

  private startReplayPlayback(): void {
    this.isReplayActive = true;
    this.replayTimer = window.setInterval(() => {
      if (this.currentReplayIndex < this.currentMoves.length - 1) {
        this.setReplayPosition(this.currentReplayIndex + 1);
      } else {
        this.stopReplayPlayback();
        const replayPlayBtn = this.container.querySelector('#replayPlayBtn') as HTMLButtonElement;
        replayPlayBtn.innerHTML = '<span class="btn-icon">▶️</span>Play';
      }
    }, 1500); // 1.5 seconds per move
  }

  private stopReplayPlayback(): void {
    this.isReplayActive = false;
    if (this.replayTimer) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
  }

  private setReplayPosition(index: number): void {
    if (index < 0 || index >= this.currentMoves.length) return;
    
    this.currentReplayIndex = index;
    this.updateReplayProgress();
    
    // Notify parent component about replay position change
    this.config.onReplayMove?.(index);
  }

  /**
   * Update probability distribution chart
   */
  private updateProbabilityDistribution(probabilities: ProbabilityMap): void {
    const distributionChartEl = this.container.querySelector('#distributionChart') as HTMLElement;
    if (!distributionChartEl) return;

    // Create a simple distribution visualization
    const ranges = [
      { min: 0, max: 0.1, label: 'Very Safe (0-10%)', color: '#28a745' },
      { min: 0.1, max: 0.25, label: 'Safe (10-25%)', color: '#17a2b8' },
      { min: 0.25, max: 0.5, label: 'Moderate (25-50%)', color: '#ffc107' },
      { min: 0.5, max: 0.75, label: 'Risky (50-75%)', color: '#fd7e14' },
      { min: 0.75, max: 1, label: 'Very Risky (75-100%)', color: '#dc3545' }
    ];

    const counts = ranges.map(range => {
      let count = 0;
      probabilities.cellProbabilities.forEach(prob => {
        if (prob >= range.min && prob < range.max) count++;
      });
      return count;
    });

    const total = counts.reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      distributionChartEl.innerHTML = 'No probability data available';
      return;
    }

    distributionChartEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
        ${ranges.map((range, index) => {
          const percentage = ((counts[index] / total) * 100).toFixed(1);
          const width = (counts[index] / total) * 100;
          return `
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="min-width: 120px; font-size: 12px;">${range.label}</div>
              <div style="flex: 1; background: #e9ecef; border-radius: 4px; height: 20px; position: relative;">
                <div style="background: ${range.color}; height: 100%; width: ${width}%; border-radius: 4px; transition: width 0.3s ease;"></div>
              </div>
              <div style="min-width: 40px; font-size: 12px; text-align: right;">${counts[index]} (${percentage}%)</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Get current probabilities (placeholder)
   */
  private getCurrentProbabilities(): ProbabilityMap {
    // This would typically come from the game state
    return {
      cellProbabilities: new Map(),
      lastUpdated: new Date(),
      calculationMethod: 'exact'
    };
  }

  /**
   * Destroy the analysis viewer and clean up
   */
  destroy(): void {
    this.stopReplayPlayback();
    this.container.innerHTML = '';
  }
}