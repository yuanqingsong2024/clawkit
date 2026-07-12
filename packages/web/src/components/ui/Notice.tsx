interface NoticeProps {
  title?: string;
  message: string;
  compact?: boolean;
}

function noticeMessageClassName(compact: boolean | undefined): string {
  return compact ? 'mt-0.5 text-sm leading-6' : 'mt-1 whitespace-pre-wrap break-words';
}

export function ErrorNotice(props: NoticeProps): JSX.Element {
  return (
    <div className={`rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 ${props.compact ? 'flex items-start gap-2' : ''}`}>
      <div className="font-medium">{props.title ?? '请求失败'}</div>
      <div className={noticeMessageClassName(props.compact)}>{props.message}</div>
    </div>
  );
}

export function InfoNotice(props: NoticeProps): JSX.Element {
  return (
    <div className={`rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-800 ${props.compact ? 'flex items-start gap-2' : ''}`}>
      <div className="font-medium">{props.title ?? '提示'}</div>
      <div className={noticeMessageClassName(props.compact)}>{props.message}</div>
    </div>
  );
}

export function SuccessNotice(props: NoticeProps): JSX.Element {
  return (
    <div className={`rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800 ${props.compact ? 'flex items-start gap-2' : ''}`}>
      <div className="font-medium">{props.title ?? '成功'}</div>
      <div className={noticeMessageClassName(props.compact)}>{props.message}</div>
    </div>
  );
}

export function WarningNotice(props: NoticeProps): JSX.Element {
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ${props.compact ? 'flex items-start gap-2' : ''}`}>
      <div className="font-medium">{props.title ?? '警告'}</div>
      <div className={noticeMessageClassName(props.compact)}>{props.message}</div>
    </div>
  );
}
