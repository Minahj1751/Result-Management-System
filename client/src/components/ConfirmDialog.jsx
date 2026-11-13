import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

/**
 * Confirmation dialog for destructive / important actions.
 * Props: isOpen, onClose, onConfirm, title, message, confirmLabel, danger
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  danger = true,
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={handleConfirm} disabled={busy}>
          {busy ? 'Please wait...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
