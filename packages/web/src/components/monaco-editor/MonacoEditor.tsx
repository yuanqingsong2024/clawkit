import React, { useEffect, useRef, useState, useCallback } from 'react';
import type * as MonacoType from 'monaco-editor';
import './MonacoEditor.css';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: string;
  height?: string | number;
  width?: string | number;
  readOnly?: boolean;
  options?: MonacoType.editor.IStandaloneEditorConstructionOptions;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language = 'yaml',
  theme = 'vs',
  height = '100%',
  width = '100%',
  readOnly = false,
  options = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof MonacoType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化 Monaco Editor
  useEffect(() => {
    // 避免在 SSR 环境中加载
    if (typeof window === 'undefined' || !containerRef.current) return;

    let mounted = true;

  const initEditor = async () => {
    try {
      // 动态导入 Monaco Editor - 使用 lazy 获取正确路径
      const monacoModule = await import('monaco-editor');
      
      if (!mounted) return;
        
        setMonaco(monacoModule);

        // 注册 YAML 语言（如果还没注册）
        if (!monacoModule.languages.getLanguages().some((lang: any) => lang.id === 'yaml')) {
          monacoModule.languages.register({ id: 'yaml' });
        }

        // 创建编辑器实例
        const editor = monacoModule.editor.create(containerRef.current!, {
          value,
          language,
          theme,
          readOnly,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'on',
          folding: true,
          glyphMargin: false,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 4,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          padding: { top: 12, bottom: 12 },
          ...options,
        });

        // 监听内容变化
        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();
          if (newValue !== value) {
            onChange(newValue);
          }
        });

        editorRef.current = editor;
        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : '加载编辑器失败');
          setIsLoading(false);
        }
      }
    };

    initEditor();

    return () => {
      mounted = false;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  // 更新编辑器值
  useEffect(() => {
    if (!editorRef.current) return;
    
    const currentValue = editorRef.current.getValue();
    if (currentValue !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  // 更新主题
  useEffect(() => {
    if (!monaco || !editorRef.current) return;
    monaco.editor.setTheme(theme);
  }, [theme, monaco]);

  // 更新只读状态
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions({ readOnly });
  }, [readOnly]);

  // 调整布局
  useEffect(() => {
    const handleResize = () => {
      editorRef.current?.layout();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (error) {
    return (
      <div className="monaco-editor-error">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="monaco-editor-loading">
        <div className="loading-spinner" />
        <span>正在加载编辑器...</span>
      </div>
    );
  }

  return <div ref={containerRef} className="monaco-editor-container" style={{ height, width }} />;
};

export default MonacoEditor;
