import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
}

function sizeClassName(size: ModalSize): string {
  switch (size) {
    case 'sm':
      return 'max-w-sm';
    case 'lg':
      return 'max-w-2xl';
    case 'xl':
      return 'max-w-4xl';
    case 'md':
    default:
      return 'max-w-lg';
  }
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  // 使用浏览器原生选择器实现 focus trap（不引入新依赖）。
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export function Modal(props: ModalProps): JSX.Element | null {
  const { isOpen, onClose, title, children, size = 'md' } = props;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef<string>('');

  const container = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return document.body;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // 记录打开前焦点，并在关闭时恢复；同时锁定背景滚动。
    lastActiveElementRef.current = (document.activeElement as HTMLElement | null) ?? null;
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const rafId = window.requestAnimationFrame(() => {
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;

      const focusables = getFocusableElements(dialogEl);
      if (focusables.length > 0) {
        focusables[0]?.focus();
      } else {
        dialogEl.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      document.body.style.overflow = previousBodyOverflowRef.current;
      lastActiveElementRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const dialogEl = dialogRef.current;
      if (!dialogEl) return;

      const focusables = getFocusableElements(dialogEl);
      if (focusables.length === 0) {
        e.preventDefault();
        dialogEl.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !dialogEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!container) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={[
                'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl',
                sizeClassName(size),
              ].join(' ')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <div id={titleId} className="text-base font-semibold text-slate-900">
                    {title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">按 ESC 可关闭</div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  aria-label="关闭"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-[80vh] overflow-auto px-5 py-4">{children}</div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    container,
  );
}
