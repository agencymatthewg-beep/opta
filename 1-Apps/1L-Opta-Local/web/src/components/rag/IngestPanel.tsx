'use client';

/**
 * IngestPanel — Document ingestion interface for RAG collections.
 *
 * Supports text input (paste documents), drag-and-drop file upload
 * (.txt, .md, .py, .ts, .js, etc.), collection name entry, and
 * chunking strategy configuration. Auto-detects code chunking
 * from file extension.
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  Loader2,
  AlertCircle,
  Settings2,
} from 'lucide-react';
import { cn, Button, Badge } from '@opta/ui';
import type { RagIngestRequest, RagIngestResponse } from '@/types/rag';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** File extensions recognized as code for auto-chunking detection */
const CODE_EXTENSIONS = new Set([
  '.py', '.ts', '.tsx', '.js', '.jsx', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.swift', '.kt',
  '.scala', '.sh', '.bash', '.zsh', '.fish', '.lua', '.r',
  '.sql', '.toml', '.yaml', '.yml', '.json', '.xml', '.html',
  '.css', '.scss', '.sass', '.less',
]);

/** Accepted file extensions for drag-and-drop */
const ACCEPTED_EXTENSIONS = [
  '.txt', '.md', '.py', '.ts', '.tsx', '.js', '.jsx', '.rs',
  '.go', '.java', '.c', '.cpp', '.h', '.cs', '.rb', '.swift',
  '.kt', '.sh', '.bash', '.toml', '.yaml', '.yml', '.json',
  '.xml', '.html', '.css', '.scss', '.sql', '.log', '.csv',
];

type ChunkingStrategy = 'auto' | 'text' | 'code' | 'none';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IngestPanelProps {
  /** Pre-fill collection name (when adding to existing) */
  selectedCollection?: string | null;
  /** All existing collection names (for autocomplete/validation) */
  existingCollections: string[];
  /** Called to ingest documents */
  onIngest: (req: RagIngestRequest) => Promise<RagIngestResponse>;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function detectChunking(filename: string): ChunkingStrategy {
  const ext = getFileExtension(filename);
  return CODE_EXTENSIONS.has(ext) ? 'code' : 'text';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IngestPanel({
  selectedCollection,
  existingCollections,
  onIngest,
  className,
}: IngestPanelProps) {
  // Form state
  const [collectionName, setCollectionName] = useState(
    selectedCollection ?? '',
  );
  const [documentText, setDocumentText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; content: string }>
  >([]);
  const [chunking, setChunking] = useState<ChunkingStrategy>('auto');
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(64);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Action state
  const [isIngesting, setIsIngesting] = useState(false);
  const [result, setResult] = useState<RagIngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update collection name when selection changes
  const prevSelectedRef = useRef(selectedCollection);
  if (selectedCollection !== prevSelectedRef.current) {
    prevSelectedRef.current = selectedCollection;
    if (selectedCollection) {
      setCollectionName(selectedCollection);
    }
  }

  // Read files via FileReader
  const readFiles = useCallback(async (files: FileList | File[]) => {
    const newFiles: Array<{ name: string; content: string }> = [];

    for (const file of Array.from(files)) {
      const ext = getFileExtension(file.name);
      if (
        !ACCEPTED_EXTENSIONS.includes(ext) &&
        !file.type.startsWith('text/')
      ) {
        continue;
      }

      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        });
        newFiles.push({ name: file.name, content });
      } catch {
        // Skip unreadable files
      }
    }

    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // Auto-detect chunking from first uploaded code file
      const codeFile = newFiles.find(
        (f) => detectChunking(f.name) === 'code',
      );
      if (codeFile && chunking === 'auto') {
        // Keep auto — the backend handles auto detection
      }
    }
  }, [chunking]);

  // Drag and drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        void readFiles(e.dataTransfer.files);
      }
    },
    [readFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void readFiles(e.target.files);
      }
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [readFiles],
  );

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Ingest handler
  const handleIngest = useCallback(async () => {
    const name = collectionName.trim();
    if (!name) return;

    // Gather all documents
    const documents: string[] = [];
    const metadata: Record<string, unknown>[] = [];

    // Add pasted text as a document
    if (documentText.trim()) {
      documents.push(documentText.trim());
      metadata.push({ source: 'pasted-text' });
    }

    // Add uploaded files as documents
    for (const file of uploadedFiles) {
      documents.push(file.content);
      metadata.push({
        source: file.name,
        filename: file.name,
        extension: getFileExtension(file.name),
      });
    }

    if (documents.length === 0) return;

    // Determine chunking strategy
    let effectiveChunking = chunking;
    if (chunking === 'auto' && uploadedFiles.length > 0) {
      // If all files are code, use code chunking
      const allCode = uploadedFiles.every(
        (f) => detectChunking(f.name) === 'code',
      );
      if (allCode && !documentText.trim()) {
        effectiveChunking = 'code';
      }
    }

    setIsIngesting(true);
    setError(null);
    setResult(null);

    try {
      const res = await onIngest({
        collection: name,
        documents,
        metadata,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        chunking: effectiveChunking,
      });
      setResult(res);
      // Clear form on success
      setDocumentText('');
      setUploadedFiles([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to ingest documents',
      );
    } finally {
      setIsIngesting(false);
    }
  }, [
    collectionName,
    documentText,
    uploadedFiles,
    chunking,
    chunkSize,
    chunkOverlap,
    onIngest,
  ]);

  const hasDocuments =
    documentText.trim().length > 0 || uploadedFiles.length > 0;
  const canIngest =
    collectionName.trim().length > 0 && hasDocuments && !isIngesting;

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* Collection name */}
      <div>
        <label
          htmlFor="collection-name"
          className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2"
        >
          Collection Name
        </label>
        <input
          id="collection-name"
          type="text"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          placeholder="my-documents"
          list="existing-collections"
          className={cn(
            'w-full rounded-lg px-3 py-2 text-sm',
            'bg-opta-surface border border-opta-border',
            'text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
            'transition-colors',
          )}
        />
        <datalist id="existing-collections">
          {existingCollections.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      {/* Text input area */}
      <div>
        <label
          htmlFor="document-text"
          className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2"
        >
          Document Text
        </label>
        <textarea
          id="document-text"
          value={documentText}
          onChange={(e) => setDocumentText(e.target.value)}
          placeholder="Paste document text here..."
          rows={6}
          className={cn(
            'w-full rounded-lg px-3 py-2 text-sm font-mono',
            'bg-opta-surface border border-opta-border',
            'text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
            'resize-y transition-colors',
          )}
        />
      </div>

      {/* Drag-and-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer',
          'transition-colors',
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-opta-border hover:border-primary/40 hover:bg-primary/5',
        )}
        role="button"
        tabIndex={0}
        aria-label="Drop files here or click to browse"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <Upload
          className={cn(
            'mx-auto h-6 w-6 mb-2',
            isDragOver ? 'text-primary' : 'text-text-muted',
          )}
        />
        <p className="text-sm text-text-secondary">
          {isDragOver
            ? 'Drop files here'
            : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-xs text-text-muted mt-1">
          .txt, .md, .py, .ts, .js, .rs, .go, and more
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Uploaded files list */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1"
          >
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">
              Files ({uploadedFiles.length})
            </p>
            {uploadedFiles.map((file, i) => (
              <motion.div
                key={`${file.name}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-opta-surface"
              >
                <FileText className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-secondary truncate flex-1">
                  {file.name}
                </span>
                <Badge variant="default" size="sm">
                  {detectChunking(file.name)}
                </Badge>
                <button
                  onClick={() => removeFile(i)}
                  className="p-0.5 rounded text-text-muted hover:text-neon-red transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced settings (chunking) */}
      <div>
        <button
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          aria-expanded={showAdvanced}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {showAdvanced ? 'Hide' : 'Show'} chunking settings
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 space-y-4 overflow-hidden"
            >
              {/* Chunking strategy */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">
                  Chunking Strategy
                </label>
                <div className="flex gap-1.5">
                  {(['auto', 'text', 'code', 'none'] as const).map(
                    (strategy) => (
                      <button
                        key={strategy}
                        onClick={() => setChunking(strategy)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          chunking === strategy
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-opta-surface text-text-secondary border border-transparent hover:border-opta-border',
                        )}
                      >
                        {strategy}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Chunk size slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-text-muted">Chunk Size</label>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {chunkSize} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min={64}
                  max={2048}
                  step={64}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Chunk overlap slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-text-muted">
                    Chunk Overlap
                  </label>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {chunkOverlap} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={512}
                  step={16}
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ingest button */}
      <Button
        variant="primary"
        size="md"
        onClick={handleIngest}
        disabled={!canIngest}
        className="w-full"
      >
        {isIngesting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ingesting...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Ingest {hasDocuments ? `(${uploadedFiles.length + (documentText.trim() ? 1 : 0)} docs)` : ''}
          </>
        )}
      </Button>

      {/* Success feedback */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2 rounded-lg border border-neon-green/20 bg-neon-green/10 px-4 py-3"
          >
            <CheckCircle className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
            <div className="text-sm text-neon-green">
              <p className="font-medium">Ingestion complete</p>
              <p className="text-xs mt-0.5 opacity-80">
                Ingested {result.documents_ingested} document
                {result.documents_ingested !== 1 ? 's' : ''} into{' '}
                {result.chunks_created} chunk
                {result.chunks_created !== 1 ? 's' : ''} in{' '}
                <span className="tabular-nums">{result.duration_ms.toFixed(0)}</span>
                ms
              </p>
            </div>
            <button
              onClick={() => setResult(null)}
              className="ml-auto p-0.5 rounded text-neon-green/60 hover:text-neon-green transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error feedback */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2 rounded-lg border border-neon-red/20 bg-neon-red/10 px-4 py-3"
          >
            <AlertCircle className="h-4 w-4 text-neon-red flex-shrink-0 mt-0.5" />
            <div className="text-sm text-neon-red">
              <p className="font-medium">Ingestion failed</p>
              <p className="text-xs mt-0.5 opacity-80 break-words">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-0.5 rounded text-neon-red/60 hover:text-neon-red transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
