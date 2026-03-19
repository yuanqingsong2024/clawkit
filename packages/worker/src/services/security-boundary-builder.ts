import type { TaskExecutionBoundary } from '@clawkit/shared';

export class SecurityBoundaryBuilder {
  build(): TaskExecutionBoundary {
    return {
      allowedActions: ['查看代码', '修改代码', '运行测试', '读取文档'],
      forbiddenActions: ['git push', '自动部署生产', '删除关键目录'],
      highRiskHandling: '如遇高风险操作，必须明确报告而不是擅自执行',
    };
  }
}
