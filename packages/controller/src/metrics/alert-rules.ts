import { EventEmitter } from 'node:events';

/**
 * 告警级别
 */
export enum AlertLevel {
  INFO = 'info',       // 信息
  WARNING = 'warning', // 警告
  ERROR = 'error',     // 错误
  CRITICAL = 'critical', // 严重
}

/**
 * 告警状态
 */
export enum AlertStatus {
  ACTIVE = 'active',       // 活跃
  ACKNOWLEDGED = 'acknowledged', // 已确认
  RESOLVED = 'resolved',   // 已解决
  SUPPRESSED = 'suppressed', // 已抑制
}

/**
 * 告警条件类型
 */
export type AlertConditionType = 
  | 'threshold'      // 阈值比较
  | 'change'         // 变化检测
  | 'absence'        // 缺失检测
  | 'rate'           // 速率检测
  | 'expression';    // 表达式

/**
 * 比较操作符
 */
export type ComparisonOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';

/**
 * 告警条件
 */
export interface AlertCondition {
  /** 条件类型 */
  type: AlertConditionType;
  /** 指标名称 */
  metric: string;
  /** 比较操作符（用于 threshold/rate） */
  operator?: ComparisonOperator;
  /** 阈值（用于 threshold/rate） */
  threshold?: number;
  /** 持续时间（毫秒，达到条件后需要持续多久才触发） */
  duration?: number;
  /** 变化幅度（用于 change） */
  changeThreshold?: number;
  /** 表达式（用于 expression） */
  expression?: string;
}

/**
 * 告警规则
 */
export interface AlertRule {
  /** 规则 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description?: string;
  /** 告警级别 */
  level: AlertLevel;
  /** 启用状态 */
  enabled: boolean;
  /** 告警条件 */
  condition: AlertCondition;
  /** 告警标签（用于分类） */
  tags?: string[];
  /** 抑制时间（毫秒，同一告警触发后的抑制期） */
  suppressDuration?: number;
  /** 冷却时间（毫秒，告警解决后再次触发的冷却期） */
  cooldownDuration?: number;
  /** 自定义数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 告警
 */
export interface Alert {
  /** 告警 ID */
  id: string;
  /** 关联的规则 ID */
  ruleId: string;
  /** 告警名称 */
  name: string;
  /** 告警级别 */
  level: AlertLevel;
  /** 告警状态 */
  status: AlertStatus;
  /** 告警消息 */
  message: string;
  /** 触发的指标值 */
  metricValue: number;
  /** 告警阈值 */
  threshold: number;
  /** 触发时间 */
  triggeredAt: Date;
  /** 确认时间 */
  acknowledgedAt?: Date;
  /** 解决时间 */
  resolvedAt?: Date;
  /** 确认人 */
  acknowledgedBy?: string;
  /** 标签 */
  tags: string[];
  /** 实例 ID */
  instanceId: string;
}

/**
 * 告警事件
 */
export interface AlertEvent {
  type: 'triggered' | 'acknowledged' | 'resolved' | 'escalated';
  alert: Alert;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * 告警规则配置
 */
export interface AlertRulesConfig {
  /** 规则列表 */
  rules: AlertRule[];
  /** 默认抑制时间（毫秒） */
  defaultSuppressDuration?: number;
  /** 默认冷却时间（毫秒） */
  defaultCooldownDuration?: number;
}

/**
 * 告警规则引擎
 * 评估指标数据，触发和管理告警
 */
export class AlertRulesEngine extends EventEmitter {
  private readonly rules: Map<string, AlertRule> = new Map();
  private readonly activeAlerts: Map<string, Alert> = new Map();
  private readonly alertHistory: Alert[] = [];
  private readonly conditionStates: Map<string, { startTime: number; value: number }> = new Map();
  
  private defaultSuppressDuration: number = 300000; // 5 分钟
  private defaultCooldownDuration: number = 600000; // 10 分钟

  constructor(config?: AlertRulesConfig) {
    super();
    
    if (config) {
      this.defaultSuppressDuration = config.defaultSuppressDuration ?? this.defaultSuppressDuration;
      this.defaultCooldownDuration = config.defaultCooldownDuration ?? this.defaultCooldownDuration;
      
      for (const rule of config.rules) {
        this.addRule(rule);
      }
    }
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    const finalRule: AlertRule = {
      ...rule,
      suppressDuration: rule.suppressDuration ?? this.defaultSuppressDuration,
      cooldownDuration: rule.cooldownDuration ?? this.defaultCooldownDuration,
    };
    this.rules.set(rule.id, finalRule);
  }

  /**
   * 移除告警规则
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * 获取规则
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取启用的规则
   */
  getEnabledRules(): AlertRule[] {
    return this.getAllRules().filter((r) => r.enabled);
  }

  /**
   * 更新规则
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const existing = this.rules.get(ruleId);
    if (!existing) {
      return false;
    }

    this.rules.set(ruleId, { ...existing, ...updates });
    return true;
  }

  /**
   * 启用规则
   */
  enableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: true });
  }

  /**
   * 禁用规则
   */
  disableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: false });
  }

  /**
   * 评估指标数据
   */
  evaluate(metrics: Record<string, number>, instanceId: string): Alert[] {
    const triggeredAlerts: Alert[] = [];
    const now = Date.now();

    for (const rule of this.getEnabledRules()) {
      const alert = this.evaluateRule(rule, metrics, instanceId, now);
      
      if (alert) {
        triggeredAlerts.push(alert);
        
        // 检查是否是新的告警
        const existingAlert = this.activeAlerts.get(rule.id);
        
        if (!existingAlert) {
          // 新告警
          this.activeAlerts.set(rule.id, alert);
          this.alertHistory.push(alert);
          
          this.emit('alert', {
            type: 'triggered',
            alert,
            timestamp: new Date(),
          } as AlertEvent);
        }
      } else {
        // 检查是否有活跃告警需要解决
        const existingAlert = this.activeAlerts.get(rule.id);
        
        if (existingAlert && existingAlert.status === AlertStatus.ACTIVE) {
          const resolved = this.resolveAlert(rule.id);
          
          if (resolved) {
            this.emit('alert', {
              type: 'resolved',
              alert: resolved,
              timestamp: new Date(),
            } as AlertEvent);
          }
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * 评估单个规则
   */
  private evaluateRule(
    rule: AlertRule,
    metrics: Record<string, number>,
    instanceId: string,
    now: number,
  ): Alert | null {
    const metricValue = metrics[rule.condition.metric];
    
    if (metricValue === undefined) {
      return null;
    }

    let triggered = false;
    let conditionMet = false;

    switch (rule.condition.type) {
      case 'threshold':
        conditionMet = this.evaluateThreshold(metricValue, rule.condition);
        break;
      case 'change':
        conditionMet = this.evaluateChange(rule.id, metricValue, rule.condition);
        break;
      case 'rate':
        conditionMet = this.evaluateRate(rule.id, metricValue, rule.condition, now);
        break;
      case 'absence':
        conditionMet = this.evaluateAbsence(rule.id, rule.condition, now);
        break;
      case 'expression':
        conditionMet = this.evaluateExpression(metrics, rule.condition.expression ?? '');
        break;
    }

    // 检查持续时间
    if (conditionMet) {
      const stateKey = `${rule.id}:condition`;
      let state = this.conditionStates.get(stateKey);
      
      if (!state) {
        state = { startTime: now, value: metricValue };
        this.conditionStates.set(stateKey, state);
      }

      const duration = rule.condition.duration ?? 0;
      
      if (now - state.startTime >= duration) {
        triggered = true;
      }
    } else {
      // 重置状态
      this.conditionStates.delete(`${rule.id}:condition`);
    }

    if (!triggered) {
      return null;
    }

    // 检查抑制
    const existingAlert = this.activeAlerts.get(rule.id);
    if (existingAlert && existingAlert.status === AlertStatus.ACTIVE) {
      const suppressUntil = existingAlert.triggeredAt.getTime() + (rule.suppressDuration ?? this.defaultSuppressDuration);
      if (now < suppressUntil) {
        return null;
      }
    }

    return this.createAlert(rule, metricValue, instanceId);
  }

  /**
   * 评估阈值条件
   */
  private evaluateThreshold(value: number, condition: AlertCondition): boolean {
    if (condition.operator === undefined || condition.threshold === undefined) {
      return false;
    }

    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<':
        return value < condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * 评估变化条件
   */
  private evaluateChange(ruleId: string, value: number, condition: AlertCondition): boolean {
    const stateKey = `${ruleId}:change`;
    const state = this.conditionStates.get(stateKey);
    
    if (!state) {
      this.conditionStates.set(stateKey, { startTime: Date.now(), value });
      return false;
    }

    if (condition.changeThreshold === undefined) {
      return false;
    }

    const change = Math.abs(value - state.value);
    const changePercent = (change / state.value) * 100;
    
    this.conditionStates.set(stateKey, { startTime: Date.now(), value });
    
    return changePercent > condition.changeThreshold;
  }

  /**
   * 评估速率条件
   */
  private evaluateRate(ruleId: string, value: number, condition: AlertCondition, now: number): boolean {
    const stateKey = `${ruleId}:rate`;
    const state = this.conditionStates.get(stateKey);
    
    if (!state) {
      this.conditionStates.set(stateKey, { startTime: now, value });
      return false;
    }

    const timeDelta = now - state.startTime;
    if (timeDelta < 1000) {
      return false;
    }

    const rate = (value - state.value) / (timeDelta / 1000);
    
    this.conditionStates.set(stateKey, { startTime: now, value });
    
    return this.evaluateThreshold(rate, condition);
  }

  /**
   * 评估缺失条件
   */
  private evaluateAbsence(ruleId: string, condition: AlertCondition, now: number): boolean {
    const stateKey = `${ruleId}:absence`;
    const state = this.conditionStates.get(stateKey);
    
    if (!state) {
      this.conditionStates.set(stateKey, { startTime: now, value: 0 });
      return false;
    }

    const duration = condition.duration ?? 60000;
    return now - state.startTime > duration;
  }

  /**
   * 评估表达式条件
   */
  private evaluateExpression(metrics: Record<string, number>, expression: string): boolean {
    try {
      // 创建安全的环境
      const env: Record<string, number> = {};
      for (const [key, value] of Object.entries(metrics)) {
        env[key] = value;
      }
      
      // 简单的表达式求值（仅支持基本算术和比较）
      // 实际生产环境应使用更安全的表达式引擎
      const safeExpression = expression
        .replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
          if (env[match] !== undefined) {
            return String(env[match]);
          }
          return '0';
        });
      
      // 只允许数字、运算符和括号
      if (!/^[\d\s+\-*/%()<>=!&|.]+$/.test(safeExpression)) {
        return false;
      }
      
      return Boolean(eval(safeExpression));
    } catch {
      return false;
    }
  }

  /**
   * 创建告警
   */
  private createAlert(rule: AlertRule, metricValue: number, instanceId: string): Alert {
    return {
      id: `alert-${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      name: rule.name,
      level: rule.level,
      status: AlertStatus.ACTIVE,
      message: this.formatAlertMessage(rule, metricValue),
      metricValue,
      threshold: rule.condition.threshold ?? 0,
      triggeredAt: new Date(),
      tags: rule.tags ?? [],
      instanceId,
    };
  }

  /**
   * 格式化告警消息
   */
  private formatAlertMessage(rule: AlertRule, metricValue: number): string {
    const parts = [rule.name];
    
    if (rule.description) {
      parts.push(rule.description);
    }
    
    parts.push(`指标: ${rule.condition.metric}`);
    parts.push(`当前值: ${metricValue}`);
    
    if (rule.condition.threshold !== undefined) {
      parts.push(`阈值: ${rule.condition.operator ?? '>'}${rule.condition.threshold}`);
    }
    
    return parts.join(' | ');
  }

  /**
   * 解决告警
   */
  private resolveAlert(ruleId: string): Alert | null {
    const alert = this.activeAlerts.get(ruleId);
    
    if (!alert) {
      return null;
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    
    this.activeAlerts.delete(ruleId);
    
    return alert;
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    const activeAlert = this.activeAlerts.get(alert.ruleId);
    if (activeAlert && activeAlert.id === alertId) {
      activeAlert.status = AlertStatus.ACKNOWLEDGED;
      activeAlert.acknowledgedAt = alert.acknowledgedAt;
      activeAlert.acknowledgedBy = acknowledgedBy;
    }

    this.emit('alert', {
      type: 'acknowledged',
      alert,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(limit?: number): Alert[] {
    const history = [...this.alertHistory].sort(
      (a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime(),
    );
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * 获取按级别统计的告警
   */
  getAlertCounts(): Record<AlertLevel, number> {
    const counts: Record<AlertLevel, number> = {
      [AlertLevel.INFO]: 0,
      [AlertLevel.WARNING]: 0,
      [AlertLevel.ERROR]: 0,
      [AlertLevel.CRITICAL]: 0,
    };

    for (const alert of this.activeAlerts.values()) {
      counts[alert.level]++;
    }

    return counts;
  }

  /**
   * 获取默认规则
   */
  getDefaultRules(): AlertRule[] {
    return [
      {
        id: 'high-cpu-usage',
        name: 'CPU 使用率过高',
        description: 'CPU 使用率超过 80%',
        level: AlertLevel.WARNING,
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'system.cpuUsage',
          operator: '>',
          threshold: 80,
          duration: 60000,
        },
        tags: ['system', 'performance'],
      },
      {
        id: 'critical-cpu-usage',
        name: 'CPU 使用率严重过高',
        description: 'CPU 使用率超过 95%',
        level: AlertLevel.CRITICAL,
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'system.cpuUsage',
          operator: '>',
          threshold: 95,
          duration: 30000,
        },
        tags: ['system', 'performance'],
      },
      {
        id: 'high-memory-usage',
        name: '内存使用率过高',
        description: '内存使用率超过 85%',
        level: AlertLevel.WARNING,
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'system.memoryUsage',
          operator: '>',
          threshold: 85,
          duration: 60000,
        },
        tags: ['system', 'memory'],
      },
      {
        id: 'high-disk-usage',
        name: '磁盘使用率过高',
        description: '磁盘使用率超过 90%',
        level: AlertLevel.ERROR,
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'system.diskUsage',
          operator: '>',
          threshold: 90,
          duration: 120000,
        },
        tags: ['system', 'storage'],
      },
      {
        id: 'low-task-success-rate',
        name: '任务成功率过低',
        description: '任务成功率低于 80%',
        level: AlertLevel.WARNING,
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'task.successRate',
          operator: '<',
          threshold: 80,
          duration: 300000,
        },
        tags: ['task', 'quality'],
      },
      {
        id: 'no-online-workers',
        name: '无可用 Worker',
        description: '没有在线的 Worker',
        level: AlertLevel.CRITICAL,
        enabled: true,
        condition: {
          type: 'threshold',
          metric: 'worker.online',
          operator: '==',
          threshold: 0,
          duration: 60000,
        },
        tags: ['worker', 'availability'],
      },
    ];
  }

  /**
   * 清除告警历史
   */
  clearHistory(): void {
    this.alertHistory.length = 0;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.rules.clear();
    this.activeAlerts.clear();
    this.alertHistory.length = 0;
    this.conditionStates.clear();
    this.removeAllListeners();
  }
}
