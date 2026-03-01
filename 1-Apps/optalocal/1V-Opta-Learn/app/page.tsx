'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Nav } from '@/components/Nav';
import { SearchBar } from '@/components/SearchBar';
import { getPublishedGuides } from '@/content/guides';

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
  const publishedGuides = getPublishedGuides();

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
          <Image
            src="/opta-learn-logo-final.png"
            alt="Opta Learn"
            width={88}
            height={88}
            priority
          />
          <div className="inline-flex items-center">
            <span className="font-sora text-sm font-semibold tracking-[0.25em] uppercase text-text-muted">
              opta local
            </span>
            <span className="ml-3 font-sora text-sm font-semibold tracking-[0.2em] uppercase text-primary">
              learn
            </span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full flex justify-center">
          <SearchBar guides={publishedGuides} />
        </motion.div>

        <motion.p variants={itemVariants} className="mt-8 text-xs font-mono text-text-muted">
          {publishedGuides.length} guides available · more added continuously
        </motion.p>
      </motion.div>
    </main>
  );
}
