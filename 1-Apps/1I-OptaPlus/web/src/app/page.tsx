"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { Bot, ConnectionStatus, BotHealth } from "@/types";
import { useGateway } from "@/hooks/useGateway";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { BotSidebar } from "@/components/BotSidebar";
import { ChatView } from "@/components/ChatView";
import { CronPanel } from "@/components/CronPanel";
import { ConfigPanel } from "@/components/ConfigPanel";
import { AddBotModal } from "@/components/AddBotModal";
import { ChatExport } from "@/components/ChatExport";
import { PinnedPanel } from "@/components/PinnedPanel";
import { HealthDashboard } from "@/components/HealthDashboard";
import { CommandPalette } from "@/components/CommandPalette";

const STORAGE_KEY = "optaplus-bots";

function loadBots(): Bot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBots(bots: Bot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
}

type SidePanel = "cron" | "config" | "pinned" | "health" | null;

export default function Home() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [showAddBot, setShowAddBot] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const activeBot = bots.find((b) => b.id === activeBotId) ?? null;
  const wsUrl = activeBot ? `ws://${activeBot.host}:${activeBot.port}` : "";
  const wsToken = activeBot?.token ?? "";

  const {
    status,
    messages,
    cronJobs,
    botConfig,
    sendMessage,
    loadHistory,
    loadCronJobs,
    addCronJob,
    updateCronJob,
    removeCronJob,
    loadConfig,
    restartBot,
    abortChat,
    reactToMessage,
    togglePin,
    getHealth,
  } = useGateway(wsUrl, wsToken);

  // Load bots from localStorage
  useEffect(() => {
    const stored = loadBots();
    setBots(stored);
    if (stored.length > 0) setActiveBotId(stored[0].id);
  }, []);

  // Load history when connected
  useEffect(() => {
    if (status === "connected") {
      loadHistory();
    }
  }, [status, loadHistory]);

  // Build connection status map
  const connectionStatus: Record<string, ConnectionStatus> = {};
  if (activeBotId) connectionStatus[activeBotId] = status;
  bots.forEach((b) => {
    if (!connectionStatus[b.id]) connectionStatus[b.id] = "disconnected";
  });

  // Health data for dashboard
  const healthData: BotHealth[] = useMemo(() => {
    if (!activeBot) return [];
    return [getHealth(activeBot.id, activeBot.name)];
  }, [activeBot, getHealth]);

  const handleAddBot = useCallback((bot: Bot) => {
    const updated = [...bots, bot];
    setBots(updated);
    saveBots(updated);
    setActiveBotId(bot.id);
    setShowAddBot(false);
  }, [bots]);

  const handleOpenCron = useCallback(() => {
    setSidePanel(sidePanel === "cron" ? null : "cron");
    if (sidePanel !== "cron") loadCronJobs();
  }, [sidePanel, loadCronJobs]);

  const handleOpenConfig = useCallback(() => {
    setSidePanel(sidePanel === "config" ? null : "config");
    if (sidePanel !== "config") loadConfig();
  }, [sidePanel, loadConfig]);

  const handleOpenPinned = useCallback(() => {
    setSidePanel(sidePanel === "pinned" ? null : "pinned");
  }, [sidePanel]);

  const handleOpenHealth = useCallback(() => {
    setSidePanel(sidePanel === "health" ? null : "health");
  }, [sidePanel]);

  // Command palette commands
  const commands = useMemo(() => [
    { id: "search", label: "Search Messages", shortcut: "⌘F", icon: "🔍", action: () => { searchInputRef.current?.focus(); } },
    { id: "export", label: "Export Chat", shortcut: "⌘E", icon: "📤", action: () => setShowExport(true) },
    { id: "cron", label: "Toggle Cron Panel", icon: "⏰", action: () => handleOpenCron() },
    { id: "config", label: "Toggle Config Panel", icon: "⚙️", action: () => handleOpenConfig() },
    { id: "pinned", label: "View Pinned Messages", icon: "📌", action: () => handleOpenPinned() },
    { id: "health", label: "Bot Health Dashboard", icon: "🏥", action: () => handleOpenHealth() },
    { id: "add-bot", label: "Add Bot", icon: "➕", action: () => setShowAddBot(true) },
    { id: "restart", label: "Restart Bot", icon: "🔄", action: () => restartBot() },
  ], [handleOpenCron, handleOpenConfig, handleOpenPinned, handleOpenHealth, restartBot]);

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(() => ({
    onCommandPalette: () => setShowCommandPalette((v) => !v),
    onBotSwitch: (index: number) => {
      if (index < bots.length) {
        setActiveBotId(bots[index].id);
      }
    },
    onEscape: () => {
      if (showCommandPalette) {
        setShowCommandPalette(false);
      } else if (showExport) {
        setShowExport(false);
      } else if (showAddBot) {
        setShowAddBot(false);
      } else if (sidePanel) {
        setSidePanel(null);
      } else if (searchQuery) {
        setSearchQuery("");
      }
    },
    onExport: () => setShowExport(true),
    onSearch: () => searchInputRef.current?.focus(),
  }), [bots, showCommandPalette, showExport, showAddBot, sidePanel, searchQuery]);

  useKeyboardShortcuts(shortcutHandlers);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <BotSidebar
        bots={bots}
        activeBotId={activeBotId}
        connectionStatus={connectionStatus}
        onSelectBot={setActiveBotId}
        onAddBot={() => setShowAddBot(true)}
      />

      {/* Main area */}
      <div className="flex-1 flex">
        {activeBot ? (
          <>
            <div className="flex-1 flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-6 py-2 border-b border-border">
                <button
                  onClick={handleOpenCron}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    sidePanel === "cron" ? "bg-primary/15 text-primary" : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                  }`}
                >
                  ⏰ Cron
                </button>
                <button
                  onClick={handleOpenConfig}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    sidePanel === "config" ? "bg-primary/15 text-primary" : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                  }`}
                >
                  ⚙ Config
                </button>
                <button
                  onClick={handleOpenPinned}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    sidePanel === "pinned" ? "bg-primary/15 text-primary" : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                  }`}
                >
                  📌 Pinned
                </button>
                <button
                  onClick={handleOpenHealth}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    sidePanel === "health" ? "bg-primary/15 text-primary" : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                  }`}
                >
                  🏥 Health
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowExport(true)}
                  className="text-xs px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.03] transition-colors"
                >
                  📤 Export
                </button>
                <button
                  onClick={() => setShowCommandPalette(true)}
                  className="text-xs px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-colors font-mono"
                >
                  ⌘K
                </button>
              </div>

              <ChatView
                botName={activeBot.name}
                messages={messages}
                status={status}
                onSend={sendMessage}
                onAbort={abortChat}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onReact={reactToMessage}
                onPin={togglePin}
              />
            </div>

            {/* Side panel */}
            <AnimatePresence>
              {sidePanel === "cron" && (
                <CronPanel
                  jobs={cronJobs}
                  onAdd={addCronJob}
                  onUpdate={updateCronJob}
                  onRemove={removeCronJob}
                  onClose={() => setSidePanel(null)}
                />
              )}
              {sidePanel === "config" && (
                <ConfigPanel
                  config={botConfig}
                  onRestart={restartBot}
                  onClose={() => setSidePanel(null)}
                />
              )}
              {sidePanel === "pinned" && (
                <PinnedPanel
                  messages={messages}
                  onUnpin={togglePin}
                  onClose={() => setSidePanel(null)}
                />
              )}
              {sidePanel === "health" && (
                <HealthDashboard
                  health={healthData}
                  onClose={() => setSidePanel(null)}
                />
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">OptaPlus Web</h2>
              <p className="text-sm">Add a bot to get started</p>
              <p className="text-xs text-text-muted mt-2">Press ⌘K for command palette</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddBot && (
          <AddBotModal
            onAdd={handleAddBot}
            onClose={() => setShowAddBot(false)}
          />
        )}
        {showExport && activeBot && (
          <ChatExport
            messages={messages}
            botName={activeBot.name}
            onClose={() => setShowExport(false)}
          />
        )}
        {showCommandPalette && (
          <CommandPalette
            commands={commands}
            onClose={() => setShowCommandPalette(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
