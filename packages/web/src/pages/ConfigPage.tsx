import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Accordion } from '../components/ui/Accordion';
import { Card } from '../components/ui/Card';
import { CodeBlock } from '../components/ui/CodeBlock';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from '../components/ui/styles';
import { apiGet, apiPut } from '../lib/api';
import { formatDateTime } from '../lib/format';

interface ManifestDocument {
  manifestPath: string;
  yamlText: string;
  savedAt: string;
  runtimeNotice: string;
}

interface ControllerConfigDocument {
  manifestPath: string | null;
  source: 'file' | 'env' | 'unset';
  configPath: string;
}

export function ConfigPage(): JSX.Element {
  const queryClient = useQueryClient();
  const controllerConfigQuery = useQuery({
    queryKey: ['controller-config'],
    queryFn: () => apiGet<ControllerConfigDocument>('/controller-config'),
  });
  const manifestQuery = useQuery({
    queryKey: ['manifest'],
    queryFn: () => apiGet<ManifestDocument>('/manifest'),
    enabled: Boolean(controllerConfigQuery.data?.manifestPath),
  });

  const [yamlText, setYamlText] = useState('');
  const [manifestPathInput, setManifestPathInput] = useState('');
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [pathSaveHint, setPathSaveHint] = useState<string | null>(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);

  useEffect(() => {
    setManifestPathInput(controllerConfigQuery.data?.manifestPath ?? '');
  }, [controllerConfigQuery.data?.manifestPath]);

  useEffect(() => {
    if (!manifestQuery.data) return;
    if (hasUserEdited) return;
    setYamlText(manifestQuery.data.yamlText ?? '');
  }, [manifestQuery.data, hasUserEdited]);

  const originalText = manifestQuery.data?.yamlText ?? '';
  const isDirty = yamlText !== originalText;
  const isPathDirty = manifestPathInput.trim() !== (controllerConfigQuery.data?.manifestPath ?? '');

  const pathMutation = useMutation({
    mutationFn: (input: { manifestPath: string }) =>
      apiPut<ControllerConfigDocument, { manifestPath: string }>('/controller-config', input),
    onSuccess: (doc) => {
      setPathSaveHint('路径保存成功');
      queryClient.setQueryData(['controller-config'], doc);
      void queryClient.invalidateQueries({ queryKey: ['controller-config'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      void queryClient.invalidateQueries({ queryKey: ['manifest'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '未知错误';
      setPathSaveHint(`路径保存失败：${message}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (input: { yamlText: string }) => apiPut<ManifestDocument, { yamlText: string }>('/manifest', input),
    onSuccess: (doc) => {
      setSaveHint('保存成功');
      setHasUserEdited(false);
      setYamlText(doc.yamlText ?? yamlText);
      queryClient.setQueryData(['manifest'], doc);
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setSaveHint(null);
      const message = error instanceof Error ? error.message : '未知错误';
      setSaveHint(`保存失败：${message}`);
    },
  });

  const runtimeNotice = useMemo(() => manifestQuery.data?.runtimeNotice ?? '', [manifestQuery.data]);
  const manifestPathSourceLabel = useMemo(() => {
    if (controllerConfigQuery.data?.source === 'file') return '页面配置';
    if (controllerConfigQuery.data?.source === 'env') return '环境变量';
    return '未配置';
  }, [controllerConfigQuery.data?.source]);

  const handleSelectPath = (path: string) => {
    setPathSaveHint(null);
    setManifestPathInput(path);
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="配置"
        description="查看和编辑 manifest（YAML）。"
        actions={
          <>
          <button type="button" onClick={() => manifestQuery.refetch()} className={secondaryButtonClassName} disabled={manifestQuery.isFetching}>
            {manifestQuery.isFetching ? '刷新中…' : '刷新'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSaveHint(null);
              saveMutation.mutate({ yamlText });
            }}
            className={primaryButtonClassName}
            disabled={saveMutation.isPending || !isDirty || yamlText.trim().length === 0}
          >
            {saveMutation.isPending ? '保存中…' : '保存'}
          </button>
          </>
        }
      />

      {controllerConfigQuery.isLoading ? <InfoNotice message="正在加载 controller 配置…" /> : null}
      {controllerConfigQuery.error ? (
        <ErrorNotice message={controllerConfigQuery.error instanceof Error ? controllerConfigQuery.error.message : '未知错误'} />
      ) : null}
      {manifestQuery.isLoading ? <InfoNotice message="正在加载 manifest…" /> : null}
      {manifestQuery.error ? (
        <ErrorNotice message={manifestQuery.error instanceof Error ? manifestQuery.error.message : '未知错误'} />
      ) : null}

      {pathSaveHint ? (
        pathSaveHint.startsWith('路径保存成功') ? (
          <InfoNotice title="路径保存结果" message={pathSaveHint} />
        ) : (
          <ErrorNotice title="路径保存结果" message={pathSaveHint} />
        )
      ) : null}
      {saveHint ? (
        saveHint.startsWith('保存成功') ? <InfoNotice title="保存结果" message={saveHint} /> : <ErrorNotice title="保存结果" message={saveHint} />
      ) : null}

      {runtimeNotice ? <InfoNotice compact title="运行态提示" message={runtimeNotice} /> : null}

      {controllerConfigQuery.data ? (
        <Card compact title="controller 配置">
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">配置文件路径</dt>
                <dd className="mt-1 break-all text-sm font-medium text-slate-900">{controllerConfigQuery.data.configPath}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">当前 manifest 来源</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{manifestPathSourceLabel}</dd>
              </div>
            </dl>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900" htmlFor="manifest-path-input">
                manifest 路径
              </label>
              <div className="flex gap-2">
                <input
                  id="manifest-path-input"
                  type="text"
                  value={manifestPathInput}
                  onChange={(e) => {
                    setPathSaveHint(null);
                    setManifestPathInput(e.target.value);
                  }}
                  className={inputClassName}
                  placeholder="请输入 manifest YAML 的绝对路径或相对路径"
                />
                <button
                  type="button"
                  onClick={() => setIsBrowserOpen(true)}
                  className={secondaryButtonClassName}
                >
                  浏览
                </button>
              </div>
              <div className="text-xs text-slate-500 leading-5">保存后 controller 会立即重读，worker 仍需手动重启。</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPathSaveHint(null);
                  pathMutation.mutate({ manifestPath: manifestPathInput });
                }}
                className={primaryButtonClassName}
                disabled={pathMutation.isPending || !isPathDirty || manifestPathInput.trim().length === 0}
              >
                {pathMutation.isPending ? '保存中…' : '保存路径'}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {manifestQuery.data ? (
        <Card
          compact
          title="基本信息"
          actions={
            isDirty ? (
              <Badge tone="warning">未保存</Badge>
            ) : (
              <Badge tone="success">已同步</Badge>
            )
          }
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">manifest 路径</dt>
              <dd className="mt-1 break-all text-sm font-medium text-slate-900">{manifestQuery.data.manifestPath}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">最后保存时间</dt>
              <dd className="mt-1 text-sm text-slate-700">{formatDateTime(manifestQuery.data.savedAt)}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Accordion
        type="multiple"
        items={[
          {
            id: 'editing-guide',
            title: '编辑说明',
            content: (
              <div className="space-y-2">
                <p>当前阶段使用 textarea 作为最小可用编辑器。</p>
                <p>保存会触发 manifest 校验；若校验失败会返回明确的错误信息。</p>
              </div>
            ),
          },
          {
            id: 'troubleshooting',
            title: '常见问题',
            content: (
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-slate-900">页面如何切换 manifest 文件？</div>
                  <div className="mt-1 text-slate-600">先在上方保存 manifest 路径，controller 会切换到新文件；worker 仍需手动重启。</div>
                </div>
                <div>
                  <div className="font-medium text-slate-900">保存后配置未生效？</div>
                  <div className="mt-1 text-slate-600">需要手动重启 controller 和 worker 进程才能使新配置生效。</div>
                </div>
                <div>
                  <div className="font-medium text-slate-900">YAML 格式错误？</div>
                  <div className="mt-1 text-slate-600">检查缩进是否使用空格（不要用 Tab），确保键值对格式正确。</div>
                </div>
                <div>
                  <div className="font-medium text-slate-900">如何查看完整配置结构？</div>
                  <div className="mt-1 text-slate-600">参考项目 examples 目录下的示例配置文件，或查看文档了解所有可用字段。</div>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Card compact title="manifest YAML">
        <div className="space-y-3">
          {controllerConfigQuery.data?.manifestPath ? (
            <>
              <textarea
                value={yamlText}
                onChange={(e) => {
                  setSaveHint(null);
                  setHasUserEdited(true);
                  setYamlText(e.target.value);
                }}
                className="h-[420px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-slate-400 focus:outline-none"
                placeholder="在此粘贴或编辑 manifest YAML…"
                spellCheck={false}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 leading-5">
                <div>
                  {yamlText.trim().length === 0 ? '内容为空，将无法保存。' : `字符数：${yamlText.length}`}
                </div>
                <div>{isDirty ? '存在未保存改动' : '无改动'}</div>
              </div>

              {saveMutation.error ? (
                <ErrorNotice message={saveMutation.error instanceof Error ? saveMutation.error.message : '未知错误'} />
              ) : null}
            </>
          ) : (
            <InfoNotice title="尚未配置 manifest 路径" message="先保存 manifest 路径，再读取和编辑 YAML。" />
          )}
        </div>
      </Card>

      {manifestQuery.data?.yamlText ? (
        <Accordion
          type="multiple"
          items={[
            {
              id: 'readonly-preview',
              title: '当前加载版本（只读预览）',
              content: <CodeBlock>{manifestQuery.data.yamlText}</CodeBlock>,
            },
          ]}
        />
      ) : null}

      <FileBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onSelect={handleSelectPath}
        initialPath={manifestPathInput.trim() || controllerConfigQuery.data?.manifestPath || ''}
      />
    </section>
  );
}
