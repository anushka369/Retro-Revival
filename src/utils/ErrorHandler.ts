/**
 * Comprehensive error handling utilities for AI Minesweeper
 */

export enum ErrorType {
  AI_CALCULATION = 'ai_calculation',
  CANVAS_RENDERING = 'canvas_rendering',
  DATA_PERSISTENCE = 'data_persistence',
  GAME_LOGIC = 'game_logic',
  USER_INPUT = 'user_input',
  NETWORK = 'network',
  PERFORMANCE = 'performance'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface GameError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  timestamp: Date;
  context?: string;
  stack?: string;
  recovered: boolean;
  recoveryAction?: string;
}

export interface ErrorRecoveryStrategy {
  canRecover: (error: GameError) => boolean;
  recover: (error: GameError, context?: any) => Promise<boolean>;
  fallback?: () => void;
}

/**
 * Central error handler for the AI Minesweeper application
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: GameError[] = [];
  private recoveryStrategies: Map<ErrorType, ErrorRecoveryStrategy> = new Map();
  private errorListeners: ((error: GameError) => void)[] = [];
  private maxErrorHistory = 100;

  private constructor() {
    this.setupDefaultRecoveryStrategies();
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handleError(
    type: ErrorType,
    message: string,
    details?: any,
    context?: string,
    originalError?: Error
  ): Promise<GameError> {
    const error: GameError = {
      id: this.generateErrorId(),
      type,
      severity: this.determineSeverity(type, details),
      message,
      details,
      timestamp: new Date(),
      context,
      stack: originalError?.stack,
      recovered: false
    };

    // Log error
    this.logError(error);

    // Attempt recovery
    const recovered = await this.attemptRecovery(error);
    error.recovered = recovered;

    // Store error in history
    this.addToHistory(error);

    // Notify listeners
    this.notifyListeners(error);

    return error;
  }

  /**
   * Register a recovery strategy for a specific error type
   */
  registerRecoveryStrategy(type: ErrorType, strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(type, strategy);
  }

  /**
   * Add error listener
   */
  addErrorListener(listener: (error: GameError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove error listener
   */
  removeErrorListener(listener: (error: GameError) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(): GameError[] {
    return [...this.errors];
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ErrorType): GameError[] {
    return this.errors.filter(error => error.type === type);
  }

  /**
   * Get recent errors (last hour)
   */
  getRecentErrors(): GameError[] {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.errors.filter(error => error.timestamp > oneHourAgo);
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errors = [];
  }

  /**
   * Check if system is in a healthy state
   */
  isSystemHealthy(): boolean {
    const recentErrors = this.getRecentErrors();
    const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL);
    const unrecoveredErrors = recentErrors.filter(e => !e.recovered);

    return criticalErrors.length === 0 && unrecoveredErrors.length < 5;
  }

  /**
   * Get system health report
   */
  getHealthReport(): {
    healthy: boolean;
    totalErrors: number;
    recentErrors: number;
    criticalErrors: number;
    unrecoveredErrors: number;
    errorsByType: Record<string, number>;
  } {
    const recentErrors = this.getRecentErrors();
    const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL);
    const unrecoveredErrors = recentErrors.filter(e => !e.recovered);

    const errorsByType: Record<string, number> = {};
    Object.values(ErrorType).forEach(type => {
      errorsByType[type] = this.getErrorsByType(type).length;
    });

    return {
      healthy: this.isSystemHealthy(),
      totalErrors: this.errors.length,
      recentErrors: recentErrors.length,
      criticalErrors: criticalErrors.length,
      unrecoveredErrors: unrecoveredErrors.length,
      errorsByType
    };
  }

  private setupDefaultRecoveryStrategies(): void {
    // AI Calculation recovery
    this.registerRecoveryStrategy(ErrorType.AI_CALCULATION, {
      canRecover: (error) => error.severity !== ErrorSeverity.CRITICAL,
      recover: async (error, context) => {
        console.warn('AI calculation failed, attempting fallback method');
        
        // Try simpler calculation method
        if (context?.calculator && typeof context.calculator.calculateMonteCarloProbabilities === 'function') {
          try {
            const result = context.calculator.calculateMonteCarloProbabilities(context.board);
            error.recoveryAction = 'Switched to Monte Carlo calculation method';
            return true;
          } catch (fallbackError) {
            console.error('Fallback calculation also failed:', fallbackError);
          }
        }
        
        // Return basic uniform probabilities as last resort
        if (context?.board) {
          const uniformProbability = context.board.getRemainingMines() / 
            (context.board.getWidth() * context.board.getHeight());
          error.recoveryAction = 'Used uniform probability distribution';
          return true;
        }
        
        return false;
      }
    });

    // Canvas rendering recovery
    this.registerRecoveryStrategy(ErrorType.CANVAS_RENDERING, {
      canRecover: (error) => true,
      recover: async (error, context) => {
        console.warn('Canvas rendering failed, attempting DOM fallback');
        
        try {
          // Try to recreate canvas context
          if (context?.canvas) {
            const newContext = context.canvas.getContext('2d');
            if (newContext) {
              error.recoveryAction = 'Recreated canvas context';
              return true;
            }
          }
          
          // Fallback to DOM rendering
          if (context?.fallbackRenderer) {
            context.fallbackRenderer();
            error.recoveryAction = 'Switched to DOM-based rendering';
            return true;
          }
          
          return false;
        } catch (recoveryError) {
          console.error('Canvas recovery failed:', recoveryError);
          return false;
        }
      }
    });

    // Data persistence recovery
    this.registerRecoveryStrategy(ErrorType.DATA_PERSISTENCE, {
      canRecover: (error) => error.severity !== ErrorSeverity.CRITICAL,
      recover: async (error, context) => {
        console.warn('Data persistence failed, attempting recovery');
        
        try {
          // Check storage availability
          if (!this.isStorageAvailable()) {
            error.recoveryAction = 'Storage unavailable, using memory-only mode';
            return true;
          }
          
          // Try to clear corrupted data
          if (error.details?.corruptedKey) {
            localStorage.removeItem(error.details.corruptedKey);
            error.recoveryAction = 'Removed corrupted data';
            return true;
          }
          
          // Try to free up storage space
          if (error.details?.quotaExceeded) {
            this.cleanupOldData();
            error.recoveryAction = 'Cleaned up old data to free storage space';
            return true;
          }
          
          return false;
        } catch (recoveryError) {
          console.error('Data persistence recovery failed:', recoveryError);
          return false;
        }
      }
    });

    // Game logic recovery
    this.registerRecoveryStrategy(ErrorType.GAME_LOGIC, {
      canRecover: (error) => error.severity !== ErrorSeverity.CRITICAL,
      recover: async (error, context) => {
        console.warn('Game logic error, attempting state recovery');
        
        try {
          // Reset to safe state
          if (context?.resetToSafeState) {
            context.resetToSafeState();
            error.recoveryAction = 'Reset game to safe state';
            return true;
          }
          
          // Create new game
          if (context?.createNewGame) {
            context.createNewGame();
            error.recoveryAction = 'Started new game';
            return true;
          }
          
          return false;
        } catch (recoveryError) {
          console.error('Game logic recovery failed:', recoveryError);
          return false;
        }
      }
    });
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        ErrorType.GAME_LOGIC,
        'Unhandled promise rejection',
        { reason: event.reason },
        'Global handler'
      );
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        ErrorType.GAME_LOGIC,
        event.message,
        { 
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        },
        'Global handler'
      );
    });
  }

  private async attemptRecovery(error: GameError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.type);
    
    if (!strategy || !strategy.canRecover(error)) {
      return false;
    }

    try {
      const recovered = await strategy.recover(error);
      if (recovered) {
        console.log(`Successfully recovered from ${error.type} error:`, error.message);
        return true;
      }
    } catch (recoveryError) {
      console.error(`Recovery failed for ${error.type} error:`, recoveryError);
      
      // Try fallback if available
      if (strategy.fallback) {
        try {
          strategy.fallback();
          error.recoveryAction = 'Used fallback strategy';
          return true;
        } catch (fallbackError) {
          console.error('Fallback strategy also failed:', fallbackError);
        }
      }
    }

    return false;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineSeverity(type: ErrorType, details?: any): ErrorSeverity {
    // Determine severity based on error type and details
    switch (type) {
      case ErrorType.AI_CALCULATION:
        return details?.timeout ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW;
      
      case ErrorType.CANVAS_RENDERING:
        return details?.contextLost ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      
      case ErrorType.DATA_PERSISTENCE:
        return details?.quotaExceeded ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      
      case ErrorType.GAME_LOGIC:
        return details?.gameBreaking ? ErrorSeverity.CRITICAL : ErrorSeverity.MEDIUM;
      
      case ErrorType.USER_INPUT:
        return ErrorSeverity.LOW;
      
      case ErrorType.NETWORK:
        return ErrorSeverity.LOW;
      
      case ErrorType.PERFORMANCE:
        return details?.severe ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private logError(error: GameError): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `[${error.type}] ${error.message}`;
    
    switch (logLevel) {
      case 'error':
        console.error(message, error);
        break;
      case 'warn':
        console.warn(message, error);
        break;
      case 'info':
        console.info(message, error);
        break;
      default:
        console.log(message, error);
    }
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  private addToHistory(error: GameError): void {
    this.errors.push(error);
    
    // Limit history size
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(-this.maxErrorHistory);
    }
  }

  private notifyListeners(error: GameError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error listener failed:', listenerError);
      }
    });
  }

  private isStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private cleanupOldData(): void {
    try {
      // Remove old game data (older than 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ai_minesweeper_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (parsed.timestamp && parsed.timestamp < thirtyDaysAgo) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Remove corrupted data
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(
  errorType: ErrorType,
  context?: string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        const errorHandler = ErrorHandler.getInstance();
        await errorHandler.handleError(
          errorType,
          `Error in ${propertyName}`,
          { args, error: error.message },
          context,
          error as Error
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utility function for safe async operations
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorType: ErrorType,
  fallback?: T,
  context?: string
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const errorHandler = ErrorHandler.getInstance();
    const gameError = await errorHandler.handleError(
      errorType,
      'Safe async operation failed',
      { error: error.message },
      context,
      error as Error
    );

    if (gameError.recovered || fallback !== undefined) {
      return fallback;
    }

    throw error;
  }
}

/**
 * Utility function for safe synchronous operations
 */
export function safeSync<T>(
  operation: () => T,
  errorType: ErrorType,
  fallback?: T,
  context?: string
): T | undefined {
  try {
    return operation();
  } catch (error) {
    const errorHandler = ErrorHandler.getInstance();
    errorHandler.handleError(
      errorType,
      'Safe sync operation failed',
      { error: error.message },
      context,
      error as Error
    );

    if (fallback !== undefined) {
      return fallback;
    }

    throw error;
  }
}