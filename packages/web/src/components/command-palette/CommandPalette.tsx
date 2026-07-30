import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import './CommandPalette.css';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category?: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 全局命令面板组件 - 支持 Command+K / Ctrl+K 快捷键
 */
export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 命令列表
  const commands: CommandItem[] = useMemo(() => [
    // 导航命令
    {
      id: 'nav-dashboard',
      label: '总览',
      description: '查看系统总览和运行状态',
      icon: '📊',
      category: '导航',
      shortcut: 'G D',
      action: () => { navigate('/'); onClose(); },
    },
    {
      id: 'nav-pipelines',
      label: '流水线',
      description: '管理和执行 AI 工作流',
      icon: '🔄',
      category: '导航',
      shortcut: 'G P',
      action: () => { navigate('/pipelines'); onClose(); },
    },
    {
      id: 'nav-pipelines-create',
      label: '新建流水线',
      description: '创建新的工作流流水线',
      icon: '➕',
      category: '导航',
      action: () => { navigate('/pipelines/create'); onClose(); },
    },
    {
      id: 'nav-plugins',
      label: '插件市场',
      description: '发现和安装插件',
      icon: '🧩',
      category: '导航',
      action: () => { navigate('/plugins'); onClose(); },
    },
    {
      id: 'nav-plugins-manage',
      label: '插件管理',
      description: '管理已安装的插件',
      icon: '⚙️',
      category: '导航',
      action: () => { navigate('/plugins/manage'); onClose(); },
    },
    {
      id: 'nav-projects',
      label: '项目管理',
      description: '管理代码项目',
      icon: '📁',
      category: '导航',
      shortcut: 'G J',
      action: () => { navigate('/projects'); onClose(); },
    },
    {
      id: 'nav-tasks',
      label: '任务中心',
      description: '查看和管理任务',
      icon: '📋',
      category: '导航',
      shortcut: 'G T',
      action: () => { navigate('/tasks'); onClose(); },
    },
    {
      id: 'nav-logs',
      label: '运行日志',
      description: '查看系统日志',
      icon: '📜',
      category: '导航',
      action: () => { navigate('/logs'); onClose(); },
    },
    {
      id: 'nav-config',
      label: '系统配置',
      description: 'manifest 配置管理',
      icon: '⚙️',
      category: '导航',
      action: () => { navigate('/config'); onClose(); },
    },
    {
      id: 'nav-setup',
      label: '快速配置',
      description: '初始化系统配置',
      icon: '🚀',
      category: '导航',
      action: () => { navigate('/setup'); onClose(); },
    },
    // 操作命令
    {
      id: 'action-refresh',
      label: '刷新页面',
      description: '刷新当前页面数据',
      icon: '🔄',
      category: '操作',
      action: () => { window.location.reload(); },
    },
    {
      id: 'action-toggle-theme',
      label: '切换主题',
      description: '在浅色和深色模式间切换',
      icon: '🌓',
      category: '操作',
      shortcut: '⌘ ⇧ T',
      action: () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('clawkit-theme', isDark ? 'dark' : 'light');
        onClose();
      },
    },
  ], [navigate, onClose]);

  // 过滤命令
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.category?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // 重置选择索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  // 关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // 按分类分组
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      const category = cmd.category || '其他';
      if (!groups[category]) groups[category] = [];
      groups[category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="命令面板" size="lg">
      <div className="command-palette">
        {/* 搜索输入 */}
        <div className="command-palette-search">
          <span className="command-palette-search-icon">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令或搜索..."
            className="command-palette-input"
            autoFocus
          />
          {query && (
            <button 
              className="command-palette-clear"
              onClick={() => setQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* 快捷键提示 */}
        <div className="command-palette-hints">
          <span><kbd>↑↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>

        {/* 命令列表 */}
        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">
              <span>没有找到匹配的命令</span>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="command-palette-group">
                <div className="command-palette-group-title">{category}</div>
                {items.map((cmd, idx) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      className={`command-palette-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <span className="command-palette-item-icon">{cmd.icon}</span>
                      <div className="command-palette-item-content">
                        <span className="command-palette-item-label">{cmd.label}</span>
                        {cmd.description && (
                          <span className="command-palette-item-description">{cmd.description}</span>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <span className="command-palette-item-shortcut">{cmd.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

