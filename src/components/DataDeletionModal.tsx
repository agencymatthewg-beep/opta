/**
 * DataDeletionModal component for confirming data deletion.
 *
 * Provides a clear confirmation flow before permanently deleting all user data.
 * Lists exactly what will be deleted and requires typed confirmation ("DELETE").
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { AlertTriangle, Trash2 } from 'lucide-react';

interface DataDeletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

/**
 * DataDeletionModal provides clear confirmation flow with typed confirmation.
 * User must type "DELETE" to enable the delete button.
 */
export function DataDeletionModal({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: DataDeletionModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === 'DELETE';

  // Reset confirmation text when modal opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmText('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass rounded-xl border border-border/30 sm:max-w-md">
        <DialogHeader>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 text-danger"
          >
            <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
            <DialogTitle>Delete All Data?</DialogTitle>
          </motion.div>
          <DialogDescription className="text-left pt-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              This will permanently delete:
              <ul className="list-disc list-inside mt-3 space-y-1.5 text-sm text-muted-foreground/70">
                <motion.li
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  Your preferences (mode, depth, style)
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  All learned patterns and insights
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  Optimization history and choices
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Statistics and member data
                </motion.li>
              </ul>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="mt-4 font-medium text-foreground"
              >
                This action cannot be undone.
              </motion.p>
            </motion.div>
          </DialogDescription>
        </DialogHeader>

        {/* Typed confirmation input */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="py-2"
        >
          <label className="block text-sm text-muted-foreground/70 mb-2">
            Type <span className="font-mono font-semibold text-danger">DELETE</span> to confirm
          </label>
          <Input
            value={confirmText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="Type DELETE to confirm"
            className="glass-subtle border-border/30 font-mono"
            disabled={loading}
            autoFocus
          />
        </motion.div>

        <DialogFooter className="gap-2 sm:gap-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-lg"
            >
              Cancel
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={loading || !isConfirmed}
              className="rounded-lg"
            >
              {loading ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" strokeWidth={1.75} />
                  Delete All Data
                </>
              )}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DataDeletionModal;
