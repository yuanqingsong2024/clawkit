import type { DoctorReport } from '@clawkit/shared';
/**
 * DoctorServiceImpl
 * 实现最小诊断检查：
 * 1. manifest 文件是否存在
 * 2. manifest 是否通过 schema 校验
 * 3. Node.js 版本是否满足要求
 * 4. pnpm 是否可用
 * 5. repoPath 是否存在
 * 6. 端口字段是否为有效数字
 * 7. SSH 节点字段结构是否完整
 */
export declare class DoctorServiceImpl {
    /** Node.js 最低版本要求 */
    private readonly minNodeVersion;
    /**
     * 执行完整诊断
     * @param manifestPath manifest 文件路径
     * @returns 诊断报告
     */
    diagnose(manifestPath: string): Promise<DoctorReport>;
    /**
     * 检查 manifest 文件是否存在
     */
    private checkFileExists;
    /**
     * 读取、解析并校验 manifest
     */
    private parseAndValidate;
    /**
     * 检查 Node.js 版本
     */
    private checkNodeVersion;
    /**
     * 检查 pnpm 是否可用
     */
    private checkPnpm;
    /**
     * 检查所有 worker 项目的 repoPath 是否存在
     */
    private checkRepoPaths;
    /**
     * 检查端口字段是否为有效数字
     * Schema 已经做了基本的类型校验，这里做额外的业务级检查（如端口冲突）
     */
    private checkPorts;
    /**
     * 检查 SSH 节点字段结构是否完整
     */
    private checkSshNodes;
    /**
     * 生成跳过的检查结果
     */
    private skipCheck;
    /**
     * 构建诊断报告
     */
    private buildReport;
    /**
     * 比较两个语义化版本号
     * 返回: >0 表示 a > b, <0 表示 a < b, 0 表示相等
     */
    private compareVersions;
}
//# sourceMappingURL=doctor.service.d.ts.map