/**
 * 执行结果分析服务单元测试
 * 测试代码质量分析、测试覆盖率分析、风险评估和优化建议生成功能
 */

const assert = require('node:assert/strict');
const {
  CodeQualityAnalyzer,
  CoverageAnalyzer,
  RiskAssessor,
  SuggestionGenerator,
  ResultAnalyzer,
  RiskLevel,
  SuggestionCategory,
  SuggestionSeverity,
} = require('../../dist/analysis');

// ========== CodeQualityAnalyzer 测试 ==========

async function runCodeQualityAnalyzerTests() {
  console.log('\n📊 测试代码质量分析器...');

  const analyzer = new CodeQualityAnalyzer({
    enableCodeQuality: true,
    largeFileThreshold: 200,
  });

  // 测试空文件列表
  let metrics = await analyzer.analyze([]);
  assert.equal(metrics.linesOfCode, 0, '空文件列表应返回零指标');
  assert.equal(metrics.fileCount, 0, '空文件列表应返回零文件数');

  // 测试单文件分析
  const singleFile = [{
    path: 'test.ts',
    content: `// 这是一个测试文件
const x = 1;
const y = 2;

// 注释行

function add(a, b) {
  return a + b;
}`,
  }];

  metrics = await analyzer.analyze(singleFile);
  assert.ok(metrics.fileCount === 1, '应分析 1 个文件');
  assert.ok(metrics.linesOfCode > 0, '应有代码行');
  assert.ok(metrics.commentRatio > 0, '应有注释比例');

  // 测试多文件分析
  const multiFile = [
    { path: 'a.ts', content: 'const a = 1;' },
    { path: 'b.ts', content: 'const b = 2;' },
    { path: 'c.ts', content: 'const c = 3;' },
  ];

  metrics = await analyzer.analyze(multiFile);
  assert.equal(metrics.fileCount, 3, '应分析 3 个文件');

  // 测试语言分布
  const mixedFiles = [
    { path: 'a.ts', content: 'const a = 1;' },
    { path: 'b.js', content: 'const b = 2;' },
    { path: 'c.py', content: 'c = 3' },
  ];

  metrics = await analyzer.analyze(mixedFiles);
  assert.ok(metrics.languageBreakdown['TypeScript'] >= 1, '应有 TypeScript 文件');
  assert.ok(metrics.languageBreakdown['JavaScript'] >= 1, '应有 JavaScript 文件');
  assert.ok(metrics.languageBreakdown['Python'] >= 1, '应有 Python 文件');

  // 测试大文件检测
  const largeFileContent = Array(250).fill('const x = 1;').join('\n');
  const largeFile = [{ path: 'large.ts', content: largeFileContent }];
  metrics = await analyzer.analyze(largeFile);
  assert.ok(metrics.maxFileSize >= 250, '大文件行数应 >= 250');

  // 测试建议生成
  const suggestions = analyzer.generateSuggestions(metrics);
  assert.ok(Array.isArray(suggestions), '应返回建议数组');
  assert.ok(suggestions.some(s => s.id === 'cq-large-file'), '应包含大文件建议');

  console.log('✓ CodeQualityAnalyzer：基础功能正常');
}

// ========== CoverageAnalyzer 测试 ==========

async function runCoverageAnalyzerTests() {
  console.log('\n🧪 测试覆盖率分析器...');

  const analyzer = new CoverageAnalyzer({
    enableCoverage: true,
  });

  // 测试空覆盖率数据
  let metrics = await analyzer.parseCoverageReport({});
  assert.equal(metrics.lineCoverage, 0, '空数据应返回零覆盖率');

  // 测试 Istanbul 格式解析
  const istanbulData = {
    total: {
      lines: { pct: 85.5 },
      functions: { pct: 90.0 },
      branches: { pct: 75.0 },
      statements: { pct: 88.0 },
      numTests: 100,
      numPassedTests: 95,
      numFailedTests: 3,
      numSkippedTests: 2,
      numBrowsers: 10,
      numTotal: 50,
    },
  };

  metrics = await analyzer.parseCoverageReport(istanbulData);
  assert.equal(metrics.lineCoverage, 85.5, '行覆盖率应为 85.5（四舍五入）');
  assert.equal(metrics.functionCoverage, 90, '函数覆盖率应为 90');
  assert.equal(metrics.branchCoverage, 75, '分支覆盖率应为 75');
  assert.equal(metrics.totalTests, 100, '总测试数应为 100');
  assert.equal(metrics.passedTests, 95, '通过测试数应为 95');
  assert.equal(metrics.failedTests, 3, '失败测试数应为 3');

  // 测试自定义格式
  const customData = {
    lineCoverage: 70,
    functionCoverage: 80,
    branchCoverage: 60,
    statementCoverage: 75,
    totalTests: 50,
    passedTests: 45,
    failedTests: 3,
    skippedTests: 2,
    coveredFiles: 20,
    totalFiles: 30,
  };

  metrics = await analyzer.parseCoverageReport(customData);
  assert.equal(metrics.lineCoverage, 70, '行覆盖率应为 70');
  assert.equal(metrics.coveredFiles, 20, '覆盖文件数应为 20');

  // 测试覆盖率报告建议
  const lowCoverageMetrics = {
    lineCoverage: 40,
    functionCoverage: 45,
    branchCoverage: 35,
    statementCoverage: 42,
    totalTests: 10,
    passedTests: 5,
    failedTests: 3,
    skippedTests: 2,
    coveredFiles: 5,
    totalFiles: 20,
  };

  const suggestions = analyzer.generateSuggestions(lowCoverageMetrics);
  assert.ok(Array.isArray(suggestions), '应返回建议数组');
  assert.ok(suggestions.some(s => s.severity === 'critical'), '应有严重级别建议');

  console.log('✓ CoverageAnalyzer：基础功能正常');
}

// ========== RiskAssessor 测试 ==========

async function runRiskAssessorTests() {
  console.log('\n⚠️ 测试风险评估器...');

  const assessor = new RiskAssessor({
    enableRiskAssessment: true,
    riskThreshold: 70,
    largeFileThreshold: 200,
  });

  // 测试空评估
  let assessment = await assessor.assess();
  assert.equal(assessment.overallRisk, RiskLevel.LOW, '空评估应为低风险');
  assert.equal(assessment.riskScore, 0, '空评估分数应为 0');

  // 测试代码质量风险评估
  const poorQuality = {
    linesOfCode: 5000,
    fileCount: 50,
    languageBreakdown: { TypeScript: 50 },
    avgFileSize: 100,
    maxFileSize: 500, // 超过阈值
    maxFilePath: 'large.ts',
    commentRatio: 1, // 注释过少
    blankLineRatio: 10,
  };

  assessment = await assessor.assess(poorQuality);
  assert.ok(assessment.riskScore > 0, '低质量代码应有风险分数');
  assert.ok(assessment.riskFactors.length > 0, '应有风险因素');

  // 测试低覆盖率风险评估
  const poorCoverage = {
    lineCoverage: 40,
    functionCoverage: 45,
    branchCoverage: 35,
    statementCoverage: 42,
    totalTests: 10,
    passedTests: 5,
    failedTests: 3,
    skippedTests: 2,
    coveredFiles: 5,
    totalFiles: 20,
  };

  assessment = await assessor.assess(undefined, poorCoverage);
  assert.ok(assessment.riskScore > 50, '低覆盖率应有高风险分数');
  assert.ok(assessment.overallRisk !== RiskLevel.LOW, '低覆盖率不应为低风险');

  // 测试失败测试用例的风险评估（与低覆盖率组合）
  const failedTestsCoverage = {
    lineCoverage: 40,
    functionCoverage: 45,
    branchCoverage: 35,
    statementCoverage: 42,
    totalTests: 100,
    passedTests: 95,
    failedTests: 5,
    skippedTests: 0,
    coveredFiles: 30,
    totalFiles: 30,
  };

  assessment = await assessor.assess(undefined, failedTestsCoverage);
  // 失败测试分数(25) + 低覆盖率分数(30-40) + 低测试数分数(15) = 可能达到 HIGH 或以上
  assert.ok(
    assessment.overallRisk === RiskLevel.HIGH || assessment.overallRisk === RiskLevel.CRITICAL,
    '低覆盖率+失败测试应为高或严重风险'
  );

  // 测试高质量代码和覆盖率
  const goodQuality = {
    linesOfCode: 1000,
    fileCount: 10,
    languageBreakdown: { TypeScript: 10 },
    avgFileSize: 100,
    maxFileSize: 150,
    maxFilePath: 'normal.ts',
    commentRatio: 15,
    blankLineRatio: 10,
  };

  const goodCoverage = {
    lineCoverage: 90,
    functionCoverage: 95,
    branchCoverage: 85,
    statementCoverage: 92,
    totalTests: 100,
    passedTests: 100,
    failedTests: 0,
    skippedTests: 0,
    coveredFiles: 30,
    totalFiles: 30,
  };

  assessment = await assessor.assess(goodQuality, goodCoverage);
  assert.equal(assessment.overallRisk, RiskLevel.LOW, '高质量代码应为低风险');

  console.log('✓ RiskAssessor：基础功能正常');
}

// ========== SuggestionGenerator 测试 ==========

async function runSuggestionGeneratorTests() {
  console.log('\n💡 测试建议生成器...');

  const generator = new SuggestionGenerator({
    enableSuggestions: true,
    enableCodeQuality: true,
    enableCoverage: true,
    enableRiskAssessment: true,
    largeFileThreshold: 200,
  });

  // 测试空建议生成
  let suggestions = await generator.generate();
  assert.ok(Array.isArray(suggestions), '应返回建议数组');

  // 测试代码质量建议生成
  const poorQuality = {
    linesOfCode: 5000,
    fileCount: 50,
    languageBreakdown: { TypeScript: 50 },
    avgFileSize: 100,
    maxFileSize: 500,
    maxFilePath: 'large.ts',
    commentRatio: 1,
    blankLineRatio: 10,
  };

  suggestions = await generator.generate(poorQuality);
  assert.ok(suggestions.length > 0, '应有建议生成');

  // 测试覆盖率建议生成
  const poorCoverage = {
    lineCoverage: 40,
    functionCoverage: 45,
    branchCoverage: 35,
    statementCoverage: 42,
    totalTests: 10,
    passedTests: 5,
    failedTests: 3,
    skippedTests: 2,
    coveredFiles: 5,
    totalFiles: 20,
  };

  suggestions = await generator.generate(undefined, poorCoverage);
  assert.ok(suggestions.some(s => s.severity === SuggestionSeverity.CRITICAL), '应有严重级别建议');

  // 测试建议按严重程度排序
  const mixedSuggestions = [
    { id: '1', severity: SuggestionSeverity.LOW, category: SuggestionCategory.CODE_QUALITY },
    { id: '2', severity: SuggestionSeverity.CRITICAL, category: SuggestionCategory.TESTING },
    { id: '3', severity: SuggestionSeverity.MEDIUM, category: SuggestionCategory.PERFORMANCE },
  ];

  // 通过生成多个建议来测试排序
  suggestions = await generator.generate(poorQuality, poorCoverage);
  if (suggestions.length >= 3) {
    // 第一个建议应该是最严重的
    const criticalIndex = suggestions.findIndex(s => s.severity === SuggestionSeverity.CRITICAL);
    const lowIndex = suggestions.findIndex(s => s.severity === SuggestionSeverity.LOW);
    assert.ok(
      criticalIndex < lowIndex || lowIndex === -1,
      '严重建议应该在低优先级建议之前'
    );
  }

  console.log('✓ SuggestionGenerator：基础功能正常');
}

// ========== ResultAnalyzer 测试 ==========

async function runResultAnalyzerTests() {
  console.log('\n🔍 测试完整分析服务...');

  const analyzer = new ResultAnalyzer({
    enableCodeQuality: true,
    enableCoverage: true,
    enableRiskAssessment: true,
    enableSuggestions: true,
    riskThreshold: 70,
  });

  // 测试完整分析流程
  const files = [
    { path: 'test.ts', content: 'const x = 1;\nfunction test() { return x; }' },
  ];

  const coverageData = {
    total: {
      lines: { pct: 80 },
      functions: { pct: 85 },
      branches: { pct: 70 },
      statements: { pct: 82 },
      numTests: 50,
      numPassedTests: 45,
      numFailedTests: 3,
      numSkippedTests: 2,
    },
  };

  const result = await analyzer.analyze(files, coverageData);

  assert.ok(result.timestamp instanceof Date, '结果应包含时间戳');
  assert.ok(result.duration >= 0, '应有分析耗时');
  assert.ok(result.codeQuality, '应包含代码质量结果');
  assert.ok(result.testCoverage, '应包含覆盖率结果');
  assert.ok(result.riskAssessment, '应包含风险评估结果');
  assert.ok(result.suggestions, '应包含建议列表');

  // 测试摘要生成
  const summary = analyzer.getSummary(result);
  assert.ok(typeof summary === 'string', '摘要应为字符串');
  assert.ok(summary.includes('代码质量'), '摘要应包含代码质量');
  assert.ok(summary.includes('测试覆盖率'), '摘要应包含测试覆盖率');

  // 测试部署允许检查 - 低风险
  const goodResult = await analyzer.analyze(files, {
    total: {
      lines: { pct: 95 },
      functions: { pct: 95 },
      branches: { pct: 90 },
      statements: { pct: 95 },
      numTests: 50,
      numPassedTests: 50,
      numFailedTests: 0,
      numSkippedTests: 0,
    },
  });

  let check = analyzer.isDeploymentAllowed(goodResult);
  assert.ok(check.allowed, '高质量结果应允许部署');

  // 测试部署允许检查 - 高风险
  const badResult = await analyzer.analyze(files, {
    total: {
      lines: { pct: 30 },
      functions: { pct: 35 },
      branches: { pct: 25 },
      statements: { pct: 32 },
      numTests: 10,
      numPassedTests: 3,
      numFailedTests: 5,
      numSkippedTests: 2,
    },
  });

  check = analyzer.isDeploymentAllowed(badResult);
  assert.ok(!check.allowed, '低质量结果不应允许部署');
  assert.ok(check.reason, '应有拒绝原因');

  console.log('✓ ResultAnalyzer：完整流程正常');
}

// ========== 运行所有测试 ==========

async function runAllTests() {
  console.log('='.repeat(50));
  console.log('开始执行结果分析服务单元测试');
  console.log('='.repeat(50));

  try {
    await runCodeQualityAnalyzerTests();
    await runCoverageAnalyzerTests();
    await runRiskAssessorTests();
    await runSuggestionGeneratorTests();
    await runResultAnalyzerTests();

    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有测试通过！');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n❌ 测试失败：', error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
