#!/usr/bin/env node
/**
 * 文档一致性检查脚本
 * 用途：检查文档中的链接是否有效，文档与代码是否同步
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

function logInfo(msg) {
  console.log(`${BLUE}[信息]${NC} ${msg}`);
}

function logSuccess(msg) {
  console.log(`${GREEN}[通过]${NC} ${msg}`);
}

function logWarn(msg) {
  console.log(`${YELLOW}[警告]${NC} ${msg}`);
}

function logError(msg) {
  console.log(`${RED}[失败]${NC} ${msg}`);
}

let passCount = 0;
let warnCount = 0;
let failCount = 0;

/**
 * 检查 docs 目录下的所有 markdown 文件
 */
function checkDocsLinks() {
  logInfo('检查文档链接...');
  
  const docsDir = path.join(__dirname, '..', 'docs');
  const mdFiles = getFiles(docsDir, '.md');
  
  logInfo(`找到 ${mdFiles.length} 个 Markdown 文档`);
  
  for (const file of mdFiles) {
    checkFileLinks(file);
  }
}

/**
 * 递归获取目录下的所有指定后缀文件
 */
function getFiles(dir, ext) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // 跳过 archive 目录
    if (entry.isDirectory() && entry.name === 'archive') {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * 检查单个文件中的链接
 */
function checkFileLinks(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // 检查相对链接 [text](./path) 或 [text](path)
  const linkRegex = /\[([^\]]+)\]\(\.\.?\/([^)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const linkText = match[1];
    const linkTarget = match[2];
    
    // 跳过锚点链接
    if (linkTarget.startsWith('#')) {
      continue;
    }
    
    // 解析相对路径
    const linkDir = path.dirname(filePath);
    const resolvedPath = path.resolve(linkDir, linkTarget);
    
    if (!fs.existsSync(resolvedPath)) {
      logWarn(`${relativePath}: 链接目标不存在 "${linkText}" -> ${linkTarget}`);
      warnCount++;
    }
  }
}

/**
 * 检查关键文档是否存在
 */
function checkEssentialDocs() {
  logInfo('检查关键文档存在性...');
  
  const essentialDocs = [
    'docs/architecture.md',
    'docs/manifest.md',
    'docs/cli.md',
    'docs/quick-start.md',
    'docs/roadmap/README.md',
  ];
  
  for (const doc of essentialDocs) {
    const fullPath = path.join(__dirname, '..', doc);
    if (fs.existsSync(fullPath)) {
      logSuccess(`关键文档存在: ${doc}`);
      passCount++;
    } else {
      logError(`关键文档缺失: ${doc}`);
      failCount++;
    }
  }
}

/**
 * 检查版本号一致性
 */
function checkVersionConsistency() {
  logInfo('检查版本号一致性...');
  
  const rootPkg = require('../package.json');
  const version = rootPkg.version;
  
  const packages = [
    'packages/cli/package.json',
    'packages/controller/package.json',
    'packages/shared/package.json',
    'packages/web/package.json',
    'packages/worker/package.json',
    'packages/templates/package.json',
    'packages/desktop/package.json',
  ];
  
  for (const pkg of packages) {
    const fullPath = path.join(__dirname, '..', pkg);
    if (fs.existsSync(fullPath)) {
      const pkgJson = require(fullPath);
      if (pkgJson.version === version) {
        passCount++;
      } else {
        logError(`版本不一致: ${pkg} 是 ${pkgJson.version}，根目录是 ${version}`);
        failCount++;
      }
    }
  }
}

/**
 * 检查 README.md 是否有基本内容
 */
function checkReadme() {
  logInfo('检查 README.md 内容...');
  
  const readmePath = path.join(__dirname, '..', 'README.md');
  
  if (!fs.existsSync(readmePath)) {
    logError('README.md 不存在');
    failCount++;
    return;
  }
  
  const content = fs.readFileSync(readmePath, 'utf-8');
  const minLength = 500;
  
  if (content.length >= minLength) {
    logSuccess(`README.md 内容充足 (${content.length} 字符)`);
    passCount++;
  } else {
    logWarn(`README.md 内容较少 (${content.length} 字符)，建议补充`);
    warnCount++;
  }
  
  // 检查是否包含关键章节
  const sections = [
    { pattern: /clawkit/i, name: '项目名称' },
    { pattern: /install|安装/i, name: '安装说明' },
    { pattern: /quick.?start|快速开始/i, name: '快速开始' },
    { pattern: /usage|使用/i, name: '使用说明' },
  ];
  
  for (const section of sections) {
    if (section.pattern.test(content)) {
      passCount++;
    } else {
      logWarn(`README.md 缺少 "${section.name}" 相关内容`);
      warnCount++;
    }
  }
}

/**
 * 主函数
 */
function main() {
  console.log('');
  console.log(`${GREEN}========================================${NC}`);
  console.log(`${GREEN}clawkit 文档一致性检查${NC}`);
  console.log(`${GREEN}========================================${NC}`);
  console.log('');
  
  try {
    checkEssentialDocs();
    console.log('');
    checkVersionConsistency();
    console.log('');
    checkReadme();
    console.log('');
    checkDocsLinks();
    
    console.log('');
    console.log(`${GREEN}========================================${NC}`);
    console.log(`${GREEN}检查结果摘要${NC}`);
    console.log(`${GREEN}========================================${NC}`);
    console.log('');
    
    console.log(`${GREEN}通过：${NC}${passCount} 项`);
    console.log(`${YELLOW}警告：${NC}${warnCount} 项`);
    console.log(`${RED}失败：${NC}${failCount} 项`);
    console.log('');
    
    if (failCount > 0) {
      logError('文档一致性检查失败');
      process.exit(1);
    } else if (warnCount > 0) {
      logWarn('文档一致性检查存在警告');
      process.exit(0);
    } else {
      logSuccess('文档一致性检查全部通过！');
      process.exit(0);
    }
  } catch (error) {
    logError(`检查过程中出错：${error.message}`);
    process.exit(1);
  }
}

main();
