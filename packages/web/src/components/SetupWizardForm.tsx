import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stepper, type StepperStepData } from '../ui/Stepper';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { InfoNotice, WarningNotice } from '../ui/Notice';
import { inputClassName, primaryButtonClassName } from '../ui/styles';

interface SetupFormData {
  // 步骤 1: 拓扑选择
  topology: 'all-in-one' | 'hybrid' | 'split';
  
  // 步骤 2: 服务配置
  controller: {
    port: number;
    publicUrl: string;
  };
  openClaw: {
    url: string;
    webhookToken: string;
  };
  
  // 步骤 3: 项目配置
  project: {
    key: string;
    path: string;
    baseBranch: string;
    openCode: {
      port: number;
    };
  };
}

const DEFAULT_FORM_DATA: SetupFormData = {
  topology: 'all-in-one',
  controller: {
    port: 8787,
    publicUrl: 'http://127.0.0.1:8787',
  },
  openClaw: {
    url: 'http://127.0.0.1:18000',
    webhookToken: '',
  },
  project: {
    key: 'my-project',
    path: '',
    baseBranch: 'main',
    openCode: {
      port: 4096,
    },
  },
};

// 步骤定义
const STEPS: StepperStepData[] = [
  { id: 'topology', title: '拓扑选择', state: 'upcoming' },
  { id: 'services', title: '服务配置', state: 'upcoming' },
  { id: 'project', title: '项目配置', state: 'upcoming' },
  { id: 'review', title: '审查确认', state: 'upcoming' },
];

interface SetupWizardFormProps {
  onSubmit: (data: SetupFormData) => Promise<void>;
  onCancel?: () => void;
}

export function SetupWizardForm({ onSubmit, onCancel }: SetupWizardFormProps): JSX.Element {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<SetupFormData>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = STEPS.map((step, index) => ({
    ...step,
    state: index < currentStepIndex ? 'completed' as const
      : index === currentStepIndex ? 'current' as const
      : 'upcoming' as const,
  }));

  const validateStep = useCallback((stepIndex: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (stepIndex === 0) {
      // 拓扑选择验证
      if (!formData.topology) {
        newErrors.topology = '请选择部署拓扑';
      }
    }
    
    if (stepIndex === 1) {
      // 服务配置验证
      if (!formData.openClaw.url) {
        newErrors.openClawUrl = '请输入 Claude Code 地址';
      }
      if (!formData.openClaw.webhookToken) {
        newErrors.webhookToken = '请输入 Webhook Token';
      }
    }
    
    if (stepIndex === 2) {
      // 项目配置验证
      if (!formData.project.key) {
        newErrors.projectKey = '请输入项目标识';
      } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.project.key)) {
        newErrors.projectKey = '项目标识只能包含字母、数字、连字符和下划线';
      }
      if (!formData.project.path) {
        newErrors.projectPath = '请输入项目路径';
      }
      if (!formData.project.path.startsWith('/')) {
        newErrors.projectPath = '项目路径必须是绝对路径';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStepIndex)) {
      setCurrentStepIndex(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  }, [currentStepIndex, validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
    setErrors({});
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateStep(3)) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      await onSubmit(formData);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, validateStep]);

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({
      ...prev,
      openClaw: { ...prev.openClaw, webhookToken: token },
    }));
  };

  return (
    <div className="space-y-6">
      {/* 分步导航 */}
      <Stepper 
        steps={steps} 
        currentStepIndex={currentStepIndex} 
        orientation="horizontal" 
        stepIdPrefix="setup"
      />
      
      {/* 错误提示 */}
      {submitError && (
        <WarningNotice 
          compact 
          title="提交失败" 
          message={submitError} 
        />
      )}
      
      {/* 步骤内容 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* 步骤 1: 拓扑选择 */}
          {currentStepIndex === 0 && (
            <Card compact title="步骤 1: 选择部署拓扑">
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  选择最适合您的部署模式。三种拓扑支持不同的架构需求。
                </p>
                
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { 
                      key: 'all-in-one', 
                      title: 'All-in-One',
                      desc: '所有组件部署在同一台机器。适合快速验证和本地开发。',
                      tags: ['简单', '本地开发']
                    },
                    { 
                      key: 'hybrid', 
                      title: 'Hybrid',
                      desc: 'Claude Code 在云端，Worker 在本地。适合安全隔离场景。',
                      tags: ['推荐', '云端隔离']
                    },
                    { 
                      key: 'split', 
                      title: 'Split',
                      desc: '各组件可独立部署到不同机器。适合生产环境。',
                      tags: ['生产', '高可用']
                    },
                  ].map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, topology: option.key as SetupFormData['topology'] })}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        formData.topology === option.key 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900">{option.title}</h4>
                          <p className="mt-1 text-sm text-slate-600">{option.desc}</p>
                        </div>
                        {formData.topology === option.key && (
                          <Badge tone="success">已选择</Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {option.tags.map(tag => (
                          <Badge key={tag} tone="neutral" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
                
                {errors.topology && (
                  <p className="text-sm text-red-600">{errors.topology}</p>
                )}
              </div>
            </Card>
          )}
          
          {/* 步骤 2: 服务配置 */}
          {currentStepIndex === 1 && (
            <Card compact title="步骤 2: 配置服务连接">
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  配置 Controller 和 Claude Code 的连接信息。
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Controller 地址
                    </label>
                    <input
                      type="text"
                      value={formData.controller.publicUrl}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        controller: { ...prev.controller, publicUrl: e.target.value }
                      })}
                      placeholder="http://127.0.0.1:8787"
                      className={inputClassName}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Controller 服务地址，用于接收任务和状态查询
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Claude Code 地址
                    </label>
                    <input
                      type="text"
                      value={formData.openClaw.url}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        openClaw: { ...prev.openClaw, url: e.target.value }
                      })}
                      placeholder="http://127.0.0.1:18000"
                      className={inputClassName}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Webhook Token
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={formData.openClaw.webhookToken}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          openClaw: { ...prev.openClaw, webhookToken: e.target.value }
                        })}
                        placeholder="输入 token 或点击生成"
                        className={`${inputClassName} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={generateToken}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm hover:bg-slate-100"
                      >
                        生成
                      </button>
                    </div>
                    {errors.webhookToken && (
                      <p className="mt-1 text-sm text-red-600">{errors.webhookToken}</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
          
          {/* 步骤 3: 项目配置 */}
          {currentStepIndex === 2 && (
            <Card compact title="步骤 3: 配置项目信息">
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  配置要管理的代码仓库信息。
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      项目标识
                    </label>
                    <input
                      type="text"
                      value={formData.project.key}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        project: { ...prev.project, key: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }
                      })}
                      placeholder="my-project"
                      className={inputClassName}
                    />
                    {errors.projectKey ? (
                      <p className="mt-1 text-sm text-red-600">{errors.projectKey}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        唯一标识，用于关联任务和配置。只允许小写字母、数字、连字符和下划线。
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      仓库路径
                    </label>
                    <input
                      type="text"
                      value={formData.project.path}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        project: { ...prev.project, path: e.target.value }
                      })}
                      placeholder="/path/to/your/project"
                      className={inputClassName}
                    />
                    {errors.projectPath ? (
                      <p className="mt-1 text-sm text-red-600">{errors.projectPath}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        代码仓库的本地绝对路径
                      </p>
                    )}
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">
                        基础分支
                      </label>
                      <input
                        type="text"
                        value={formData.project.baseBranch}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          project: { ...prev.project, baseBranch: e.target.value }
                        })}
                        placeholder="main"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">
                        OpenCode 端口
                      </label>
                      <input
                        type="number"
                        value={formData.project.openCode.port}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          project: { 
                            ...prev.project, 
                            openCode: { port: parseInt(e.target.value) || 4096 }
                          }
                        })}
                        placeholder="4096"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
          
          {/* 步骤 4: 审查确认 */}
          {currentStepIndex === 3 && (
            <Card compact title="步骤 4: 审查配置">
              <div className="space-y-4">
                <InfoNotice 
                  compact
                  title="配置摘要"
                  message="请确认以下配置正确无误"
                />
                
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">部署拓扑</span>
                      <div className="font-medium text-slate-900 capitalize">{formData.topology.replace('-', ' ')}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Controller 地址</span>
                      <div className="font-mono text-slate-900">{formData.controller.publicUrl}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Claude Code 地址</span>
                      <div className="font-mono text-slate-900">{formData.openClaw.url}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">项目标识</span>
                      <div className="font-medium text-slate-900">{formData.project.key}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">仓库路径</span>
                      <div className="font-mono text-slate-900 break-all">{formData.project.path}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">基础分支</span>
                      <div className="font-medium text-slate-900">{formData.project.baseBranch}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">OpenCode 端口</span>
                      <div className="font-mono text-slate-900">{formData.project.openCode.port}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* 导航按钮 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一步
        </button>
        
        {currentStepIndex < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? '提交中...' : '确认配置'}
          </button>
        )}
      </div>
    </div>
  );
}
