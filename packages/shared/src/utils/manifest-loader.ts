/**
 * Manifest 加载器
 * 支持自动识别简化配置和完整配置
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ManifestSchema } from '../schema/manifest';
import { ManifestV2Schema } from '../schema/manifest-v2';
import {
  SimpleManifestSchema,
  EditableSimpleManifestSchema,
  convertSimpleToFullManifest,
} from '../schema/manifest-simple';
import type { Manifest } from '../types/manifest';
import type { EditableSimpleManifest, SimpleManifest } from '../schema/manifest-simple';

function resolveManifestPath(value: string | undefined, manifestDir: string): string | undefined {
  if (!value || value.startsWith('~') || value.startsWith('/')) return value;
  return require('node:path').resolve(manifestDir, value);
}

function validateV2References(data: import('../schema/manifest-v2').ManifestV2): void {
  const nodes = new Set(Object.keys(data.nodes));
  const executors = data.executors;
  const executorNames = new Set(Object.keys(executors));
  for (const [name, executor] of Object.entries(executors)) {
    if (!nodes.has(executor.node)) throw new Error(`V2 执行器 ${name} 引用了未定义的节点：${executor.node}`);
  }
  for (const worker of data.workers) {
    if (!nodes.has(worker.node)) throw new Error(`V2 Worker ${worker.id} 引用了未定义的节点：${worker.node}`);
    if (worker.executorRef && !executorNames.has(worker.executorRef)) {
      throw new Error(`V2 Worker ${worker.id} 引用了未定义的执行器：${worker.executorRef}`);
    }
    for (const project of worker.projects) {
      if (project.executor?.executorRef && !executorNames.has(project.executor.executorRef)) {
        throw new Error(`V2 项目 ${project.key} 引用了未定义的执行器：${project.executor.executorRef}`);
      }
    }
  }
}

function normalizeV2Manifest(data: import('../schema/manifest-v2').ManifestV2, manifestDir: string): Manifest {
  validateV2References(data);
  const executors = data.executors;
  const workers = data.workers.map((worker) => ({
    ...worker,
    projects: worker.projects.map((project) => {
      const override = project.executor;
      const instance = override?.executorRef ? executors[override.executorRef] : undefined;
      const config = override?.config ?? {};
      const port = typeof config.port === 'number' ? config.port : instance?.port;
      return {
        ...project,
        repoPath: resolveManifestPath(project.repoPath, manifestDir) ?? project.repoPath,
        openCode: {
          port: port ?? 4096,
          agent: typeof config.agent === 'string' ? config.agent : instance?.agent ?? 'build',
          mode: typeof config.mode === 'string' ? config.mode : instance?.mode ?? 'default',
        },
      };
    }),
  }));
  return {
    ...data,
    workers,
    services: data.services as Manifest['services'],
    runtime: data.runtime as Manifest['runtime'],
  } as unknown as Manifest;
}

/**
 * 加载 manifest 配置
 * 自动识别简化配置和完整配置
 */
export function loadManifest(filePath: string): Manifest {
  // 读取文件
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawData = yaml.load(content);

  // V2 使用显式 executors/triggers 字段，必须优先识别，避免被旧 schema 丢弃。
  const v2Result = ManifestV2Schema.safeParse(rawData);
  if (v2Result.success) {
    return normalizeV2Manifest(v2Result.data, require('node:path').dirname(require('node:path').resolve(filePath)));
  }

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
export function detectManifestType(filePath: string): 'simple' | 'full' | 'v2' | 'unknown' {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rawData = yaml.load(content);

    const v2Result = ManifestV2Schema.safeParse(rawData);
    if (v2Result.success) {
      return 'v2';
    }

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
