/**
 * 执行结果分析服务
 * 整合代码质量分析、测试覆盖率分析、风险评估和优化建议生成
 */

import type {
  AnalysisConfig,
  AnalysisResult,
  CodeQualityMetrics,
  TestCoverageMetrics,
  RiskAssessment,
  OptimizationSuggestion,
} from './analysis.types';

import { CodeQualityAnalyzer } from './code-quality-analyzer';
import { CoverageAnalyzer } from './coverage-analyzer';
import { RiskAssessor } from './risk-assessor';
import { SuggestionGenerator } from './suggestion-generator';

/**
 * 执行结果分析服务
 */
export class ResultAnalyzer {
  private readonly config: Required<AnalysisConfig>;
  private readonly codeQualityAnalyzer: CodeQualityAnalyzer;
  private readonly coverageAnalyzer: CoverageAnalyzer;
  private readonly riskAssessor: RiskAssessor;
  private readonly suggestionGenerator: SuggestionGenerator;

  constructor(config: AnalysisConfig = {}) {
    this.config = {
      enableCodeQuality: config.enableCodeQuality ?? true,
      enableCoverage: config.enableCoverage ?? true,
      enableRiskAssessment: config.enableRiskAssessment ?? true,
      enableSuggestions: config.enableSuggestions ?? true,
      riskThreshold: config.riskThreshold ?? 70,
      largeFileThreshold: config.largeFileThreshold ?? 500,
    };

    this.codeQualityAnalyzer = new CodeQualityAnalyzer(this.config);
    this.coverageAnalyzer = new CoverageAnalyzer(this.config);
    this.riskAssessor = new RiskAssessor(this.config);
    this.suggestionGenerator = new SuggestionGenerator(this.config);
  }

  /**
   * 执行完整分析
   * @param files 代码文件列表
   * @param coverageData 测试覆盖率数据
   * @returns 完整的分析结果
   */
  async analyze(
    files: Array<{ path: string; content: string }>,
    coverageData?: Record<string, unknown> | string,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    let codeQuality: CodeQualityMetrics | undefined;
    let testCoverage: TestCoverageMetrics | undefined;
    let riskAssessment: RiskAssessment | undefined;
    let suggestions: OptimizationSuggestion[] | undefined;

    // 代码质量分析
    if (this.config.enableCodeQuality) {
      codeQuality = await this.codeQualityAnalyzer.analyze(files);
    }

    // 覆盖率分析
    if (this.config.enableCoverage && coverageData) {
      testCoverage = await this.coverageAnalyzer.parseCoverageReport(coverageData);
    }

    // 风险评估
    if (this.config.enableRiskAssessment && (codeQuality || testCoverage)) {
      riskAssessment = await this.riskAssessor.assess(codeQuality, testCoverage);
    }

    // 优化建议
    if (this.config.enableSuggestions) {
      suggestions = await this.suggestionGenerator.generate(codeQuality, testCoverage, riskAssessment);
    }

    const duration = Date.now() - startTime;

    return {
      timestamp: new Date(),
      codeQuality,
      testCoverage,
      riskAssessment,
      suggestions,
      duration,
      config: this.config,
    };
  }

  /**
   * 仅分析代码质量
   */
  async analyzeCodeQuality(files: Array<{ path: string; content: string }>): Promise<CodeQualityMetrics> {
    return this.codeQualityAnalyzer.analyze(files);
  }

  /**
   * 仅分析测试覆盖率
   */
  async analyzeCoverage(coverageData: Record<string, unknown> | string): Promise<TestCoverageMetrics> {
    return this.coverageAnalyzer.parseCoverageReport(coverageData);
  }

  /**
   * 仅评估风险
   */
  async assessRisk(
    codeQuality?: CodeQualityMetrics,
    testCoverage?: TestCoverageMetrics,
  ): Promise<RiskAssessment> {
    return this.riskAssessor.assess(codeQuality, testCoverage);
  }

  /**
   * 仅生成优化建议
   */
  async generateSuggestions(
    codeQuality?: CodeQualityMetrics,
    testCoverage?: TestCoverageMetrics,
    riskAssessment?: RiskAssessment,
  ): Promise<OptimizationSuggestion[]> {
    return this.suggestionGenerator.generate(codeQuality, testCoverage, riskAssessment);
  }

  /**
   * 获取分析结果摘要
   */
  getSummary(result: AnalysisResult): string {
    const parts: string[] = [];

    parts.push(`分析时间：${result.timestamp.toISOString()}`);
    parts.push(`分析耗时：${result.duration}ms\n`);

    if (result.codeQuality) {
      const cq = result.codeQuality;
      parts.push('📊 代码质量：');
      parts.push(`  - 总代码行数：${cq.linesOfCode}`);
      parts.push(`  - 文件数量：${cq.fileCount}`);
      parts.push(`  - 平均文件大小：${cq.avgFileSize} 行`);
      parts.push(`  - 最大文件：${cq.maxFilePath} (${cq.maxFileSize} 行)`);
      parts.push(`  - 注释比例：${cq.commentRatio}%`);
      parts.push('');
    }

    if (result.testCoverage) {
      const tc = result.testCoverage;
      parts.push('🧪 测试覆盖率：');
      parts.push(`  - 行覆盖率：${tc.lineCoverage}%`);
      parts.push(`  - 函数覆盖率：${tc.functionCoverage}%`);
      parts.push(`  - 分支覆盖率：${tc.branchCoverage}%`);
      parts.push(`  - 测试结果：${tc.passedTests}/${tc.totalTests} 通过`);
      if (tc.failedTests > 0) {
        parts.push(`  - ⚠️ 失败测试：${tc.failedTests}`);
      }
      parts.push('');
    }

    if (result.riskAssessment) {
      const ra = result.riskAssessment;
      const riskEmoji = ra.overallRisk === 'critical' ? '🔴' : ra.overallRisk === 'high' ? '🟠' : ra.overallRisk === 'medium' ? '🟡' : '🟢';
      parts.push(`${riskEmoji} 风险评估：`);
      parts.push(`  - 风险级别：${ra.overallRisk.toUpperCase()}`);
      parts.push(`  - 风险分数：${ra.riskScore}`);
      if (ra.riskFactors.length > 0) {
        parts.push(`  - 风险因素：${ra.riskFactors.length} 项`);
      }
      parts.push('');
    }

    if (result.suggestions && result.suggestions.length > 0) {
      const criticalCount = result.suggestions.filter((s) => s.severity === 'critical').length;
      const highCount = result.suggestions.filter((s) => s.severity === 'high').length;

      parts.push('💡 优化建议：');
      parts.push(`  - 总计 ${result.suggestions.length} 条建议`);
      if (criticalCount > 0) {
        parts.push(`  - 🔴 严重：${criticalCount} 条`);
      }
      if (highCount > 0) {
        parts.push(`  - 🟠 高：${highCount} 条`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 检查是否允许部署（基于风险评估）
   */
  isDeploymentAllowed(result: AnalysisResult): { allowed: boolean; reason?: string } {
    if (!result.riskAssessment) {
      // 没有风险评估时，默认允许部署
      return { allowed: true };
    }

    const { riskAssessment } = result;

    // 检查是否有失败的测试
    if (result.testCoverage && result.testCoverage.failedTests > 0) {
      return {
        allowed: false,
        reason: `存在 ${result.testCoverage.failedTests} 个失败的测试用例，必须修复后才能部署`,
      };
    }

    // 检查风险级别
    if (riskAssessment.overallRisk === 'critical') {
      return {
        allowed: false,
        reason: '风险级别为严重，建议推迟部署',
      };
    }

    if (riskAssessment.overallRisk === 'high') {
      return {
        allowed: false,
        reason: '风险级别为高，建议优先解决风险因素',
      };
    }

    // 检查风险分数
    if (riskAssessment.riskScore > this.config.riskThreshold) {
      return {
        allowed: false,
        reason: `风险分数 ${riskAssessment.riskScore} 超过阈值 ${this.config.riskThreshold}`,
      };
    }

    return { allowed: true };
  }
}
