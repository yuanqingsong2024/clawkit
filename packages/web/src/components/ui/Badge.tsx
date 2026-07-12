import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'failed' | 'info';

function toneClassName(tone: BadgeTone): string {
  switch (tone) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    case 'failed':
      return 'bg-rose-50 text-rose-700 ring-rose-600/20';
    case 'info':
      return 'bg-sky-50 text-sky-700 ring-sky-600/20';
    case 'neutral':
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-600/20';
  }
}

export function Badge(props: { tone?: BadgeTone; className?: string; children: ReactNode }): JSX.Element {
  const tone = props.tone ?? 'neutral';
  return (
    <span
      className={[
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
        toneClassName(tone),
        props.className ?? '',
      ].join(' ')}
    >
      {props.children}
    </span>
  );
}
