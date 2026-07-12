const assert = require('node:assert/strict');
const {
  UserService,
  UserRole,
  UserStatus,
  Permission,
  ROLE_PERMISSIONS,
} = require('../dist/services/user.service');

// 测试用户服务
async function runUserServiceTests() {
  console.log('\n📋 测试用户服务...');

  const service = new UserService();

  // 测试创建用户
  const user = service.create({
    username: 'testuser',
    email: 'test@example.com',
    displayName: '测试用户',
    role: UserRole.OPERATOR,
    password: 'password123',
  });

  assert.ok(user.id, '用户应有 ID');
  assert.equal(user.username, 'testuser', '用户名应正确');
  assert.equal(user.email, 'test@example.com', '邮箱应正确');
  assert.equal(user.role, UserRole.OPERATOR, '角色应正确');
  assert.equal(user.status, UserStatus.PENDING, '新用户应为待激活状态');
  assert.ok(!user.passwordHash, '返回的用户不应包含密码哈希');
  assert.ok(!user.salt, '返回的用户不应包含盐');

  console.log('✓ 创建用户功能正常');

  // 测试获取用户
  const fetched = service.getById(user.id);
  assert.ok(fetched, '应能获取用户');
  assert.equal(fetched.username, 'testuser', '用户名应正确');

  // 测试按用户名获取
  const byUsername = service.getByUsername('testuser');
  assert.ok(byUsername, '应能按用户名获取用户');
  assert.equal(byUsername.id, user.id, '应获取相同用户');

  // 测试按邮箱获取
  const byEmail = service.getByEmail('test@example.com');
  assert.ok(byEmail, '应能按邮箱获取用户');
  assert.equal(byEmail.id, user.id, '应获取相同用户');

  console.log('✓ 查询用户功能正常');

  // 测试更新用户
  const updated = service.update(user.id, {
    displayName: '更新后的用户',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  assert.equal(updated.displayName, '更新后的用户', '显示名应更新');
  assert.equal(updated.role, UserRole.ADMIN, '角色应更新');
  assert.equal(updated.status, UserStatus.ACTIVE, '状态应更新');

  console.log('✓ 更新用户功能正常');

  // 测试认证
  const loginInfo = service.authenticate('testuser', 'password123');
  assert.ok(loginInfo, '应能登录');
  assert.equal(loginInfo.username, 'testuser', '用户名应正确');
  assert.equal(loginInfo.role, UserRole.ADMIN, '角色应正确');
  assert.ok(Array.isArray(loginInfo.permissions), '应包含权限列表');
  assert.ok(loginInfo.expiresAt instanceof Date, '过期时间应为 Date');

  // 测试错误密码
  const wrongLogin = service.authenticate('testuser', 'wrongpassword');
  assert.ok(!wrongLogin, '错误密码不应登录');

  // 测试不存在的用户
  const noUserLogin = service.authenticate('nonexistent', 'password123');
  assert.ok(!noUserLogin, '不存在的用户不应登录');

  console.log('✓ 认证功能正常');

  // 创建另一个 OPERATOR 用户用于权限测试（避免被上面的更新影响）
  const operatorUser = service.create({
    username: 'operatoruser',
    email: 'operator@example.com',
    displayName: '操作员用户',
    role: UserRole.OPERATOR,
    password: 'password123',
  });

  // 激活用户（权限检查要求用户必须是 ACTIVE 状态）
  service.activate(operatorUser.id);

  // 测试权限检查 - 使用独立的 OPERATOR 用户
  assert.ok(service.hasPermission(operatorUser.id, Permission.TASK_VIEW), 'OPERATOR 应有 TASK_VIEW 权限');
  assert.ok(service.hasPermission(operatorUser.id, Permission.TASK_APPROVE), 'OPERATOR 应有 TASK_APPROVE 权限');
  assert.ok(!service.hasPermission(operatorUser.id, Permission.USER_DELETE), 'OPERATOR 不应有 USER_DELETE 权限');
  assert.ok(!service.hasPermission(operatorUser.id, Permission.SYSTEM_MANAGE), 'OPERATOR 不应有 SYSTEM_MANAGE 权限');

  console.log('✓ 权限检查功能正常');

  // 测试权限列表 - 使用独立的 OPERATOR 用户（未被更新）
  const permissions = service.getPermissions(operatorUser.id);
  assert.ok(Array.isArray(permissions), '应返回权限数组');
  assert.ok(permissions.includes(Permission.TASK_VIEW), '应包含 TASK_VIEW');
  assert.ok(!permissions.includes(Permission.USER_DELETE), '不应包含 USER_DELETE');

  console.log('✓ 权限列表功能正常');

  // 测试批量权限检查 - 使用独立的 OPERATOR 用户
  assert.ok(service.hasAnyPermission(operatorUser.id, [Permission.TASK_VIEW, Permission.USER_DELETE]), '应返回 true（有一个权限）');
  assert.ok(!service.hasAnyPermission(operatorUser.id, [Permission.USER_DELETE, Permission.USER_CREATE]), '应返回 false（没有权限）');

  assert.ok(service.hasAllPermissions(operatorUser.id, [Permission.TASK_VIEW, Permission.TASK_APPROVE]), '应返回 true（有两个权限）');
  assert.ok(!service.hasAllPermissions(operatorUser.id, [Permission.TASK_VIEW, Permission.USER_DELETE]), '应返回 false（缺少 USER_DELETE）');

  console.log('✓ 批量权限检查功能正常');

  // 测试列表查询
  const { users, total } = service.list();
  assert.ok(total >= 1, '应有至少 1 个用户');
  assert.ok(Array.isArray(users), '应返回数组');

  const filtered = service.list({ role: UserRole.ADMIN });
  assert.ok(filtered.total >= 1, '应能按角色筛选');

  const statusFiltered = service.list({ status: UserStatus.ACTIVE });
  assert.ok(statusFiltered.total >= 1, '应能按状态筛选');

  console.log('✓ 列表查询功能正常');

  // 测试密码修改
  service.changePassword(user.id, 'password123', 'newpassword456');
  const afterChange = service.authenticate('testuser', 'newpassword456');
  assert.ok(afterChange, '新密码应能登录');
  const oldLogin = service.authenticate('testuser', 'password123');
  assert.ok(!oldLogin, '旧密码不应登录');

  console.log('✓ 密码修改功能正常');

  // 测试用户总数
  assert.ok(service.size() >= 1, '应有用户');

  console.log('✓ UserService：基础功能正常');
}

// 测试角色权限映射
async function runRolePermissionsTests() {
  console.log('\n🎯 测试角色权限映射...');

  // ADMIN 应有所有权限
  const adminPerms = ROLE_PERMISSIONS[UserRole.ADMIN];
  assert.ok(adminPerms.includes(Permission.TASK_CREATE), 'ADMIN 应有 TASK_CREATE');
  assert.ok(adminPerms.includes(Permission.USER_DELETE), 'ADMIN 应有 USER_DELETE');
  assert.ok(adminPerms.includes(Permission.SYSTEM_MANAGE), 'ADMIN 应有 SYSTEM_MANAGE');
  assert.ok(adminPerms.includes(Permission.AUDIT_VIEW), 'ADMIN 应有 AUDIT_VIEW');

  // OPERATOR 不应有管理权限
  const operatorPerms = ROLE_PERMISSIONS[UserRole.OPERATOR];
  assert.ok(operatorPerms.includes(Permission.TASK_APPROVE), 'OPERATOR 应有 TASK_APPROVE');
  assert.ok(!operatorPerms.includes(Permission.USER_DELETE), 'OPERATOR 不应有 USER_DELETE');
  assert.ok(!operatorPerms.includes(Permission.USER_CREATE), 'OPERATOR 不应有 USER_CREATE');

  // VIEWER 只有查看权限
  const viewerPerms = ROLE_PERMISSIONS[UserRole.VIEWER];
  assert.ok(viewerPerms.includes(Permission.TASK_VIEW), 'VIEWER 应有 TASK_VIEW');
  assert.ok(!viewerPerms.includes(Permission.TASK_CREATE), 'VIEWER 不应有 TASK_CREATE');
  assert.ok(!viewerPerms.includes(Permission.TASK_APPROVE), 'VIEWER 不应有 TASK_APPROVE');

  console.log('✓ 角色权限映射正确');

  // 测试枚举值
  assert.equal(UserRole.ADMIN, 'admin', 'ADMIN 应为 admin');
  assert.equal(UserRole.OPERATOR, 'operator', 'OPERATOR 应为 operator');
  assert.equal(UserRole.VIEWER, 'viewer', 'VIEWER 应为 viewer');

  assert.equal(UserStatus.ACTIVE, 'active', 'ACTIVE 应为 active');
  assert.equal(UserStatus.INACTIVE, 'inactive', 'INACTIVE 应为 inactive');
  assert.equal(UserStatus.SUSPENDED, 'suspended', 'SUSPENDED 应为 suspended');
  assert.equal(UserStatus.PENDING, 'pending', 'PENDING 应为 pending');

  console.log('✓ 枚举值正确');
}

// 测试错误处理
async function runErrorHandlingTests() {
  console.log('\n⚠️ 测试错误处理...');

  const service = new UserService();

  // 测试创建重复用户名
  service.create({
    username: 'uniqueuser',
    email: 'unique@example.com',
    displayName: '唯一用户',
    role: UserRole.VIEWER,
    password: 'password123',
  });

  try {
    service.create({
      username: 'uniqueuser', // 重复用户名
      email: 'another@example.com',
      displayName: '另一个用户',
      role: UserRole.VIEWER,
      password: 'password123',
    });
    assert.fail('应抛出重复用户名错误');
  } catch (error) {
    assert.ok(error.message.includes('用户名'), '错误信息应包含用户名');
  }

  // 测试创建重复邮箱
  try {
    service.create({
      username: 'anotheruser',
      email: 'unique@example.com', // 重复邮箱
      displayName: '另一个用户',
      role: UserRole.VIEWER,
      password: 'password123',
    });
    assert.fail('应抛出重复邮箱错误');
  } catch (error) {
    assert.ok(error.message.includes('邮箱'), '错误信息应包含邮箱');
  }

  // 测试获取不存在的用户
  const notFound = service.getById('nonexistent-id');
  assert.ok(!notFound, '不存在的用户应返回 undefined');

  // 测试更新不存在的用户
  try {
    service.update('nonexistent-id', { displayName: '测试' });
    assert.fail('应抛出用户不存在错误');
  } catch (error) {
    assert.ok(error.message.includes('不存在'), '错误信息应包含不存在');
  }

  // 测试删除不存在的用户
  try {
    service.delete('nonexistent-id');
    assert.fail('应抛出用户不存在错误');
  } catch (error) {
    assert.ok(error.message.includes('不存在'), '错误信息应包含不存在');
  }

  // 测试密码修改错误
  try {
    service.changePassword('nonexistent-id', 'old', 'new');
    assert.fail('应抛出用户不存在错误');
  } catch (error) {
    assert.ok(error.message.includes('不存在'), '错误信息应包含不存在');
  }

  // 测试错误旧密码
  const user = service.getByUsername('uniqueuser');
  assert.ok(user, '应能找到用户');
  try {
    service.changePassword(user.id, 'wrongpassword', 'newpassword');
    assert.fail('应抛出旧密码错误');
  } catch (error) {
    assert.ok(error.message.includes('原密码'), '错误信息应包含原密码');
  }

  console.log('✓ 错误处理正常');
}

// 测试激活和停用
async function runStatusManagementTests() {
  console.log('\n🔄 测试状态管理...');

  const service = new UserService();

  const user = service.create({
    username: 'statususer',
    email: 'status@example.com',
    displayName: '状态用户',
    role: UserRole.OPERATOR,
    password: 'password123',
  });

  assert.equal(user.status, UserStatus.PENDING, '新用户应为待激活状态');

  // 激活用户
  const activated = service.activate(user.id);
  assert.equal(activated.status, UserStatus.ACTIVE, '用户应被激活');

  // 验证激活后可登录
  const login = service.authenticate('statususer', 'password123');
  assert.ok(login, '激活后应能登录');

  // 停用用户
  const suspended = service.suspend(user.id);
  assert.equal(suspended.status, UserStatus.SUSPENDED, '用户应被停用');

  // 验证停用后不可登录
  const suspendedLogin = service.authenticate('statususer', 'password123');
  assert.ok(!suspendedLogin, '停用后不应能登录');

  console.log('✓ 状态管理功能正常');
}

// 运行所有测试
async function runAllUserTests() {
  console.log('\n========================================');
  console.log('用户服务单元测试');
  console.log('========================================');

  try {
    await runUserServiceTests();
    await runRolePermissionsTests();
    await runErrorHandlingTests();
    await runStatusManagementTests();

    console.log('\n========================================');
    console.log('✅ 所有用户服务测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出测试函数
module.exports = { runAllUserTests };

// 如果直接运行此文件
if (require.main === module) {
  runAllUserTests();
}
