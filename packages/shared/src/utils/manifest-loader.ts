/**
 * Manifest 加载器
 * 支持自动识别简化配置和完整配置
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ManifestSchema } from '../schema/manifest';
import {
  SimpleManifestSchema,
  EditableSimpleManifestSchema,
  convertSimpleToFullManifest,
} from '../schema/manifest-simple';
import type { Manifest } from '../types/manifest';
import type { EditableSimpleManifest, SimpleManifest } from '../schema/manifest-simple';

/**
 * 加载 manifest 配置
 * 自动识别简化配置和完整配置
 */
export function loadManifest(filePath: string): Manifest {
  // 读取文件
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawData = yaml.load(content);

  // 尝试解析为简化配置
  const simpleResult = SimpleManifestSchema.safeParse(rawData);
  if (simpleResult.success) {
    console.log('检测到简化配置，自动转换为完整配置');
    return convertSimpleToFullManifest(simpleResult.data);
  }

  // 尝试解析为完整配置
  const fullResult = ManifestSchema.safeParse(rawData);
  if (fullResult.success) {
    console.log('检测到完整配置');
    return fullResult.data;
  }

  // 两种格式都不匹配，抛出错误
  const errors: string[] = [];
  
  if (simpleResult.error) {
    errors.push('简化配置格式错误：');
    simpleResult.error.issues.forEach((err) => {
      errors.push(`  - ${err.path.join('.')}: ${err.message}`);
    });
  }
  
  if (fullResult.error) {
    errors.push('完整配置格式错误：');
    fullResult.error.issues.forEach((err) => {
      errors.push(`  - ${err.path.join('.')}: ${err.message}`);
    });
  }

  throw new Error(`配置文件格式错误：\n${errors.join('\n')}`);
}

/**
 * 加载可编辑的简化 manifest 配置
 * 允许项目列表为空，便于项目管理页面保存中间态。
 */
export function loadEditableSimpleManifest(filePath: string): EditableSimpleManifest {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawData = yaml.load(content);
  const result = EditableSimpleManifestSchema.safeParse(rawData);

  if (result.success) {
    return result.data;
  }

  throw new Error(`配置文件格式错误：${result.error.message}`);
}

/**
 * 检测配置类型
 */
export function detectManifestType(filePath: string): 'simple' | 'full' | 'unknown' {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rawData = yaml.load(content);

    const simpleResult = SimpleManifestSchema.safeParse(rawData);
    if (simpleResult.success) {
      return 'simple';
    }

    const fullResult = ManifestSchema.safeParse(rawData);
    if (fullResult.success) {
      return 'full';
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * 验证简化配置
 */
export function validateSimpleManifest(data: unknown): { 
  valid: boolean; 
  errors?: string[]; 
  data?: SimpleManifest 
} {
  const result = SimpleManifestSchema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.issues.map((err) => {
    return `${err.path.join('.')}: ${err.message}`;
  });

  return { valid: false, errors };
}

/**
 * 验证可编辑的简化配置
 */
export function validateEditableSimpleManifest(data: unknown): {
  valid: boolean;
  errors?: string[];
  data?: EditableSimpleManifest;
} {
  const result = EditableSimpleManifestSchema.safeParse(data);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.issues.map((err) => {
    return `${err.path.join('.')}: ${err.message}`;
  });

  return { valid: false, errors };
}

/**
 * 验证完整配置
 */
export function validateFullManifest(data: unknown): { 
  valid: boolean; 
  errors?: string[]; 
  data?: Manifest 
} {
  const result = ManifestSchema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.issues.map((err) => {
    return `${err.path.join('.')}: ${err.message}`;
  });

  return { valid: false, errors };
}
