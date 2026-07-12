/**
 * 代码质量分析服务
 */

import type {
  CodeQualityMetrics,
  AnalysisConfig,
} from './analysis.types';

/**
 * 代码质量分析服务
 * 分析代码库的规模、结构、质量指标
 */
export class CodeQualityAnalyzer {
  private readonly config: Required<AnalysisConfig>;

  constructor(config: AnalysisConfig = {}) {
    this.config = {
      enableCodeQuality: config.enableCodeQuality ?? true,
      enableCoverage: config.enableCoverage ?? false,
      enableRiskAssessment: config.enableRiskAssessment ?? false,
      enableSuggestions: config.enableSuggestions ?? false,
      riskThreshold: config.riskThreshold ?? 70,
      largeFileThreshold: config.largeFileThreshold ?? 500,
    };
  }

  /**
   * 分析代码质量
   * @param files 代码文件列表，每个文件包含路径和内容
   * @returns 代码质量指标
   */
  async analyze(files: Array<{ path: string; content: string }>): Promise<CodeQualityMetrics> {
    if (files.length === 0) {
      return this.createEmptyMetrics();
    }

    // 计算语言分布
    const languageBreakdown = this.calculateLanguageBreakdown(files);

    // 计算总行数和文件统计
    let totalLines = 0;
    let totalCodeLines = 0;
    let totalCommentLines = 0;
    let totalBlankLines = 0;
    let maxLines = 0;
    let maxFilePath = '';

    const fileSizes: number[] = [];

    for (const file of files) {
      const lines = this.splitLines(file.content);
      const fileLineCount = lines.length;
      totalLines += fileLineCount;
      fileSizes.push(fileLineCount);

      if (fileLineCount > maxLines) {
        maxLines = fileLineCount;
        maxFilePath = file.path;
      }

      // 统计各类行
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '') {
          totalBlankLines++;
        } else if (this.isCommentLine(trimmed)) {
          totalCommentLines++;
        } else {
          totalCodeLines++;
        }
      }
    }

    // 计算平均文件大小
    const avgFileSize = Math.round(totalLines / files.length);

    return {
      linesOfCode: totalCodeLines,
      fileCount: files.length,
      languageBreakdown,
      avgFileSize,
      maxFileSize: maxLines,
      maxFilePath,
      commentRatio: totalLines > 0 ? Math.round((totalCommentLines / totalLines) * 100) : 0,
      blankLineRatio: totalLines > 0 ? Math.round((totalBlankLines / totalLines) * 100) : 0,
    };
  }

  /**
   * 根据代码质量指标生成建议
   * @param metrics 代码质量指标
   * @returns 优化建议列表
   */
  generateSuggestions(metrics: CodeQualityMetrics): Array<{
    id: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    relatedFiles?: string[];
    expectedBenefit?: string;
  }> {
    const suggestions: Array<{
      id: string;
      category: string;
      severity: string;
      title: string;
      description: string;
      relatedFiles?: string[];
      expectedBenefit?: string;
    }> = [];

    // 检查大文件
    if (metrics.maxFileSize > this.config.largeFileThreshold) {
      suggestions.push({
        id: 'cq-large-file',
        category: 'maintainability',
        severity: 'medium',
        title: `大文件检测: ${metrics.maxFilePath}`,
        description: `文件 ${metrics.maxFilePath} 包含 ${metrics.maxFileSize} 行代码，建议拆分为更小的模块。`,
        relatedFiles: [metrics.maxFilePath],
        expectedBenefit: '提高代码可读性和可维护性',
      });
    }

    // 检查注释比例
    if (metrics.commentRatio < 5) {
      suggestions.push({
        id: 'cq-low-comments',
        category: 'documentation',
        severity: 'low',
        title: '代码注释较少',
        description: `代码注释比例为 ${metrics.commentRatio}%，建议增加必要的代码注释以提高可读性。`,
        expectedBenefit: '提高代码可读性和团队协作效率',
      });
    }

    // 检查平均文件大小
    if (metrics.avgFileSize > 200) {
      suggestions.push({
        id: 'cq-large-avg-file',
        category: 'maintainability',
        severity: 'low',
        title: '平均文件较大',
        description: `平均文件大小为 ${metrics.avgFileSize} 行，建议将较大的文件拆分为更小的模块。`,
        expectedBenefit: '提高代码组织性和可测试性',
      });
    }

    return suggestions;
  }

  /**
   * 计算语言分布
   */
  private calculateLanguageBreakdown(files: Array<{ path: string; content: string }>): Record<string, number> {
    const breakdown: Record<string, number> = {};
    const extensionMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.c': 'C',
      '.cpp': 'C++',
      '.cs': 'C#',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
    };

    for (const file of files) {
      const ext = this.getFileExtension(file.path);
      const language = extensionMap[ext] || 'Other';
      breakdown[language] = (breakdown[language] || 0) + 1;
    }

    return breakdown;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1) {
      return '';
    }
    return filePath.substring(lastDot);
  }

  /**
   * 分割文本为行
   */
  private splitLines(content: string): string[] {
    return content.split(/\r?\n/);
  }

  /**
   * 判断是否为注释行
   */
  private isCommentLine(line: string): boolean {
    // 单行注释
    if (line.startsWith('//') || line.startsWith('#')) {
      return true;
    }
    // 块注释开始/结束行
    if (line.startsWith('/*') || line.startsWith('*') || line.trim().startsWith('*/')) {
      return true;
    }
    // HTML/SVG 注释
    if (line.startsWith('<!--') || line.trim().startsWith('-->')) {
      return true;
    }
    return false;
  }

  /**
   * 创建空的代码质量指标
   */
  private createEmptyMetrics(): CodeQualityMetrics {
    return {
      linesOfCode: 0,
      fileCount: 0,
      languageBreakdown: {},
      avgFileSize: 0,
      maxFileSize: 0,
      maxFilePath: '',
      commentRatio: 0,
      blankLineRatio: 0,
    };
  }
}
