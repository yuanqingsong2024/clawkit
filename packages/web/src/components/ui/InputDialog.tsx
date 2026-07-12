import { useEffect, useState } from 'react';

import { Modal } from './Modal';
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from './styles';

export interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function InputDialog(props: InputDialogProps): JSX.Element {
  const {
    isOpen,
    onClose,
    onConfirm,
    title,
    label,
    placeholder,
    initialValue = '',
    confirmLabel = '确认',
    cancelLabel = '取消',
  } = props;

  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [initialValue, isOpen]);

  const handleConfirm = (): void => {
    onConfirm(value.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className={inputClassName}
            autoFocus
          />
        </div>

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
            className={primaryButtonClassName}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
