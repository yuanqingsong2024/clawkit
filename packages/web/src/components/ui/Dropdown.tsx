/**
 * Dropdown 下拉菜单组件
 * 支持单选、多选和自定义触发器
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  description?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Dropdown({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = '请选择',
  className = '',
  disabled = false,
  size = 'md',
}: DropdownProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === (value ?? selectedValue));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) return;
    setSelectedValue(option.value);
    onChange?.(option.value);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-3 text-base',
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={[
          'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          sizeClasses[size],
          disabled && 'cursor-not-allowed bg-slate-50 opacity-50',
        ].join(' ')}
      >
        <span className={selectedOption ? 'text-slate-700' : 'text-slate-400'}>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon && <span>{selectedOption.icon}</span>}
              {selectedOption.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={option.disabled}
                className={[
                  'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
                  option.value === (value ?? selectedValue)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50',
                  option.disabled && 'cursor-not-allowed opacity-50',
                ].join(' ')}
              >
                {option.icon && <span className="text-base">{option.icon}</span>}
                <div className="flex-1">
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-slate-400">{option.description}</div>
                  )}
                </div>
                {option.value === (value ?? selectedValue) && (
                  <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DropdownItemProps {
  icon?: string;
  label: string;
  description?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export function DropdownItem({
  icon,
  label,
  description,
  onClick,
  disabled = false,
  danger = false,
}: DropdownItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-600 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
      ].join(' ')}
    >
      {icon && <span className="text-base">{icon}</span>}
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        {description && <div className="text-xs text-slate-400">{description}</div>}
      </div>
    </button>
  );
}

export function DropdownDivider(): JSX.Element {
  return <div className="my-2 border-t border-slate-100" />;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = 'right',
  className = '',
}: DropdownMenuProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={[
              'absolute z-50 mt-2 min-w-[180px] rounded-xl border border-slate-200 bg-white py-2 shadow-xl',
              align === 'right' ? 'right-0' : 'left-0',
            ].join(' ')}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
