/**
 * 优化建议生成服务
 */

import {
  type OptimizationSuggestion,
  type CodeQualityMetrics,
  type TestCoverageMetrics,
  type RiskAssessment,
  type AnalysisConfig,
  SuggestionCategory,
  SuggestionSeverity,
} from './analysis.types';

/**
 * 优化建议生成服务
 * 根据分析结果生成优化建议
 */
export class SuggestionGenerator {
  private readonly config: Required<AnalysisConfig>;
  private suggestionIdCounter = 0;

  constructor(config: AnalysisConfig = {}) {
    this.config = {
      enableCodeQuality: config.enableCodeQuality ?? false,
      enableCoverage: config.enableCoverage ?? false,
      enableRiskAssessment: config.enableRiskAssessment ?? false,
      enableSuggestions: config.enableSuggestions ?? true,
      riskThreshold: config.riskThreshold ?? 70,
      largeFileThreshold: config.largeFileThreshold ?? 500,
    };
  }

  /**
   * 生成优化建议
   * @param codeQuality 代码质量指标
   * @param testCoverage 测试覆盖率指标
   * @param riskAssessment 风险评估结果
   * @returns 优化建议列表
   */
  async generate(
    codeQuality?: CodeQualityMetrics,
    testCoverage?: TestCoverageMetrics,
    riskAssessment?: RiskAssessment,
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // 从代码质量分析生成建议
    if (codeQuality && this.config.enableCodeQuality) {
      suggestions.push(...this.generateCodeQualitySuggestions(codeQuality));
    }

    // 从测试覆盖率分析生成建议
    if (testCoverage && this.config.enableCoverage) {
      suggestions.push(...this.generateCoverageSuggestions(testCoverage));
    }

    // 从风险评估生成建议
    if (riskAssessment && this.config.enableRiskAssessment) {
      suggestions.push(...this.generateRiskSuggestions(riskAssessment));
    }

    // 生成通用优化建议
    suggestions.push(...this.generateGeneralSuggestions(codeQuality, testCoverage));

    // 按严重程度排序
    return this.sortBySeverity(suggestions);
  }

  /**
   * 从代码质量分析生成建议
   */
  private generateCodeQualitySuggestions(quality: CodeQualityMetrics): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 大文件建议
    if (quality.maxFileSize > this.config.largeFileThreshold) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.MAINTAINABILITY,
        severity: SuggestionSeverity.MEDIUM,
        title: `考虑拆分大文件: ${quality.maxFilePath}`,
        description: `文件 ${quality.maxFilePath} 包含 ${quality.maxFileSize} 行代码。建议：`,
        currentCode: `${quality.maxFilePath} (${quality.maxFileSize} lines)`,
        suggestedFix: '将文件拆分为多个模块，每个模块不超过 200 行',
        expectedBenefit: '提高代码可读性和可维护性，简化代码审查',
        relatedFiles: [quality.maxFilePath],
        estimatedEffort: '2-4 小时',
      });
    }

    // 注释建议
    if (quality.commentRatio < 5 && quality.linesOfCode > 100) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.CODE_QUALITY,
        severity: SuggestionSeverity.LOW,
        title: '增加代码注释',
        description: `代码注释比例为 ${quality.commentRatio}%，建议增加公共 API 和复杂逻辑的注释。`,
        expectedBenefit: '提高代码可读性，便于团队协作',
        estimatedEffort: '1-2 小时',
      });
    }

    // 语言分布建议
    const languages = Object.entries(quality.languageBreakdown);
    if (languages.length > 3) {
      const mainLanguages = languages
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([lang]) => lang)
        .join(', ');
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.MAINTAINABILITY,
        severity: SuggestionSeverity.INFO,
        title: '多语言项目',
        description: `项目使用 ${languages.length} 种语言，主要语言包括：${mainLanguages}。建议保持语言一致性或明确技术栈边界。`,
        expectedBenefit: '降低项目复杂度，提高开发效率',
      });
    }

    return suggestions;
  }

  /**
   * 从测试覆盖率分析生成建议
   */
  private generateCoverageSuggestions(coverage: TestCoverageMetrics): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 整体覆盖率建议
    const avgCoverage =
      (coverage.lineCoverage + coverage.functionCoverage + coverage.branchCoverage) / 3;

    if (avgCoverage < 50) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.TESTING,
        severity: SuggestionSeverity.CRITICAL,
        title: '测试覆盖率严重不足',
        description: `整体测试覆盖率仅为 ${Math.round(avgCoverage)}%，强烈建议优先建立测试基础设施。`,
        expectedBenefit: '防止回归错误，提高代码质量信心',
        estimatedEffort: '8-16 小时',
      });
    } else if (avgCoverage < 70) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.TESTING,
        severity: SuggestionSeverity.HIGH,
        title: '测试覆盖率偏低',
        description: `整体测试覆盖率仅为 ${Math.round(avgCoverage)}%，建议优先补充关键路径的测试。`,
        expectedBenefit: '减少生产环境 bug，提高代码质量',
        estimatedEffort: '4-8 小时',
      });
    } else if (avgCoverage < 85) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.TESTING,
        severity: SuggestionSeverity.MEDIUM,
        title: '测试覆盖率可进一步提升',
        description: `当前测试覆盖率为 ${Math.round(avgCoverage)}%，建议继续增加边界条件和异常处理路径的测试。`,
        expectedBenefit: '提高代码健壮性，减少边界 case 问题',
        estimatedEffort: '2-4 小时',
      });
    }

    // 分支覆盖率建议
    if (coverage.branchCoverage < 60) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.TESTING,
        severity: SuggestionSeverity.MEDIUM,
        title: '分支覆盖率不足',
        description: `分支覆盖率仅为 ${coverage.branchCoverage}%，建议增加条件分支的测试用例，确保每个分支都被执行。`,
        expectedBenefit: '确保所有代码路径都被正确测试',
        estimatedEffort: '2-4 小时',
      });
    }

    // 失败测试建议
    if (coverage.failedTests > 0) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.TESTING,
        severity: SuggestionSeverity.CRITICAL,
        title: `${coverage.failedTests} 个测试失败`,
        description: `当前有 ${coverage.failedTests} 个测试失败。建议：\n1. 检查失败的测试用例\n2. 确认是否由本次变更引入\n3. 修复或更新测试用例后再部署`,
        expectedBenefit: '确保代码质量符合预期，避免生产环境问题',
        estimatedEffort: '1-4 小时（取决于问题复杂度）',
      });
    }

    // 未覆盖文件建议
    if (coverage.totalFiles > 0) {
      const uncoveredRatio = ((coverage.totalFiles - coverage.coveredFiles) / coverage.totalFiles) * 100;
      if (uncoveredRatio > 30) {
        suggestions.push({
          id: this.nextId(),
          category: SuggestionCategory.TESTING,
          severity: SuggestionSeverity.MEDIUM,
          title: '部分文件缺少测试',
          description: `${Math.round(uncoveredRatio)}% 的文件（${coverage.totalFiles - coverage.coveredFiles}/${coverage.totalFiles}）未被测试覆盖。建议优先为核心模块添加测试。`,
          expectedBenefit: '提高测试覆盖率，减少潜在 bug',
          estimatedEffort: '4-8 小时',
        });
      }
    }

    return suggestions;
  }

  /**
   * 从风险评估生成建议
   */
  private generateRiskSuggestions(riskAssessment: RiskAssessment): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 根据风险级别生成建议
    switch (riskAssessment.overallRisk) {
      case 'critical':
        suggestions.push({
          id: this.nextId(),
          category: SuggestionCategory.MAINTAINABILITY,
          severity: SuggestionSeverity.CRITICAL,
          title: '风险级别：严重',
          description: '检测到严重风险因素，建议推迟部署。\n\n' + riskAssessment.explanation,
          expectedBenefit: '避免将存在严重问题的代码部署到生产环境',
          estimatedEffort: '根据具体风险因素而定',
        });
        break;

      case 'high':
        suggestions.push({
          id: this.nextId(),
          category: SuggestionCategory.MAINTAINABILITY,
          severity: SuggestionSeverity.HIGH,
          title: '风险级别：高',
          description: '检测到多个风险因素，建议优先解决后再部署。\n\n' + riskAssessment.explanation,
          expectedBenefit: '降低部署风险，减少生产环境问题',
          estimatedEffort: '根据具体风险因素而定',
        });
        break;

      case 'medium':
        suggestions.push({
          id: this.nextId(),
          category: SuggestionCategory.MAINTAINABILITY,
          severity: SuggestionSeverity.MEDIUM,
          title: '风险级别：中等',
          description: '检测到一些风险因素，建议关注并逐步解决。\n\n' + riskAssessment.explanation,
          expectedBenefit: '持续改进代码质量',
          estimatedEffort: '根据具体风险因素而定',
        });
        break;
    }

    // 根据具体风险因素生成建议
    for (const factor of riskAssessment.riskFactors) {
      if (factor.score >= 15) {
        suggestions.push({
          id: this.nextId(),
          category: SuggestionCategory.CODE_QUALITY,
          severity: factor.level === 'critical' ? SuggestionSeverity.CRITICAL : SuggestionSeverity.HIGH,
          title: `风险因素：${this.formatRiskName(factor.name)}`,
          description: factor.description,
          relatedFiles: factor.relatedFiles,
          expectedBenefit: '降低该风险因素的影响',
        });
      }
    }

    return suggestions;
  }

  /**
   * 生成通用优化建议
   */
  private generateGeneralSuggestions(
    codeQuality?: CodeQualityMetrics,
    testCoverage?: TestCoverageMetrics,
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 代码行数建议
    if (codeQuality && codeQuality.linesOfCode > 5000) {
      suggestions.push({
        id: this.nextId(),
        category: SuggestionCategory.PERFORMANCE,
        severity: SuggestionSeverity.INFO,
        title: '考虑模块化重构',
        description: `项目代码总行数为 ${codeQuality.linesOfCode}，建议检查是否存在职责不清的模块，考虑微服务拆分。`,
        expectedBenefit: '提高系统可扩展性和可维护性',
        estimatedEffort: '长期优化',
      });
    }

    // 测试通过率建议
    if (testCoverage && testCoverage.totalTests > 0) {
      const passRate = (testCoverage.passedTests / testCoverage.totalTests) * 100;
      if (passRate < 95 && testCoverage.failedTests === 0) {
        suggestions.push({
          id: this.nextId(),
          category: SuggestionCategory.TESTING,
          severity: SuggestionSeverity.INFO,
          title: '测试通过率优化',
          description: `测试通过率为 ${Math.round(passRate)}%（${testCoverage.skippedTests} 个跳过），建议检查跳过的测试是否必要。`,
          expectedBenefit: '提高测试有效性和代码质量',
        });
      }
    }

    return suggestions;
  }

  /**
   * 按严重程度排序建议
   */
  private sortBySeverity(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    const severityOrder: Record<SuggestionSeverity, number> = {
      [SuggestionSeverity.CRITICAL]: 0,
      [SuggestionSeverity.HIGH]: 1,
      [SuggestionSeverity.MEDIUM]: 2,
      [SuggestionSeverity.LOW]: 3,
      [SuggestionSeverity.INFO]: 4,
    };

    return [...suggestions].sort((a, b) => {
      const orderDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (orderDiff !== 0) {
        return orderDiff;
      }
      // 同一严重程度时按类别排序
      return a.category.localeCompare(b.category);
    });
  }

  /**
   * 生成下一个建议 ID
   */
  private nextId(): string {
    return `suggestion-${Date.now()}-${++this.suggestionIdCounter}`;
  }

  /**
   * 格式化风险名称
   */
  private formatRiskName(name: string): string {
    return name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
