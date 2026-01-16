import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShareCard } from './ShareCard';
import {
  shareToTwitter,
  copyShareText,
  copyToClipboard,
  saveAsImage,
  supportsImageClipboard,
} from '@/lib/shareUtils';
import type { OptaScore } from '@/types/scoring';
import {
  X,
  Twitter,
  Download,
  Check,
  Image,
  MessageSquare,
} from 'lucide-react';

interface ShareModalProps {
  score: OptaScore;
  isOpen: boolean;
  onClose: () => void;
}

type CopyState = 'idle' | 'copying' | 'copied';

/**
 * ShareModal - Modal for sharing score to various platforms.
 * Provides options to share via Twitter, copy text, copy image, or download.
 */
export function ShareModal({ score, isOpen, onClose }: ShareModalProps) {
  const [copyTextState, setCopyTextState] = useState<CopyState>('idle');
  const [copyImageState, setCopyImageState] = useState<CopyState>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const handleCopyText = useCallback(async () => {
    setCopyTextState('copying');
    const success = await copyShareText(score);
    setCopyTextState(success ? 'copied' : 'idle');
    if (success) {
      setTimeout(() => setCopyTextState('idle'), 2000);
    }
  }, [score]);

  const handleCopyImage = useCallback(async () => {
    if (!shareCardRef.current) return;
    setCopyImageState('copying');
    const success = await copyToClipboard(shareCardRef.current);
    setCopyImageState(success ? 'copied' : 'idle');
    if (success) {
      setTimeout(() => setCopyImageState('idle'), 2000);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!shareCardRef.current) return;
    setIsExporting(true);
    try {
      await saveAsImage(shareCardRef.current, score);
    } finally {
      setIsExporting(false);
    }
  }, [score]);

  const handleTwitterShare = useCallback(() => {
    shareToTwitter(score);
  }, [score]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-lg"
          >
            <div className="glass-strong rounded-2xl border border-border/30 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/20">
                <h2 className="text-lg font-semibold">Share Your Score</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="rounded-lg w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Share Options */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Twitter/X */}
                  <ShareOption
                    icon={Twitter}
                    label="Share on X"
                    description="Post your score"
                    onClick={handleTwitterShare}
                    colorClass="primary"
                  />

                  {/* Copy Text */}
                  <ShareOption
                    icon={copyTextState === 'copied' ? Check : MessageSquare}
                    label={copyTextState === 'copied' ? 'Copied!' : 'Copy for Discord'}
                    description="Copy formatted text"
                    onClick={handleCopyText}
                    colorClass="accent"
                    disabled={copyTextState === 'copying'}
                  />

                  {/* Copy Image */}
                  {supportsImageClipboard() && (
                    <ShareOption
                      icon={copyImageState === 'copied' ? Check : Image}
                      label={copyImageState === 'copied' ? 'Copied!' : 'Copy Image'}
                      description="Copy score card"
                      onClick={handleCopyImage}
                      colorClass="success"
                      disabled={copyImageState === 'copying'}
                    />
                  )}

                  {/* Download */}
                  <ShareOption
                    icon={Download}
                    label="Download"
                    description="Save as PNG"
                    onClick={handleExport}
                    colorClass="warning"
                    disabled={isExporting}
                  />
                </div>

                {/* Preview Note */}
                <p className="text-xs text-muted-foreground text-center">
                  Your score card will be exported as a shareable image
                </p>
              </div>
            </div>
          </motion.div>

          {/* Hidden ShareCard for export - rendered off-screen */}
          <div className="fixed -left-[9999px] -top-[9999px]">
            <ShareCard ref={shareCardRef} score={score} />
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ShareOptionProps {
  icon: typeof Twitter;
  label: string;
  description: string;
  onClick: () => void;
  colorClass: 'primary' | 'accent' | 'success' | 'warning';
  disabled?: boolean;
}

const colorMap = {
  primary: {
    bg: 'bg-primary/10 hover:bg-primary/20',
    border: 'border-primary/30',
    text: 'text-primary',
  },
  accent: {
    bg: 'bg-accent/10 hover:bg-accent/20',
    border: 'border-accent/30',
    text: 'text-accent',
  },
  success: {
    bg: 'bg-success/10 hover:bg-success/20',
    border: 'border-success/30',
    text: 'text-success',
  },
  warning: {
    bg: 'bg-warning/10 hover:bg-warning/20',
    border: 'border-warning/30',
    text: 'text-warning',
  },
};

function ShareOption({
  icon: Icon,
  label,
  description,
  onClick,
  colorClass,
  disabled,
}: ShareOptionProps) {
  const colors = colorMap[colorClass];

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border text-left transition-colors',
        colors.bg,
        colors.border,
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center border',
          colors.bg,
          colors.border
        )}
      >
        <Icon className={cn('w-5 h-5', colors.text)} strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </motion.button>
  );
}

export default ShareModal;
