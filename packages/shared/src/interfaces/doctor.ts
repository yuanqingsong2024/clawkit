import { Manifest } from '../types/manifest';

/**
 * 检查项状态
 */
export enum CheckStatus {
  /** 通过 */
  PASS = 'pass',
  /** 警告 */
  WARN = 'warn',
  /** 失败 */
  FAIL = 'fail',
  /** 跳过 */
  SKIP = 'skip',
}

/**
 * 检查项结果
 */
export interface CheckResult {
  /** 检查项名称 */
  name: string;
  /** 检查状态 */
  status: CheckStatus;
  /** 检查信息 */
  message: string;
  /** 建议修复方案 */
  suggestion?: string;
}

/**
 * Doctor 检查报告
 */
export interface DoctorReport {
  /** 检查时间 */
  timestamp: Date;
  /** 配置文件路径 */
  manifestPath: string;
  /** 检查结果列表 */
  checks: CheckResult[];
  /** 总体状态 */
  overallStatus: CheckStatus;
  /** 通过数量 */
  passCount: number;
  /** 警告数量 */
  warnCount: number;
  /** 失败数量 */
  failCount: number;
}

/**
 * Doctor 服务接口
 * 负责诊断配置和环境
 */
export interface DoctorService {
  /**
   * 执行诊断
   * @param manifest Manifest 配置
   * @returns 诊断报告
   */
  diagnose(manifest: Manifest): Promise<DoctorReport>;

  /**
   * 检查配置文件语法
   * @param manifest Manifest 配置
   * @returns 检查结果
   */
  checkManifestSyntax(manifest: Manifest): Promise<CheckResult>;

  /**
   * 检查节点连接
   * @param manifest Manifest 配置
   * @returns 检查结果列表
   */
  checkNodeConnections(manifest: Manifest): Promise<CheckResult[]>;

  /**
   * 检查依赖环境
   * @param manifest Manifest 配置
   * @returns 检查结果列表
   */
  checkDependencies(manifest: Manifest): Promise<CheckResult[]>;
}
