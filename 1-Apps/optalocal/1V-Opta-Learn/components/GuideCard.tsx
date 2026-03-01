'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Guide } from '@/content/guides';
import { appColors, appLabels } from '@/content/guides';

interface GuideCardProps {
  guide: Guide;
  compact?: boolean;
}

export function GuideCard({ guide, compact = false }: GuideCardProps) {
  return (
    <Link href={`/guides/${guide.slug}`}>
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="obsidian-interactive rounded-xl px-5 py-4 border border-white/5 flex items-start gap-4 cursor-pointer"
        style={{ borderLeft: `2px solid ${appColors[guide.app]}40` }}
      >
        <div
          className="w-2 h-2 rounded-full mt-2 shrink-0"
          style={{ backgroundColor: appColors[guide.app] }}
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{guide.title}</span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${appColors[guide.app]}20`,
                color: appColors[guide.app],
              }}
            >
              {appLabels[guide.app]}
            </span>
            {!compact && <span className="text-[10px] font-mono text-text-muted">{guide.category}</span>}
          </div>
          <p className="text-xs text-text-secondary line-clamp-2">{guide.summary}</p>
        </div>

        <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
      </motion.div>
    </Link>
  );
}
