import type { ReactNode } from 'react';

export function Card(props: { title: string; actions?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{props.title}</h2>
        {props.actions ? <div className="shrink-0">{props.actions}</div> : null}
      </div>
      <div className="p-4">{props.children}</div>
    </section>
  );
}
