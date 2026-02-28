"use client";

/**
 * LogsBrowser — P6A
 *
 * Browse session logs and update logs from the LMX server.
 * Two-tab layout: list files → click to view content in scrollable code block.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ChevronLeft,
  Copy,
  CheckCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { LogFileMeta } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Motion variants
// ---------------------------------------------------------------------------

const floatUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 240, damping: 28 },
  },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TabId = "session" | "update";

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {Icon && (
        <Icon
          className="h-3.5 w-3.5 opacity-60"
          style={{ color: "var(--color-text-muted)" }}
        />
      )}
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {children}
      </span>
    </div>
  );
}

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={cn(
        "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200",
        copied ? "opacity-100" : "opacity-60 hover:opacity-100",
      )}
      style={{
        background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
        border: copied
          ? "1px solid rgba(34,197,94,0.3)"
          : "1px solid rgba(255,255,255,0.08)",
        color: copied ? "var(--color-neon-green)" : "var(--color-text-muted)",
      }}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <CheckCheck className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

interface FileListProps {
  files: LogFileMeta[];
  isLoading: boolean;
  error: string | null;
  onSelect: (filename: string) => void;
  onRefresh: () => void;
}

function FileList({
  files,
  isLoading,
  error,
  onSelect,
  onRefresh,
}: FileListProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex items-center justify-between">
        <span
          className="text-[10px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {files.length} file{files.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="rounded-lg p-1 opacity-50 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
          aria-label="Refresh"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            style={{ color: "var(--color-text-muted)" }}
          />
        </button>
      </div>

      {error && (
        <p className="text-[11px]" style={{ color: "var(--color-neon-red)" }}>
          {error}
        </p>
      )}

      {!isLoading && !error && files.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8">
          <FileText
            className="h-7 w-7 opacity-20"
            style={{ color: "var(--color-text-muted)" }}
          />
          <p
            className="text-[11px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            No log files
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {files.map((file) => (
          <motion.button
            key={file.filename}
            type="button"
            layout
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => onSelect(file.filename)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors duration-150"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(139,92,246,0.08)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(139,92,246,0.08)";
              e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              e.currentTarget.style.borderColor = "rgba(139,92,246,0.08)";
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText
                className="h-3.5 w-3.5 shrink-0 opacity-50"
                style={{ color: "var(--color-text-muted)" }}
              />
              <span
                className="truncate text-[11px] font-mono"
                style={{ color: "var(--color-text-primary)" }}
                title={file.filename}
              >
                {file.filename}
              </span>
            </div>
            <span
              className="ml-3 shrink-0 text-[10px] tabular-nums"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatSize(file.size_bytes)}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface FileViewProps {
  filename: string;
  content: string | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
}

function FileView({
  filename,
  content,
  isLoading,
  error,
  onBack,
}: FileViewProps) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-opacity opacity-60 hover:opacity-100"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="Back to file list"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <span
          className="truncate text-[11px] font-mono"
          style={{ color: "var(--color-text-secondary)" }}
          title={filename}
        >
          {filename}
        </span>
        {content && (
          <div className="ml-auto shrink-0">
            <CopyButton text={content} />
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <RefreshCw
            className="h-5 w-5 animate-spin opacity-40"
            style={{ color: "var(--color-text-muted)" }}
          />
        </div>
      )}

      {error && (
        <p className="text-[11px]" style={{ color: "var(--color-neon-red)" }}>
          {error}
        </p>
      )}

      {content && !isLoading && (
        <pre
          className="overflow-auto rounded-xl p-4 text-[11px] leading-relaxed"
          style={{
            maxHeight: 400,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(139,92,246,0.12)",
            color: "var(--color-text-secondary)",
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          {content}
        </pre>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface LogsBrowserProps {
  client: LMXClient | null;
}

export function LogsBrowser({ client }: LogsBrowserProps) {
  const [activeTab, setActiveTab] = useState<TabId>("session");

  // Files lists
  const [sessionFiles, setSessionFiles] = useState<LogFileMeta[]>([]);
  const [updateFiles, setUpdateFiles] = useState<LogFileMeta[]>([]);
  const [sessionFilesLoading, setSessionFilesLoading] = useState(false);
  const [updateFilesLoading, setUpdateFilesLoading] = useState(false);
  const [sessionFilesError, setSessionFilesError] = useState<string | null>(
    null,
  );
  const [updateFilesError, setUpdateFilesError] = useState<string | null>(null);

  // Viewed file
  const [viewedFile, setViewedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch file lists
  // ---------------------------------------------------------------------------

  const fetchSessionFiles = useCallback(async () => {
    if (!client) return;
    setSessionFilesLoading(true);
    setSessionFilesError(null);
    try {
      const files = await client.listSessionLogs();
      setSessionFiles(files);
    } catch (err) {
      setSessionFilesError(
        err instanceof Error ? err.message : "Failed to load session logs",
      );
    } finally {
      setSessionFilesLoading(false);
    }
  }, [client]);

  const fetchUpdateFiles = useCallback(async () => {
    if (!client) return;
    setUpdateFilesLoading(true);
    setUpdateFilesError(null);
    try {
      const files = await client.listUpdateLogs();
      setUpdateFiles(files);
    } catch (err) {
      setUpdateFilesError(
        err instanceof Error ? err.message : "Failed to load update logs",
      );
    } finally {
      setUpdateFilesLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchSessionFiles();
    void fetchUpdateFiles();
  }, [fetchSessionFiles, fetchUpdateFiles]);

  // ---------------------------------------------------------------------------
  // Fetch file content
  // ---------------------------------------------------------------------------

  const handleSelectFile = useCallback(
    async (filename: string) => {
      if (!client) return;
      setViewedFile(filename);
      setFileContent(null);
      setFileError(null);
      setFileLoading(true);
      try {
        const content =
          activeTab === "session"
            ? await client.getSessionLog(filename)
            : await client.getUpdateLog(filename);
        setFileContent(content);
      } catch (err) {
        setFileError(
          err instanceof Error ? err.message : "Failed to read file",
        );
      } finally {
        setFileLoading(false);
      }
    },
    [client, activeTab],
  );

  const handleBack = useCallback(() => {
    setViewedFile(null);
    setFileContent(null);
    setFileError(null);
  }, []);

  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      handleBack();
    },
    [handleBack],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tabs: { id: TabId; label: string }[] = [
    { id: "session", label: "Session Logs" },
    { id: "update", label: "Update Logs" },
  ];

  return (
    <motion.div
      variants={floatUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(145deg, rgba(15,10,30,0.82) 0%, rgba(10,8,22,0.78) 50%, rgba(12,10,28,0.82) 100%)",
        border: "1px solid rgba(139,92,246,0.12)",
        boxShadow:
          "0 1px 0 inset rgba(255,255,255,0.04), 0 20px 40px -20px rgba(0,0,0,0.6)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <SectionLabel icon={FileText}>Logs</SectionLabel>

      {/* Tabs */}
      <div
        className="mb-4 flex rounded-xl p-0.5"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex-1 rounded-xl py-1.5 text-[11px] font-medium transition-all duration-200",
            )}
            style={
              activeTab === tab.id
                ? {
                    background:
                      "linear-gradient(135deg, rgba(88,28,135,0.45), rgba(59,130,246,0.25))",
                    border: "1px solid rgba(139,92,246,0.35)",
                    color: "var(--color-text-primary)",
                  }
                : {
                    background: "transparent",
                    border: "1px solid transparent",
                    color: "var(--color-text-muted)",
                  }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {viewedFile ? (
          <FileView
            key={`view-${viewedFile}`}
            filename={viewedFile}
            content={fileContent}
            isLoading={fileLoading}
            error={fileError}
            onBack={handleBack}
          />
        ) : activeTab === "session" ? (
          <motion.div
            key="session-list"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <FileList
              files={sessionFiles}
              isLoading={sessionFilesLoading}
              error={sessionFilesError}
              onSelect={(f) => void handleSelectFile(f)}
              onRefresh={() => void fetchSessionFiles()}
            />
          </motion.div>
        ) : (
          <motion.div
            key="update-list"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <FileList
              files={updateFiles}
              isLoading={updateFilesLoading}
              error={updateFilesError}
              onSelect={(f) => void handleSelectFile(f)}
              onRefresh={() => void fetchUpdateFiles()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
