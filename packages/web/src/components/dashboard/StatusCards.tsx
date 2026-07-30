/**
 * 服务状态卡片组件
 * 展示 Controller、Workers、Claude Code、OpenCode 四个核心服务的状态
 */

import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import {
  OverviewData,
  toneForSystemStatus,
  toneForServiceStatus,
  labelForServiceStatus,
  buildOpenCodeGroups,
} from './types';
import { isNonEmptyString } from '../../lib/format';

interface StatusCardsProps {
  data: OverviewData;
  desktopMode: boolean;
  openClawStarting: boolean;
  onStartClaudeCode: () => void;
  showOpenCodeDetails: boolean;
  onToggleOpenCodeDetails: () => void;
  openCodeOnlineCount: number;
  openCodeInstanceCount: number;
  openCodeHasInstances: boolean;
  openCodeProjectCount: number;
}

/**
 * Controller 状态卡片
 */
function ControllerCard({ data }: { data: OverviewData }): JSX.Element {
  return (
    <Card compact title="Controller" className="h-full">
      <div className="flex h-full flex-col space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-600">调度中心</div>
            <div className="mt-1 text-sm font-medium text-slate-900">任务派发与状态聚合</div>
          </div>
          <Badge tone={toneForSystemStatus(data.controller.status)} className="shrink-0 text-sm">
            {data.controller.status}
          </Badge>
        </div>
        {isNonEmptyString(data.controller.publicUrl) ? (
          <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 break-all leading-5">
            {data.controller.publicUrl}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Workers 状态卡片
 */
function WorkersCard({ data }: { data: OverviewData }): JSX.Element {
  return (
    <Card compact title="Workers" className="h-full">
      <div className="flex h-full flex-col space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-slate-600">执行节点</div>
            <div className="mt-1 text-sm font-medium text-slate-900">在线 / 总数</div>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{data.workers.online}/{data.workers.total}</div>
        </div>
        <div className="mt-auto grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-center">
            <div className="text-[11px] text-emerald-700">空闲</div>
            <div className="mt-0.5 text-sm font-semibold text-emerald-900">{data.workers.idle}</div>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-2 text-center">
            <div className="text-[11px] text-sky-700">忙碌</div>
            <div className="mt-0.5 text-sm font-semibold text-sky-900">{data.workers.busy}</div>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2 text-center">
            <div className="text-[11px] text-rose-700">离线</div>
            <div className="mt-0.5 text-sm font-semibold text-rose-900">{data.workers.offline}</div>
          </div>
        </div>
        {data.workers.offline > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-5">
            检测到离线 Worker，可在下方列表中直接点击"一键启动"。
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Claude Code 状态卡片
 */
function ClaudeCodeCard({
  data,
  onStart,
  starting,
}: {
  data: OverviewData;
  onStart: () => void;
  starting: boolean;
}): JSX.Element {
  return (
    <Card compact title="Claude Code" className="h-full">
      <div className="flex h-full flex-col space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-600">Webhook 接入</div>
            <div className="mt-1 text-sm font-medium text-slate-900">Claude Code 通道状态</div>
          </div>
          <Badge tone={toneForServiceStatus(data.openClaw.serviceStatus)} className="shrink-0 text-sm">
            {labelForServiceStatus(data.openClaw.serviceStatus)}
          </Badge>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
            <div className="text-[11px] text-slate-500">配置</div>
            <div className="mt-0.5 font-medium text-slate-800">{data.openClaw.configured ? '已配置' : '未配置'}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
            <div className="text-[11px] text-slate-500">Token</div>
            <div className="mt-0.5 font-medium text-slate-800">{data.openClaw.tokenConfigured ? '已设置' : '未设置'}</div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
          {data.openClaw.localDetected
            ? '已识别到本机 Claude Code 服务，即使 manifest 尚未配置也会显示在线状态。'
            : data.openClaw.healthCheckDetail}
        </div>
        {data.openClaw.serviceStatus !== 'online' && data.openClaw.canStart ? (
          <button
            type="button"
            disabled={starting}
            onClick={onStart}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? '启动中…' : '一键启动 Claude Code'}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * OpenCode 状态卡片
 */
function OpenCodeCard({
  data,
  desktopMode,
  showDetails,
  onToggleDetails,
  onlineCount,
  instanceCount,
  hasInstances,
  projectCount,
}: {
  data: OverviewData;
  desktopMode: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
  onlineCount: number;
  instanceCount: number;
  hasInstances: boolean;
  projectCount: number;
}): JSX.Element {
  return (
    <Card compact title="OpenCode 总览" className="h-full">
      <div className={`flex h-full flex-col ${showDetails ? 'space-y-2' : 'space-y-3'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-600">代码执行服务实例</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {showDetails ? '明细已展开，继续向下查看' : '运行中的 OpenCode 节点'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {onlineCount}/{instanceCount}
            </div>
            {hasInstances ? (
              <button
                type="button"
                onClick={onToggleDetails}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                {showDetails ? '收起总览' : '查看明细'}
              </button>
            ) : null}
          </div>
        </div>

        {!showDetails && hasInstances ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <div className="text-[11px] text-slate-500">实例</div>
                <div className="mt-0.5 font-medium text-slate-800">{instanceCount} 个</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <div className="text-[11px] text-slate-500">项目</div>
                <div className="mt-0.5 font-medium text-slate-800">{projectCount} 个</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={onlineCount > 0 ? 'success' : 'failed'} className="text-xs">
                {instanceCount > 0 ? `${onlineCount} 在线 / ${instanceCount} 实例` : '无实例'}
              </Badge>
              <span className="text-xs text-slate-500">
                {desktopMode
                  ? '点击"查看明细"展开每个项目对应的节点，同端口关联项目会合并显示。'
                  : '点击"查看明细"展开每个项目对应的节点。'}
              </span>
            </div>
          </>
        ) : null}

        {showDetails && hasInstances ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 leading-5">
            已折叠总览，只保留状态摘要。明细区已自动定位到页面下方，可直接查看每个实例的运行状态和启动操作。
          </div>
        ) : null}

        {!showDetails && hasInstances ? (
          <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
            {onlineCount > 0
              ? desktopMode
                ? '默认只展示总览。点击"查看明细"可展开每个项目对应的 OpenCode 节点，同端口的关联项目会合并显示。'
                : '默认只展示总览。点击"查看明细"可展开每个项目对应的 OpenCode 节点。'
              : desktopMode
                ? '所有 OpenCode 节点都处于离线状态。请先确认 OPENCODE_SERVER_PASSWORD 已配置，再使用明细里的启动按钮。'
                : '所有 OpenCode 节点都处于离线状态。请先在对应项目目录启动 OpenCode，再刷新此页面。'}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * 服务状态卡片网格组件
 */
export function StatusCards(props: StatusCardsProps): JSX.Element {
  const {
    data,
    desktopMode,
    openClawStarting,
    onStartClaudeCode,
    showOpenCodeDetails,
    onToggleOpenCodeDetails,
    openCodeOnlineCount,
    openCodeInstanceCount,
    openCodeHasInstances,
    openCodeProjectCount,
  } = props;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
      <ControllerCard data={data} />
      <WorkersCard data={data} />
      <ClaudeCodeCard
        data={data}
        onStart={onStartClaudeCode}
        starting={openClawStarting}
      />
      <OpenCodeCard
        data={data}
        desktopMode={desktopMode}
        showDetails={showOpenCodeDetails}
        onToggleDetails={onToggleOpenCodeDetails}
        onlineCount={openCodeOnlineCount}
        instanceCount={openCodeInstanceCount}
        hasInstances={openCodeHasInstances}
        projectCount={openCodeProjectCount}
      />
    </div>
  );
}
