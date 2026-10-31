import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  isDanger?: boolean;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  isDanger,
  type = 'danger',
}) => {
  const displayConfirm = confirmText || confirmLabel || 'Confirm';
  const displayCancel = cancelText || cancelLabel || 'Cancel';
  const dangerous = isDanger !== undefined ? isDanger : type === 'danger';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-[var(--border-glass)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {displayCancel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md text-white transition-colors ${
              dangerous
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {displayConfirm}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 py-2">
        <div className="p-2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-0.5">{message}</p>
      </div>
    </Modal>
  );
};
