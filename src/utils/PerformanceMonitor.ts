/**
 * Performance monitoring and optimization utilities for AI Minesweeper
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: Date;
}

export interface PerformanceReport {
  averageFrameTime: number;
  memoryUsage: MemoryUsage;
  slowOperations: PerformanceMetric[];
  totalMetrics: number;
  healthScore: number; // 0-100
}

/**
 * Performance monitoring system for tracking and optimizing game performance
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private completedMetrics: PerformanceMetric[] = [];
  private frameTimings: number[] = [];
  private memorySnapshots: MemoryUsage[] = [];
  private maxMetricsHistory = 1000;
  private maxFrameTimings = 60; // Last 60 frames
  private maxMemorySnapshots = 100;
  private performanceThresholds = {
    slowOperation: 100, // ms
    criticalOperation: 500, // ms
    memoryWarning: 0.8, // 80% of available memory
    frameTimeWarning: 16.67 // 60fps = 16.67ms per frame
  };

  private constructor() {
    this.setupPerformanceObserver();
    this.startMemoryMonitoring();
    this.startFrameTimeMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start measuring a performance metric
   */
  startMeasure(name: string, metadata?: Record<string, any>): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata
    };
    
    this.metrics.set(id, metric);
    return id;
  }

  /**
   * End measuring a performance metric
   */
  endMeasure(id: string): PerformanceMetric | null {
    const metric = this.metrics.get(id);
    if (!metric) {
      console.warn(`Performance metric not found: ${id}`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // Move to completed metrics
    this.completedMetrics.push(metric);
    this.metrics.delete(id);

    // Limit history size
    if (this.completedMetrics.length > this.maxMetricsHistory) {
      this.completedMetrics = this.completedMetrics.slice(-this.maxMetricsHistory);
    }

    // Log slow operations
    if (metric.duration > this.performanceThresholds.slowOperation) {
      const level = metric.duration > this.performanceThresholds.criticalOperation ? 'error' : 'warn';
      console[level](`Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
    }

    return metric;
  }

  /**
   * Measure a function execution time
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const id = this.startMeasure(name, metadata);
    try {
      const result = await fn();
      this.endMeasure(id);
      return result;
    } catch (error) {
      this.endMeasure(id);
      throw error;
    }
  }

  /**
   * Measure a synchronous function execution time
   */
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const id = this.startMeasure(name, metadata);
    try {
      const result = fn();
      this.endMeasure(id);
      return result;
    } catch (error) {
      this.endMeasure(id);
      throw error;
    }
  }

  /**
   * Record frame timing
   */
  recordFrameTime(frameTime: number): void {
    this.frameTimings.push(frameTime);
    
    if (this.frameTimings.length > this.maxFrameTimings) {
      this.frameTimings = this.frameTimings.slice(-this.maxFrameTimings);
    }

    // Warn about slow frames
    if (frameTime > this.performanceThresholds.frameTimeWarning) {
      console.warn(`Slow frame detected: ${frameTime.toFixed(2)}ms (target: ${this.performanceThresholds.frameTimeWarning}ms)`);
    }
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage(): MemoryUsage | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: memory.usedJSHeapSize / memory.totalJSHeapSize,
        timestamp: new Date()
      };
    }
    return null;
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): void {
    const usage = this.getCurrentMemoryUsage();
    if (usage) {
      this.memorySnapshots.push(usage);
      
      if (this.memorySnapshots.length > this.maxMemorySnapshots) {
        this.memorySnapshots = this.memorySnapshots.slice(-this.maxMemorySnapshots);
      }

      // Warn about high memory usage
      if (usage.percentage > this.performanceThresholds.memoryWarning) {
        console.warn(`High memory usage detected: ${(usage.percentage * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): PerformanceReport {
    const averageFrameTime = this.frameTimings.length > 0 
      ? this.frameTimings.reduce((sum, time) => sum + time, 0) / this.frameTimings.length
      : 0;

    const currentMemory = this.getCurrentMemoryUsage() || {
      used: 0,
      total: 0,
      percentage: 0,
      timestamp: new Date()
    };

    const slowOperations = this.completedMetrics.filter(
      metric => metric.duration && metric.duration > this.performanceThresholds.slowOperation
    );

    const healthScore = this.calculateHealthScore(averageFrameTime, currentMemory, slowOperations);

    return {
      averageFrameTime,
      memoryUsage: currentMemory,
      slowOperations,
      totalMetrics: this.completedMetrics.length,
      healthScore
    };
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.completedMetrics.filter(metric => metric.name === name);
  }

  /**
   * Get average duration for a metric
   */
  getAverageDuration(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;
    
    const totalDuration = metrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    return totalDuration / metrics.length;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.completedMetrics = [];
    this.frameTimings = [];
    this.memorySnapshots = [];
  }

  /**
   * Get memory trend (increasing/decreasing/stable)
   */
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
    if (this.memorySnapshots.length < 3) {
      return 'unknown';
    }

    const recent = this.memorySnapshots.slice(-10);
    const first = recent[0].percentage;
    const last = recent[recent.length - 1].percentage;
    const difference = last - first;

    if (Math.abs(difference) < 0.05) { // Less than 5% change
      return 'stable';
    }

    return difference > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Optimize performance based on current metrics
   */
  optimizePerformance(): {
    recommendations: string[];
    actions: string[];
  } {
    const report = this.getPerformanceReport();
    const recommendations: string[] = [];
    const actions: string[] = [];

    // Frame rate optimization
    if (report.averageFrameTime > this.performanceThresholds.frameTimeWarning) {
      recommendations.push('Frame rate is below 60fps - consider reducing visual effects');
      actions.push('reduce_visual_effects');
    }

    // Memory optimization
    if (report.memoryUsage.percentage > this.performanceThresholds.memoryWarning) {
      recommendations.push('Memory usage is high - consider clearing old data');
      actions.push('cleanup_memory');
    }

    const memoryTrend = this.getMemoryTrend();
    if (memoryTrend === 'increasing') {
      recommendations.push('Memory usage is increasing - possible memory leak detected');
      actions.push('investigate_memory_leak');
    }

    // Slow operations
    if (report.slowOperations.length > 5) {
      recommendations.push('Multiple slow operations detected - consider optimization');
      actions.push('optimize_slow_operations');
    }

    // AI calculation optimization
    const aiMetrics = this.getMetricsByName('ai_calculation');
    const avgAiTime = this.getAverageDuration('ai_calculation');
    if (avgAiTime > 200) {
      recommendations.push('AI calculations are slow - consider using Web Workers');
      actions.push('use_web_workers');
    }

    return { recommendations, actions };
  }

  /**
   * Force garbage collection if available (for testing)
   */
  forceGarbageCollection(): boolean {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
      return true;
    }
    return false;
  }

  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure') {
              this.recordCustomMeasure(entry);
            }
          });
        });
        
        observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
      } catch (error) {
        console.warn('PerformanceObserver not supported or failed to initialize:', error);
      }
    }
  }

  private recordCustomMeasure(entry: PerformanceEntry): void {
    const metric: PerformanceMetric = {
      name: entry.name,
      startTime: entry.startTime,
      endTime: entry.startTime + entry.duration,
      duration: entry.duration
    };
    
    this.completedMetrics.push(metric);
  }

  private startMemoryMonitoring(): void {
    // Take memory snapshot every 10 seconds
    setInterval(() => {
      this.takeMemorySnapshot();
    }, 10000);
  }

  private startFrameTimeMonitoring(): void {
    let lastFrameTime = performance.now();
    
    const measureFrame = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      this.recordFrameTime(frameTime);
      lastFrameTime = currentTime;
      
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }

  private calculateHealthScore(
    averageFrameTime: number,
    memoryUsage: MemoryUsage,
    slowOperations: PerformanceMetric[]
  ): number {
    let score = 100;

    // Frame rate penalty
    if (averageFrameTime > this.performanceThresholds.frameTimeWarning) {
      const penalty = Math.min(30, (averageFrameTime - this.performanceThresholds.frameTimeWarning) * 2);
      score -= penalty;
    }

    // Memory usage penalty
    if (memoryUsage.percentage > this.performanceThresholds.memoryWarning) {
      const penalty = Math.min(25, (memoryUsage.percentage - this.performanceThresholds.memoryWarning) * 100);
      score -= penalty;
    }

    // Slow operations penalty
    const slowOpsPenalty = Math.min(20, slowOperations.length * 2);
    score -= slowOpsPenalty;

    return Math.max(0, Math.round(score));
  }
}

/**
 * Decorator for automatic performance measurement
 */
export function measurePerformance(metricName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const name = metricName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = PerformanceMonitor.getInstance();
      
      if (method.constructor.name === 'AsyncFunction') {
        return await monitor.measureAsync(name, () => method.apply(this, args));
      } else {
        return monitor.measureSync(name, () => method.apply(this, args));
      }
    };

    return descriptor;
  };
}

/**
 * Memory management utilities
 */
export class MemoryManager {
  private static cleanupCallbacks: (() => void)[] = [];
  private static cleanupThreshold = 0.85; // 85% memory usage

  /**
   * Register a cleanup callback
   */
  static registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Perform memory cleanup
   */
  static performCleanup(): void {
    console.log('Performing memory cleanup...');
    
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Cleanup callback failed:', error);
      }
    });

    // Force garbage collection if available
    const monitor = PerformanceMonitor.getInstance();
    monitor.forceGarbageCollection();
  }

  /**
   * Check if cleanup is needed
   */
  static isCleanupNeeded(): boolean {
    const monitor = PerformanceMonitor.getInstance();
    const memoryUsage = monitor.getCurrentMemoryUsage();
    
    return memoryUsage ? memoryUsage.percentage > this.cleanupThreshold : false;
  }

  /**
   * Auto cleanup when memory usage is high
   */
  static startAutoCleanup(): void {
    setInterval(() => {
      if (this.isCleanupNeeded()) {
        this.performCleanup();
      }
    }, 30000); // Check every 30 seconds
  }
}