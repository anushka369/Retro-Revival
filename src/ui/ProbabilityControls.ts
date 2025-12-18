import { ProbabilityDetailLevel, ProbabilityVisualizerConfig } from './ProbabilityVisualizer';

export interface ProbabilityControlsConfig {
  containerId: string;
  onDetailLevelChange?: (level: ProbabilityDetailLevel) => void;
  onColorSchemeChange?: (scheme: 'default' | 'colorblind') => void;
  onPercentageToggle?: (show: boolean) => void;
}

export class ProbabilityControls {
  private container: HTMLElement;
  private config: ProbabilityControlsConfig;
  private currentDetailLevel: ProbabilityDetailLevel = ProbabilityDetailLevel.MEDIUM;
  private currentColorScheme: 'default' | 'colorblind' = 'default';
  private showPercentages: boolean = true;

  constructor(config: ProbabilityControlsConfig) {
    this.config = config;
    
    const container = document.getElementById(config.containerId);
    if (!container) {
      throw new Error(`Container element with id '${config.containerId}' not found`);
    }
    this.container = container;
    
    this.createControls();
  }

  /**
   * Create the control panel UI
   */
  private createControls(): void {
    this.container.innerHTML = `
      <div class="probability-controls">
        <div class="control-group">
          <label for="detail-level">Probability Detail:</label>
          <select id="detail-level" class="detail-level-select">
            <option value="${ProbabilityDetailLevel.OFF}">Off</option>
            <option value="${ProbabilityDetailLevel.LOW}">Colors Only</option>
            <option value="${ProbabilityDetailLevel.MEDIUM}" selected>Colors + Hover %</option>
            <option value="${ProbabilityDetailLevel.HIGH}">Colors + Always %</option>
          </select>
        </div>
        
        <div class="control-group">
          <label for="color-scheme">Color Scheme:</label>
          <select id="color-scheme" class="color-scheme-select">
            <option value="default" selected>Default</option>
            <option value="colorblind">Colorblind Friendly</option>
          </select>
        </div>
        
        <div class="control-group">
          <label class="checkbox-label">
            <input type="checkbox" id="show-percentages" checked>
            Show Hover Tooltips
          </label>
        </div>
        
        <div class="control-group">
          <button id="toggle-probabilities" class="toggle-btn">
            Toggle Probabilities
          </button>
        </div>
        
        <div class="probability-legend">
          <h4>Risk Levels:</h4>
          <div class="legend-items">
            <div class="legend-item">
              <div class="legend-color safe"></div>
              <span>0-10% (Very Safe)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color low"></div>
              <span>11-25% (Safe)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color medium"></div>
              <span>26-50% (Moderate)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color high"></div>
              <span>51-75% (Risky)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color danger"></div>
              <span>76-100% (Very Risky)</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
    this.attachEventListeners();
  }

  /**
   * Add CSS styles for the controls
   */
  private addStyles(): void {
    const styleId = 'probability-controls-styles';
    
    // Check if styles already exist
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .probability-controls {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 16px;
        margin: 10px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }
      
      .control-group {
        margin-bottom: 12px;
      }
      
      .control-group label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
        color: #495057;
      }
      
      .detail-level-select,
      .color-scheme-select {
        width: 100%;
        padding: 6px 12px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        background-color: #fff;
        font-size: 14px;
      }
      
      .checkbox-label {
        display: flex !important;
        align-items: center;
        cursor: pointer;
        margin-bottom: 0 !important;
      }
      
      .checkbox-label input[type="checkbox"] {
        margin-right: 8px;
      }
      
      .toggle-btn {
        width: 100%;
        padding: 8px 16px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .toggle-btn:hover {
        background-color: #0056b3;
      }
      
      .toggle-btn:active {
        background-color: #004085;
      }
      
      .probability-legend {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #dee2e6;
      }
      
      .probability-legend h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #495057;
      }
      
      .legend-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .legend-item {
        display: flex;
        align-items: center;
        font-size: 12px;
      }
      
      .legend-color {
        width: 16px;
        height: 16px;
        border-radius: 2px;
        margin-right: 8px;
        border: 1px solid #ccc;
      }
      
      .legend-color.safe { background-color: #00ff00; }
      .legend-color.low { background-color: #7fff00; }
      .legend-color.medium { background-color: #ffff00; }
      .legend-color.high { background-color: #ff7f00; }
      .legend-color.danger { background-color: #ff0000; }
      
      /* Colorblind friendly colors */
      .probability-controls.colorblind .legend-color.safe { background-color: #0077bb; }
      .probability-controls.colorblind .legend-color.low { background-color: #33bbee; }
      .probability-controls.colorblind .legend-color.medium { background-color: #009988; }
      .probability-controls.colorblind .legend-color.high { background-color: #ee7733; }
      .probability-controls.colorblind .legend-color.danger { background-color: #cc3311; }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners to controls
   */
  private attachEventListeners(): void {
    const detailSelect = this.container.querySelector('#detail-level') as HTMLSelectElement;
    const colorSchemeSelect = this.container.querySelector('#color-scheme') as HTMLSelectElement;
    const percentageCheckbox = this.container.querySelector('#show-percentages') as HTMLInputElement;
    const toggleButton = this.container.querySelector('#toggle-probabilities') as HTMLButtonElement;

    if (detailSelect) {
      detailSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.currentDetailLevel = target.value as ProbabilityDetailLevel;
        this.config.onDetailLevelChange?.(this.currentDetailLevel);
      });
    }

    if (colorSchemeSelect) {
      colorSchemeSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.currentColorScheme = target.value as 'default' | 'colorblind';
        this.config.onColorSchemeChange?.(this.currentColorScheme);
        this.updateLegendColors();
      });
    }

    if (percentageCheckbox) {
      percentageCheckbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.showPercentages = target.checked;
        this.config.onPercentageToggle?.(this.showPercentages);
      });
    }

    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.toggleProbabilities();
      });
    }
  }

  /**
   * Toggle probability display on/off
   */
  private toggleProbabilities(): void {
    const detailSelect = this.container.querySelector('#detail-level') as HTMLSelectElement;
    
    if (this.currentDetailLevel === ProbabilityDetailLevel.OFF) {
      // Turn on with medium detail
      this.currentDetailLevel = ProbabilityDetailLevel.MEDIUM;
      detailSelect.value = ProbabilityDetailLevel.MEDIUM;
    } else {
      // Turn off
      this.currentDetailLevel = ProbabilityDetailLevel.OFF;
      detailSelect.value = ProbabilityDetailLevel.OFF;
    }
    
    this.config.onDetailLevelChange?.(this.currentDetailLevel);
  }

  /**
   * Update legend colors based on color scheme
   */
  private updateLegendColors(): void {
    const controlsElement = this.container.querySelector('.probability-controls');
    if (controlsElement) {
      if (this.currentColorScheme === 'colorblind') {
        controlsElement.classList.add('colorblind');
      } else {
        controlsElement.classList.remove('colorblind');
      }
    }
  }

  /**
   * Set the current configuration
   */
  setConfig(config: ProbabilityVisualizerConfig): void {
    this.currentDetailLevel = config.detailLevel;
    this.currentColorScheme = config.colorScheme;
    this.showPercentages = config.showPercentages;

    // Update UI elements
    const detailSelect = this.container.querySelector('#detail-level') as HTMLSelectElement;
    const colorSchemeSelect = this.container.querySelector('#color-scheme') as HTMLSelectElement;
    const percentageCheckbox = this.container.querySelector('#show-percentages') as HTMLInputElement;

    if (detailSelect) detailSelect.value = this.currentDetailLevel;
    if (colorSchemeSelect) colorSchemeSelect.value = this.currentColorScheme;
    if (percentageCheckbox) percentageCheckbox.checked = this.showPercentages;

    this.updateLegendColors();
  }

  /**
   * Get current configuration
   */
  getConfig(): ProbabilityVisualizerConfig {
    return {
      detailLevel: this.currentDetailLevel,
      colorScheme: this.currentColorScheme,
      showPercentages: this.showPercentages
    };
  }

  /**
   * Show/hide the controls
   */
  setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Destroy the controls and clean up
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}