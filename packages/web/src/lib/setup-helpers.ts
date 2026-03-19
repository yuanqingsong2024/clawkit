/**
 * Setup 向导页面的状态辅助函数
 * 提取纯函数逻辑，便于测试和复用
 */

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface SetupStepData {
  stepKey: string;
  title: string;
  status: StepStatus;
  errorMessage: string | null;
}

/**
 * 将步骤状态映射为显示文本
 */
export function mapStepStatusToText(status: StepStatus): string {
  const statusMap: Record<StepStatus, string> = {
    pending: '待执行',
    running: '执行中',
    success: '已完成',
    failed: '失败',
    skipped: '已跳过',
  };
  return statusMap[status];
}

/**
 * 将步骤状态映射为 Badge 色调
 */
export function mapStepStatusToTone(status: StepStatus): 'success' | 'failed' | 'info' | 'warning' | 'neutral' {
  const toneMap: Record<StepStatus, 'success' | 'failed' | 'info' | 'warning' | 'neutral'> = {
    pending: 'neutral',
    running: 'info',
    success: 'success',
    failed: 'failed',
    skipped: 'neutral',
  };
  return toneMap[status];
}

/**
 * 计算当前活跃步骤的索引
 */
export function findCurrentStepIndex(steps: SetupStepData[]): number {
  const runningIndex = steps.findIndex((step) => step.status === 'running');
  if (runningIndex !== -1) {
    return runningIndex;
  }

  const failedIndex = steps.findIndex((step) => step.status === 'failed');
  if (failedIndex !== -1) {
    return failedIndex;
  }

  const lastSuccessIndex = steps.reduce((lastIndex, step, index) => {
    return step.status === 'success' ? index : lastIndex;
  }, -1);

  return lastSuccessIndex !== -1 ? lastSuccessIndex : 0;
}

/**
 * 计算已完成步骤数量
 */
export function countCompletedSteps(steps: SetupStepData[]): number {
  return steps.filter((step) => step.status === 'success').length;
}

/**
 * 计算进度百分比
 */
export function calculateProgress(steps: SetupStepData[]): number {
  if (steps.length === 0) {
    return 0;
  }

  const completed = countCompletedSteps(steps);
  const currentIndex = findCurrentStepIndex(steps);
  const currentStep = steps[currentIndex];

  // 如果当前步骤正在运行，算作 50% 完成
  const currentProgress = currentStep?.status === 'running' ? 0.5 : 0;

  return Math.round(((completed + currentProgress) / steps.length) * 100);
}

/**
 * 判断步骤是否应该展开详情
 */
export function shouldExpandStep(step: SetupStepData, currentIndex: number, stepIndex: number): boolean {
  // 失败的步骤自动展开
  if (step.status === 'failed') {
    return true;
  }

  // 当前正在执行的步骤展开
  if (step.status === 'running') {
    return true;
  }

  // 当前聚焦的步骤展开
  if (stepIndex === currentIndex) {
    return true;
  }

  return false;
}

/**
 * 获取步骤的视觉状态（用于进度条渲染）
 */
export function getStepVisualState(step: SetupStepData): 'completed' | 'current' | 'upcoming' | 'failed' | 'skipped' {
  if (step.status === 'success') {
    return 'completed';
  }
  if (step.status === 'running') {
    return 'current';
  }
  if (step.status === 'failed') {
    return 'failed';
  }
  if (step.status === 'skipped') {
    return 'skipped';
  }
  return 'upcoming';
}

/**
 * 映射步骤 key 到友好的中文标题
 */
export function mapStepKeyToTitle(stepKey: string, fallbackTitle: string): string {
  const titleMap: Record<string, string> = {
    generate_manifest: '生成部署配置',
    doctor: '检查运行环境',
    plan: '预览部署变更',
    apply: '写入部署文件',
    check_controller: '检查控制服务',
    check_worker: '检查执行节点',
    check_opencode: '检查 OpenCode 服务',
    check_openclaw: '检查 OpenClaw 配置',
    smoke_test: '执行连通性验证',
    finalize_summary: '汇总执行结果',
  };
  return titleMap[stepKey] ?? fallbackTitle;
}
