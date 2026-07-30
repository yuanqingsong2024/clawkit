import { createContext, useContext, useState, useCallback, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react';

/**
 * 命令面板上下文
 * 提供全局命令面板状态管理
 */

interface CommandPaletteContextType {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | null>(null);

interface CommandPaletteProviderProps {
  children: ReactNode;
}

/**
 * 命令面板 Provider
 * 包装应用，提供全局命令面板控制
 */
export function CommandPaletteProvider({ children }: CommandPaletteProviderProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  // 打开命令面板
  const open = useCallback(() => setIsOpen(true), []);

  // 关闭命令面板
  const close = useCallback(() => setIsOpen(false), []);

  // 切换命令面板
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  // 全局快捷键监听 - Command+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框中的快捷键
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isInput) {
          toggle();
        }
      }

      // Escape 关闭（如果打开）
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close]);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, setIsOpen, open, close, toggle }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

/**
 * 使用命令面板的 Hook
 */
export function useCommandPalette(): CommandPaletteContextType {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette 必须在 CommandPaletteProvider 内使用');
  }
  return context;
}

/**
 * 快捷键配置类型
 */
export interface ShortcutConfig {
  /** 按键组合，如 'mod+k' */
  key: string;
  /** 描述 */
  description?: string;
  /** 是否显示在快捷键提示中 */
  showInHints?: boolean;
}

/**
 * 快捷键映射
 */
export const SHORTCUTS: Record<string, ShortcutConfig> = {
  commandPalette: {
    key: 'mod+k',
    description: '打开命令面板',
    showInHints: true,
  },
  goToDashboard: {
    key: 'g d',
    description: '跳转到总览',
    showInHints: true,
  },
  goToPipelines: {
    key: 'g p',
    description: '跳转到流水线',
    showInHints: true,
  },
  goToTasks: {
    key: 'g t',
    description: '跳转到任务中心',
    showInHints: true,
  },
  refresh: {
    key: 'r',
    description: '刷新页面',
    showInHints: true,
  },
  toggleTheme: {
    key: 'mod+shift+t',
    description: '切换主题',
    showInHints: true,
  },
};

/**
 * 获取显示的快捷键
 */
export function getShortcutLabel(shortcut: ShortcutConfig): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';
  
  return shortcut.key
    .replace('mod', modKey)
    .replace('shift', '⇧')
    .replace('alt', '⌥')
    .replace('+', '');
}
