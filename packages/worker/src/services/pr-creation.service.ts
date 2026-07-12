/**
 * 自动 PR 创建服务导出
 * 支持 GitHub PR 和 GitLab MR 自动创建
 */

export {
  AutoPrService,
  DEFAULT_AUTO_PR_OPTIONS,
  createAutoPrOptionsFromEnv,
  type AutoPrOptions,
} from './auto-pr.service';

export { GithubPrService } from './github-pr.service';

export {
  DEFAULT_PR_CONFIG,
  type GithubPrRequest,
  type GitlabMrRequest,
  parseRepoUrl,
  renderPrTemplate,
  type PrCreationConfig,
  type PrCreationInput,
  type PrCreationResult,
  type PrProvider,
  type PrTemplateVariables,
  type GitProvider,
} from './pr-creation.interface';

export { GitlabMrService } from './gitlab-mr.service';
