import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const shortcuts = [
  {
    category: '导航',
    items: [
      { key: '⌘ + K', description: '打开命令面板' },
      { key: '⌘ + /', description: '打开快捷键帮助' },
      { key: '⌘ + 1', description: '切换到总览页' },
      { key: '⌘ + 2', description: '切换到流水线页' },
      { key: '⌘ + 3', description: '切换到插件市场' },
      { key: '⌘ + 4', description: '切换到项目页' },
      { key: '⌘ + 5', description: '切换到任务中心' },
      { key: '⌘ + 6', description: '切换到日志页' },
      { key: '⌘ + 7', description: '切换到配置页' },
    ],
  },
  {
    category: '任务操作',
    items: [
      { key: '⌘ + Enter', description: '确认/执行操作' },
      { key: 'Esc', description: '取消/关闭当前操作' },
      { key: '⌘ + Shift + C', description: '创建新任务' },
      { key: '⌘ + Shift + R', description: '刷新任务列表' },
    ],
  },
  {
    category: '编辑',
    items: [
      { key: '⌘ + C', description: '复制' },
      { key: '⌘ + V', description: '粘贴' },
      { key: '⌘ + X', description: '剪切' },
      { key: '⌘ + Z', description: '撤销' },
      { key: '⌘ + Shift + Z', description: '重做' },
      { key: '⌘ + S', description: '保存' },
    ],
  },
  {
    category: '通用',
    items: [
      { key: '⌘ + ,', description: '打开设置' },
      { key: '⌘ + Shift + .', description: '开发者工具' },
      { key: 'F1', description: '打开帮助文档' },
      { key: '⌘ + +', description: '放大' },
      { key: '⌘ + -', description: '缩小' },
      { key: '⌘ + 0', description: '重置缩放' },
    ],
  },
];

export function KeyboardShortcuts({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: isOpen ? 1 : 0.95 }}
        exit={{ scale: 0.95 }}
        className="relative flex h-full w-full max-w-4xl items-center justify-center p-4 pointer-events-none"
      >
        <motion.div
          initial={{ x: 10, opacity: 0 }}
          animate={{ x: 0, opacity: 1, transition: { delay: 0.1 } }}
          exit={{ x: 10, opacity: 0 }}
          className="relative flex flex-col w-full max-w-xl pointer-events-auto bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
            <h2 className="text-xl font-semibold text-slate-900">键盘快捷键</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900"
            >
              ✕
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {shortcuts.map((section, index) => (
              <div key={index} className="mb-6">
                <h3 className="text-lg font-medium text-slate-800 mb-3">{section.category}</h3>
                <div className="space-y-2">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                      <div className="flex-shrink-0 text-sm font-mono bg-slate-100 px-2.5 py-0.5 rounded text-slate-800">
                        {item.key}
                      </div>
                      <div className="flex-1 text-sm text-slate-600">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}