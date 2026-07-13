/**
 * Tabs 标签页组件
 * 支持多种样式和动画效果
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tab {
  key: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  variant?: 'underline' | 'pill' | 'card';
  className?: string;
}

export function Tabs({
  tabs,
  activeKey: controlledActiveKey,
  defaultActiveKey,
  onChange,
  variant = 'underline',
  className = '',
}: TabsProps): JSX.Element {
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey || tabs[0]?.key);
  const activeKey = controlledActiveKey ?? internalActiveKey;

  const handleTabClick = (key: string, disabled?: boolean) => {
    if (disabled) return;
    if (!controlledActiveKey) {
      setInternalActiveKey(key);
    }
    onChange?.(key);
  };

  const renderUnderlineVariant = () => (
    <div className="relative">
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key, tab.disabled)}
            disabled={tab.disabled}
            className={[
              'relative px-4 py-3 text-sm font-medium transition-colors',
              activeKey === tab.key
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-700',
              tab.disabled && 'cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            <span className="flex items-center gap-2">
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </span>
            {activeKey === tab.key && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderPillVariant = () => (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTabClick(tab.key, tab.disabled)}
          disabled={tab.disabled}
          className={[
            'relative rounded-lg px-4 py-2 text-sm font-medium transition-all',
            activeKey === tab.key
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
            tab.disabled && 'cursor-not-allowed opacity-50',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );

  const renderCardVariant = () => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTabClick(tab.key, tab.disabled)}
          disabled={tab.disabled}
          className={[
            'rounded-xl border px-4 py-3 text-sm font-medium transition-all',
            activeKey === tab.key
              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            tab.disabled && 'cursor-not-allowed opacity-50',
          ].join(' ')}
        >
          <span className="flex items-center justify-center gap-2">
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );

  const content = tabs.find((tab) => tab.key === activeKey);

  return (
    <div className={className}>
      {variant === 'underline' && renderUnderlineVariant()}
      {variant === 'pill' && renderPillVariant()}
      {variant === 'card' && renderCardVariant()}
    </div>
  );
}

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ children, className = '' }: TabPanelProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedTabsProps {
  tabs: Tab[];
  children: React.ReactNode[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  variant?: 'underline' | 'pill' | 'card';
  className?: string;
}

export function AnimatedTabs({
  tabs,
  children,
  activeKey,
  defaultActiveKey,
  onChange,
  variant = 'underline',
  className = '',
}: AnimatedTabsProps): JSX.Element {
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey || tabs[0]?.key);
  const currentActiveKey = activeKey ?? internalActiveKey;

  const handleTabClick = (key: string) => {
    if (!activeKey) {
      setInternalActiveKey(key);
    }
    onChange?.(key);
  };

  return (
    <div className={className}>
      <Tabs
        tabs={tabs}
        activeKey={currentActiveKey}
        onChange={handleTabClick}
        variant={variant}
      />
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentActiveKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children[tabs.findIndex((t) => t.key === currentActiveKey)]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
