import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { SystemActionResultView, type SystemActionResult } from '../components/SystemActionResultView';
import { Card } from '../components/ui/Card';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { Badge } from '../components/ui/Badge';
import { apiPost } from '../lib/api';

type DeployAction = 'doctor' | 'plan' | 'apply_preview' | 'apply_execute';

export function DeployPage(): JSX.Element {
  const [lastResult, setLastResult] = useState<SystemActionResult<unknown> | null>(null);
  const [lastAction, setLastAction] = useState<DeployAction | null>(null);

  const mutation = useMutation({
    mutationFn: async (action: DeployAction) => {
      setLastAction(action);
      if (action === 'doctor') {
        return apiPost<SystemActionResult<unknown>, Record<string, never>>('/system/doctor', {});
      }
      if (action === 'plan') {
        return apiPost<SystemActionResult<unknown>, Record<string, never>>('/system/plan', {});
      }
      if (action === 'apply_preview') {
        return apiPost<SystemActionResult<unknown>, { dryRun: boolean }>('/system/apply', { dryRun: true });
      }
      return apiPost<SystemActionResult<unknown>, { dryRun: boolean; confirmExecution: boolean }>(
        '/system/apply',
        { dryRun: false, confirmExecution: true }
      );
    },
    onSuccess: (result) => {
      setLastResult(result);
    },
  });

  const isRunning = mutation.isPending;
  const runningLabel = useMemo(() => {
    if (!isRunning) return null;
    if (lastAction === 'doctor') return 'Doctor 执行中…';
    if (lastAction === 'plan') return 'Plan 生成中…';
    if (lastAction === 'apply_preview') return 'Apply 预览中…';
    if (lastAction === 'apply_execute') return 'Apply 执行中…';
    return '执行中…';
  }, [isRunning, lastAction]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">部署</h1>
        <div className="mt-1 text-sm text-slate-600">通过 controller 的 system API 触发 doctor/plan/apply。</div>
      </div>

      <Card
        title="操作"
        actions={runningLabel ? <Badge tone="info">{runningLabel}</Badge> : <Badge tone="neutral">手动触发</Badge>}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => mutation.mutate('doctor')}
            disabled={mutation.isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Doctor
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate('plan')}
            disabled={mutation.isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate('apply_preview')}
            disabled={mutation.isPending}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Apply（预览）
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate('apply_execute')}
            disabled={mutation.isPending}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Apply（执行）
          </button>
        </div>

        <div className="mt-3">
          <InfoNotice message="本页不做自动刷新；如需更新状态，请在总览页或状态页手动刷新。" />
        </div>

        {mutation.error ? (
          <div className="mt-3">
            <ErrorNotice message={mutation.error instanceof Error ? mutation.error.message : '未知错误'} />
          </div>
        ) : null}
      </Card>

      {lastResult ? <SystemActionResultView result={lastResult} /> : <InfoNotice message="尚未执行任何操作。" />}
    </section>
  );
}
