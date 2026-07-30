import { useState, useEffect } from 'react';
import { getShortcutLabel, SHORTCUTS } from '../../contexts';
import './KeyboardHints.css';

/**
 * 键盘快捷键提示配置
 */
interface ShortcutHint {
  key: string;
  label: string;
  icon?: string;
}

const GLOBAL_SHORTCUTS: ShortcutHint[] = [
  { key: 'commandPalette', label: '命令面板', icon: '⌘' },
  { key: 'toggleTheme', label: '切换主题', icon: '🌓' },
  { key: 'refresh', label: '刷新', icon: '🔄' },
];

/**
 * 键盘快捷键提示组件
 * 显示在页面底部状态栏
 */
export function KeyboardHints(): JSX.Element | null {
  const [isMac, setIsMac] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  // 按住 ? 键显示快捷键提示
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 显示快捷键：按住 Shift + / 或 ?
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setIsVisible(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === '?' || e.key === '/') {
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="keyboard-hints-overlay">
      <div className="keyboard-hints">
        <div className="keyboard-hints-title">
          <span>键盘快捷键</span>
          <span className="keyboard-hints-hint">按住 <kbd>?</kbd> 显示</span>
        </div>
        <div className="keyboard-hints-list">
          {GLOBAL_SHORTCUTS.map((shortcut) => {
            const config = SHORTCUTS[shortcut.key];
            return (
              <div key={shortcut.key} className="keyboard-hint-item">
                <span className="keyboard-hint-label">{shortcut.label}</span>
                <kbd className="keyboard-hint-key">
                  {getShortcutLabel(config)}
                </kbd>
              </div>
            );
          })}
        </div>
        <div className="keyboard-hints-divider" />
        <div className="keyboard-hints-section">
          <div className="keyboard-hints-section-title">导航</div>
          <div className="keyboard-hint-item">
            <span className="keyboard-hint-label">跳转总览</span>
            <kbd className="keyboard-hint-key">G D</kbd>
          </div>
          <div className="keyboard-hint-item">
            <span className="keyboard-hint-label">跳转流水线</span>
            <kbd className="keyboard-hint-key">G P</kbd>
          </div>
          <div className="keyboard-hint-item">
            <span className="keyboard-hint-label">跳转任务</span>
            <kbd className="keyboard-hint-key">G T</kbd>
          </div>
        </div>
        <div className="keyboard-hints-section">
          <div className="keyboard-hints-section-title">命令面板</div>
          <div className="keyboard-hint-item">
            <span className="keyboard-hint-label">向上选择</span>
            <kbd className="keyboard-hint-key">↑</kbd>
          </div>
          <div className="keyboard-hint-item">
            <span className="keyboard-hint-label">向下选择</span>
            <kbd className="keyboard-hint-key">↓</kbd>
          </div>
          <div className="keyboard-hint-item">
            <span className="keyboard-hint-label">执行</span>
            <kbd className="keyboard-hint-key">Enter</kbd>
          </div>
          <div className="keyboard-hint-item">
            <span className="keyboard-hint-label">关闭</span>
            <kbd className="keyboard-hint-key">Esc</kbd>
          </div>
        </div>
        <div className="keyboard-hints-footer">
          <span>按 <kbd>?</kbd> 或 <kbd>Shift+/</kbd> 显示此面板</span>
        </div>
      </div>
    </div>
  );
}
