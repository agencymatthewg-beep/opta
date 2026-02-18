'use client';

/**
 * RAG Page — Manage RAG collections, ingest documents, and query them.
 *
 * Three-panel layout:
 * - Left sidebar: collection list (collapsible on mobile)
 * - Main area: tabbed interface (Ingest / Query)
 *
 * Initializes its own LMXClient from connection settings, same pattern
 * as ChatPage and SessionsPage.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  Search,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import Link from 'next/link';
import { cn, Button } from '@opta/ui';

import { createClient, getConnectionSettings } from '@/lib/connection';
import type { LMXClient } from '@/lib/lmx-client';
import { useRAG } from '@/hooks/useRAG';
import { CollectionList } from '@/components/rag/CollectionList';
import { IngestPanel } from '@/components/rag/IngestPanel';
import { QueryPanel } from '@/components/rag/QueryPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActiveTab = 'ingest' | 'query';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RAGPage() {
  // Client initialization
  const [client, setClient] = useState<LMXClient | null>(null);
  const [settingsError, setSettingsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const settings = await getConnectionSettings();
        if (!cancelled) {
          setClient(createClient(settings));
        }
      } catch {
        if (!cancelled) {
          setSettingsError(true);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // RAG hook
  const {
    collections,
    isLoading,
    error,
    ingestDocuments,
    queryCollection,
    deleteCollection,
    refreshCollections,
  } = useRAG(client);

  // UI state
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('ingest');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auto-select first collection when loaded
  useEffect(() => {
    if (!selectedCollection && collections.length > 0) {
      setSelectedCollection(collections[0]!.name);
    }
  }, [collections, selectedCollection]);

  // If selected collection was deleted, clear selection
  useEffect(() => {
    if (
      selectedCollection &&
      collections.length > 0 &&
      !collections.some((c) => c.name === selectedCollection)
    ) {
      setSelectedCollection(collections[0]?.name ?? null);
    }
  }, [collections, selectedCollection]);

  const handleNewCollection = useCallback(() => {
    setSelectedCollection(null);
    setActiveTab('ingest');
  }, []);

  const handleSelectCollection = useCallback((name: string) => {
    setSelectedCollection(name);
    setActiveTab('query');
  }, []);

  const handleDeleteCollection = useCallback(
    (name: string) => {
      void deleteCollection(name);
    },
    [deleteCollection],
  );

  // Settings error state
  if (settingsError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="glass-subtle max-w-sm rounded-xl p-8 text-center">
          <p className="mb-2 text-lg font-semibold text-text-primary">
            Settings Error
          </p>
          <p className="mb-4 text-sm text-text-secondary">
            Could not load connection settings. Please configure your server
            connection.
          </p>
          <Link href="/settings">
            <Button variant="primary" size="md">
              Go to Settings
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10',
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <h1 className="text-lg font-semibold text-text-primary">
          RAG Collections
        </h1>

        {/* Sidebar toggle (visible on all sizes) */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className={cn(
            'ml-auto p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10',
          )}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeft className="w-5 h-5" />
          )}
        </button>
      </header>

      {/* Content: sidebar + main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex-shrink-0 border-r border-opta-border overflow-hidden"
            >
              <CollectionList
                collections={collections}
                selectedCollection={selectedCollection}
                onSelect={handleSelectCollection}
                onDelete={handleDeleteCollection}
                onNewCollection={handleNewCollection}
                onRefresh={refreshCollections}
                isLoading={isLoading}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-6 pt-4 pb-2">
            <button
              onClick={() => setActiveTab('ingest')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'ingest'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-primary/5 border border-transparent',
              )}
            >
              <Upload className="h-4 w-4" />
              Ingest
            </button>
            <button
              onClick={() => setActiveTab('query')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'query'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-primary/5 border border-transparent',
              )}
            >
              <Search className="h-4 w-4" />
              Query
            </button>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-6 mb-2"
              >
                <div className="glass-subtle rounded-xl px-4 py-3 text-sm text-neon-amber border border-neon-amber/20">
                  Unable to load collections. Make sure the LMX server is
                  running and RAG is enabled.
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <AnimatePresence mode="wait">
              {activeTab === 'ingest' && (
                <motion.div
                  key="ingest"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-2xl py-2"
                >
                  <IngestPanel
                    selectedCollection={selectedCollection}
                    existingCollections={collections.map((c) => c.name)}
                    onIngest={ingestDocuments}
                  />
                </motion.div>
              )}

              {activeTab === 'query' && (
                <motion.div
                  key="query"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-3xl py-2"
                >
                  <QueryPanel
                    selectedCollection={selectedCollection}
                    onQuery={queryCollection}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
