import React from 'react';
import Modal from './common/Modal';
import Button from './common/Button';
import { AlertTriangle, Trash2 } from 'lucide-react';

const DeleteVideoModal = ({
  isOpen,
  onClose,
  onConfirm,
  videoTitle = '',
  isDeleting = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      title="Delete Video"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start space-x-3 p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-300">
            <p className="font-semibold mb-1">Permanent Deletion</p>
            <p>
              Deleting a video cannot be undone. Its video files, thumbnails, and views will be permanently removed from our servers.
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300">
          Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{videoTitle}"</span>?
        </p>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onConfirm}
            isLoading={isDeleting}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete Video
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteVideoModal;
