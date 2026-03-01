'use client';

import { motion } from 'framer-motion';
import { Nav } from '@/components/Nav';
import { OptaRing } from '@/components/OptaRing';
import { SearchBar } from '@/components/SearchBar';
import { allGuides } from '@/content/guides';

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

export default function HomePage() {
  return (
    <main className="min-h-screen bg-void flex flex-col items-center justify-center px-6 bg-dot-subtle">
      <Nav />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex w-full max-w-4xl flex-col items-center"
      >
        <motion.div variants={itemVariants} className="mb-12 flex flex-col items-center gap-4">
          <OptaRing size={72} />
          <div>
            <span className="font-sora text-sm font-semibold tracking-[0.25em] uppercase text-text-muted">
              opta local
            </span>
            <span className="ml-3 font-sora text-sm font-semibold tracking-[0.2em] uppercase text-primary">
              learn
            </span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full flex justify-center">
          <SearchBar guides={allGuides} />
        </motion.div>

        <motion.p variants={itemVariants} className="mt-8 text-xs font-mono text-text-muted">
          {allGuides.length} verified guide available
        </motion.p>
      </motion.div>
    </main>
  );
}
