import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { SystemActionResultView, type SystemActionResult } from '../components/SystemActionResultView';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { apiPost } from '../lib/api';

type HealAction = 'heal_preview' | 'heal_execute';

export function HealPage(): JSX.Element {
  const [lastResult, setLastResult] = useState<SystemActionResult<unknown> | null>(null);
  const [lastAction, setLastAction] = useState<HealAction | null>(null);

  const mutation = useMutation({
    mutationFn: async (action: HealAction) => {
      setLastAction(action);
      if (action === 'heal_preview') {
        return apiPost<SystemActionResult<unknown>, { dryRun: boolean }>('/system/heal', { dryRun: true });
      }

      return apiPost<SystemActionResult<unknown>, { dryRun: boolean; confirmExecution: boolean }>(
        '/system/heal',
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
    if (lastAction === 'heal_preview') return 'Heal 预览中…';
    if (lastAction === 'heal_execute') return 'Heal 执行中…';
    return '执行中…';
  }, [isRunning, lastAction]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">修复</h1>
        <div className="mt-1 text-sm text-slate-600">通过 controller 的 system API 触发 heal 诊断与修复。</div>
      </div>

      <Card
        title="操作"
        actions={runningLabel ? <Badge tone="info">{runningLabel}</Badge> : <Badge tone="neutral">手动触发</Badge>}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => mutation.mutate('heal_preview')}
            disabled={mutation.isPending}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Heal（预览）
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate('heal_execute')}
            disabled={mutation.isPending}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Heal（执行）
          </button>
        </div>

        <div className="mt-3">
          <InfoNotice message="真实执行会修改本地输出文件或配置。请先使用预览确认影响后再执行。" />
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
