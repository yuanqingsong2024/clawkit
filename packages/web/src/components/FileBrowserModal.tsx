import { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/Modal';
import { InputDialog } from './ui/InputDialog';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { secondaryButtonClassName } from './ui/styles';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  git?: {
    isRepo: boolean;
    currentBranch?: string;
    remoteUrl?: string | null;
  };
}

interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
  locations?: Array<{
    label: string;
    path: string;
  }>;
}

interface BreadcrumbItem {
  label: string;
  path: string;
}

interface RecentEntry {
  path: string;
  label: string;
}

interface FavoriteEntry {
  path: string;
  label: string;
}

interface FavoriteRenameState {
  isOpen: boolean;
  path: string;
  initialValue: string;
}

type ConfirmAction = 'clearRecent' | 'resetPreferences';

const RECENT_PATH_STORAGE_KEY = 'clawkit.file-browser.recent-paths';
const FAVORITE_PATH_STORAGE_KEY = 'clawkit.file-browser.favorite-paths';
const COLLAPSED_GROUPS_STORAGE_KEY = 'clawkit.file-browser.collapsed-groups';
const FILE_BROWSER_PREFERENCE_KEYS = [RECENT_PATH_STORAGE_KEY, FAVORITE_PATH_STORAGE_KEY, COLLAPSED_GROUPS_STORAGE_KEY] as const;
const MAX_RECENT_PATHS = 8;
const MAX_FAVORITE_PATHS = 12;
const DEFAULT_FAVORITE_PATHS: FavoriteEntry[] = [
  { label: '主目录', path: '~' },
  { label: '根目录', path: '/' },
  { label: '项目目录', path: '~/projects' },
  { label: '工作目录', path: '~/work' },
  { label: '下载目录', path: '~/Downloads' },
];

interface FileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
  selectLabel?: string;
  selectType?: 'file' | 'directory';
  initialPath?: string;
  filter?: (item: FileItem) => boolean;
}

export function FileBrowserModal(props: FileBrowserModalProps): JSX.Element {
  const {
    isOpen,
    onClose,
    onSelect,
    title = '选择文件',
    selectLabel = '确认选择',
    selectType = 'file',
    initialPath,
  } = props;
  
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [pathInput, setPathInput] = useState<string>('');
  const [favoriteEntries, setFavoriteEntries] = useState<FavoriteEntry[]>(DEFAULT_FAVORITE_PATHS);
  const [favoriteRenameState, setFavoriteRenameState] = useState<FavoriteRenameState>({
    isOpen: false,
    path: '',
    initialValue: '',
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    recent: false,
    favorite: false,
  });
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');

  const deriveEntryLabel = (entryPath: string): string => {
    const normalized = entryPath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!normalized || normalized === '/') {
      return '/';
    }

    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || normalized;
  };

  const persistRecentEntries = (entries: RecentEntry[]): void => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(RECENT_PATH_STORAGE_KEY, JSON.stringify(entries));
  };

  const persistFavoriteEntries = (entries: FavoriteEntry[]): void => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(FAVORITE_PATH_STORAGE_KEY, JSON.stringify(entries));
  };

  const persistCollapsedGroups = (groups: Record<string, boolean>): void => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  };

  const clearRecentEntries = (): void => {
    setRecentEntries([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(RECENT_PATH_STORAGE_KEY);
    }
  };

  const resetFileBrowserPreferences = (): void => {
    setRecentEntries([]);
    setFavoriteEntries(DEFAULT_FAVORITE_PATHS);
    setCollapsedGroups({ recent: false, favorite: false });

    if (typeof window !== 'undefined') {
      for (const key of FILE_BROWSER_PREFERENCE_KEYS) {
        window.localStorage.removeItem(key);
      }
    }
  };

  const addRecentEntry = (entryPath: string, label?: string): void => {
    const trimmedPath = entryPath.trim();
    if (!trimmedPath) {
      return;
    }

    const nextEntry: RecentEntry = {
      path: trimmedPath,
      label: label?.trim() || deriveEntryLabel(trimmedPath),
    };

    setRecentEntries((prev) => {
      const nextEntries = [nextEntry, ...prev.filter((item) => item.path !== nextEntry.path)].slice(0, MAX_RECENT_PATHS);
      persistRecentEntries(nextEntries);
      return nextEntries;
    });
  };

  const addFavoriteEntry = (entryPath: string, label?: string): void => {
    const trimmedPath = entryPath.trim();
    if (!trimmedPath) {
      return;
    }

    const nextEntry: FavoriteEntry = {
      path: trimmedPath,
      label: label?.trim() || deriveEntryLabel(trimmedPath),
    };

    setFavoriteEntries((prev) => {
      const nextEntries = [nextEntry, ...prev.filter((item) => item.path !== nextEntry.path)].slice(0, MAX_FAVORITE_PATHS);
      persistFavoriteEntries(nextEntries);
      return nextEntries;
    });
  };

  const renameFavoriteEntry = (path: string, label: string): void => {
    const nextLabel = label.trim();
    if (!nextLabel) {
      return;
    }

    setFavoriteEntries((prev) => {
      const nextEntries = prev.map((item) => (item.path === path ? { ...item, label: nextLabel } : item));
      persistFavoriteEntries(nextEntries);
      return nextEntries;
    });
  };

  const removeFavoriteEntry = (path: string): void => {
    setFavoriteEntries((prev) => {
      const nextEntries = prev.filter((item) => item.path !== path);
      persistFavoriteEntries(nextEntries);
      return nextEntries.length > 0 ? nextEntries : DEFAULT_FAVORITE_PATHS;
    });
  };

  const moveFavoriteEntry = (path: string, direction: 'up' | 'down'): void => {
    setFavoriteEntries((prev) => {
      const index = prev.findIndex((item) => item.path === path);
      if (index < 0) {
        return prev;
      }

      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const nextEntries = [...prev];
      [nextEntries[index], nextEntries[nextIndex]] = [nextEntries[nextIndex], nextEntries[index]];
      persistFavoriteEntries(nextEntries);
      return nextEntries;
    });
  };

  const toggleGroupCollapse = (group: 'recent' | 'favorite'): void => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const getConfirmDialogContent = (): { title: string; message: string; confirmLabel: string } => {
    if (confirmAction === 'resetPreferences') {
      return {
        title: '重置目录选择器偏好',
        message: '确定要重置所有目录选择器偏好吗？最近访问、固定常用目录和分组折叠状态都会恢复默认。',
        confirmLabel: '重置',
      };
    }

    return {
      title: '清空最近访问',
      message: '确定要清空最近访问记录吗？清空后左侧最近访问分组将恢复为空。',
      confirmLabel: '清空',
    };
  };

  const handleConfirmAction = (): void => {
    if (confirmAction === 'resetPreferences') {
      resetFileBrowserPreferences();
    }

    if (confirmAction === 'clearRecent') {
      clearRecentEntries();
    }

    setConfirmAction(null);
  };

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      const record = parsed as Record<string, unknown>;
      setCollapsedGroups({
        recent: record.recent === true,
        favorite: record.favorite === true,
      });
    } catch {
      // 解析失败时保留默认展开状态即可。
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    persistCollapsedGroups(collapsedGroups);
  }, [collapsedGroups, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(RECENT_PATH_STORAGE_KEY);
      if (!raw) {
        setRecentEntries([]);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setRecentEntries([]);
        return;
      }

      const entries = parsed
        .filter((item): item is RecentEntry => {
          if (!item || typeof item !== 'object') return false;
          const record = item as { path?: unknown; label?: unknown };
          return typeof record.path === 'string' && typeof record.label === 'string';
        })
        .slice(0, MAX_RECENT_PATHS);

      setRecentEntries(entries);
    } catch {
      setRecentEntries([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(FAVORITE_PATH_STORAGE_KEY);
      if (!raw) {
        setFavoriteEntries(DEFAULT_FAVORITE_PATHS);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setFavoriteEntries(DEFAULT_FAVORITE_PATHS);
        return;
      }

      const entries = parsed
        .filter((item): item is FavoriteEntry => {
          if (!item || typeof item !== 'object') return false;
          const record = item as { path?: unknown; label?: unknown };
          return typeof record.path === 'string' && typeof record.label === 'string';
        })
        .slice(0, MAX_FAVORITE_PATHS);

      setFavoriteEntries(entries.length > 0 ? entries : DEFAULT_FAVORITE_PATHS);
    } catch {
      setFavoriteEntries(DEFAULT_FAVORITE_PATHS);
    }
  }, [isOpen]);

  const fetchDirectory = async (path?: string): Promise<BrowseResult> => {
    const url = new URL('/api/file-browser/browse-files', window.location.origin);
    if (path) {
      url.searchParams.set('path', path);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '未知错误' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<BrowseResult>;
  };

  const loadDirectory = async (path?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchDirectory(path);
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setPathInput(data.currentPath);
      addRecentEntry(data.currentPath);

      // 根据 filter 过滤项目
      const filteredItems = props.filter ? data.items.filter((item) => props.filter!(item)) : data.items;

      setItems(filteredItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载目录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory(initialPath);
      setSelectedPath('');
    }
  }, [initialPath, isOpen]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    if (!currentPath) return [];

    const normalized = currentPath.replace(/\\/g, '/');
    const isWindowsDrive = /^[A-Za-z]:\//.test(normalized);
    const parts = normalized.split('/').filter(Boolean);

    if (parts.length === 0) {
      return [{ label: '/', path: '/' }];
    }

    if (isWindowsDrive) {
      const drive = parts[0];
      const items: BreadcrumbItem[] = [{ label: `${drive}\\`, path: `${drive}\\` }];
      let current = `${drive}\\`;

      for (const part of parts.slice(1)) {
        current = current.endsWith('\\') ? `${current}${part}` : `${current}\\${part}`;
        items.push({ label: part, path: current });
      }

      return items;
    }

    const items: BreadcrumbItem[] = [{ label: '/', path: '/' }];
    let current = '';
    for (const part of parts) {
      current = `${current}/${part}`;
      items.push({ label: part, path: current });
    }

    return items;
  }, [currentPath]);

  const handleNavigate = (path: string): void => {
    loadDirectory(path);
    setSelectedPath('');
  };

  const handleItemClick = (item: FileItem): void => {
    if (item.type === 'directory') {
      handleNavigate(item.path);
    } else {
      setSelectedPath(item.path);
    }
  };

  const handleSelectDirectory = (path: string): void => {
    setSelectedPath(path);
    addRecentEntry(path);
  };

  const handlePathSubmit = (): void => {
    const nextPath = pathInput.trim();
    if (!nextPath) {
      return;
    }

    handleNavigate(nextPath);
  };

  const handleConfirm = (): void => {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
    }
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
        <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-500">路径跳转</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePathSubmit();
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="输入路径后按回车跳转"
            />
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={handlePathSubmit}
              disabled={loading || pathInput.trim().length === 0}
            >
              跳转
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-medium text-slate-500">当前目录</div>
            <div className="break-all text-sm text-slate-900">{currentPath || '加载中...'}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {parentPath && (
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => handleNavigate(parentPath)}
                disabled={loading}
              >
                上级目录
              </button>
            )}
            {selectType === 'directory' && currentPath && (
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => handleSelectDirectory(currentPath)}
                disabled={loading}
              >
                选择当前目录
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleConfirm}
              disabled={!selectedPath}
            >
              {selectLabel}
            </button>
          </div>
        </div>

        {breadcrumbs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>当前位置</span>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;

              return (
                <div key={`${item.path}-${index}`} className="flex items-center gap-2">
                  {index > 0 ? <span className="text-slate-300">/</span> : null}
                  {isLast ? (
                    <span className="font-medium text-slate-700">{item.label}</span>
                  ) : (
                    <button
                      type="button"
                      className="rounded px-1 py-0.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      onClick={() => handleNavigate(item.path)}
                      disabled={loading}
                    >
                      {item.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-slate-500">本地偏好</div>
              <button
                type="button"
                className="text-xs font-medium text-rose-600 transition-colors hover:text-rose-700"
                onClick={() => setConfirmAction('resetPreferences')}
              >
                重置全部
              </button>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
                  onClick={() => toggleGroupCollapse('recent')}
                >
                  <span>最近访问</span>
                  <span className="text-[10px]">{collapsedGroups.recent ? '展开' : '收起'}</span>
                </button>
                {recentEntries.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
                    onClick={() => setConfirmAction('clearRecent')}
                  >
                    清空
                  </button>
                )}
              </div>
              {!collapsedGroups.recent && (recentEntries.length > 0 ? (
                <div className="space-y-2">
                  {recentEntries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleNavigate(entry.path)}
                      disabled={loading || entry.path === currentPath}
                    >
                      <span className="truncate">{entry.label}</span>
                      <span className="ml-2 max-w-[120px] truncate text-xs text-slate-400">{entry.path}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
                  暂无最近访问
                </div>
              ))}
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
                  onClick={() => toggleGroupCollapse('favorite')}
                >
                  <span>固定常用</span>
                  <span className="text-[10px]">{collapsedGroups.favorite ? '展开' : '收起'}</span>
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                  onClick={() => addFavoriteEntry(currentPath, deriveEntryLabel(currentPath))}
                  disabled={!currentPath || loading}
                >
                  固定当前目录
                </button>
              </div>
              {!collapsedGroups.favorite && (
              <div className="space-y-2">
                {favoriteEntries.length > 0 ? (
                  favoriteEntries.map((entry) => {
                    const isFixedPath = DEFAULT_FAVORITE_PATHS.some((item) => item.path === entry.path);
                    return (
                      <div
                        key={entry.path}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center justify-between text-left text-sm text-slate-700 transition-colors hover:text-slate-900"
                          onClick={() => handleNavigate(entry.path)}
                          disabled={loading || entry.path === currentPath}
                        >
                          <span className="truncate">{entry.label}</span>
                          <span className="ml-2 max-w-[120px] truncate text-xs text-slate-400">{entry.path}</span>
                        </button>
                        {!isFixedPath && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => moveFavoriteEntry(entry.path, 'up')}
                              disabled={favoriteEntries.findIndex((item) => item.path === entry.path) <= 0}
                            >
                              上移
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => moveFavoriteEntry(entry.path, 'down')}
                              disabled={favoriteEntries.findIndex((item) => item.path === entry.path) >= favoriteEntries.length - 1}
                            >
                              下移
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                              onClick={() => {
                                setFavoriteRenameState({
                                  isOpen: true,
                                  path: entry.path,
                                  initialValue: entry.label,
                                });
                              }}
                            >
                              重命名
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                              onClick={() => removeFavoriteEntry(entry.path)}
                            >
                              取消
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
                    暂无固定常用目录
                  </div>
                )}
              </div>
              )}
            </div>

          </aside>

          <div className="space-y-3">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              目录为空
            </div>
          ) : (
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[36%]" />
                <col className="w-20" />
                <col />
                <col className="w-20" />
                {selectType === 'directory' && <col className="w-24" />}
              </colgroup>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">名称</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 whitespace-nowrap">类型</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Git 信息</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 whitespace-nowrap">大小</th>
                  {selectType === 'directory' && (
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 whitespace-nowrap">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    className={[
                      'cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50',
                      selectedPath === item.path ? 'bg-blue-50' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        {item.type === 'directory' ? (
                          <svg className="h-4 w-4 shrink-0 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                          </svg>
                        )}
                        <span className="truncate text-slate-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">
                      {item.type === 'directory' ? '目录' : '文件'}
                    </td>
                    <td className="min-w-0 px-4 py-2 text-sm text-slate-600">
                      {item.git?.isRepo ? (
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-medium text-slate-900">Git</div>
                          <div className="text-xs text-slate-500">{item.git.currentBranch || 'HEAD'}</div>
                          <div className="truncate text-xs text-slate-500">
                            {item.git.remoteUrl || '未配置远程'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-slate-600 whitespace-nowrap">
                      {formatSize(item.size)}
                    </td>
                    {selectType === 'directory' && (
                      <td className="px-4 py-2 text-right text-sm">
                        {item.type === 'directory' ? (
                          <button
                            type="button"
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectDirectory(item.path);
                            }}
                          >
                            选择
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
            </div>
          </div>
        </div>

        {selectedPath && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="text-xs text-blue-600">已选择</div>
            <div className="mt-1 text-sm text-blue-900">{selectedPath}</div>
          </div>
        )}

        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={getConfirmDialogContent().title}
        message={getConfirmDialogContent().message}
        confirmLabel={getConfirmDialogContent().confirmLabel}
        cancelLabel="取消"
        danger
      />

      <InputDialog
        isOpen={favoriteRenameState.isOpen}
        onClose={() => setFavoriteRenameState({ isOpen: false, path: '', initialValue: '' })}
        onConfirm={(value) => {
          renameFavoriteEntry(favoriteRenameState.path, value);
          setFavoriteRenameState({ isOpen: false, path: '', initialValue: '' });
        }}
        title="重命名固定目录"
        label="显示名称"
        initialValue={favoriteRenameState.initialValue}
        confirmLabel="保存"
        cancelLabel="取消"
      />
    </>
  );
}
