import { Toaster } from 'sonner';
import './Toast.css';

/**
 * Toast 通知系统 - 全局单例组件
 * 使用方式：import { toast } from '@/components/toast';
 * toast.success('操作成功')
 */
export function ToastSystem() {
  return (
    <Toaster
      position="top-right"
      richColors
      expand={false}
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200',
          success: 'group-[.toaster]:bg-green-50 group-[.toaster]:text-green-800 group-[.toaster]:border-green-200',
          error: 'group-[.toaster]:bg-rose-50 group-[.toaster]:text-rose-800 group-[.toaster]:border-rose-200 group-[.toaster]:border-rose-200',
          warning: 'group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-800 group-[.toaster]:border-amber-200',
          info: 'group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-800 group-[.toaster]:border-blue-200',
          loading: 'group-[.toaster]:bg-slate-50 group-[.toaster]:text-slate-800 group-[.toaster]:border-slate-200',
        },
      }}
      />
  );
}

/**
 * Toast 服务 - 提供类型安全的 toast 函数
 * 用法：
 * import { toast } from '@components/toast';
 * toast.success('成功消息')
 * toast.error('错误消息')
 * toast.info('提示消息')
 * toast.warning('警告消息')
 * toast.loading('加载中...')
 * toast.success('完成!', { duration: 5000 })
 */
export { toast } from 'sonner';

export default ToastSystem;
