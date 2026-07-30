/**
 * 数据导出工具
 * 支持 CSV 和 JSON 格式导出
 */

/**
 * 通用导出选项
 */
export interface ExportOptions<T = any> {
  filename?: string;
  includeTimestamp?: boolean;
  columns?: (keyof T)[];
}

/**
 * 将数据转换为 CSV 格式
 */
export function toCSV<T extends Record<string, unknown>>(data: T[], columns?: (keyof T)[]): string {
  if (data.length === 0) return '';

  // 确定列
  const keys = columns ?? (Object.keys(data[0]) as (keyof T)[]);

  // CSV 头部
  const header = keys.map(k => `"${String(k)}"`).join(',');

  // CSV 数据行
  const rows = data.map(row =>
    keys.map(k => {
      const value = row[k];
      if (value === null || value === undefined) return '""';
      const str = String(value);
      // 转义引号并包裹
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 生成带时间戳的文件名
 */
export function generateFilename(baseName: string, extension: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * 导出为 CSV
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions<T> = {}
): void {
  const {
    filename = generateFilename('export', 'csv'),
    columns,
  } = options;

  const csv = toCSV(data, columns);
  downloadFile(csv, filename, 'text/csv;charset=utf-8');
}

/**
 * 导出为 JSON
 */
export function exportToJSON<T>(
  data: T,
  options: ExportOptions = {}
): void {
  const {
    filename = generateFilename('export', 'json'),
  } = options;

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename, 'application/json');
}

/**
 * 表格数据导出 Hook
 */
export function useExport<T extends Record<string, unknown>>(
  data: T[],
  columns?: (keyof T)[]
) {
  const exportCSV = (options?: ExportOptions) => {
    exportToCSV(data, { ...options, columns });
  };

  const exportJSON = (options?: ExportOptions) => {
    exportToJSON(data, options);
  };

  return { exportCSV, exportJSON };
}

export default { toCSV, exportToCSV, exportToJSON, downloadFile, generateFilename };
