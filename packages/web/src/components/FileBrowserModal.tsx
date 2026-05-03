import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
}

interface FileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
  fileFilter?: (item: FileItem) => boolean;
}

export function FileBrowserModal(props: FileBrowserModalProps): JSX.Element {
  const { isOpen, onClose, onSelect, title = '选择文件', fileFilter } = props;
  
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');

  const loadDirectory = async (path?: string) => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL('/api/file-browser/browse-files', window.location.origin);
      if (path) {
        url.searchParams.set('path', path);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: BrowseResult = await response.json();
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);

      // 根据 filter 过滤项目
      const filteredItems = props.filter
        ? data.items.filter((item) => {
            if (item.type === 'directory') return true;
            return props.filter!(item.name);
          })
        : data.items;

      setItems(filteredItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载目录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory();
      setSelectedPath('');
    }
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    loadDirectory(path);
    setSelectedPath('');
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      handleNavigate(item.path);
    } else {
      setSelectedPath(item.path);
    }
  };

  const handleConfirm = () => {
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
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {currentPath || '加载中...'}
          </div>
          {parentPath && (
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleNavigate(parentPath)}
              disabled={loading}
            >
              上级目录
            </button>
          )}
        </div>

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
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">名称</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">类型</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">大小</th>
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
                      <div className="flex items-center gap-2">
                        {item.type === 'directory' ? (
                          <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                          </svg>
                        )}
                        <span className="text-slate-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">
                      {item.type === 'directory' ? '目录' : '文件'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-slate-600">
                      {formatSize(item.size)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedPath && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="text-xs text-blue-600">已选择</div>
            <div className="mt-1 text-sm text-blue-900">{selectedPath}</div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleConfirm}
            disabled={!selectedPath}
          >
            确认选择
          </button>
        </div>
      </div>
    </Modal>
  );
}
