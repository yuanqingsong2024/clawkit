import type { ReactNode } from 'react';

export function PageHeader(props: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-slate-900">{props.title}</h1>
        {props.description ? <div className="mt-1 text-sm text-slate-600">{props.description}</div> : null}
      </div>
      {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
    </div>
  );
}
