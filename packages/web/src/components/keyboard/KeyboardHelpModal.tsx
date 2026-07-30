/**
 * 键盘快捷键帮助弹窗
 * 按 ? 键呼出
 */
import { useEffect } from 'react';
import { Modal } from '../ui/Modal';

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: '全局',
    shortcuts: [
      { keys: ['?'], description: '显示快捷键帮助' },
      { keys: ['⌘', 'K'], description: '打开命令面板' },
      { keys: ['Esc'], description: '关闭弹窗/面板' },
      { keys: ['⌘', 'D'], description: '切换深色模式' },
    ],
  },
  {
    title: '导航',
    shortcuts: [
      { keys: ['G', 'H'], description: '跳转到总览页' },
      { keys: ['G', 'P'], description: '跳转到流水线' },
      { keys: ['G', 'T'], description: '跳转到任务中心' },
      { keys: ['G', 'L'], description: '跳转到日志页' },
    ],
  },
  {
    title: '列表操作',
    shortcuts: [
      { keys: ['J'], description: '下一项' },
      { keys: ['K'], description: '上一项' },
      { keys: ['Enter'], description: '打开选中项' },
      { keys: ['⌘', 'Enter'], description: '新窗口打开' },
    ],
  },
  {
    title: '任务操作',
    shortcuts: [
      { keys: ['R'], description: '刷新列表' },
      { keys: ['N'], description: '新建项目' },
      { keys: ['E'], description: '编辑选中项' },
      { keys: ['⌘', 'Del'], description: '删除选中项' },
    ],
  },
];

interface KeyboardHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardHelpModal({ open, onClose }: KeyboardHelpModalProps): JSX.Element {
  // 监听 ? 键关闭
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="键盘快捷键"
      size="md"
    >
      <div className="space-y-4">
        {shortcutGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{group.title}</h3>
            <div className="space-y-2">
              {group.shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0"
                >
                  <span className="text-sm text-slate-600">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={keyIndex} className="flex items-center">
                        <kbd className="min-w-[24px] rounded border border-slate-300 bg-slate-50 px-2 py-1 text-center text-xs font-mono text-slate-700 shadow-sm">
                          {key}
                        </kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="mx-1 text-xs text-slate-400">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
        按 <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">Esc</kbd> 关闭
      </div>
    </Modal>
  );
}

export default KeyboardHelpModal;
