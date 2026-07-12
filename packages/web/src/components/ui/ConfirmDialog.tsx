import { Modal } from './Modal';
import { primaryButtonClassName, secondaryButtonClassName } from './styles';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const {
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = '确认',
    cancelLabel = '取消',
    danger = false,
  } = props;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{message}</p>
        
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClassName}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`${primaryButtonClassName} ${danger ? 'bg-rose-600 hover:bg-rose-500' : ''}`.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
