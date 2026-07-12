/**
 * 风险评估服务
 */

import {
  type RiskAssessment,
  type RiskFactor,
  type RiskLevel,
  type CodeQualityMetrics,
  type TestCoverageMetrics,
  type AnalysisConfig,
  RiskLevel as RiskLevelEnum,
} from './analysis.types';

/**
 * 风险评估服务
 * 评估代码变更的风险级别
 */
export class RiskAssessor {
  private readonly config: Required<AnalysisConfig>;

  constructor(config: AnalysisConfig = {}) {
    this.config = {
      enableCodeQuality: config.enableCodeQuality ?? false,
      enableCoverage: config.enableCoverage ?? false,
      enableRiskAssessment: config.enableRiskAssessment ?? true,
      enableSuggestions: config.enableSuggestions ?? false,
      riskThreshold: config.riskThreshold ?? 70,
      largeFileThreshold: config.largeFileThreshold ?? 500,
    };
  }

  /**
   * 评估代码变更风险
   * @param codeQuality 代码质量指标
   * @param testCoverage 测试覆盖率指标
   * @param additionalFactors 额外的风险因素
   * @returns 风险评估结果
   */
  async assess(
    codeQuality?: CodeQualityMetrics,
    testCoverage?: TestCoverageMetrics,
    additionalFactors: RiskFactor[] = [],
  ): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];

    // 评估代码质量风险
    if (codeQuality) {
      riskFactors.push(...this.assessCodeQuality(codeQuality));
    }

    // 评估测试覆盖率风险
    if (testCoverage) {
      riskFactors.push(...this.assessTestCoverage(testCoverage));
    }

    // 添加额外的风险因素
    riskFactors.push(...additionalFactors);

    // 计算总体风险
    const { overallRisk, riskScore } = this.calculateOverallRisk(riskFactors);

    return {
      overallRisk,
      riskScore,
      riskFactors,
      explanation: this.generateExplanation(riskFactors, overallRisk, riskScore),
    };
  }

  /**
   * 评估代码质量相关的风险因素
   */
  private assessCodeQuality(quality: CodeQualityMetrics): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // 大文件风险
    if (quality.maxFileSize > this.config.largeFileThreshold) {
      factors.push({
        name: 'large-file',
        level: RiskLevelEnum.MEDIUM,
        score: 15,
        description: `存在超大文件 ${quality.maxFilePath}（${quality.maxFileSize} 行），增加维护难度和出错风险`,
        relatedFiles: [quality.maxFilePath],
      });
    }

    // 文件平均大小风险
    if (quality.avgFileSize > 300) {
      factors.push({
        name: 'large-avg-file',
        level: RiskLevelEnum.LOW,
        score: 10,
        description: `平均文件大小较大（${quality.avgFileSize} 行），可能需要重构`,
      });
    }

    // 注释不足风险
    if (quality.commentRatio < 3) {
      factors.push({
        name: 'low-comments',
        level: RiskLevelEnum.LOW,
        score: 5,
        description: `代码注释比例较低（${quality.commentRatio}%），可能影响代码可读性`,
      });
    }

    // 大量文件风险
    if (quality.fileCount > 100) {
      factors.push({
        name: 'many-files',
        level: RiskLevelEnum.LOW,
        score: 5,
        description: `项目包含大量文件（${quality.fileCount} 个），增加理解成本`,
      });
    }

    return factors;
  }

  /**
   * 评估测试覆盖率相关的风险因素
   */
  private assessTestCoverage(coverage: TestCoverageMetrics): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // 低覆盖率风险
    if (coverage.lineCoverage < 50) {
      factors.push({
        name: 'very-low-coverage',
        level: RiskLevelEnum.CRITICAL,
        score: 30,
        description: `代码覆盖率极低（${coverage.lineCoverage}%），存在严重的回归风险`,
      });
    } else if (coverage.lineCoverage < 70) {
      factors.push({
        name: 'low-coverage',
        level: RiskLevelEnum.HIGH,
        score: 20,
        description: `代码覆盖率偏低（${coverage.lineCoverage}%），建议增加测试`,
      });
    } else if (coverage.lineCoverage < 80) {
      factors.push({
        name: 'moderate-coverage',
        level: RiskLevelEnum.MEDIUM,
        score: 10,
        description: `代码覆盖率一般（${coverage.lineCoverage}%），可进一步提升`,
      });
    }

    // 低分支覆盖率风险
    if (coverage.branchCoverage < 50) {
      factors.push({
        name: 'low-branch-coverage',
        level: RiskLevelEnum.HIGH,
        score: 15,
        description: `分支覆盖率较低（${coverage.branchCoverage}%），部分代码路径未经测试`,
      });
    }

    // 失败测试风险
    if (coverage.failedTests > 0) {
      factors.push({
        name: 'failed-tests',
        level: RiskLevelEnum.CRITICAL,
        score: 35,
        description: `存在 ${coverage.failedTests} 个失败的测试用例，必须修复后才能部署`,
      });
    }

    // 未覆盖文件风险
    if (coverage.totalFiles > 0 && coverage.coveredFiles < coverage.totalFiles) {
      const uncoveredRatio = ((coverage.totalFiles - coverage.coveredFiles) / coverage.totalFiles) * 100;
      if (uncoveredRatio > 50) {
        factors.push({
          name: 'many-uncovered-files',
          level: RiskLevelEnum.HIGH,
          score: 15,
          description: `${Math.round(uncoveredRatio)}% 的文件未被测试覆盖`,
        });
      }
    }

    return factors;
  }

  /**
   * 计算总体风险级别和分数
   */
  private calculateOverallRisk(factors: RiskFactor[]): { overallRisk: RiskLevel; riskScore: number } {
    if (factors.length === 0) {
      return { overallRisk: RiskLevelEnum.LOW, riskScore: 0 };
    }

    // 计算总风险分数
    const riskScore = factors.reduce((sum, factor) => sum + factor.score, 0);

    // 限制最高分数为 100
    const cappedScore = Math.min(riskScore, 100);

    // 确定风险级别
    let overallRisk: RiskLevel;
    if (cappedScore >= 80) {
      overallRisk = RiskLevelEnum.CRITICAL;
    } else if (cappedScore >= 60) {
      overallRisk = RiskLevelEnum.HIGH;
    } else if (cappedScore >= 40) {
      overallRisk = RiskLevelEnum.MEDIUM;
    } else {
      overallRisk = RiskLevelEnum.LOW;
    }

    return { overallRisk, riskScore: cappedScore };
  }

  /**
   * 生成风险说明
   */
  private generateExplanation(factors: RiskFactor[], overallRisk: RiskLevel, riskScore: number): string {
    if (factors.length === 0) {
      return '未检测到明显的风险因素，代码变更风险较低。';
    }

    const sortedFactors = [...factors].sort((a, b) => b.score - a.score);
    const topFactors = sortedFactors.slice(0, 3);

    const riskLevelText: Record<RiskLevel, string> = {
      [RiskLevelEnum.LOW]: '低',
      [RiskLevelEnum.MEDIUM]: '中等',
      [RiskLevelEnum.HIGH]: '高',
      [RiskLevelEnum.CRITICAL]: '严重',
    };

    let explanation = `风险级别：${riskLevelText[overallRisk]}（分数：${riskScore}）\n`;
    explanation += '主要风险因素：\n';

    for (const factor of topFactors) {
      explanation += `- ${factor.description}\n`;
    }

    if (factors.length > 3) {
      explanation += `及其他 ${factors.length - 3} 项次要风险因素。\n`;
    }

    if (overallRisk === RiskLevelEnum.CRITICAL) {
      explanation += '\n⚠️ 建议：当前风险级别为严重，建议推迟部署，先解决上述问题。';
    } else if (overallRisk === RiskLevelEnum.HIGH) {
      explanation += '\n⚠️ 建议：当前风险级别较高，建议在部署前解决关键风险因素。';
    } else if (overallRisk === RiskLevelEnum.MEDIUM) {
      explanation += '\n💡 建议：当前风险级别中等，建议关注并逐步解决上述问题。';
    } else {
      explanation += '\n✅ 建议：风险可控，可以继续部署。';
    }

    return explanation;
  }

  /**
   * 根据风险评估结果生成建议
   */
  generateSuggestions(assessment: RiskAssessment): Array<{
    id: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    expectedBenefit?: string;
  }> {
    const suggestions: Array<{
      id: string;
      category: string;
      severity: string;
      title: string;
      description: string;
      expectedBenefit?: string;
    }> = [];

    // 根据风险级别生成建议
    if (assessment.overallRisk === RiskLevelEnum.CRITICAL) {
      suggestions.push({
        id: 'risk-critical-action',
        category: 'risk-mitigation',
        severity: 'critical',
        title: '严重风险：阻止部署',
        description: '检测到严重风险因素，建议立即解决后再进行部署。',
        expectedBenefit: '避免将存在严重问题的代码部署到生产环境',
      });
    } else if (assessment.overallRisk === RiskLevelEnum.HIGH) {
      suggestions.push({
        id: 'risk-high-action',
        category: 'risk-mitigation',
        severity: 'high',
        title: '高风险：谨慎部署',
        description: '检测到多个风险因素，建议优先解决后再进行部署。',
        expectedBenefit: '降低部署风险，减少生产环境问题',
      });
    }

    // 根据具体风险因素生成建议
    for (const factor of assessment.riskFactors) {
      if (factor.score >= 20) {
        suggestions.push({
          id: `risk-${factor.name}`,
          category: 'risk-mitigation',
          severity: factor.level === RiskLevelEnum.CRITICAL ? 'critical' : 'high',
          title: `风险因素：${factor.name}`,
          description: factor.description,
          expectedBenefit: '降低该风险因素的影响',
        });
      }
    }

    return suggestions;
  }
}
