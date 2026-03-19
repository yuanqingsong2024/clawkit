import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { CodeBlock } from '../components/ui/CodeBlock';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { apiGet, apiPost } from '../lib/api';
import { formatDateTime } from '../lib/format';

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
      apiPost<unknown, { operator: string }>(`/approval/${encodeURIComponent(taskId)}/approve`, input),
    onSuccess: () => {
      setActionHint('草案已确认，任务已进入执行链路（如后端已派发）。');
      void queryClient.invalidateQueries({ queryKey: ['taskDetail', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (input: { operator: string }) =>
      apiPost<unknown, { operator: string }>(`/approval/${encodeURIComponent(taskId)}/cancel`, input),
    onSuccess: () => {
      setActionHint('任务已取消。');
      void queryClient.invalidateQueries({ queryKey: ['taskDetail', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const isAnyActionPending = reviseMutation.isPending || approveMutation.isPending || cancelMutation.isPending;
  const operatorReady = operator.trim().length > 0;
  const canRevise = operatorReady && revisionText.trim().length > 0;

  const detail = detailQuery.data;
  const snapshot = detail?.statusSnapshot;
  const execution = snapshot?.executionSummary;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">
            <Link className="text-sky-700 hover:underline" to="/tasks">
              返回任务列表
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold">任务详情</h1>
          <div className="mt-1 text-sm text-slate-600">taskId：{taskId || '-'}</div>
        </div>
        <button
          type="button"
          onClick={() => detailQuery.refetch()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={detailQuery.isFetching}
        >
          {detailQuery.isFetching ? '刷新中…' : '手动刷新'}
        </button>
      </div>

      {detailQuery.isLoading ? <InfoNotice message="正在加载任务详情…" /> : null}
      {detailQuery.error ? (
        <ErrorNotice message={detailQuery.error instanceof Error ? detailQuery.error.message : '未知错误'} />
      ) : null}

      {actionHint ? <InfoNotice title="操作结果" message={actionHint} /> : null}

      {detail ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card
              title="taskDraft 基本信息"
              actions={snapshot ? <Badge tone="neutral">{snapshot.status}</Badge> : undefined}
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
                    <Badge tone="neutral">{detail.taskDraft.status}</Badge>
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

            <Card title="latestPromptDraftSummary">
              {promptSummaryBlock}
            </Card>
          </div>

          <Card title="executionSummary">
            {execution ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      execution.status === 'done'
                        ? 'success'
                        : execution.status === 'failed'
                          ? 'failed'
                          : execution.status === 'running'
                            ? 'info'
                            : 'neutral'
                    }
                  >
                    {execution.status}
                  </Badge>
                  <span className="text-sm text-slate-700">{execution.note}</span>
                  <span className="text-xs text-slate-500">最后更新：{formatDateTime(execution.lastUpdatedAt)}</span>
                </div>

                {execution.summary ? <div className="text-sm text-slate-800">摘要：{execution.summary}</div> : null}
                {execution.testResult ? <div className="text-sm text-slate-800">测试结果：{execution.testResult}</div> : null}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">变更文件</div>
                    <div className="mt-1">{renderList(execution.changedFiles ?? [])}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">日志</div>
                    <div className="mt-1">
                      <CodeBlock>{execution.logs && execution.logs.length > 0 ? execution.logs.join('\n') : '暂无日志'}</CodeBlock>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">暂无 executionSummary</div>
            )}
          </Card>

          <Card title="操作">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500">操作者（operator）</label>
                  <input
                    value={operator}
                    onChange={(e) => {
                      setActionHint(null);
                      setOperator(e.target.value);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    placeholder="例如：admin"
                  />
                  <div className="mt-1 text-xs text-slate-500">用于记录审计信息，不做复杂校验。</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">修改草案（revisionText）</label>
                  <textarea
                    value={revisionText}
                    onChange={(e) => {
                      setActionHint(null);
                      setRevisionText(e.target.value);
                    }}
                    className="mt-1 h-24 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    placeholder="输入你希望如何修改草案，例如：缩小范围、补充约束、调整验收标准…"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canRevise || isAnyActionPending}
                  onClick={() => {
                    setActionHint(null);
                    reviseMutation.mutate({ operator: operator.trim(), revisionText });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  修改草案
                </button>
                <button
                  type="button"
                  disabled={!operatorReady || isAnyActionPending}
                  onClick={() => {
                    setActionHint(null);
                    approveMutation.mutate({ operator: operator.trim() });
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  确认派发
                </button>
                <button
                  type="button"
                  disabled={!operatorReady || isAnyActionPending}
                  onClick={() => {
                    setActionHint(null);
                    cancelMutation.mutate({ operator: operator.trim() });
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  取消任务
                </button>
              </div>

              {(reviseMutation.error || approveMutation.error || cancelMutation.error) ? (
                <ErrorNotice
                  message={
                    (reviseMutation.error ?? approveMutation.error ?? cancelMutation.error) instanceof Error
                      ? (reviseMutation.error ?? approveMutation.error ?? cancelMutation.error as Error).message
                      : '未知错误'
                  }
                />
              ) : null}
            </div>
          </Card>

          <Card title="sourceText（只读）">
            <CodeBlock>{detail.taskDraft.sourceText || '-'}</CodeBlock>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
