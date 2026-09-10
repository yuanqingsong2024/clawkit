import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { FilterBar } from '../components/ui/FilterBar';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { inputClassName, primaryButtonClassName, secondaryButtonClassName, selectClassName, compactButtonClassName } from '../components/ui/styles';
import { apiGet, apiPost } from '../lib/api';
import { formatDateTime } from '../lib/format';
import {
  type TaskActionType,
  getAvailableTaskActions,
  getTaskActionHint,
  labelForTaskAction,
  labelForTaskStatus,
  toneForTaskStatus,
} from '../lib/task-ui';
import { TaskStatsCards, computeTaskStats } from '../components/tasks';

interface TaskListItem {
  taskId: string;
  projectKey: string;
  intent: string;
  status: string;
  priority: string;
  nextStageHint: string;
  updatedAt: string;
}

interface TaskListResult {
  tasks: TaskListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface PendingTaskAction {
  taskId: string;
  action: TaskActionType;
}

interface TaskActionInput {
  taskId: string;
  action: TaskActionType;
  operator: string;
  revisionText?: string;
}

interface ApproveActionResult {
  dispatchErrorMessage?: string;
  nextStageHint?: string;
}

function normalizeTaskPriority(priority: string): string {
  return priority.trim().toUpperCase();
}

function toneForPriority(priority: string): 'failed' | 'warning' | 'info' | 'neutral' {
  const normalizedPriority = normalizeTaskPriority(priority);

  if (normalizedPriority === 'URGENT') return 'failed';
  if (normalizedPriority === 'HIGH') return 'warning';
  if (normalizedPriority === 'NORMAL') return 'info';
  return 'neutral';
}

function labelForPriority(priority: string): string {
  const normalizedPriority = normalizeTaskPriority(priority);
  const labels: Record<string, string> = {
    URGENT: '紧急',
    HIGH: '高',
    NORMAL: '普通',
    LOW: '低',
  };
  return labels[normalizedPriority] || priority;
}

function getActionClassName(action: TaskActionType): string {
  switch (action) {
    case 'approve':
      return `${compactButtonClassName} bg-slate-900 px-2.5 text-[11px] text-white hover:bg-slate-800`;
    case 'cancel':
      return `${compactButtonClassName} bg-rose-600 px-2.5 text-[11px] text-white hover:bg-rose-500 font-medium`;
    case 'revise':
    default:
      return `${compactButtonClassName} border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 hover:bg-slate-50`;
  }
}

function isDangerousAction(action: TaskActionType): boolean {
  return action === 'cancel';
}

function getNextStageClassName(status: string): string {
  const normalizedStatus = status.trim().toUpperCase();

  if (normalizedStatus === 'APPROVED') {
    return 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900';
  }

  if (normalizedStatus === 'FAILED') {
    return 'rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900';
  }

  return 'rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600';
}

function formatNextStageHint(status: string, nextStageHint: string | undefined): string {
  const hint = nextStageHint?.trim() || '暂无提示';
  const normalizedStatus = status.trim().toUpperCase();

  if (normalizedStatus === 'APPROVED') {
    return `需处理：${hint}`;
  }

  if (normalizedStatus === 'FAILED') {
    return `失败后续：${hint}`;
  }

  return `下一步：${hint}`;
}

function getCompactTaskActionHint(status: string): string {
  const normalizedStatus = status.trim().toUpperCase();

  switch (normalizedStatus) {
    case 'DRAFT':
      return '仅可取消';
    case 'WAITING_APPROVAL':
      return '可修改/确认/取消';
    case 'PROMPT_GENERATED':
      return '可修改/取消';
    case 'APPROVED':
    case 'DISPATCHED':
    case 'RUNNING':
      return '仅可取消';
    case 'FAILED':
      return '可修改/取消';
    case 'DONE':
      return '无可执行操作';
    case 'CANCELLED':
      return '任务已取消';
    default:
      return '暂无操作';
  }
}

export function TasksPage(): JSX.Element {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingTaskAction | null>(null);
  const [operator, setOperator] = useState('');
  const [revisionText, setRevisionText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ['tasks', page, pageSize, statusFilter, projectFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (statusFilter) params.append('status', statusFilter);
      if (projectFilter) params.append('projectKey', projectFilter);
      return apiGet<TaskListResult>(`/tasks?${params.toString()}`);
    },
  });

  const data = tasksQuery.data;
  const pagination = data?.pagination;

  const actionTarget = useMemo(() => data?.tasks.find((task) => task.taskId === pendingAction?.taskId) ?? null, [data?.tasks, pendingAction?.taskId]);

  const actionMutation = useMutation({
    mutationFn: async (input: TaskActionInput): Promise<unknown> => {
      const operatorValue = input.operator.trim();

      switch (input.action) {
        case 'revise':
          return apiPost<unknown, { operator: string; revisionText: string }>(`/drafts/${encodeURIComponent(input.taskId)}/revise`, {
            operator: operatorValue,
            revisionText: input.revisionText?.trim() ?? '',
          });
        case 'approve':
          return apiPost<ApproveActionResult, { operator: string }>(`/approval/${encodeURIComponent(input.taskId)}/approve`, {
            operator: operatorValue,
          });
        case 'cancel':
          return apiPost<unknown, { operator: string }>(`/approval/${encodeURIComponent(input.taskId)}/cancel`, {
            operator: operatorValue,
          });
      }
    },
    onSuccess: async (result) => {
      const currentTaskId = pendingAction?.taskId;
      const currentAction = pendingAction?.action;
      const approveResult = currentAction === 'approve' ? (result as ApproveActionResult) : null;
      setPendingAction(null);
      setOperator('');
      setRevisionText('');
      setActionError(null);
      setActionHint(
        currentAction === 'revise'
          ? `任务 ${currentTaskId ?? '-'} 的草案已提交修改。`
          : currentAction === 'approve'
            ? approveResult?.dispatchErrorMessage
              ? `任务 ${currentTaskId ?? '-'} 已确认，但当前无法派发：${approveResult.dispatchErrorMessage}`
              : approveResult?.nextStageHint
                ? `任务 ${currentTaskId ?? '-'} 已确认。${approveResult.nextStageHint}`
                : `任务 ${currentTaskId ?? '-'} 已确认。`
            : currentAction === 'cancel'
              ? `任务 ${currentTaskId ?? '-'} 已取消。`
              : '操作已完成。',
      );
      await tasksQuery.refetch();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : '操作失败');
    },
  });

  const isActionBusy = actionMutation.isPending || isCreating;

  useEffect(() => {
    if (!actionHint) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionHint(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionHint]);

  const actionDialogTitle = pendingAction ? `${labelForTaskAction(pendingAction.action)} - ${pendingAction.taskId}` : '';
  const actionDialogMessage = pendingAction
    ? pendingAction.action === 'revise'
      ? '提交修改意见后，任务会回到待确认链路。'
      : pendingAction.action === 'approve'
        ? '确认后将进入审批后的后续链路。'
        : '任务取消后将不再继续流转。'
    : '';
  const canSubmitAction = Boolean(
    pendingAction &&
      operator.trim().length > 0 &&
      !isActionBusy &&
      (pendingAction.action !== 'revise' || revisionText.trim().length > 0),
  );

  const handleCreateTask = async () => {
    if (!taskText.trim()) {
      setCreateError('任务描述不能为空');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await apiPost<{ taskDraft: { taskId: string } }, { text: string }>('/tasks', { text: taskText });
      setShowCreateDialog(false);
      setTaskText('');
      await tasksQuery.refetch();
      navigate(`/tasks/${result.taskDraft.taskId}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const openActionDialog = (taskId: string, action: TaskActionType): void => {
    setPendingAction({ taskId, action });
    setOperator('');
    setRevisionText('');
    setActionError(null);
    setActionHint(null);
  };

  const closeActionDialog = (): void => {
    if (isActionBusy) {
      return;
    }

    setPendingAction(null);
    setOperator('');
    setRevisionText('');
    setActionError(null);
  };

  const submitAction = (): void => {
    if (!pendingAction) {
      return;
    }

    setActionError(null);
    actionMutation.mutate({
      taskId: pendingAction.taskId,
      action: pendingAction.action,
      operator,
      revisionText,
    });
  };

  const renderTaskActions = (task: TaskListItem): JSX.Element | null => {
    const actions = getAvailableTaskActions(task.status);
    if (actions.length === 0) {
      return <span className="text-[10px] leading-5 text-right text-slate-300">{getCompactTaskActionHint(task.status)}</span>;
    }

    return (
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <div className="flex flex-wrap justify-end gap-1.5">
          {actions.map((action) => (
            <button
              key={`${task.taskId}-${action}`}
              type="button"
              onClick={() => openActionDialog(task.taskId, action)}
              className={getActionClassName(action)}
              disabled={isActionBusy}
            >
              {labelForTaskAction(action)}
            </button>
          ))}
        </div>
        <div className="text-[10px] leading-4 text-right text-slate-300">· {getCompactTaskActionHint(task.status)}</div>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      {/* 顶部标题 */}
      <PageHeader
        title="任务中心"
        description={pagination ? `共 ${pagination.total} 个任务` : '任务列表与筛选'}
      />

      {/* 筛选栏 */}
      <FilterBar
        search={{
          placeholder: '搜索项目 key...',
          value: projectFilter,
          onChange: setProjectFilter,
        }}
        filters={[
          {
            key: 'status',
            label: '状态',
            value: statusFilter,
            options: [
              { value: 'DRAFT', label: '草稿' },
              { value: 'WAITING_APPROVAL', label: '等待审批' },
              { value: 'APPROVED', label: '已确认' },
              { value: 'DISPATCHED', label: '已派发' },
              { value: 'RUNNING', label: '运行中' },
              { value: 'DONE', label: '完成' },
              { value: 'FAILED', label: '失败' },
              { value: 'CANCELLED', label: '已取消' },
            ],
            onChange: (value) => {
              setStatusFilter(value);
              setPage(1);
            },
          },
        ]}
        actions={[
          {
            label: '创建任务',
            onClick: () => setShowCreateDialog(true),
            variant: 'primary',
          },
          {
            label: tasksQuery.isFetching ? '刷新中…' : '刷新',
            onClick: () => tasksQuery.refetch(),
            disabled: tasksQuery.isFetching,
          },
        ]}
      />

      {/* 清除筛选按钮 */}
      {(statusFilter || projectFilter) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>当前筛选：</span>
          {statusFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
              状态：{statusFilter}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setPage(1);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </span>
          )}
          {projectFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
              项目：{projectFilter}
              <button
                type="button"
                onClick={() => {
                  setProjectFilter('');
                  setPage(1);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setStatusFilter('');
              setProjectFilter('');
              setPage(1);
            }}
            className="text-sky-600 hover:underline"
          >
            清除全部
          </button>
        </div>
      )}

      {tasksQuery.isLoading ? <InfoNotice message="正在加载任务列表…" /> : null}
      {actionHint ? <InfoNotice title="操作结果" message={actionHint} /> : null}
      {tasksQuery.error ? (
        <ErrorNotice message={tasksQuery.error instanceof Error ? tasksQuery.error.message : '未知错误'} />
      ) : null}

      {/* 任务统计卡片 */}
      {data?.tasks && <TaskStatsCards stats={computeTaskStats(data.tasks)} />}

{/* 任务列表 - 卡片模式 */}
      {viewMode === 'card' && data?.tasks && data.tasks.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.tasks.map((task) => (
            <Card compact key={task.taskId} className="overflow-hidden">
              <div className="space-y-1.5">
                {/* 任务头部 */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    to={`/tasks/${task.taskId}`}
                    className="shrink-0 whitespace-nowrap font-mono text-sm text-sky-700 hover:underline"
                  >
                    {task.taskId}
                  </Link>
                  <span className="shrink-0 whitespace-nowrap font-mono text-xs text-slate-500">{task.projectKey}</span>
                  <Badge tone={toneForPriority(task.priority)} className="text-xs">
                    {labelForPriority(task.priority)}
                  </Badge>
                  <Badge tone={toneForTaskStatus(task.status)} className="text-xs">
                    {labelForTaskStatus(task.status)}
                  </Badge>
                </div>

                {/* 任务内容 */}
                <div className="space-y-2">
                  <div className="text-sm text-slate-900 line-clamp-2">{task.intent}</div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">下一步</div>
                      <div className={`${getNextStageClassName(task.status)} line-clamp-1 border-none bg-transparent px-0 py-0 text-[11px]`}>
                        {formatNextStageHint(task.status, task.nextStageHint)}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 md:min-w-[140px]">
                      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">操作</div>
                      {renderTaskActions(task)}
                    </div>
                  </div>
                </div>

                {/* 任务底部 */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[11px] leading-5 text-slate-500">
                  <span className="truncate">{formatDateTime(task.updatedAt)}</span>
                  <span className="text-slate-300">·</span>
                  <Link
                    to={`/tasks/${task.taskId}`}
                    className="shrink-0 text-sky-700 hover:underline font-medium"
                  >
                    详情 →
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* 任务列表 - 表格模式 */}
      {viewMode === 'table' && data?.tasks ? (
        <Card compact title="任务列表">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm lg:table-auto">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="py-2.5 px-3 pr-3 font-medium min-w-[100px]">任务 ID</th>
                  <th className="py-2.5 px-3 pr-3 font-medium min-w-[80px] hidden md:table-cell">项目</th>
                  <th className="py-2.5 px-3 pr-3 font-medium min-w-[150px]">意图</th>
                  <th className="py-2.5 px-3 pr-3 font-medium min-w-[120px] hidden lg:table-cell">下一步</th>
                  <th className="py-2.5 px-3 pr-3 font-medium min-w-[60px]">优先级</th>
                  <th className="py-2.5 px-3 pr-3 font-medium min-w-[70px]">状态</th>
                  <th className="py-2.5 px-3 pr-3 font-medium min-w-[120px] hidden sm:table-cell">更新时间</th>
                  <th className="py-2.5 px-3 font-medium text-right min-w-[120px]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.tasks.length > 0 ? (
                  data.tasks.map((task) => (
                    <tr key={task.taskId} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-2 px-3 pr-3 font-mono text-xs">
                        <Link className="text-sky-700 hover:underline" to={`/tasks/${task.taskId}`}>
                          {task.taskId}
                        </Link>
                      </td>
                      <td className="py-2 px-3 pr-3 font-mono text-xs text-slate-800 hidden md:table-cell">{task.projectKey}</td>
                      <td className="py-2 px-3 pr-3 text-slate-800 max-w-xs truncate" title={task.intent}>{task.intent}</td>
                      <td className="py-2 px-3 pr-3 max-w-xs hidden lg:table-cell">
                        <div className={getNextStageClassName(task.status)}>{formatNextStageHint(task.status, task.nextStageHint)}</div>
                      </td>
                      <td className="py-2 px-3 pr-3">
                        <Badge tone={toneForPriority(task.priority)} className="text-xs">
                          {labelForPriority(task.priority)}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 pr-3">
                        <Badge tone={toneForTaskStatus(task.status)} className="text-xs">
                          {labelForTaskStatus(task.status)}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 pr-3 text-slate-700 hidden sm:table-cell">{formatDateTime(task.updatedAt)}</td>
                      <td className="py-2 px-3 align-top">
                        <div className="ml-auto max-w-[220px]">{renderTaskActions(task)}</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      暂无任务
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* 空状态 */}
      {data?.tasks.length === 0 && (
        <Card compact title="暂无任务">
          <div className="text-center py-8 text-slate-500">
            {statusFilter || projectFilter ? '没有符合筛选条件的任务' : '还没有任何任务'}
          </div>
        </Card>
      )}

      {/* 分页 */}
      {pagination && pagination.totalPages > 1 && (
        <Card compact title="分页">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className={compactButtonClassName}
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
                className={compactButtonClassName}
              >
                下一页
              </button>
            </div>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showCreateDialog}
        onClose={() => {
          if (isCreating) return;
          setShowCreateDialog(false);
          setTaskText('');
          setCreateError(null);
        }}
        title="创建任务"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">输入任务描述，系统将自动生成任务草案并等待审批</p>

          {createError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
              {createError}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">任务描述</label>
            <textarea
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="例如：为用户模块添加头像上传功能"
              className="min-h-[120px] w-full resize-y rounded-lg border-slate-200 text-sm"
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateDialog(false);
                setTaskText('');
                setCreateError(null);
              }}
              disabled={isCreating}
              className={secondaryButtonClassName}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCreateTask}
              disabled={isCreating || !taskText.trim()}
              className={`${primaryButtonClassName} bg-sky-700 hover:bg-sky-800`.trim()}
            >
              {isCreating ? '创建中…' : '创建'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={pendingAction !== null} onClose={closeActionDialog} title={actionDialogTitle} size="sm">
        {pendingAction ? (
          <div className="space-y-4">
            {isDangerousAction(pendingAction.action) ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                ⚠️ 此操作不可撤销，取消后任务将不会继续派发执行。
              </div>
            ) : (
              <p className="text-sm text-slate-600">{actionDialogMessage}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">操作者（operator）</label>
                <input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className={inputClassName}
                  placeholder="例如：admin"
                  autoFocus
                />
              </div>

              {pendingAction.action === 'revise' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">修改意见</label>
                  <textarea
                    value={revisionText}
                    onChange={(e) => setRevisionText(e.target.value)}
                    className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    placeholder="例如：缩小范围、补充约束、调整验收标准…"
                  />
                </div>
              ) : null}
            </div>

            {actionError ? <ErrorNotice message={actionError} /> : null}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeActionDialog} className={secondaryButtonClassName} disabled={isActionBusy}>
                取消
              </button>
              <button
                type="button"
                onClick={submitAction}
                className={`${primaryButtonClassName} ${isDangerousAction(pendingAction.action) ? 'bg-rose-600 hover:bg-rose-500' : ''}`.trim()}
                disabled={!canSubmitAction}
              >
                {actionMutation.isPending ? '提交中…' : isDangerousAction(pendingAction.action) ? '确认取消' : '确认'}
              </button>
            </div>

            {actionTarget ? <div className="text-xs text-slate-500">当前任务状态：{labelForTaskStatus(actionTarget.status)}</div> : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
