/**
 * 任务操作弹窗组件
 * 任务操作（批准、修改、取消）的确认对话框
 */

import { inputClassName } from '../ui/styles';
import { Modal } from '../ui/Modal';
import { ErrorNotice, InfoNotice } from '../ui/Notice';
import { formatDateTime } from '../../lib/format';
import { TaskActionInput, TaskActionType } from './types';
import { toneForTaskStatus, labelForTaskStatus } from './types';

interface TaskActionDialogProps {
  pendingAction: {
    taskId: string;
    action: TaskActionType;
  } | null;
  taskStatus: string;
  isActionBusy: boolean;
  actionError: string | null;
  actionHint: string | null;
  operator: string;
  setOperator: (value: string) => void;
  revisionText: string;
  setRevisionText: (value: string) => void;
  canSubmitAction: boolean;
  onClose: () => void;
  onSubmit: () => void;
  taskActionMutation: {
    mutate: (input: TaskActionInput) => void;
    isPending: boolean;
  };
}

/**
 * 任务操作弹窗组件
 */
export function TaskActionDialog(props: TaskActionDialogProps): JSX.Element | null {
  const {
    pendingAction,
    taskStatus,
    isActionBusy,
    actionError,
    actionHint,
    operator,
    setOperator,
    revisionText,
    setRevisionText,
    canSubmitAction,
    onClose,
    onSubmit,
    taskActionMutation,
  } = props;

  if (!pendingAction) return null;

  const actionDialogMessage =
    pendingAction.action === 'revise'
      ? '提交修改意见后，任务会回到待确认链路。'
      : pendingAction.action === 'approve'
        ? '确认后将进入审批后的后续链路。'
        : '任务取消后将不再继续流转。';

  return (
    <Modal isOpen={!!pendingAction} onClose={onClose} title={`${pendingAction.taskId} - ${pendingAction.action}`} size="sm">
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
          <button type="button" onClick={onClose} className="px-3 py-1 text-sm font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-50" disabled={isActionBusy}>
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-3 py-1 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700"
            disabled={!canSubmitAction}
          >
            {taskActionMutation.isPending ? '提交中…' : '确认'}
          </button>
        </div>

        {actionHint ? <InfoNotice message={actionHint} /> : null}
      </div>
    </Modal>
  );
}