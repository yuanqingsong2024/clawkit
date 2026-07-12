import type { ReactNode } from 'react';

export function CodeBlock(props: { children: ReactNode }): JSX.Element {
  return (
    <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
      {props.children}
    </pre>
  );
}
