import { randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';

/**
 * 用户角色枚举
 */
export enum UserRole {
  ADMIN = 'admin',       // 管理员：所有权限
  OPERATOR = 'operator', // 操作员：审批、执行任务
  VIEWER = 'viewer',     // 查看者：仅查看
}

/**
 * 权限枚举
 */
export enum Permission {
  // 任务权限
  TASK_CREATE = 'task:create',
  TASK_VIEW = 'task:view',
  TASK_APPROVE = 'task:approve',
  TASK_REJECT = 'task:reject',
  TASK_CANCEL = 'task:cancel',
  TASK_EXECUTE = 'task:execute',
  TASK_DELETE = 'task:delete',

  // 草稿权限
  DRAFT_CREATE = 'draft:create',
  DRAFT_VIEW = 'draft:view',
  DRAFT_EDIT = 'draft:edit',
  DRAFT_DELETE = 'draft:delete',

  // Worker 权限
  WORKER_VIEW = 'worker:view',
  WORKER_ENABLE = 'worker:enable',
  WORKER_DISABLE = 'worker:disable',

  // 配置权限
  CONFIG_VIEW = 'config:view',
  CONFIG_EDIT = 'config:edit',

  // 用户管理权限
  USER_VIEW = 'user:view',
  USER_CREATE = 'user:create',
  USER_EDIT = 'user:edit',
  USER_DELETE = 'user:delete',

  // 系统权限
  SYSTEM_VIEW = 'system:view',
  SYSTEM_MANAGE = 'system:manage',
  AUDIT_VIEW = 'audit:view',
}

/**
 * 角色权限映射
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // 所有任务权限
    Permission.TASK_CREATE,
    Permission.TASK_VIEW,
    Permission.TASK_APPROVE,
    Permission.TASK_REJECT,
    Permission.TASK_CANCEL,
    Permission.TASK_EXECUTE,
    Permission.TASK_DELETE,
    // 所有草稿权限
    Permission.DRAFT_CREATE,
    Permission.DRAFT_VIEW,
    Permission.DRAFT_EDIT,
    Permission.DRAFT_DELETE,
    // 所有 Worker 权限
    Permission.WORKER_VIEW,
    Permission.WORKER_ENABLE,
    Permission.WORKER_DISABLE,
    // 所有配置权限
    Permission.CONFIG_VIEW,
    Permission.CONFIG_EDIT,
    // 所有用户管理权限
    Permission.USER_VIEW,
    Permission.USER_CREATE,
    Permission.USER_EDIT,
    Permission.USER_DELETE,
    // 所有系统权限
    Permission.SYSTEM_VIEW,
    Permission.SYSTEM_MANAGE,
    Permission.AUDIT_VIEW,
  ],
  [UserRole.OPERATOR]: [
    // 任务权限
    Permission.TASK_VIEW,
    Permission.TASK_APPROVE,
    Permission.TASK_REJECT,
    Permission.TASK_CANCEL,
    Permission.TASK_EXECUTE,
    // 草稿权限
    Permission.DRAFT_VIEW,
    // Worker 权限
    Permission.WORKER_VIEW,
    // 配置权限
    Permission.CONFIG_VIEW,
    // 系统权限
    Permission.SYSTEM_VIEW,
    Permission.AUDIT_VIEW,
  ],
  [UserRole.VIEWER]: [
    // 仅查看权限
    Permission.TASK_VIEW,
    Permission.DRAFT_VIEW,
    Permission.WORKER_VIEW,
    Permission.CONFIG_VIEW,
    Permission.SYSTEM_VIEW,
    Permission.AUDIT_VIEW,
  ],
};

/**
 * 用户状态
 */
export enum UserStatus {
  ACTIVE = 'active',       // 活跃
  INACTIVE = 'inactive',   // 非活跃
  SUSPENDED = 'suspended',  // 停用
  PENDING = 'pending',      // 待激活
}

/**
 * 用户信息
 */
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  passwordHash?: string;
  salt?: string;
  lastLoginAt?: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 用户创建输入
 */
export interface CreateUserInput {
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 用户更新输入
 */
export interface UpdateUserInput {
  email?: string;
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 用户登录信息
 */
export interface LoginInfo {
  userId: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  expiresAt: Date;
}

/**
 * 用户服务
 * 管理用户、角色、权限
 */
export class UserService {
  private readonly users: Map<string, User> = new Map();
  private readonly usernameIndex: Map<string, string> = new Map(); // username -> userId
  private readonly emailIndex: Map<string, string> = new Map(); // email -> userId

  constructor() {
    // 创建默认管理员用户（仅用于开发环境）
    if (process.env.NODE_ENV !== 'production') {
      this.createDefaultAdmin();
    }
  }

  /**
   * 创建默认管理员（开发环境）
   */
  private createDefaultAdmin(): void {
    const defaultAdmin: User = {
      id: 'admin-001',
      username: 'admin',
      email: 'admin@localhost',
      displayName: '系统管理员',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      loginCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { isDefault: true },
    };
    this.users.set(defaultAdmin.id, defaultAdmin);
    this.usernameIndex.set(defaultAdmin.username, defaultAdmin.id);
    this.emailIndex.set(defaultAdmin.email, defaultAdmin.id);
  }

  /**
   * 创建用户
   */
  create(input: CreateUserInput): User {
    // 检查用户名是否已存在
    if (this.usernameIndex.has(input.username)) {
      throw new Error(`用户名 ${input.username} 已存在`);
    }

    // 检查邮箱是否已存在
    if (this.emailIndex.has(input.email)) {
      throw new Error(`邮箱 ${input.email} 已存在`);
    }

    // 生成盐和密码哈希
    const salt = randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(input.password, salt);

    const user: User = {
      id: randomUUID(),
      username: input.username,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: UserStatus.PENDING,
      passwordHash,
      salt,
      loginCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: input.createdBy,
      metadata: input.metadata,
    };

    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
    this.emailIndex.set(user.email, user.id);

    return this.sanitize(user);
  }

  /**
   * 更新用户
   */
  update(userId: string, input: UpdateUserInput): User {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`用户不存在：${userId}`);
    }

    // 如果更新邮箱，检查是否与其他用户冲突
    if (input.email && input.email !== user.email) {
      if (this.emailIndex.has(input.email)) {
        throw new Error(`邮箱 ${input.email} 已被使用`);
      }
      this.emailIndex.delete(user.email);
      this.emailIndex.set(input.email, user.id);
    }

    // 如果更新密码，重新生成盐和哈希
    if (input.password) {
      const newSalt = randomBytes(16).toString('hex');
      user.salt = newSalt;
      user.passwordHash = this.hashPassword(input.password, newSalt);
    }

    // 更新字段
    if (input.email) user.email = input.email;
    if (input.displayName) user.displayName = input.displayName;
    if (input.role) user.role = input.role;
    if (input.status) user.status = input.status;
    if (input.metadata) user.metadata = { ...user.metadata, ...input.metadata };
    user.updatedAt = new Date();

    return this.sanitize(user);
  }

  /**
   * 删除用户
   */
  delete(userId: string): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`用户不存在：${userId}`);
    }

    // 不能删除自己
    if (user.metadata?.isDefault && user.username === 'admin') {
      throw new Error('不能删除默认管理员');
    }

    this.usernameIndex.delete(user.username);
    this.emailIndex.delete(user.email);
    this.users.delete(user.id);
  }

  /**
   * 根据 ID 获取用户
   */
  getById(userId: string): User | undefined {
    const user = this.users.get(userId);
    return user ? this.sanitize(user) : undefined;
  }

  /**
   * 根据用户名获取用户
   */
  getByUsername(username: string): User | undefined {
    const userId = this.usernameIndex.get(username);
    if (!userId) return undefined;
    return this.sanitize(this.users.get(userId)!);
  }

  /**
   * 根据邮箱获取用户
   */
  getByEmail(email: string): User | undefined {
    const userId = this.emailIndex.get(email);
    if (!userId) return undefined;
    return this.sanitize(this.users.get(userId)!);
  }

  /**
   * 获取所有用户
   */
  list(filter?: {
    role?: UserRole;
    status?: UserStatus;
    limit?: number;
    offset?: number;
  }): { users: User[]; total: number } {
    let filtered = Array.from(this.users.values());

    if (filter?.role) {
      filtered = filtered.filter((u) => u.role === filter.role);
    }

    if (filter?.status) {
      filtered = filtered.filter((u) => u.status === filter.status);
    }

    // 排序（按创建时间倒序）
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      users: paginated.map((u) => this.sanitize(u)),
      total,
    };
  }

  /**
   * 验证用户密码
   */
  verifyPassword(userId: string, password: string): boolean {
    const user = this.users.get(userId);
    if (!user || !user.salt || !user.passwordHash) {
      return false;
    }

    const hash = this.hashPassword(password, user.salt);
    return hash === user.passwordHash;
  }

  /**
   * 验证用户名密码
   */
  authenticate(username: string, password: string): LoginInfo | null {
    const userId = this.usernameIndex.get(username);
    if (!userId) return null;

    const user = this.users.get(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    if (!this.verifyPassword(userId, password)) {
      return null;
    }

    // 更新登录信息
    user.lastLoginAt = new Date();
    user.loginCount++;
    user.updatedAt = new Date();

    // 生成过期时间（24小时后）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role],
      expiresAt,
    };
  }

  /**
   * 检查用户是否具有指定权限
   */
  hasPermission(userId: string, permission: Permission): boolean {
    const user = this.users.get(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      return false;
    }

    return ROLE_PERMISSIONS[user.role].includes(permission);
  }

  /**
   * 检查用户是否具有任意指定权限
   */
  hasAnyPermission(userId: string, permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(userId, p));
  }

  /**
   * 检查用户是否具有所有指定权限
   */
  hasAllPermissions(userId: string, permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(userId, p));
  }

  /**
   * 获取用户的权限列表
   */
  getPermissions(userId: string): Permission[] {
    const user = this.users.get(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      return [];
    }

    return [...ROLE_PERMISSIONS[user.role]];
  }

  /**
   * 更改用户密码
   */
  changePassword(userId: string, oldPassword: string, newPassword: string): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`用户不存在：${userId}`);
    }

    // 验证旧密码
    if (!this.verifyPassword(userId, oldPassword)) {
      throw new Error('原密码不正确');
    }

    // 生成新的盐和密码哈希
    const newSalt = randomBytes(16).toString('hex');
    user.salt = newSalt;
    user.passwordHash = this.hashPassword(newPassword, newSalt);
    user.updatedAt = new Date();
  }

  /**
   * 重置用户密码（管理员操作）
   */
  resetPassword(userId: string, newPassword: string, resetBy: string): string {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`用户不存在：${userId}`);
    }

    // 生成新的盐和密码哈希
    const newSalt = randomBytes(16).toString('hex');
    user.salt = newSalt;
    user.passwordHash = this.hashPassword(newPassword, newSalt);
    user.updatedAt = new Date();
    user.metadata = { ...user.metadata, passwordResetBy: resetBy, passwordResetAt: new Date().toISOString() };

    return newPassword;
  }

  /**
   * 激活用户
   */
  activate(userId: string): User {
    return this.update(userId, { status: UserStatus.ACTIVE });
  }

  /**
   * 停用用户
   */
  suspend(userId: string): User {
    return this.update(userId, { status: UserStatus.SUSPENDED });
  }

  /**
   * 哈希密码（简单实现，生产环境应使用 bcrypt）
   */
  private hashPassword(password: string, salt: string): string {
    // 简单实现：实际生产应使用 bcrypt
    const crypto = require('node:crypto');
    return crypto.createHash('sha256').update(password + salt).digest('hex');
  }

  /**
   * 清理敏感信息
   */
  private sanitize(user: User): User {
    const { passwordHash, salt, ...sanitized } = user;
    return sanitized as User;
  }

  /**
   * 获取用户总数
   */
  size(): number {
    return this.users.size;
  }
}
