import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { CodeBlock } from '../components/ui/CodeBlock';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from '../components/ui/styles';
import { apiGet, apiPost } from '../lib/api';
import { formatDateTime } from '../lib/format';
import {
  getAvailableTaskActions,
  getTaskActionHint,
  labelForExecutionStatus,
  labelForTaskStatus,
  toneForExecutionStatus,
  toneForTaskStatus,
} from '../lib/task-ui';

interface TaskDraft {
  taskId: string;
  projectKey: string;
  intent: string;
  status: string;
  constraints: string[];
  acceptanceCriteria: string[];
  createdAt: string;
  updatedAt: string;
  sourceText: string;
}

interface PromptDraftSummaryView {
  goal: string;
  scope: string[];
  constraints: string[];
  acceptanceCriteria: string[];
}

interface ExecutionSummary {
  status: 'not_started' | 'running' | 'done' | 'failed' | string;
  note: string;
  summary?: string;
  testResult?: string;
  changedFiles?: string[];
  logs?: string[];
  lastUpdatedAt: string | null;
}

interface TaskStatusSnapshot {
  taskId: string;
  projectKey: string;
  status: string;
  latestPromptDraftSummary: PromptDraftSummaryView | null;
  nextStageHint: string;
  executionSummary: ExecutionSummary | null;
}

interface TaskDetail {
  taskDraft: TaskDraft;
  statusSnapshot: TaskStatusSnapshot;
}

interface ApproveActionResult {
  dispatchErrorMessage?: string;
  nextStageHint?: string;
}

// 任务状态时间线
interface TimelineStep {
  status: string;
  label: string;
  time?: string;
  active: boolean;
  completed: boolean;
}

function renderList(items: string[] | undefined | null): JSX.Element {
  if (!items || items.length === 0) {
    return <div className="text-sm text-slate-500">-</div>;
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

// 任务状态时间线组件
function TaskTimeline({ draft, snapshot }: { draft: TaskDraft; snapshot: TaskStatusSnapshot | undefined }): JSX.Element {
  const currentStatus = snapshot?.status ?? draft.status;
  
  // 定义状态流程
  const statusFlow: { status: string; label: string }[] = [
    { status: 'drafting', label: '生成草案' },
    { status: 'pending_review', label: '待审批' },
    { status: 'pending_execution', label: '待执行' },
    { status: 'executing', label: '执行中' },
    { status: 'completed', label: '已完成' },
    { status: 'failed', label: '失败' },
    { status: 'cancelled', label: '已取消' },
  ];
  
  // 找到当前状态的位置
  const currentIndex = statusFlow.findIndex(s => s.status === currentStatus);
  
  const steps: TimelineStep[] = statusFlow.map((s, index) => {
    const isCompleted = currentIndex > index || (currentIndex === index && ['completed', 'failed', 'cancelled'].includes(currentStatus));
    const isActive = s.status === currentStatus;
    
    return {
      status: s.status,
      label: s.label,
      time: index <= currentIndex ? (index === currentIndex ? snapshot?.latestPromptDraftSummary?.goal?.slice(0, 20) : draft.updatedAt) : undefined,
      active: isActive,
      completed: isCompleted && !isActive,
    };
  }).filter(s => !['failed', 'cancelled'].includes(s.status) || s.active);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all ${
                  step.completed
                    ? 'bg-emerald-500 text-white'
                    : step.active
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {step.completed ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <div className={`mt-1 text-[10px] font-medium ${step.active ? 'text-blue-600' : 'text-slate-500'}`}>
                {step.label}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-0.5 w-8 ${step.completed ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 执行日志查看组件
function ExecutionLogs({ logs }: { logs: string[] | undefined }): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const allLogs = logs ?? [];
  const displayLogs = showAll ? allLogs : allLogs.slice(-50); // 默认显示最后 50 行
  
  const filteredLogs = searchTerm
    ? displayLogs.filter(log => log.toLowerCase().includes(searchTerm.toLowerCase()))
    : displayLogs;

  if (allLogs.length === 0) {
    return <div className="text-sm text-slate-500">暂无执行日志</div>;
  }

  return (
    <div className="space-y-2">
      {/* 搜索框 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索日志内容..."
          className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
        />
        {!showAll && allLogs.length > 50 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            显示全部 ({allLogs.length})
          </button>
        )}
        {showAll && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-xs text-slate-500 hover:underline"
          >
            收起
          </button>
        )}
      </div>
      
      {/* 日志内容 */}
      <div className="max-h-64 overflow-y-auto rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-100">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500">没有匹配的日志</div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="whitespace-pre-wrap leading-relaxed">
              {searchTerm ? (
                <>
                  {log.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) =>
                    i % 2 === 0 ? part : <mark key={i} className="bg-yellow-200 text-slate-900">{part}</mark>
                  )}
                </>
              ) : log}
            </div>
          ))
        )}
      </div>
      
      <div className="text-xs text-slate-500">
        {filteredLogs.length} / {allLogs.length} 行
        {searchTerm && ` (匹配 "${searchTerm}")`}
      </div>
    </div>
  );
}

export function TaskDetailPage(): JSX.Element {
  const params = useParams();
  const taskId = params.taskId ?? '';
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['taskDetail', taskId],
    queryFn: () => apiGet<TaskDetail>(`/tasks/${encodeURIComponent(taskId)}`),
    enabled: taskId.trim().length > 0,
  });

  const [operator, setOperator] = useState('');
  const [revisionText, setRevisionText] = useState('');
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'execution' | 'logs'>('info');

  const reviseMutation = useMutation({
    mutationFn: (input: { operator: string; revisionText: string }) =>
      apiPost<unknown, { operator: string; revisionText: string }>(`/drafts/${encodeURIComponent(taskId)}/revise`, input),
    onSuccess: () => {
      setActionHint('草案已提交修改，已生成新版本并回到待确认状态（如后端返回）。');
      setRevisionText('');
      void queryClient.invalidateQueries({ queryKey: ['taskDetail', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (input: { operator: string }) =>
      apiPost<ApproveActionResult, { operator: string }>(`/approval/${encodeURIComponent(taskId)}/approve`, input),
    onSuccess: (result) => {
      setActionHint(
        result.dispatchErrorMessage
          ? `任务已确认，但当前无法派发：${result.dispatchErrorMessage}`
          : result.nextStageHint
            ? `任务已确认。${result.nextStageHint}`
            : '草案已确认，任务已进入执行链路（如后端已派发）。',
      );
      void queryClient.invalidateQueries({ queryKey: ['taskDetail', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (input: { operator: string }) =>
      apiPost<unknown, { operator: string }>(`/approval/${encodeURIComponent(taskId)}/cancel`, input),
    onSuccess: () => {
      setActionHint('任务已取消。');
      setShowCancelConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ['taskDetail', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (input: { operator: string }) =>
      apiPost<unknown, { operator: string }>(`/tasks/${encodeURIComponent(taskId)}/retry`, input),
    onSuccess: () => {
      setActionHint('任务已重新提交执行。');
      setShowRetryConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ['taskDetail', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiPost<unknown, unknown>(`/tasks/${encodeURIComponent(taskId)}/delete`, {}),
    onSuccess: () => {
      setActionHint('任务已删除。');
      setShowDeleteConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      // 延迟跳转回列表
      setTimeout(() => {
        window.location.href = '/tasks';
      }, 1000);
    },
  });

  const isAnyActionPending = reviseMutation.isPending || approveMutation.isPending || cancelMutation.isPending || retryMutation.isPending;
  const operatorReady = operator.trim().length > 0;
  const canRevise = operatorReady && revisionText.trim().length > 0;

  const detail = detailQuery.data;
  const snapshot = detail?.statusSnapshot;
  const execution = snapshot?.executionSummary;
  const availableActions = useMemo(() => getAvailableTaskActions(snapshot?.status ?? detail?.taskDraft.status ?? ''), [detail?.taskDraft.status, snapshot?.status]);
  const canReviseAction = availableActions.includes('revise');
  const canApproveAction = availableActions.includes('approve');
  const canCancelAction = availableActions.includes('cancel');
  const canRetryAction = snapshot?.status === 'failed';
  const canDeleteAction = ['completed', 'failed', 'cancelled'].includes(snapshot?.status ?? '');
  const actionHintText = getTaskActionHint(snapshot?.status ?? detail?.taskDraft.status ?? '');

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

  const promptSummary = snapshot?.latestPromptDraftSummary;
  const promptSummaryBlock = useMemo(() => {
    if (!promptSummary) {
      return <div className="text-sm text-slate-500">暂无提示草案摘要</div>;
    }

    return (
      <div className="space-y-3">
        <div>
          <div className="text-xs text-slate-500">目标</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{promptSummary.goal}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">范围</div>
          {renderList(promptSummary.scope)}
        </div>
        <div>
          <div className="text-xs text-slate-500">约束</div>
          {renderList(promptSummary.constraints)}
        </div>
        <div>
          <div className="text-xs text-slate-500">验收标准</div>
          {renderList(promptSummary.acceptanceCriteria)}
        </div>
      </div>
    );
  }, [promptSummary]);

  return (
    <section className="space-y-4">
      <PageHeader
        title="任务详情"
        description={
          <>
            <span className="block text-sm">
              <Link className="text-sky-700 hover:underline" to="/tasks">
                返回任务列表
              </Link>
            </span>
            <span className="block text-sm text-slate-600">ID：{taskId || '-'}</span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => detailQuery.refetch()}
            className={primaryButtonClassName}
            disabled={detailQuery.isFetching}
          >
            {detailQuery.isFetching ? '刷新中…' : '手动刷新'}
          </button>
        }
      />

      {detailQuery.isLoading ? <InfoNotice message="加载任务详情…" /> : null}
      {detailQuery.error ? (
        <ErrorNotice message={detailQuery.error instanceof Error ? detailQuery.error.message : '未知错误'} />
      ) : null}

      {actionHint ? <InfoNotice title="操作结果" message={actionHint} /> : null}

      {detail ? (
        <div className="space-y-4">
          {/* 状态时间线 */}
          <Card compact title="任务进度">
            <TaskTimeline draft={detail.taskDraft} snapshot={snapshot} />
          </Card>

          {/* 标签页切换 */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'info'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              基本信息
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('execution')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'execution'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              执行详情
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              执行日志 {execution?.logs?.length ? `(${execution.logs.length})` : ''}
            </button>
          </div>

          {/* 基本信息 */}
          {activeTab === 'info' && (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card
                  compact
                  title="任务信息"
                  actions={snapshot ? <Badge tone={toneForTaskStatus(snapshot.status)}>{labelForTaskStatus(snapshot.status)}</Badge> : undefined}
                >
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500">意图</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">{detail.taskDraft.intent}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">projectKey</dt>
                      <dd className="mt-1 font-mono text-xs text-slate-800">{detail.taskDraft.projectKey}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">状态</dt>
                      <dd className="mt-1">
                        <Badge tone={toneForTaskStatus(detail.taskDraft.status)}>{labelForTaskStatus(detail.taskDraft.status)}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">创建时间</dt>
                      <dd className="mt-1 text-sm text-slate-700">{formatDateTime(detail.taskDraft.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">更新时间</dt>
                      <dd className="mt-1 text-sm text-slate-700">{formatDateTime(detail.taskDraft.updatedAt)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500">下一步提示</dt>
                      <dd className="mt-1 text-sm text-slate-700">{snapshot?.nextStageHint ?? '-'}</dd>
                    </div>
                  </dl>
                </Card>

                <Card compact title="Prompt 摘要">
                  {promptSummaryBlock}
                </Card>
              </div>

              <Card compact title="操作">
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{actionHintText}</div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-500">操作者（operator）</label>
                      <input
                        value={operator}
                        onChange={(e) => {
                          setActionHint(null);
                          setOperator(e.target.value);
                        }}
                        className={inputClassName}
                        placeholder="例如：admin"
                      />
                      <div className="mt-1 text-xs text-slate-500">用于审计记录，不做复杂校验。</div>
                    </div>
                    {canReviseAction ? (
                      <div>
                        <label className="text-xs text-slate-500">修改草案（revisionText）</label>
                        <textarea
                          value={revisionText}
                          onChange={(e) => {
                            setActionHint(null);
                            setRevisionText(e.target.value);
                          }}
                          className="mt-1 h-24 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                          placeholder="例如：缩小范围、补充约束、调整验收标准…"
                        />
                      </div>
                    ) : null}
                  </div>

                  {availableActions.length > 0 || canRetryAction || canDeleteAction ? (
                    <div className="flex flex-wrap gap-2">
                      {canReviseAction ? (
                        <button
                          type="button"
                          disabled={!canRevise || isAnyActionPending}
                          onClick={() => {
                            setActionHint(null);
                            reviseMutation.mutate({ operator: operator.trim(), revisionText });
                          }}
                          className={secondaryButtonClassName}
                        >
                          修改草案
                        </button>
                      ) : null}
                      {canApproveAction ? (
                        <button
                          type="button"
                          disabled={!operatorReady || isAnyActionPending}
                          onClick={() => {
                            setActionHint(null);
                            approveMutation.mutate({ operator: operator.trim() });
                          }}
                          className={primaryButtonClassName}
                        >
                          确认派发
                        </button>
                      ) : null}
                      {canRetryAction ? (
                        <button
                          type="button"
                          disabled={!operatorReady || isAnyActionPending}
                          onClick={() => {
                            setActionHint(null);
                            setShowRetryConfirm(true);
                          }}
                          className={`${primaryButtonClassName} bg-amber-600 hover:bg-amber-500`}
                        >
                          重新执行
                        </button>
                      ) : null}
                      {canCancelAction ? (
                        <button
                          type="button"
                          disabled={!operatorReady || isAnyActionPending}
                          onClick={() => {
                            setActionHint(null);
                            setShowCancelConfirm(true);
                          }}
                          className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          取消任务
                        </button>
                      ) : null}
                      {canDeleteAction ? (
                        <button
                          type="button"
                          disabled={isAnyActionPending}
                          onClick={() => {
                            setActionHint(null);
                            setShowDeleteConfirm(true);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          删除任务
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">当前状态没有可执行操作。</div>
                  )}

                  {(reviseMutation.error || approveMutation.error || cancelMutation.error) ? (
                    <ErrorNotice
                      message={
                        (reviseMutation.error ?? approveMutation.error ?? cancelMutation.error) instanceof Error
                          ? ((reviseMutation.error ?? approveMutation.error ?? cancelMutation.error) as Error).message
                          : '未知错误'
                      }
                    />
                  ) : null}
                </div>
              </Card>

              <Card compact title="sourceText（只读）">
                <CodeBlock>{detail.taskDraft.sourceText || '-'}</CodeBlock>
              </Card>
            </>
          )}

          {/* 执行详情 */}
          {activeTab === 'execution' && (
            <Card compact title="执行详情">
              {execution ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Badge tone={toneForExecutionStatus(execution.status)}>{labelForExecutionStatus(execution.status)}</Badge>
                    <span className="text-sm text-slate-700">{execution.note}</span>
                    <span className="ml-auto text-xs text-slate-500">最后更新：{formatDateTime(execution.lastUpdatedAt)}</span>
                  </div>

                  {execution.summary && (
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-xs font-medium text-slate-500">执行摘要</div>
                      <div className="mt-1 text-sm text-slate-800">{execution.summary}</div>
                    </div>
                  )}

                  {execution.testResult && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="text-xs font-medium text-emerald-700">测试结果</div>
                      <div className="mt-1 text-sm text-emerald-800">{execution.testResult}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-slate-500">变更文件</div>
                      <div className="mt-1">
                        {execution.changedFiles && execution.changedFiles.length > 0 ? (
                          <div className="max-h-40 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                            {execution.changedFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-2 py-1 text-xs font-mono text-slate-700">
                                <span className="text-emerald-500">+</span>
                                <span>{file}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">暂无变更文件</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">日志摘要</div>
                      <div className="mt-1">
                        <CodeBlock>{execution.logs && execution.logs.length > 0 ? execution.logs.slice(-10).join('\n') : '暂无日志'}</CodeBlock>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">暂无执行摘要</div>
              )}
            </Card>
          )}

          {/* 执行日志 */}
          {activeTab === 'logs' && (
            <Card compact title="执行日志">
              <ExecutionLogs logs={execution?.logs} />
            </Card>
          )}
        </div>
      ) : null}

      {/* 取消任务确认 */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          cancelMutation.mutate({ operator: operator.trim() });
        }}
        title="确认取消任务"
        message={`确定要取消任务 ${taskId} 吗？此操作不可撤销。`}
        confirmLabel="确认取消"
        cancelLabel="返回"
        danger
      />

      {/* 重新执行确认 */}
      <ConfirmDialog
        isOpen={showRetryConfirm}
        onClose={() => setShowRetryConfirm(false)}
        onConfirm={() => {
          retryMutation.mutate({ operator: operator.trim() });
        }}
        title="确认重新执行"
        message={`确定要重新执行任务 ${taskId} 吗？`}
        confirmLabel="确认重试"
        cancelLabel="返回"
      />

      {/* 删除任务确认 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteMutation.mutate();
        }}
        title="确认删除任务"
        message={`确定要删除任务 ${taskId} 吗？此操作不可撤销。`}
        confirmLabel="确认删除"
        cancelLabel="返回"
        danger
      />
    </section>
  );
}
