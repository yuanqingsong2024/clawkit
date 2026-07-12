/**
 * 高可用集群模块
 * 提供多实例部署支持，包括成员管理、共享状态、健康检查等能力
 */

// 导出所有公共接口和类
export { MembershipService } from './membership';
export type {
  ControllerInstance,
  InstanceStatus,
  InstanceEvent,
  MembershipConfig,
} from './membership';

export { SharedStateService } from './shared-state';
export type {
  StateChangeEvent,
  StateStorageOptions,
  StateItem,
  LockOptions,
} from './shared-state';

export { HealthCheckService } from './health-check';
export type {
  HealthCheckResult,
  HealthCheckConfig,
  SystemHealth,
  ReadinessResult,
  LivenessResult,
} from './health-check';

export { ClusterManager } from './cluster-manager';
export type {
  HighAvailabilityConfig,
  ClusterNodeEvent,
  LeaderChangeEvent,
} from './cluster-manager';
