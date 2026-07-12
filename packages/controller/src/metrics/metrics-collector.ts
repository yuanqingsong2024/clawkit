import { EventEmitter } from 'node:events';
import os from 'node:os';

/**
 * 任务执行指标
 */
export interface TaskMetrics {
  total: number;           // 总任务数
  pending: number;         // 待处理
  running: number;         // 运行中
  success: number;         // 成功
  failed: number;          // 失败
  cancelled: number;       // 已取消
  avgExecutionTime: number; // 平均执行时间（毫秒）
  successRate: number;     // 成功率
}

/**
 * 系统资源指标
 */
export interface SystemMetrics {
  cpuUsage: number;        // CPU 使用率 (0-100)
  memoryUsed: number;      // 内存使用量（字节）
  memoryTotal: number;      // 内存总量（字节）
  memoryUsage: number;      // 内存使用率 (0-100)
  diskUsed: number;        // 磁盘使用量（字节）
  diskTotal: number;       // 磁盘总量（字节）
  diskUsage: number;       // 磁盘使用率 (0-100)
  uptime: number;          // 运行时间（秒）
}

/**
 * Worker 指标
 */
export interface WorkerMetrics {
  total: number;           // 总 worker 数
  online: number;          // 在线
  offline: number;         // 离线
  idle: number;           // 空闲
  busy: number;            // 忙碌
  currentLoad: number;      // 当前总负载
  maxLoad: number;         // 最大负载
}

/**
 * HTTP 指标
 */
export interface HttpMetrics {
  requestsTotal: number;   // 总请求数
  requestsSuccess: number;  // 成功请求数
  requestsError: number;   // 错误请求数
  avgResponseTime: number;  // 平均响应时间（毫秒）
  maxResponseTime: number;  // 最大响应时间（毫秒）
}

/**
 * 完整指标快照
 */
export interface MetricsSnapshot {
  timestamp: Date;
  instanceId: string;
  task: TaskMetrics;
  system: SystemMetrics;
  worker: WorkerMetrics;
  http: HttpMetrics;
}

/**
 * 指标历史数据点
 */
export interface MetricsDataPoint {
  timestamp: Date;
  value: number;
}

/**
 * 指标历史记录
 */
export interface MetricsHistory {
  metricName: string;
  dataPoints: MetricsDataPoint[];
}

/**
 * 指标采集器配置
 */
export interface MetricsCollectorConfig {
  /** 采集间隔（毫秒） */
  collectionIntervalMs?: number;
  /** 历史保留时间（毫秒） */
  historyRetentionMs?: number;
  /** 指标历史采样间隔 */
  historySampleIntervalMs?: number;
  /** 实例 ID */
  instanceId: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<MetricsCollectorConfig, 'instanceId'>> = {
  collectionIntervalMs: 10000,
  historyRetentionMs: 3600000, // 1 小时
  historySampleIntervalMs: 60000, // 1 分钟
};

/**
 * 指标采集服务
 * 采集系统、任务、Worker、HTTP 等各类指标
 */
export class MetricsCollector extends EventEmitter {
  private readonly config: Required<MetricsCollectorConfig>;
  private collectionTimer?: NodeJS.Timeout;
  private startTime: Date;
  
  // 任务指标
  private taskMetrics: TaskMetrics = {
    total: 0,
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    cancelled: 0,
    avgExecutionTime: 0,
    successRate: 0,
  };
  
  // HTTP 指标
  private httpMetrics: HttpMetrics = {
    requestsTotal: 0,
    requestsSuccess: 0,
    requestsError: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
  };
  
  // 指标历史
  private readonly metricsHistory: Map<string, MetricsDataPoint[]> = new Map();
  
  // Worker 状态查询函数
  private getWorkerMetricsFn?: () => { online: number; offline: number; idle: number; busy: number; currentLoad: number; maxLoad: number };
  
  // 任务状态查询函数
  private getTaskMetricsFn?: () => { total: number; pending: number; running: number; success: number; failed: number; cancelled: number; avgExecutionTime: number };

  constructor(config: MetricsCollectorConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
  }

  /**
   * 设置 Worker 指标查询函数
   */
  setWorkerMetricsGetter(fn: () => { online: number; offline: number; idle: number; busy: number; currentLoad: number; maxLoad: number }): void {
    this.getWorkerMetricsFn = fn;
  }

  /**
   * 设置任务指标查询函数
   */
  setTaskMetricsGetter(fn: () => { total: number; pending: number; running: number; success: number; failed: number; cancelled: number; avgExecutionTime: number }): void {
    this.getTaskMetricsFn = fn;
  }

  /**
   * 开始自动采集
   */
  start(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }

    // 立即采集一次
    this.collect();

    // 设置定期采集
    this.collectionTimer = setInterval(() => {
      this.collect();
    }, this.config.collectionIntervalMs);

    // 设置历史采样
    setInterval(() => {
      this.sampleHistory();
    }, this.config.historySampleIntervalMs);

    console.log(`指标采集器已启动，实例ID: ${this.config.instanceId}`);
  }

  /**
   * 停止自动采集
   */
  stop(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }
    console.log('指标采集器已停止');
  }

  /**
   * 采集所有指标
   */
  collect(): MetricsSnapshot {
    // 采集系统指标
    const systemMetrics = this.collectSystemMetrics();

    // 采集任务指标
    this.collectTaskMetrics();

    // 采集 Worker 指标
    const workerMetrics = this.collectWorkerMetrics();

    // 发出指标采集完成事件
    this.emit('metrics_collected', {
      timestamp: new Date(),
      instanceId: this.config.instanceId,
      system: systemMetrics,
      task: this.taskMetrics,
      worker: workerMetrics,
      http: this.httpMetrics,
    });

    return this.getSnapshot();
  }

  /**
   * 采集系统指标
   */
  private collectSystemMetrics(): SystemMetrics {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // 计算 CPU 使用率
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }
    const cpuUsage = total > 0 ? Math.round((1 - idle / total) * 100) : 0;

    // 获取磁盘信息（简化实现）
    const diskUsage = this.getDiskUsage();

    return {
      cpuUsage,
      memoryUsed: usedMem,
      memoryTotal: totalMem,
      memoryUsage: Math.round((usedMem / totalMem) * 100),
      diskUsed: diskUsage.used,
      diskTotal: diskUsage.total,
      diskUsage: diskUsage.usage,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
    };
  }

  /**
   * 获取磁盘使用情况
   */
  private getDiskUsage(): { used: number; total: number; usage: number } {
    // 简化实现：返回预估值
    // 实际实现应该通过 fs.statfs 或外部命令获取
    const total = 500 * 1024 * 1024 * 1024; // 假设 500GB
    const used = total * 0.4; // 假设 40% 使用
    return {
      used,
      total,
      usage: Math.round((used / total) * 100),
    };
  }

  /**
   * 采集任务指标
   */
  private collectTaskMetrics(): void {
    if (this.getTaskMetricsFn) {
      const metrics = this.getTaskMetricsFn();
      this.taskMetrics = {
        total: metrics.total,
        pending: metrics.pending,
        running: metrics.running,
        success: metrics.success,
        failed: metrics.failed,
        cancelled: metrics.cancelled,
        avgExecutionTime: metrics.avgExecutionTime,
        successRate: metrics.total > 0 
          ? Math.round((metrics.success / metrics.total) * 100 * 100) / 100 
          : 0,
      };
    }
  }

  /**
   * 采集 Worker 指标
   */
  private collectWorkerMetrics(): WorkerMetrics {
    if (this.getWorkerMetricsFn) {
      const metrics = this.getWorkerMetricsFn();
      return {
        total: metrics.online + metrics.offline,
        online: metrics.online,
        offline: metrics.offline,
        idle: metrics.idle,
        busy: metrics.busy,
        currentLoad: metrics.currentLoad,
        maxLoad: metrics.maxLoad,
      };
    }

    return {
      total: 0,
      online: 0,
      offline: 0,
      idle: 0,
      busy: 0,
      currentLoad: 0,
      maxLoad: 0,
    };
  }

  /**
   * 记录 HTTP 请求
   */
  recordHttpRequest(success: boolean, responseTime: number): void {
    this.httpMetrics.requestsTotal++;
    
    if (success) {
      this.httpMetrics.requestsSuccess++;
    } else {
      this.httpMetrics.requestsError++;
    }

    // 更新响应时间统计
    const totalTime = this.httpMetrics.avgResponseTime * (this.httpMetrics.requestsTotal - 1);
    this.httpMetrics.avgResponseTime = (totalTime + responseTime) / this.httpMetrics.requestsTotal;
    
    if (responseTime > this.httpMetrics.maxResponseTime) {
      this.httpMetrics.maxResponseTime = responseTime;
    }
  }

  /**
   * 记录任务状态变化
   */
  recordTaskStatusChange(status: string): void {
    switch (status) {
      case 'pending':
        this.taskMetrics.pending++;
        this.taskMetrics.total++;
        break;
      case 'running':
        this.taskMetrics.pending = Math.max(0, this.taskMetrics.pending - 1);
        this.taskMetrics.running++;
        break;
      case 'done':
        this.taskMetrics.running = Math.max(0, this.taskMetrics.running - 1);
        this.taskMetrics.success++;
        break;
      case 'failed':
        this.taskMetrics.running = Math.max(0, this.taskMetrics.running - 1);
        this.taskMetrics.failed++;
        break;
      case 'cancelled':
        this.taskMetrics.pending = Math.max(0, this.taskMetrics.pending - 1);
        this.taskMetrics.cancelled++;
        break;
    }

    // 更新成功率
    if (this.taskMetrics.total > 0) {
      this.taskMetrics.successRate = Math.round((this.taskMetrics.success / this.taskMetrics.total) * 10000) / 100;
    }
  }

  /**
   * 获取指标快照
   */
  getSnapshot(): MetricsSnapshot {
    return {
      timestamp: new Date(),
      instanceId: this.config.instanceId,
      task: { ...this.taskMetrics },
      system: this.collectSystemMetrics(),
      worker: this.collectWorkerMetrics(),
      http: { ...this.httpMetrics },
    };
  }

  /**
   * 获取任务指标
   */
  getTaskMetrics(): TaskMetrics {
    return { ...this.taskMetrics };
  }

  /**
   * 获取系统指标
   */
  getSystemMetrics(): SystemMetrics {
    return this.collectSystemMetrics();
  }

  /**
   * 获取 Worker 指标
   */
  getWorkerMetrics(): WorkerMetrics {
    return this.collectWorkerMetrics();
  }

  /**
   * 获取 HTTP 指标
   */
  getHttpMetrics(): HttpMetrics {
    return { ...this.httpMetrics };
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(metricName: string): MetricsHistory | null {
    const dataPoints = this.metricsHistory.get(metricName);
    if (!dataPoints) {
      return null;
    }

    return {
      metricName,
      dataPoints: [...dataPoints],
    };
  }

  /**
   * 获取所有指标历史名称
   */
  getMetricHistoryNames(): string[] {
    return Array.from(this.metricsHistory.keys());
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.taskMetrics = {
      total: 0,
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      cancelled: 0,
      avgExecutionTime: 0,
      successRate: 0,
    };

    this.httpMetrics = {
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsError: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
    };

    this.metricsHistory.clear();
    console.log('指标已重置');
  }

  /**
   * 采样历史数据
   */
  private sampleHistory(): void {
    const now = Date.now();
    const cutoff = now - this.config.historyRetentionMs;

    // 采集各指标
    const snapshot = this.getSnapshot();

    // 添加到历史
    this.addToHistory('system.cpuUsage', snapshot.system.cpuUsage, now);
    this.addToHistory('system.memoryUsage', snapshot.system.memoryUsage, now);
    this.addToHistory('system.diskUsage', snapshot.system.diskUsage, now);
    this.addToHistory('task.successRate', snapshot.task.successRate, now);
    this.addToHistory('task.total', snapshot.task.total, now);
    this.addToHistory('worker.online', snapshot.worker.online, now);
    this.addToHistory('worker.busy', snapshot.worker.busy, now);
    this.addToHistory('http.requestsTotal', snapshot.http.requestsTotal, now);

    // 清理过期数据
    for (const [name, points] of this.metricsHistory.entries()) {
      const filtered = points.filter((p) => p.timestamp.getTime() > cutoff);
      if (filtered.length === 0) {
        this.metricsHistory.delete(name);
      } else {
        this.metricsHistory.set(name, filtered);
      }
    }
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(metricName: string, value: number, timestamp: number): void {
    let points = this.metricsHistory.get(metricName);
    if (!points) {
      points = [];
      this.metricsHistory.set(metricName, points);
    }

    points.push({
      timestamp: new Date(timestamp),
      value,
    });
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stop();
    this.metricsHistory.clear();
    this.removeAllListeners();
  }
}
