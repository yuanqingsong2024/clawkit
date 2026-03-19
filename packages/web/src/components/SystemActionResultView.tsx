import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { CodeBlock } from './ui/CodeBlock';
import { formatDateTime } from '../lib/format';

export type SystemActionStatus = 'success' | 'warning' | 'failed' | string;
export type StepStatus = 'success' | 'warning' | 'failed' | 'skipped' | string;

export interface SystemActionStep {
  title: string;
  status: StepStatus;
  detail: string;
  suggestion?: string;
}

export interface SystemActionResult<T> {
  action: string;
  dryRun: boolean;
  status: SystemActionStatus;
  summary: string;
  steps: SystemActionStep[];
  logs: string[];
  nextStep: string;
  startedAt: string;
  finishedAt: string;
  data: T | null;
}

function toneForActionStatus(status: SystemActionStatus): 'success' | 'warning' | 'failed' | 'neutral' {
  if (status === 'success') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'failed') return 'failed';
  return 'neutral';
}

function toneForStepStatus(status: StepStatus): 'success' | 'warning' | 'failed' | 'neutral' {
  if (status === 'success') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'failed') return 'failed';
  if (status === 'skipped') return 'neutral';
  return 'neutral';
}

export function SystemActionResultView<T>(props: { result: SystemActionResult<T> }): JSX.Element {
  const { result } = props;
  return (
    <div className="space-y-4">
      <Card
        title="执行结果"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={toneForActionStatus(result.status)}>{result.status}</Badge>
            <Badge tone="neutral">{result.dryRun ? '预览' : '执行'}</Badge>
            <span className="text-xs text-slate-500">
              {formatDateTime(result.startedAt)} → {formatDateTime(result.finishedAt)}
            </span>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-900">{result.summary}</div>
          <div className="text-sm text-slate-700">下一步：{result.nextStep}</div>
        </div>
      </Card>

      <Card title="步骤">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">标题</th>
                <th className="py-2 pr-3 font-medium">状态</th>
                <th className="py-2 pr-3 font-medium">详情</th>
                <th className="py-2 font-medium">建议</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.steps.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-500">
                    暂无步骤
                  </td>
                </tr>
              ) : (
                result.steps.map((step, index) => (
                  <tr key={`${step.title}-${index}`}>
                    <td className="py-2 pr-3 text-slate-900">{step.title}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={toneForStepStatus(step.status)}>{step.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{step.detail}</td>
                    <td className="py-2 text-slate-700">{step.suggestion ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="日志">
        <CodeBlock>{result.logs.length > 0 ? result.logs.join('\n') : '暂无日志'}</CodeBlock>
      </Card>
    </div>
  );
}
