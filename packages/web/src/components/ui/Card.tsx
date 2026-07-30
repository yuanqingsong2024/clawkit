import type { ReactNode } from 'react';

export function Card(props: { title?: string; actions?: ReactNode; children: ReactNode; className?: string; compact?: boolean }): JSX.Element {
  const compact = props.compact === true;
  const headerPaddingClassName = compact ? 'px-3 py-2' : 'px-4 py-2.5';
  const contentPaddingClassName = compact ? 'p-3' : 'p-4';

  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${props.className ?? ''}`.trim()}>
      {props.title ? (
        <div className={`flex items-center justify-between gap-3 border-b border-slate-100 ${headerPaddingClassName}`}>
          <h2 className={compact ? 'text-[13px] font-semibold text-slate-900' : 'text-sm font-semibold text-slate-900'}>{props.title}</h2>
          {props.actions ? <div className="shrink-0">{props.actions}</div> : null}
        </div>
      ) : props.actions ? (
        <div className={`flex items-start justify-end gap-3 border-b border-slate-100 ${headerPaddingClassName}`}>
          <div className="shrink-0">{props.actions}</div>
        </div>
      ) : null}
      <div className={contentPaddingClassName}>{props.children}</div>
    </section>
  );
}
