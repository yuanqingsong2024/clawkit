export function ErrorNotice(props: { title?: string; message: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <div className="font-medium">{props.title ?? '请求失败'}</div>
      <div className="mt-1 whitespace-pre-wrap break-words">{props.message}</div>
    </div>
  );
}

export function InfoNotice(props: { title?: string; message: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
      <div className="font-medium">{props.title ?? '提示'}</div>
      <div className="mt-1 whitespace-pre-wrap break-words">{props.message}</div>
    </div>
  );
}
