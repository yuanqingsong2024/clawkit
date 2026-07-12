/**
 * 执行结果分析服务类型定义
 */

/**
 * 代码质量指标
 */
export interface CodeQualityMetrics {
  /** 代码行数 */
  linesOfCode: number;
  /** 文件数量 */
  fileCount: number;
  /** 语言分布 */
  languageBreakdown: Record<string, number>;
  /** 平均文件大小 */
  avgFileSize: number;
  /** 最大文件大小 */
  maxFileSize: number;
  /** 最大文件路径 */
  maxFilePath: string;
  /** 注释比例 */
  commentRatio: number;
  /** 空白行比例 */
  blankLineRatio: number;
}

/**
 * 测试覆盖率指标
 */
export interface TestCoverageMetrics {
  /** 行覆盖率 */
  lineCoverage: number;
  /** 函数覆盖率 */
  functionCoverage: number;
  /** 分支覆盖率 */
  branchCoverage: number;
  /** 语句覆盖率 */
  statementCoverage: number;
  /** 总测试数 */
  totalTests: number;
  /** 通过测试数 */
  passedTests: number;
  /** 失败测试数 */
  failedTests: number;
  /** 跳过测试数 */
  skippedTests: number;
  /** 覆盖的文件数 */
  coveredFiles: number;
  /** 总文件数 */
  totalFiles: number;
}

/**
 * 变更风险级别
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 风险评估结果
 */
export interface RiskAssessment {
  /** 总体风险级别 */
  overallRisk: RiskLevel;
  /** 风险分数 (0-100) */
  riskScore: number;
  /** 风险因素列表 */
  riskFactors: RiskFactor[];
  /** 风险说明 */
  explanation: string;
}

/**
 * 风险因素
 */
export interface RiskFactor {
  /** 风险因素名称 */
  name: string;
  /** 风险级别 */
  level: RiskLevel;
  /** 风险分数贡献 */
  score: number;
  /** 详细描述 */
  description: string;
  /** 相关文件 */
  relatedFiles?: string[];
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  /** 建议 ID */
  id: string;
  /** 建议类别 */
  category: SuggestionCategory;
  /** 严重程度 */
  severity: SuggestionSeverity;
  /** 标题 */
  title: string;
  /** 详细描述 */
  description: string;
  /** 当前代码/问题 */
  currentCode?: string;
  /** 建议的改进方案 */
  suggestedFix?: string;
  /** 预期收益 */
  expectedBenefit?: string;
  /** 相关文件 */
  relatedFiles?: string[];
  /** 预估工作量 */
  estimatedEffort?: string;
}

/**
 * 建议类别
 */
export enum SuggestionCategory {
  PERFORMANCE = 'performance',
  CODE_QUALITY = 'code_quality',
  TESTING = 'testing',
  SECURITY = 'security',
  MAINTAINABILITY = 'maintainability',
  DEPENDENCIES = 'dependencies',
}

/**
 * 建议严重程度
 */
export enum SuggestionSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

/**
 * 执行结果分析配置
 */
export interface AnalysisConfig {
  /** 是否启用代码质量分析 */
  enableCodeQuality?: boolean;
  /** 是否启用测试覆盖率分析 */
  enableCoverage?: boolean;
  /** 是否启用风险评估 */
  enableRiskAssessment?: boolean;
  /** 是否启用优化建议生成 */
  enableSuggestions?: boolean;
  /** 风险阈值 (超过此分数视为高风险) */
  riskThreshold?: number;
  /** 代码行数警告阈值 */
  largeFileThreshold?: number;
}

/**
 * 执行结果分析结果
 */
export interface AnalysisResult {
  /** 分析时间戳 */
  timestamp: Date;
  /** 代码质量分析结果 */
  codeQuality?: CodeQualityMetrics;
  /** 测试覆盖率分析结果 */
  testCoverage?: TestCoverageMetrics;
  /** 风险评估结果 */
  riskAssessment?: RiskAssessment;
  /** 优化建议列表 */
  suggestions?: OptimizationSuggestion[];
  /** 分析耗时 (毫秒) */
  duration: number;
  /** 分析配置 */
  config: AnalysisConfig;
}
