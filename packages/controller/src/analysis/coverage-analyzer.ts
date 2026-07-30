/**
 * 测试覆盖率分析服务
 */

import type {
  TestCoverageMetrics,
  AnalysisConfig,
} from './analysis.types';
import { createLogger } from '@clawkit/shared';

const logger = createLogger('controller.analysis.coverage');

/**
 * 测试覆盖率分析服务
 * 解析测试覆盖率报告并生成指标
 */
export class CoverageAnalyzer {
  private readonly config: Required<AnalysisConfig>;

  constructor(config: AnalysisConfig = {}) {
    this.config = {
      enableCodeQuality: config.enableCodeQuality ?? false,
      enableCoverage: config.enableCoverage ?? true,
      enableRiskAssessment: config.enableRiskAssessment ?? false,
      enableSuggestions: config.enableSuggestions ?? false,
      riskThreshold: config.riskThreshold ?? 70,
      largeFileThreshold: config.largeFileThreshold ?? 500,
    };
  }

  /**
   * 从标准覆盖率报告格式解析覆盖率数据
   * 支持常见的覆盖率报告格式 (Istanbul/LCOV/Cobertura)
   * @param coverageData 覆盖率数据对象或 JSON 字符串
   * @returns 测试覆盖率指标
   */
  async parseCoverageReport(coverageData: Record<string, unknown> | string): Promise<TestCoverageMetrics> {
    let data: Record<string, unknown>;

    if (typeof coverageData === 'string') {
      try {
        data = JSON.parse(coverageData);
      } catch (error) {
        // 尝试作为 LCOV 格式解析
        logger.debug('JSON 解析失败，尝试 LCOV 格式', { error: error instanceof Error ? error.message : String(error) });
        return this.parseLcovFormat(coverageData);
      }
    } else {
      data = coverageData;
    }

    // 支持 Istanbul 格式
    if (data.total) {
      return this.parseIstanbulFormat(data.total as Record<string, unknown>);
    }

    // 支持自定义格式
    if (data.lineCoverage !== undefined || data.lines) {
      return this.parseCustomFormat(data);
    }

    return this.createEmptyMetrics();
  }

  /**
   * 从测试运行结果计算覆盖率指标
   * @param testResults 测试结果列表
   * @param coveredFiles 已覆盖的文件列表
   * @param totalFiles 总文件数
   * @returns 测试覆盖率指标
   */
  async calculateFromTestResults(
    testResults: Array<{ passed: boolean; skipped?: boolean }>,
    coveredFiles: string[],
    totalFiles: number,
  ): Promise<TestCoverageMetrics> {
    const totalTests = testResults.length;
    const passedTests = testResults.filter((t) => t.passed).length;
    const failedTests = testResults.filter((t) => !t.passed && !t.skipped).length;
    const skippedTests = testResults.filter((t) => t.skipped).length;

    // 基于测试结果估算覆盖率
    // 注意：这是一个估算，实际覆盖率需要真实的覆盖率报告
    const coverageRatio = totalTests > 0 ? passedTests / totalTests : 0;

    return {
      lineCoverage: Math.round(coverageRatio * 80), // 估算行覆盖率
      functionCoverage: Math.round(coverageRatio * 75), // 估算函数覆盖率
      branchCoverage: Math.round(coverageRatio * 70), // 估算分支覆盖率
      statementCoverage: Math.round(coverageRatio * 85), // 估算语句覆盖率
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      coveredFiles: coveredFiles.length,
      totalFiles,
    };
  }

  /**
   * 解析 Istanbul 格式的覆盖率数据
   */
  private parseIstanbulFormat(total: Record<string, unknown>): TestCoverageMetrics {
    const lines = total.lines as Record<string, unknown> | undefined;
    const functions = total.functions as Record<string, unknown> | undefined;
    const branches = total.branches as Record<string, unknown> | undefined;
    const statements = total.statements as Record<string, unknown> | undefined;

    return {
      lineCoverage: this.extractPercentage(lines?.pct),
      functionCoverage: this.extractPercentage(functions?.pct),
      branchCoverage: this.extractPercentage(branches?.pct),
      statementCoverage: this.extractPercentage(statements?.pct),
      totalTests: (total.numTests as number) || 0,
      passedTests: (total.numPassedTests as number) || 0,
      failedTests: (total.numFailedTests as number) || 0,
      skippedTests: (total.numSkippedTests as number) || 0,
      coveredFiles: (total.numBrowsers as number) || 0,
      totalFiles: (total.numTotal as number) || 0,
    };
  }

  /**
   * 解析自定义格式的覆盖率数据
   */
  private parseCustomFormat(data: Record<string, unknown>): TestCoverageMetrics {
    return {
      lineCoverage: (data.lineCoverage as number) || 0,
      functionCoverage: (data.functionCoverage as number) || 0,
      branchCoverage: (data.branchCoverage as number) || 0,
      statementCoverage: (data.statementCoverage as number) || 0,
      totalTests: (data.totalTests as number) || 0,
      passedTests: (data.passedTests as number) || 0,
      failedTests: (data.failedTests as number) || 0,
      skippedTests: (data.skippedTests as number) || 0,
      coveredFiles: (data.coveredFiles as number) || 0,
      totalFiles: (data.totalFiles as number) || 0,
    };
  }

  /**
   * 解析 LCOV 格式覆盖率数据
   */
  private parseLcovFormat(lcovData: string): TestCoverageMetrics {
    let lineCoverage = 0;
    let functionCoverage = 0;
    let branchCoverage = 0;
    let coveredLines = 0;
    let totalLines = 0;
    let coveredFunctions = 0;
    let totalFunctions = 0;
    let coveredBranches = 0;
    let totalBranches = 0;
    let coveredFiles = 0;

    const lines = lcovData.split('\n');
    let currentFile = '';

    for (const line of lines) {
      if (line.startsWith('SF:')) {
        currentFile = line.substring(3);
        coveredFiles++;
      } else if (line.startsWith('LH:')) {
        coveredLines += parseInt(line.substring(3), 10) || 0;
      } else if (line.startsWith('LF:')) {
        totalLines += parseInt(line.substring(3), 10) || 0;
      } else if (line.startsWith('FNH:')) {
        coveredFunctions += parseInt(line.substring(4), 10) || 0;
      } else if (line.startsWith('FNF:')) {
        totalFunctions += parseInt(line.substring(4), 10) || 0;
      } else if (line.startsWith('BRKH:')) {
        coveredBranches += parseInt(line.substring(5), 10) || 0;
      } else if (line.startsWith('BRKF:')) {
        totalBranches += parseInt(line.substring(5), 10) || 0;
      }
    }

    lineCoverage = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
    functionCoverage = totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 0;
    branchCoverage = totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 0;

    return {
      lineCoverage,
      functionCoverage,
      branchCoverage,
      statementCoverage: lineCoverage,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coveredFiles,
      totalFiles: coveredFiles,
    };
  }

  /**
   * 从百分比字符串或数字提取百分比值
   */
  private extractPercentage(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace('%', ''));
      return isNaN(parsed) ? 0 : Math.round(parsed);
    }
    return 0;
  }

  /**
   * 根据覆盖率指标生成建议
   */
  generateSuggestions(metrics: TestCoverageMetrics): Array<{
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

    // 检查整体覆盖率
    const avgCoverage = (metrics.lineCoverage + metrics.functionCoverage + metrics.branchCoverage) / 3;

    if (avgCoverage < 50) {
      suggestions.push({
        id: 'cov-very-low',
        category: 'testing',
        severity: 'critical',
        title: '测试覆盖率极低',
        description: `整体测试覆盖率仅为 ${Math.round(avgCoverage)}%，强烈建议增加测试用例以提高代码质量保障。`,
        expectedBenefit: '提高代码质量和减少回归错误',
      });
    } else if (avgCoverage < 70) {
      suggestions.push({
        id: 'cov-low',
        category: 'testing',
        severity: 'high',
        title: '测试覆盖率偏低',
        description: `整体测试覆盖率仅为 ${Math.round(avgCoverage)}%，建议增加测试用例覆盖更多代码路径。`,
        expectedBenefit: '提高代码质量和可维护性',
      });
    }

    // 检查行覆盖率
    if (metrics.lineCoverage < 80) {
      suggestions.push({
        id: 'cov-line-low',
        category: 'testing',
        severity: 'medium',
        title: '行覆盖率偏低',
        description: `行覆盖率为 ${metrics.lineCoverage}%，建议增加边界条件和异常处理路径的测试。`,
        expectedBenefit: '提高代码健壮性',
      });
    }

    // 检查分支覆盖率
    if (metrics.branchCoverage < 60) {
      suggestions.push({
        id: 'cov-branch-low',
        category: 'testing',
        severity: 'medium',
        title: '分支覆盖率偏低',
        description: `分支覆盖率仅为 ${metrics.branchCoverage}%，建议增加条件分支的测试用例。`,
        expectedBenefit: '确保所有代码路径都被测试',
      });
    }

    // 检查失败的测试
    if (metrics.failedTests > 0) {
      suggestions.push({
        id: 'cov-failed-tests',
        category: 'testing',
        severity: 'critical',
        title: `${metrics.failedTests} 个测试失败`,
        description: `当前有 ${metrics.failedTests} 个测试失败，请修复失败的测试用例后再进行部署。`,
        expectedBenefit: '确保代码质量符合预期',
      });
    }

    return suggestions;
  }

  /**
   * 创建空的覆盖率指标
   */
  private createEmptyMetrics(): TestCoverageMetrics {
    return {
      lineCoverage: 0,
      functionCoverage: 0,
      branchCoverage: 0,
      statementCoverage: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coveredFiles: 0,
      totalFiles: 0,
    };
  }
}
