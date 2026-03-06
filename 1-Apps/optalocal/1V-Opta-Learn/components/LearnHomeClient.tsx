'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import type { GuideSearchEntry } from '@/content/guides';
import { Nav } from '@/components/Nav';
import { SearchBar } from '@/components/SearchBar';

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.05,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease,
    },
  },
};

interface LearnHomeClientProps {
  guides: GuideSearchEntry[];
}

export function LearnHomeClient({ guides }: LearnHomeClientProps) {
  return (
    <main className="min-h-screen bg-void flex flex-col items-center pt-32 px-6 bg-dot-subtle relative overflow-hidden">
      <Nav />
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-[#1a1a24]/50 to-transparent -z-10" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex w-full max-w-3xl flex-col items-center"
      >
        <motion.div variants={itemVariants} className="mb-12 flex flex-col items-center gap-6">
          <Image src="/opta-learn-mark.svg" alt="Opta Learn" width={72} height={72} priority />
          <div className="inline-flex items-center">
            <span className="font-sora text-sm font-semibold tracking-[0.25em] uppercase text-text-muted">
              opta
            </span>
            <span className="ml-3 font-sora text-sm font-semibold tracking-[0.2em] uppercase text-primary">
              learn
            </span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full flex justify-center">
          <SearchBar guides={guides} />
        </motion.div>

        <motion.p variants={itemVariants} className="mt-3 text-sm text-center text-text-secondary max-w-2xl">
          Opta Learn is the knowledge surface for Opta. It teaches the canonical model:
          Opta Local is the first public release, Opta AI is the optimizer, and activation
          flows from local LMX or cloud runtime into CLI/Code execution.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full border border-primary/30 text-primary/90">Opta Local: First Public Release</span>
          <span className="px-3 py-1 rounded-full border border-white/15 text-text-secondary">Runtime: Opta LMX or Cloud</span>
          <span className="px-3 py-1 rounded-full border border-white/15 text-text-secondary">Opta AI Activation Core</span>
          <span className="px-3 py-1 rounded-full border border-white/15 text-text-secondary">Execution: Opta CLI + Opta Code</span>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-5 flex flex-wrap justify-center gap-3 text-xs">
          <a href="https://help.optalocal.com" className="text-text-muted hover:text-text-secondary">Help</a>
          <span className="text-text-muted">•</span>
          <a href="https://init.optalocal.com" className="text-text-muted hover:text-text-secondary">Init</a>
          <span className="text-text-muted">•</span>
          <a href="https://admin.optalocal.com" className="text-text-muted hover:text-text-secondary">Admin</a>
          <span className="text-text-muted">•</span>
          <a href="https://status.optalocal.com" className="text-text-secondary hover:text-primary">Status</a>
        </motion.div>

        <motion.p variants={itemVariants} className="mt-8 text-[11px] font-mono text-text-muted tracking-widest uppercase">
          Interactive guides incoming · rebuilt for /gu format
        </motion.p>
      </motion.div>
    </main>
  );
}
