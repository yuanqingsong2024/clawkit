/**
 * 执行结果分析服务模块
 * 提供代码质量分析、测试覆盖率分析、风险评估和优化建议生成功能
 */

// 类型定义
export {
  type CodeQualityMetrics,
  type TestCoverageMetrics,
  type RiskAssessment,
  type RiskFactor,
  type OptimizationSuggestion,
  type AnalysisConfig,
  type AnalysisResult,
  RiskLevel,
  SuggestionCategory,
  SuggestionSeverity,
} from './analysis.types';

// 分析器
export { CodeQualityAnalyzer } from './code-quality-analyzer';
export { CoverageAnalyzer } from './coverage-analyzer';
export { RiskAssessor } from './risk-assessor';
export { SuggestionGenerator } from './suggestion-generator';
export { ResultAnalyzer } from './result-analyzer';
