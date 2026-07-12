import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
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
      return `${compactButtonClassName} bg-rose-600 px-2.5 text-[11px] text-white hover:bg-rose-500`;
    case 'revise':
    default:
      return `${compactButtonClassName} border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 hover:bg-slate-50`;
  }
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
    <section className="space-y-4">
      {/* 顶部标题和操作 */}
      <PageHeader
        title="任务中心"
        description={pagination ? `共 ${pagination.total} 个任务` : '任务列表与筛选'}
        actions={
          <>
            {/* 视图切换 */}
            <div className="flex rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'card'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              } rounded-l-lg`}
            >
              卡片
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              } rounded-r-lg border-l border-slate-200`}
            >
              表格
            </button>
            </div>
            <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className={`${primaryButtonClassName} bg-sky-700 hover:bg-sky-800`.trim()}
          >
            创建任务
          </button>
            <button
            type="button"
            onClick={() => tasksQuery.refetch()}
            className={primaryButtonClassName}
            disabled={tasksQuery.isFetching}
          >
            {tasksQuery.isFetching ? '刷新中…' : '刷新'}
          </button>
          </>
        }
      />

      {/* 筛选条件 */}
      <Card
        compact
        title="筛选"
        actions={
          <button
            type="button"
            onClick={() => {
              setStatusFilter('');
              setProjectFilter('');
              setPage(1);
            }}
            disabled={!statusFilter && !projectFilter}
            className={`${secondaryButtonClassName} h-8 px-2.5 py-1 text-xs`}
          >
            清除
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs text-slate-500">状态</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={selectClassName}
            >
              <option value="">全部</option>
              <option value="DRAFT">草稿</option>
              <option value="WAITING_APPROVAL">等待审批</option>
              <option value="APPROVED">已确认</option>
              <option value="DISPATCHED">已派发</option>
              <option value="RUNNING">运行中</option>
              <option value="DONE">完成</option>
              <option value="FAILED">失败</option>
              <option value="CANCELLED">已取消</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-slate-500">项目</label>
            <input
              type="text"
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              placeholder="输入项目 key"
              className={inputClassName}
            />
          </div>
        </div>
      </Card>

      {tasksQuery.isLoading ? <InfoNotice message="正在加载任务列表…" /> : null}
      {actionHint ? <InfoNotice title="操作结果" message={actionHint} /> : null}
      {tasksQuery.error ? (
        <ErrorNotice message={tasksQuery.error instanceof Error ? tasksQuery.error.message : '未知错误'} />
      ) : null}

      {/* 任务列表 - 卡片模式 */}
      {viewMode === 'card' && data?.tasks && data.tasks.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
                      <div className="mb-0.5 text-right text-[10px] font-medium uppercase tracking-wide text-slate-400">操作</div>
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
             <div className="overflow-auto">
             <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="py-1.5 pr-3 font-medium">任务 ID</th>
                  <th className="py-1.5 pr-3 font-medium">项目</th>
                  <th className="py-1.5 pr-3 font-medium">意图</th>
                  <th className="py-1.5 pr-3 font-medium">下一步</th>
                  <th className="py-1.5 pr-3 font-medium">优先级</th>
                  <th className="py-1.5 pr-3 font-medium">状态</th>
                  <th className="py-1.5 pr-3 font-medium">更新时间</th>
                  <th className="py-1.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.tasks.length > 0 ? (
                  data.tasks.map((task) => (
                    <tr key={task.taskId}>
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        <Link className="text-sky-700 hover:underline" to={`/tasks/${task.taskId}`}>
                          {task.taskId}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-xs text-slate-800">{task.projectKey}</td>
                      <td className="py-1.5 pr-3 text-slate-800 max-w-xs truncate">{task.intent}</td>
                      <td className="py-1.5 pr-3 max-w-xs">
                        <div className={getNextStageClassName(task.status)}>{formatNextStageHint(task.status, task.nextStageHint)}</div>
                      </td>
                      <td className="py-1.5 pr-3">
                        <Badge tone={toneForPriority(task.priority)} className="text-xs">
                          {labelForPriority(task.priority)}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-3">
                        <Badge tone={toneForTaskStatus(task.status)} className="text-xs">
                          {labelForTaskStatus(task.status)}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-3 text-slate-700">{formatDateTime(task.updatedAt)}</td>
                      <td className="py-1.5 align-top">
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
            <p className="text-sm text-slate-600">{actionDialogMessage}</p>
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
              <button type="button" onClick={submitAction} className={primaryButtonClassName} disabled={!canSubmitAction}>
                {actionMutation.isPending ? '提交中…' : '确认'}
              </button>
            </div>

            {actionTarget ? <div className="text-xs text-slate-500">当前任务状态：{labelForTaskStatus(actionTarget.status)}</div> : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
