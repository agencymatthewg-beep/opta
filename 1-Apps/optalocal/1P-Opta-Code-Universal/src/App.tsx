import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { CommandPalette } from "./components/CommandPalette";
import { Composer } from "./components/Composer";
import { Download } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { TimelineCards } from "./components/TimelineCards";
import { ProjectPane } from "./components/sidebars/ProjectPane";
import { WidgetPane } from "./components/sidebars/WidgetPane";
import { recordCommandUsage } from "./components/widgets/WidgetCommandBar";
import {
  SETTINGS_TAB_SEQUENCE,
  normalizeSettingsTabId,
  type SettingsTabId,
} from "./components/settingsStudioConfig";
import { useWidgetLayout } from "./hooks/useWidgetLayout";
import { downloadAsFile, exportToMarkdown } from "./lib/sessionExporter";
import { useCommandPalette } from "./hooks/useCommandPalette";
import { useDaemonSessions } from "./hooks/useDaemonSessions";
import { daemonClient } from "./lib/daemonClient";
import { useBrowserLiveHost } from "./hooks/useBrowserLiveHost";
import { useConnectionHealth } from "./hooks/useConnectionHealth";
import { usePlatform } from "./hooks/usePlatform";
import { OPEN_SETUP_WIZARD_EVENT } from "./components/ErrorBoundary";
import {
  deriveBrowserVisualState,
  type BrowserVisualSummary,
} from "./lib/browserVisualState";
import { getTauriInvoke, isNativeDesktop } from "./lib/runtime";
import {
  LazyAtpoStudio,
  LazyBrowserStudio,
  LazyLiveBrowserView,
  LazyLiveStudio,
  LazyModelsStudio,
  LazyProjectsStudio,
  LazyPermissionModal,
  LazySettingsModal,
  LazySettingsView,
  LazySetupWizard,
  preloadSettingsModal,
  preloadSettingsView,
} from "./lazyAppModules";
import { DeferredMount } from "./components/DeferredMount";

declare global {
  interface Window {
    __optaDeferredLayer2?: boolean;
    __optaDeferredLayer3?: boolean;
    __optaDeferredBrowser?: boolean;
    __optaDeferredModels?: boolean;
    __optaDeferredAtpo?: boolean;
    __optaDeferredProjects?: boolean;
    __optaDeferredLive?: boolean;
  }
}

type FeatureStudioId = "browser" | "models" | "atpo" | "live" | "projects";
import type {
  PaletteCommand,
  SessionSubmitMode,
  SessionTurnOverrides,
} from "./types";

interface TranscriptionResult {
  text: string;
}

interface TTSResult {
  audioBase64: string;
}

type AppPage =
  | "sessions"
  | "models"
  | "tools"
  | "apps"
  | "memory"
  | "system"
  | "cli"
  | "env"
  | "mcp"
  | "config"
  | "account"
  | "jobs"
  | "logs";

interface DockInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const ACCOUNTS_PORTAL_URL = "https://accounts.optalocal.com";

export type BrowserViewMode = "default" | "expanded" | "minimized";

function modePillLabel(mode: SessionSubmitMode): string {
  switch (mode) {
    case "do":
      return "Do mode";
    case "plan":
      return "Plan mode";
    case "review":
      return "Review mode";
    case "research":
      return "Research mode";
    default:
      return "Chat mode";
  }
}

function modeSubmitNotice(mode: SessionSubmitMode): string {
  switch (mode) {
    case "do":
      return "Task dispatched to agent";
    case "plan":
      return "Planning request submitted to daemon";
    case "review":
      return "Review request submitted to daemon";
    case "research":
      return "Research request submitted to daemon";
    default:
      return "Message submitted to daemon";
  }
}

type SettingsLayer = 1 | 2 | 3;
type SettingsLayerDirection = "deeper" | "shallower";
type SettingsLayerMotion = "root" | "intra" | "switch";
type SettingsLayerTransition = {
  direction: SettingsLayerDirection;
  motion: SettingsLayerMotion;
};
type SpatialDirection = "left" | "right" | "up" | "down";
type SettingsNavigationInputMode = "keyboard" | "pointer";
type SettingsNavigationState = {
  activeLayer: SettingsLayer;
  highlightedNodeKey: string | null;
  editMode: boolean;
  editTargetKey: string | null;
  draftValue: string | number | boolean | null;
  activeScrollContainerKey: "layer-2" | "layer-3" | "none";
};

const settingsLayerVariants = {
  enter: ({ direction, motion }: SettingsLayerTransition) => ({
    opacity: 0,
    scale:
      motion === "switch"
        ? 0.975
        : motion === "intra"
          ? direction === "deeper"
            ? 0.985
            : 1.015
          : direction === "deeper"
            ? 0.96
            : 1.02,
    x:
      motion === "switch"
        ? 0
        : motion === "intra"
          ? direction === "deeper"
            ? 28
            : -28
          : direction === "deeper"
            ? 72
            : -72,
    y:
      motion === "switch"
        ? 10
        : motion === "intra"
          ? direction === "deeper"
            ? 10
            : -10
          : direction === "deeper"
            ? 24
            : -24,
    filter: motion === "switch" ? "blur(6px)" : motion === "intra" ? "blur(8px)" : "blur(14px)",
  }),
  center: ({ motion }: SettingsLayerTransition) => ({
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: motion === "switch" ? 0.14 : motion === "intra" ? 0.2 : 0.5,
    },
  }),
  exit: ({ direction, motion }: SettingsLayerTransition) => ({
    opacity: 0,
    scale:
      motion === "switch"
        ? 1.02
        : motion === "intra"
          ? direction === "deeper"
            ? 1.01
            : 0.985
          : direction === "deeper"
            ? 1.03
            : 0.94,
    x:
      motion === "switch"
        ? 0
        : motion === "intra"
          ? direction === "deeper"
            ? -24
            : 24
          : direction === "deeper"
            ? -56
            : 56,
    y:
      motion === "switch"
        ? -8
        : motion === "intra"
          ? direction === "deeper"
            ? -8
            : 8
          : direction === "deeper"
            ? -18
            : 18,
    filter: motion === "switch" ? "blur(6px)" : motion === "intra" ? "blur(6px)" : "blur(12px)",
    transition: {
      duration: motion === "switch" ? 0.11 : motion === "intra" ? 0.16 : 0.35,
    },
  }),
};

function SettingsLayerLoadingFallback({
  layer,
  activeTab,
}: {
  layer: 2 | 3;
  activeTab: SettingsTabId;
}) {
  if (layer === 2) {
    return (
      <div className="settings-view-grid" role="status" aria-live="polite">
        <section
          className="settings-view-card is-active"
          data-settings-tab-id={activeTab}
          aria-busy="true"
          style={{ minHeight: 168 }}
        >
          <h3>Loading settings</h3>
          <p>Preparing the Settings Studio overview.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="opta-studio-content" role="status" aria-live="polite" aria-busy="true">
      <p style={{ margin: 0 }}>Loading settings details…</p>
    </div>
  );
}

function App() {
  const nativeDesktop = isNativeDesktop();
  const platform = usePlatform();

  // null = loading (show blank), true = first run (show wizard), false = normal app
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const [settingsLayer, setSettingsLayer] = useState<SettingsLayer>(1);
  const [settingsLayerDirection, setSettingsLayerDirection] =
    useState<SettingsLayerDirection>("deeper");
  const [settingsLayerMotion, setSettingsLayerMotion] =
    useState<SettingsLayerMotion>("root");
  const [settingsActiveTab, setSettingsActiveTab] =
    useState<SettingsTabId>("connection-network");
  const [settingsFocusIndex, setSettingsFocusIndex] = useState(0);
  const [lastSettingsLayer, setLastSettingsLayer] = useState<Exclude<SettingsLayer, 1>>(2);
  const [lastSettingsTab, setLastSettingsTab] =
    useState<SettingsTabId>("connection-network");
  const [settingsFullscreen, setSettingsFullscreen] = useState(false);
  const [settingsLayer3FocusIndex, setSettingsLayer3FocusIndex] = useState(0);
  const [settingsLayer3EditMode, setSettingsLayer3EditMode] = useState(false);
  const [activeStudio, setActiveStudio] = useState<FeatureStudioId | null>(null);
  // Ref tracking studio-to-studio switches for fast crossfade variant (vs full fly-in)
  const studioSwitchingRef = useRef(false);
  const [studioFullscreen, setStudioFullscreen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useLocalStorage(
    "opta:sidebar-visible",
    true,
  );
  const settingsLayer3EditTargetRef = useRef<HTMLElement | null>(null);
  const settingsLayer3PendingEditFocusRef = useRef(false);
  const settingsLayer3EditDraftRef = useRef<string | number | boolean | null>(
    null,
  );
  const layer3ResetKeyRef = useRef<string | null>(null);
  const settingsNavigationInputModeRef =
    useRef<SettingsNavigationInputMode>("keyboard");
  const [settingsNavigationInputMode, setSettingsNavigationInputModeState] =
    useState<SettingsNavigationInputMode>("keyboard");

  const isTypingControlElement = useCallback((element: EventTarget | null) => {
    if (!(element instanceof HTMLElement)) return false;
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element.isContentEditable
    );
  }, []);

  const setSettingsNavigationInputMode = useCallback(
    (mode: SettingsNavigationInputMode) => {
      if (settingsNavigationInputModeRef.current !== mode) {
        settingsNavigationInputModeRef.current = mode;
        setSettingsNavigationInputModeState(mode);
      } else {
        settingsNavigationInputModeRef.current = mode;
      }
      const layerRoot = settingsLayerRefs.current[3];

      if (mode === "keyboard" && settingsLayer === 3 && !settingsLayer3EditMode) {
        const activeElement = document.activeElement;
        if (isTypingControlElement(activeElement)) {
          (activeElement as HTMLElement).blur();
        }
        layerRoot?.focus({ preventScroll: true });
      }
    },
    [isTypingControlElement, settingsLayer, settingsLayer3EditMode],
  );

  const settingsNavigationState = useMemo<SettingsNavigationState>(() => {
    const highlightedNodeKey =
      settingsLayer === 2
        ? SETTINGS_TAB_SEQUENCE[settingsFocusIndex] ?? settingsActiveTab
        : settingsLayer === 3
          ? `l3:${settingsLayer3FocusIndex}`
          : null;

    return {
      activeLayer: settingsLayer,
      highlightedNodeKey,
      editMode: settingsLayer3EditMode,
      editTargetKey: settingsLayer3EditTargetRef.current?.tagName?.toLowerCase() ?? null,
      draftValue: settingsLayer3EditDraftRef.current,
      activeScrollContainerKey:
        settingsLayer === 3 ? "layer-3" : settingsLayer === 2 ? "layer-2" : "none",
    };
  }, [
    settingsActiveTab,
    settingsFocusIndex,
    settingsLayer,
    settingsLayer3EditMode,
    settingsLayer3FocusIndex,
  ]);

  useEffect(() => {
    const invoke = getTauriInvoke();
    if (!invoke) {
      // Browser / Vite dev mode — skip wizard
      setFirstRun(false);
      return;
    }
    invoke("check_first_run")
      .then((isFirstRun) => setFirstRun(Boolean(isFirstRun)))
      .catch(() => setFirstRun(false)); // On error, don't block the app
  }, []);

  const [showTerminal, setShowTerminal] = useState(false); // Changed initial state from true to false

  const [composerDraft, setComposerDraft] = useState("");

  // WidgetCommandBar injects commands via custom event to stay decoupled from Composer
  useEffect(() => {
    const handler = (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail;
      if (typeof cmd === "string") setComposerDraft(cmd);
    };
    window.addEventListener("opta:inject-command", handler);
    return () => window.removeEventListener("opta:inject-command", handler);
  }, []);

  const [submissionMode, setSubmissionMode] =
    useState<SessionSubmitMode>("chat");
  const [selectedWorkspace, setSelectedWorkspace] = useLocalStorage(
    "opta:selectedWorkspace",
    "all",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("sessions");
  const [showToken, setShowToken] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const [disconnectedSinceMs, setDisconnectedSinceMs] = useState<number | null>(
    null,
  );
  const [offlineSeconds, setOfflineSeconds] = useState(0);
  const [browserViewMode, setBrowserViewMode] =
    useState<BrowserViewMode>("default");
  const [designMode, setDesignMode] = useState("3");
  const [deviceLabel, setDeviceLabel] = useState<string>(() => {
    try { return localStorage.getItem("opta:deviceLabel") ?? "Workstation - Opta48"; }
    catch { return "Workstation - Opta48"; }
  });

  // Persist deviceLabel to localStorage whenever it changes
  const handleDeviceLabelChange = useCallback((label: string) => {
    setDeviceLabel(label);
    try { localStorage.setItem("opta:deviceLabel", label); } catch { /* noop */ }
  }, []);

  const goToSettingsLayer = useCallback((nextLayer: SettingsLayer) => {
    if (nextLayer >= 2) {
      void preloadSettingsView();
      if (nextLayer >= 3) {
        void preloadSettingsModal();
      }
    }

    setSettingsLayer((currentLayer) => {
      if (nextLayer === currentLayer) {
        return currentLayer;
      }
      setSettingsLayerDirection(
        nextLayer > currentLayer ? "deeper" : "shallower",
      );
      setSettingsLayerMotion(
        nextLayer > 1 && currentLayer > 1 ? "intra" : "root",
      );
      return nextLayer;
    });
  }, []);

  const settingsLayerTransition = useMemo<SettingsLayerTransition>(
    () => ({
      direction: settingsLayerDirection,
      motion: settingsLayerMotion,
    }),
    [settingsLayerDirection, settingsLayerMotion],
  );

  const focusSettingsTab = useCallback((tab: SettingsTabId) => {
    const normalizedTab = normalizeSettingsTabId(tab);
    setSettingsActiveTab(normalizedTab);
    const nextIndex = SETTINGS_TAB_SEQUENCE.indexOf(normalizedTab);
    if (nextIndex >= 0) {
      setSettingsFocusIndex(nextIndex);
    }
  }, []);

  const cycleSettingsTab = useCallback((delta: number) => {
    setSettingsFocusIndex((currentIndex) => {
      const length = SETTINGS_TAB_SEQUENCE.length;
      const nextIndex = (currentIndex + delta + length) % length;
      setSettingsActiveTab(SETTINGS_TAB_SEQUENCE[nextIndex]);
      return nextIndex;
    });
  }, []);

  const getSettingsGridColumns = useCallback(() => {
    if (typeof window === "undefined") return 4;
    if (window.innerWidth <= 760) return 1;
    if (window.innerWidth <= 1220) return 2;
    return 4;
  }, []);

  const moveSettingsGridSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      setSettingsFocusIndex((currentIndex) => {
        const cols = getSettingsGridColumns();
        const maxIndex = SETTINGS_TAB_SEQUENCE.length - 1;
        let nextIndex = currentIndex;

        if (direction === "left") {
          nextIndex = Math.max(0, currentIndex - 1);
        } else if (direction === "right") {
          nextIndex = Math.min(maxIndex, currentIndex + 1);
        } else if (direction === "up") {
          nextIndex = Math.max(0, currentIndex - cols);
        } else if (direction === "down") {
          nextIndex = Math.min(maxIndex, currentIndex + cols);
        }

        setSettingsActiveTab(SETTINGS_TAB_SEQUENCE[nextIndex]);
        return nextIndex;
      });
    },
    [getSettingsGridColumns],
  );

  const settingsLayerRefs = useRef<Partial<Record<2 | 3, HTMLDivElement | null>>>(
    {},
  );
  const settingsMiddleLayerRef = useRef<HTMLDivElement | null>(null);
  const dockMeasureRafRef = useRef<number | null>(null);
  const [settingsDockInset, setSettingsDockInset] = useState<DockInset | null>(
    null,
  );

  const refreshSettingsDockInset = useCallback(() => {
    const container = settingsMiddleLayerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setSettingsDockInset({
      top: Math.max(0, rect.top),
      right: Math.max(0, window.innerWidth - rect.right),
      bottom: Math.max(0, window.innerHeight - rect.bottom),
      left: Math.max(0, rect.left),
    });
  }, []);

  const scheduleSettingsDockInsetRefresh = useCallback(() => {
    if (dockMeasureRafRef.current !== null) return;
    dockMeasureRafRef.current = window.requestAnimationFrame(() => {
      dockMeasureRafRef.current = null;
      refreshSettingsDockInset();
    });
  }, [refreshSettingsDockInset]);

  useLayoutEffect(() => {
    if (settingsLayer <= 1) return;
    scheduleSettingsDockInsetRefresh();
  }, [scheduleSettingsDockInsetRefresh, settingsLayer, settingsFullscreen]);

  useEffect(() => {
    if (settingsLayer <= 1) return;
    const handleMeasure = () => {
      scheduleSettingsDockInsetRefresh();
    };
    handleMeasure();
    window.addEventListener("resize", handleMeasure, { passive: true });
    window.addEventListener("scroll", handleMeasure, {
      capture: true,
      passive: true,
    });
    return () => {
      if (dockMeasureRafRef.current !== null) {
        window.cancelAnimationFrame(dockMeasureRafRef.current);
        dockMeasureRafRef.current = null;
      }
      window.removeEventListener("resize", handleMeasure);
      window.removeEventListener("scroll", handleMeasure, true);
    };
  }, [scheduleSettingsDockInsetRefresh, settingsLayer]);

  const settingsOverlayDockStyle = useMemo<CSSProperties>(() => {
    if (!settingsDockInset) {
      return { visibility: "hidden" };
    }
    return {
      "--settings-dock-top": `${settingsDockInset.top}px`,
      "--settings-dock-right": `${settingsDockInset.right}px`,
      "--settings-dock-bottom": `${settingsDockInset.bottom}px`,
      "--settings-dock-left": `${settingsDockInset.left}px`,
    } as CSSProperties;
  }, [settingsDockInset]);

  const getSettingsScrollContainer = useCallback(
    (layer: 2 | 3): HTMLElement | null => {
      const layerRoot = settingsLayerRefs.current[layer];
      if (!layerRoot) return null;

      if (layer === 3) {
        const deepLayout = layerRoot.querySelector(
          ".opta-studio-layout--deep",
        ) as HTMLElement | null;
        const deepContent = layerRoot.querySelector(
          ".opta-studio-content",
        ) as HTMLElement | null;
        return (
          [deepLayout, deepContent, layerRoot].find(
            (candidate) =>
              candidate && candidate.scrollHeight > candidate.clientHeight + 1,
          ) ??
          [deepLayout, deepContent, layerRoot].find(Boolean) ??
          null
        );
      }

      const layerGrid = layerRoot.querySelector(
        ".settings-view-grid",
      ) as HTMLElement | null;
      return (
        [layerGrid, layerRoot].find(
          (candidate) =>
            candidate && candidate.scrollHeight > candidate.clientHeight + 1,
        ) ??
        [layerGrid, layerRoot].find(Boolean) ??
        null
      );
    },
    [],
  );

  const centerSettingsTargetInView = useCallback(
    (
      target: HTMLElement,
      layer: 2 | 3,
      behavior: ScrollBehavior = "smooth",
    ) => {
      const container = getSettingsScrollContainer(layer);
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTop =
        targetRect.top - containerRect.top + container.scrollTop;
      const targetCenter = targetTop + targetRect.height / 2;
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const topThreshold = Math.max(
        96,
        Math.min(320, container.clientHeight * 0.32),
      );
      const desired =
        targetTop <= topThreshold
          ? Math.max(0, targetTop - 28)
          : targetCenter - container.clientHeight / 2;
      const clamped = Math.min(maxScrollTop, Math.max(0, desired));

      if (Math.abs(container.scrollTop - clamped) < 1) return;
      container.scrollTo({ top: clamped, behavior });
    },
    [getSettingsScrollContainer],
  );

  const resolveLayer3HighlightTarget = useCallback((element: HTMLElement) => {
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        return (
          element.closest<HTMLElement>(".st-checkbox-label, label, .st-perm-row, .st-row, .st-fieldset-inner") ??
          element
        );
      }
      return (
        element.closest<HTMLElement>(".st-label, .st-fieldset-inner, .opta-studio-form-group, .st-row") ??
        element
      );
    }

    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      return (
        element.closest<HTMLElement>(".st-label, .st-fieldset-inner, .opta-studio-form-group, .st-row") ??
        element
      );
    }

    if (element instanceof HTMLButtonElement) {
      if (element.classList.contains("st-perm-pill")) {
        return element.closest<HTMLElement>(".st-perm-row") ?? element;
      }
      return element;
    }

    return (
      element.closest<HTMLElement>(".st-fieldset-inner, .st-row, .opta-studio-card") ??
      element
    );
  }, []);

  const getLayer3InteractiveElements = useCallback((): HTMLElement[] => {
    const container = settingsLayerRefs.current[3];
    if (!container) return [];
    const content = container.querySelector(".opta-studio-content");
    if (!content) return [];
    const candidates = Array.from(
      content.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])",
      ),
    );
    return candidates.filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }, []);

  const getLayer3ChoiceButtons = useCallback(
    (button: HTMLButtonElement): HTMLButtonElement[] => {
      const explicitGroup = button.closest(
        ".st-perm-pills, [role='group'], [data-opta-choice-group='true']",
      );
      if (explicitGroup) {
        return Array.from(
          explicitGroup.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
          ),
        );
      }

      const parent = button.parentElement;
      if (!parent) return [];
      const siblingButtons = Array.from(
        parent.querySelectorAll<HTMLButtonElement>(":scope > button:not([disabled])"),
      );
      if (
        siblingButtons.length > 1 &&
        siblingButtons.every((candidate) =>
          candidate.classList.contains("st-perm-pill"),
        )
      ) {
        return siblingButtons;
      }

      return [];
    },
    [],
  );

  const clearLayer3KeyboardMarkers = useCallback(
    (clearEditing = true) => {
      const layerRoot = settingsLayerRefs.current[3];
      if (!layerRoot) return;
      const selector = clearEditing
        ? ".opta-setting-highlighted, .opta-setting-editing, [data-opta-nav-highlight='true'], [data-opta-nav-editing='true']"
        : ".opta-setting-highlighted, [data-opta-nav-highlight='true']";
      layerRoot.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        element.classList.remove("opta-setting-highlighted");
        element.removeAttribute("data-opta-nav-highlight");
        if (clearEditing) {
          element.classList.remove("opta-setting-editing");
          element.removeAttribute("data-opta-nav-editing");
        }
      });
    },
    [],
  );

  const getCurrentLayer3InteractiveTarget = useCallback((): HTMLElement | null => {
    const elements = getLayer3InteractiveElements();
    if (!elements.length) return null;
    const clampedIndex = Math.min(
      Math.max(settingsLayer3FocusIndex, 0),
      elements.length - 1,
    );
    return elements[clampedIndex] ?? elements[0] ?? null;
  }, [getLayer3InteractiveElements, settingsLayer3FocusIndex]);

  const resolveLiveLayer3EditTarget = useCallback((): HTMLElement | null => {
    const refTarget = settingsLayer3EditTargetRef.current;
    if (refTarget && refTarget.isConnected) {
      return refTarget;
    }
    const fallback = getCurrentLayer3InteractiveTarget();
    if (fallback) {
      settingsLayer3EditTargetRef.current = fallback;
      return fallback;
    }
    return refTarget ?? null;
  }, [getCurrentLayer3InteractiveTarget]);

  const getElementValue = useCallback((element: HTMLElement) => {
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        return element.checked;
      }
      return element.value;
    }
    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    return null;
  }, []);

  const applyElementValue = useCallback(
    (element: HTMLElement, value: string | number | boolean | null) => {
      if (element instanceof HTMLInputElement) {
        if (element.type === "checkbox" || element.type === "radio") {
          element.checked = Boolean(value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
        element.value = `${value ?? ""}`;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        element.value = `${value ?? ""}`;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    [],
  );

  const moveLayer3Highlight = useCallback(
    (direction: SpatialDirection) => {
      const elements = getLayer3InteractiveElements();
      if (!elements.length) return;

      setSettingsLayer3FocusIndex((currentIndex) => {
        const clampedCurrent = Math.min(
          Math.max(currentIndex, 0),
          elements.length - 1,
        );
        const current = elements[clampedCurrent] ?? elements[0];
        const currentRect = current.getBoundingClientRect();
        const currentX = currentRect.left + currentRect.width / 2;
        const currentY = currentRect.top + currentRect.height / 2;

        let bestIndex = -1;
        let bestScore = Number.POSITIVE_INFINITY;

        elements.forEach((candidate, index) => {
          if (index === clampedCurrent) return;
          const rect = candidate.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const dx = x - currentX;
          const dy = y - currentY;

          if (direction === "left" && dx >= -4) return;
          if (direction === "right" && dx <= 4) return;
          if (direction === "up" && dy >= -4) return;
          if (direction === "down" && dy <= 4) return;

          const primary = direction === "left" || direction === "right"
            ? Math.abs(dx)
            : Math.abs(dy);
          const secondary = direction === "left" || direction === "right"
            ? Math.abs(dy)
            : Math.abs(dx);
          const score = primary + secondary * 0.55;
          if (score < bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });

        if (bestIndex >= 0) return bestIndex;
        if (direction === "left" || direction === "up") {
          return (clampedCurrent - 1 + elements.length) % elements.length;
        }
        return (clampedCurrent + 1) % elements.length;
      });
    },
    [getLayer3InteractiveElements],
  );

  const adjustLayer3SelectedSetting = useCallback(
    (event: KeyboardEvent): boolean => {
      const target = resolveLiveLayer3EditTarget();
      if (!target) return false;

      const key = event.key;
      const increase =
        key === "ArrowRight" || key === "ArrowUp" || key === "PageUp";
      const decrease =
        key === "ArrowLeft" || key === "ArrowDown" || key === "PageDown";
      const toMin = key === "Home";
      const toMax = key === "End";
      if (!increase && !decrease && !toMin && !toMax) return false;

      if (target instanceof HTMLButtonElement) {
        const choiceButtons = getLayer3ChoiceButtons(target);
        if (!choiceButtons.length) return false;

        const currentChoiceIndex = Math.max(0, choiceButtons.indexOf(target));
        let nextChoiceIndex = currentChoiceIndex;
        if (toMin) {
          nextChoiceIndex = 0;
        } else if (toMax) {
          nextChoiceIndex = choiceButtons.length - 1;
        } else {
          const delta = increase ? 1 : -1;
          nextChoiceIndex = Math.max(
            0,
            Math.min(choiceButtons.length - 1, currentChoiceIndex + delta),
          );
        }
        const nextTarget = choiceButtons[nextChoiceIndex];
        if (!nextTarget) return false;

        target.classList.remove("opta-setting-editing");
        target.removeAttribute("data-opta-nav-editing");
        nextTarget.classList.add("opta-setting-editing");
        nextTarget.setAttribute("data-opta-nav-editing", "true");
        settingsLayer3EditTargetRef.current = nextTarget;
        nextTarget.focus({ preventScroll: true });
        centerSettingsTargetInView(
          resolveLayer3HighlightTarget(nextTarget),
          3,
          "smooth",
        );
        const interactive = getLayer3InteractiveElements();
        const interactiveIndex = interactive.indexOf(nextTarget);
        if (interactiveIndex >= 0) {
          setSettingsLayer3FocusIndex(interactiveIndex);
        }
        return true;
      }

      if (target instanceof HTMLInputElement) {
        if (target.type === "checkbox" || target.type === "radio") {
          if (toMin) {
            target.checked = false;
          } else if (toMax) {
            target.checked = true;
          } else {
            target.checked = increase;
          }
          target.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }

        if (target.type === "number" || target.type === "range") {
          const current = Number.parseFloat(target.value || "0");
          if (!Number.isFinite(current)) return false;
          const rawStep = Number.parseFloat(target.step || "1");
          const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 1;
          const multiplier = event.shiftKey ? 5 : 1;
          const pageDelta = key === "PageUp" || key === "PageDown" ? 5 : 1;
          let next = current;
          if (increase || decrease) {
            next += (increase ? step : -step) * multiplier * pageDelta;
          }

          const min = Number.parseFloat(target.min);
          const max = Number.parseFloat(target.max);
          if (toMin && Number.isFinite(min)) {
            next = min;
          }
          if (toMax && Number.isFinite(max)) {
            next = max;
          }
          if (Number.isFinite(min)) next = Math.max(next, min);
          if (Number.isFinite(max)) next = Math.min(next, max);

          target.value = `${next}`;
          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        return false;
      }

      if (target instanceof HTMLSelectElement) {
        let nextIndex = target.selectedIndex;
        if (toMin) {
          nextIndex = 0;
        } else if (toMax) {
          nextIndex = Math.max(0, target.options.length - 1);
        } else {
          const delta = increase ? 1 : -1;
          nextIndex = Math.max(
            0,
            Math.min(target.options.length - 1, target.selectedIndex + delta),
          );
        }
        target.selectedIndex = nextIndex;
        target.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      return false;
    },
    [
      centerSettingsTargetInView,
      getLayer3ChoiceButtons,
      getLayer3InteractiveElements,
      resolveLayer3HighlightTarget,
      resolveLiveLayer3EditTarget,
    ],
  );

  const applyLayer3HighlightState = useCallback(
    ({
      behavior = "smooth",
      scroll = true,
      editMode = settingsLayer3EditMode,
      editTarget = settingsLayer3EditTargetRef.current,
      respectInputMode = true,
    }: {
      behavior?: ScrollBehavior;
      scroll?: boolean;
      editMode?: boolean;
      editTarget?: HTMLElement | null;
      respectInputMode?: boolean;
    } = {}): boolean => {
      const elements = getLayer3InteractiveElements();
      if (!elements.length) return false;

      const pointerNavigationActive =
        settingsNavigationInputModeRef.current === "pointer";
      if (respectInputMode && pointerNavigationActive && !Boolean(editMode)) {
        clearLayer3KeyboardMarkers(true);
        return false;
      }

      const clampedIndex = Math.min(
        Math.max(settingsLayer3FocusIndex, 0),
        elements.length - 1,
      );
      if (clampedIndex !== settingsLayer3FocusIndex) {
        setSettingsLayer3FocusIndex(clampedIndex);
      }

      const liveEditTarget =
        Boolean(editMode) &&
          editTarget &&
          elements.includes(editTarget)
          ? editTarget
          : Boolean(editMode)
            ? (elements[clampedIndex] ?? null)
            : null;
      if (Boolean(editMode)) {
        settingsLayer3EditTargetRef.current = liveEditTarget;
      }

      const highlightedInteractive = elements[clampedIndex] ?? elements[0];
      const highlightedTarget = highlightedInteractive
        ? resolveLayer3HighlightTarget(highlightedInteractive)
        : null;
      const editVisualTarget = liveEditTarget
        ? resolveLayer3HighlightTarget(liveEditTarget)
        : null;

      const visualTargets = new Set<HTMLElement>();
      elements.forEach((element) => {
        visualTargets.add(resolveLayer3HighlightTarget(element));
        visualTargets.add(element);
      });

      visualTargets.forEach((element) => {
        element.classList.remove("opta-setting-highlighted", "opta-setting-editing");
        element.removeAttribute("data-opta-nav-highlight");
        element.removeAttribute("data-opta-nav-editing");
      });

      if (highlightedTarget) {
        highlightedTarget.classList.add("opta-setting-highlighted");
        highlightedTarget.setAttribute("data-opta-nav-highlight", "true");
      }

      if (Boolean(editMode) && editVisualTarget) {
        editVisualTarget.classList.add("opta-setting-editing");
        editVisualTarget.setAttribute("data-opta-nav-editing", "true");
      }

      if (scroll) {
        if (highlightedTarget) {
          centerSettingsTargetInView(highlightedTarget, 3, behavior);
        }
      }
      return true;
    },
    [
      clearLayer3KeyboardMarkers,
      centerSettingsTargetInView,
      getLayer3InteractiveElements,
      resolveLayer3HighlightTarget,
      settingsLayer3EditMode,
      settingsLayer3FocusIndex,
    ],
  );

  const scheduleLayer3HighlightRefresh = useCallback(() => {
    if (settingsLayer !== 3) return;
    const applyHighlight = () =>
      applyLayer3HighlightState({
        behavior: "auto",
        scroll: false,
        editMode: false,
        editTarget: null,
      });

    // Always run staged retries because the deep-layer content swaps with
    // enter/exit animations and may mount after the first pass succeeds.
    applyHighlight();

    window.requestAnimationFrame(() => {
      applyHighlight();
    });
    [32, 96, 180, 260, 320, 420].forEach((delay) => {
      window.setTimeout(() => {
        applyHighlight();
      }, delay);
    });
  }, [applyLayer3HighlightState, settingsLayer]);
  const scheduleLayer3HighlightRefreshRef = useRef(
    scheduleLayer3HighlightRefresh,
  );
  scheduleLayer3HighlightRefreshRef.current = scheduleLayer3HighlightRefresh;

  const restoreLayer3NavigationFocus = useCallback((force = false) => {
    if (settingsLayer !== 3) return;

    const focusLayerShell = () => {
      const activeElement = document.activeElement;
      const activeIsTypingControl =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);
      if (activeIsTypingControl) {
        activeElement.blur();
      }
      settingsLayerRefs.current[3]?.focus({ preventScroll: true });
    };

    const activeElement = document.activeElement;
    const activeIsTypingControl =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable);
    if (!force && !activeIsTypingControl) {
      return;
    }

    focusLayerShell();
    window.requestAnimationFrame(focusLayerShell);
    [96, 220, 420].forEach((delay) => {
      window.setTimeout(focusLayerShell, delay);
    });
  }, [settingsLayer]);

  const cancelLayer3SettingEdit = useCallback(() => {
    const draftValue = settingsLayer3EditDraftRef.current;
    const referenceTarget = settingsLayer3EditTargetRef.current;
    const liveTarget = resolveLiveLayer3EditTarget();

    const rollbackTargets = [liveTarget, referenceTarget].filter(
      (candidate): candidate is HTMLElement => Boolean(candidate),
    );
    const uniqueRollbackTargets = Array.from(new Set(rollbackTargets));
    uniqueRollbackTargets.forEach((target) => {
      applyElementValue(target, draftValue);
    });

    const cleanupTarget = liveTarget ?? referenceTarget;
    if (cleanupTarget) {
      cleanupTarget.blur();
      const visualTarget = resolveLayer3HighlightTarget(cleanupTarget);
      visualTarget.classList.remove("opta-setting-editing");
      visualTarget.removeAttribute("data-opta-nav-editing");
    }
    settingsLayer3EditTargetRef.current = null;
    settingsLayer3PendingEditFocusRef.current = false;
    settingsLayer3EditDraftRef.current = null;
    setSettingsLayer3EditMode(false);
    restoreLayer3NavigationFocus(true);
    scheduleLayer3HighlightRefresh();
  }, [
    applyElementValue,
    resolveLayer3HighlightTarget,
    resolveLiveLayer3EditTarget,
    restoreLayer3NavigationFocus,
    scheduleLayer3HighlightRefresh,
  ]);

  const commitLayer3SettingEdit = useCallback(() => {
    const target = resolveLiveLayer3EditTarget();
    if (!target) return;

    if (target instanceof HTMLButtonElement) {
      target.click();
    } else {
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const scope =
      target.closest(".st-fieldset, .opta-studio-card, .opta-studio-content") ??
      settingsLayerRefs.current[3];
    const saveButton = Array.from(
      (scope ?? document).querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ),
    ).find((button) => /save/i.test(button.textContent ?? ""));
    if (
      saveButton &&
      (!(
        target instanceof HTMLButtonElement
      ) ||
        !/save/i.test(target.textContent ?? ""))
    ) {
      saveButton.click();
    }

    target.blur();
    const visualTarget = resolveLayer3HighlightTarget(target);
    visualTarget.classList.remove("opta-setting-editing");
    visualTarget.removeAttribute("data-opta-nav-editing");
    settingsLayer3EditTargetRef.current = null;
    settingsLayer3PendingEditFocusRef.current = false;
    settingsLayer3EditDraftRef.current = null;
    setSettingsLayer3EditMode(false);
    restoreLayer3NavigationFocus(true);
    scheduleLayer3HighlightRefresh();
  }, [
    resolveLayer3HighlightTarget,
    resolveLiveLayer3EditTarget,
    restoreLayer3NavigationFocus,
    scheduleLayer3HighlightRefresh,
  ]);

  const openSettings = useCallback(
    (tab: SettingsTabId = "connection-network") => {
      setActivePage("sessions");
      focusSettingsTab(tab);
      goToSettingsLayer(3);
    },
    [focusSettingsTab, goToSettingsLayer],
  );

  const {
    activeSessionId,
    cancelActiveTurn,
    connection,
    connectionError,
    connectionState,
    isStreaming,
    pendingPermissions,
    streamingBySession,
    pendingPermissionsBySession,
    repairConnection,
    refreshNow,
    resolvePermission,
    resolveSessionPermission,
    runtime,
    sessions,
    setActiveSessionId,
    setConnection,
    submitMessage,
    timelineBySession,
    rawEventsBySession,
    trackSession,
    createSession,
    removeSession,
    initialCheckDone,
    runtimePollDelayMs,
  } = useDaemonSessions();

  // V1: Widget layout hook
  const widgetLayout = useWidgetLayout("default");
  const useConnectionHealthResult = useConnectionHealth(connection, connectionState);

  const { status: browserLiveHostStatus, getSlotForSession, refreshNow: refreshLiveHost } =
    useBrowserLiveHost(connection);

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const activeBrowserSlot = activeSessionId
    ? getSlotForSession(activeSessionId)
    : undefined;
  const activeBrowserViewerAuthToken = browserLiveHostStatus?.viewerAuthToken;

  const activeStreamCount = useMemo(
    () => Object.values(streamingBySession).filter(Boolean).length,
    [streamingBySession],
  );

  const totalPendingPermissions = useMemo(
    () =>
      Object.values(pendingPermissionsBySession).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ),
    [pendingPermissionsBySession],
  );

  const firstPendingPermission = useMemo(() => {
    for (const [sessionId, reqs] of Object.entries(pendingPermissionsBySession)) {
      if (reqs && reqs.length > 0) {
        return { ...reqs[0], sessionId };
      }
    }
    return null;
  }, [pendingPermissionsBySession]);

  const timelineItems = activeSessionId
    ? (timelineBySession[activeSessionId] ?? [])
    : [];
  const sessionCount = sessions.length;

  const browserVisualBySession = useMemo<
    Record<string, BrowserVisualSummary>
  >(() => {
    const next: Record<string, BrowserVisualSummary> = {};
    for (const session of sessions) {
      const sessionId = session.sessionId;
      next[sessionId] = deriveBrowserVisualState({
        connectionState,
        isStreaming: streamingBySession[sessionId] ?? false,
        pendingPermissions: pendingPermissionsBySession[sessionId] ?? [],
        timelineItems: timelineBySession[sessionId] ?? [],
      });
    }
    return next;
  }, [
    connectionState,
    sessions,
    streamingBySession,
    pendingPermissionsBySession,
    timelineBySession,
  ]);

  const activeBrowserVisual = useMemo(
    () =>
      activeSessionId
        ? (browserVisualBySession[activeSessionId] ??
          deriveBrowserVisualState({
            connectionState,
            isStreaming,
            pendingPermissions,
            timelineItems,
          }))
        : deriveBrowserVisualState({
          connectionState,
          isStreaming: false,
          pendingPermissions: [],
          timelineItems: [],
        }),
    [
      activeSessionId,
      browserVisualBySession,
      connectionState,
      isStreaming,
      pendingPermissions,
      timelineItems,
    ],
  );

  const browserWorkingCount = useMemo(
    () =>
      Object.values(browserVisualBySession).filter(
        (summary) => summary.state === "working",
      ).length,
    [browserVisualBySession],
  );

  const browserBlockedCount = useMemo(
    () =>
      Object.values(browserVisualBySession).filter(
        (summary) => summary.state === "blocked",
      ).length,
    [browserVisualBySession],
  );

  const isSettingsNavigationActive = settingsLayer > 1;
  const isSettingsFocusMode = isSettingsNavigationActive && settingsFullscreen;
  const isStudioActive = activeStudio !== null;
  const isAnyOverlayActive = isSettingsNavigationActive || isStudioActive;

  useEffect(() => {
    if (settingsLayer !== 2) return;
    const layerRoot = settingsLayerRefs.current[2];
    if (!layerRoot) return;
    const activeCard = layerRoot.querySelector<HTMLElement>(
      `.settings-view-card[data-settings-tab-id="${settingsActiveTab}"]`,
    ) ?? layerRoot.querySelector<HTMLElement>(".settings-view-card.is-active");
    if (!activeCard) return;
    centerSettingsTargetInView(activeCard, 2, "smooth");
  }, [centerSettingsTargetInView, settingsActiveTab, settingsFocusIndex, settingsLayer]);

  useEffect(() => {
    if (settingsLayer !== 3) return;

    const layerContainer = settingsLayerRefs.current[3];
    const content = layerContainer?.querySelector(
      ".opta-studio-content",
    ) as HTMLElement | null;
    if (!content) return;

    let rafId: number | null = null;
    const syncHighlightMarkers = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        applyLayer3HighlightState({ behavior: "auto", scroll: false });
        rafId = null;
      });
    };

    const observer = new MutationObserver(() => {
      syncHighlightMarkers();
    });
    observer.observe(content, { childList: true, subtree: true });
    content.addEventListener("transitionend", syncHighlightMarkers, true);
    content.addEventListener("animationend", syncHighlightMarkers, true);
    syncHighlightMarkers();

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      content.removeEventListener("transitionend", syncHighlightMarkers, true);
      content.removeEventListener("animationend", syncHighlightMarkers, true);
    };
  }, [applyLayer3HighlightState, settingsActiveTab, settingsLayer]);

  useEffect(() => {
    if (settingsLayer !== 3) {
      if (settingsLayer3EditTargetRef.current) {
        const visualTarget = resolveLayer3HighlightTarget(
          settingsLayer3EditTargetRef.current,
        );
        visualTarget.classList.remove(
          "opta-setting-editing",
          "opta-setting-highlighted",
        );
        visualTarget.removeAttribute("data-opta-nav-editing");
        visualTarget.removeAttribute("data-opta-nav-highlight");
      }
      settingsLayer3EditTargetRef.current = null;
      settingsLayer3PendingEditFocusRef.current = false;
      settingsLayer3EditDraftRef.current = null;
      setSettingsLayer3EditMode(false);
      return;
    }

    const elements = getLayer3InteractiveElements();
    if (!elements.length) {
      const timeoutA = window.setTimeout(() => {
        applyLayer3HighlightState({ behavior: "auto", scroll: false });
      }, 32);
      const timeoutB = window.setTimeout(() => {
        applyLayer3HighlightState({ behavior: "auto", scroll: false });
      }, 128);
      return () => {
        window.clearTimeout(timeoutA);
        window.clearTimeout(timeoutB);
      };
    }
    applyLayer3HighlightState();
  }, [
    applyLayer3HighlightState,
    getLayer3InteractiveElements,
    resolveLayer3HighlightTarget,
    settingsLayer,
    settingsActiveTab,
  ]);

  // Re-apply L3 visual markers after every render so React class updates
  // from daemon polling do not drop keyboard highlight/edit styling.
  useEffect(() => {
    if (settingsLayer !== 3) return;
    if (
      settingsNavigationInputModeRef.current === "keyboard" &&
      !settingsLayer3EditMode
    ) {
      restoreLayer3NavigationFocus();
    }
    applyLayer3HighlightState({ behavior: "auto", scroll: false });
  }, [
    applyLayer3HighlightState,
    restoreLayer3NavigationFocus,
    settingsLayer,
    settingsLayer3EditMode,
    settingsLayer3FocusIndex,
  ]);

  useEffect(() => {
    if (settingsLayer !== 3) return;
    const layerRoot = settingsLayerRefs.current[3];
    if (!layerRoot) return;

    const interactiveSelector =
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])";

    const switchToPointerMode = (target: EventTarget | null, withSelection: boolean) => {
      if (!(target instanceof HTMLElement) || !layerRoot.contains(target)) return;
      const interactiveTarget =
        withSelection
          ? target.closest<HTMLElement>(interactiveSelector)
          : null;
      const modeSwitchNeeded = settingsNavigationInputModeRef.current !== "pointer";
      const editModeActive = settingsLayer3EditMode;
      if (!modeSwitchNeeded && !editModeActive && !interactiveTarget) return;

      if (modeSwitchNeeded) {
        setSettingsNavigationInputMode("pointer");
      }

      if (editModeActive) {
        settingsLayer3EditTargetRef.current = null;
        settingsLayer3PendingEditFocusRef.current = false;
        settingsLayer3EditDraftRef.current = null;
        setSettingsLayer3EditMode(false);
      }

      if (interactiveTarget) {
        const interactiveElements = getLayer3InteractiveElements();
        const nextIndex = interactiveElements.indexOf(interactiveTarget);
        if (nextIndex >= 0) {
          setSettingsLayer3FocusIndex((current) =>
            current === nextIndex ? current : nextIndex,
          );
        }
      }

      applyLayer3HighlightState({
        behavior: "auto",
        scroll: false,
        editMode: false,
        editTarget: null,
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (event.buttons !== 0) return;
      switchToPointerMode(event.target, false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      switchToPointerMode(event.target, true);
    };

    layerRoot.addEventListener("mousemove", handleMouseMove, true);
    layerRoot.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      layerRoot.removeEventListener("mousemove", handleMouseMove, true);
      layerRoot.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [
    applyLayer3HighlightState,
    getLayer3InteractiveElements,
    setSettingsNavigationInputMode,
    settingsLayer,
    settingsLayer3EditMode,
  ]);

  useEffect(() => {
    if (settingsLayer !== 3 || settingsLayer3EditMode) return;

    const handleFocusIn = (event: FocusEvent) => {
      const layerRoot = settingsLayerRefs.current[3];
      if (!layerRoot) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !layerRoot.contains(target)) {
        return;
      }

      if (settingsLayer3PendingEditFocusRef.current) {
        settingsLayer3PendingEditFocusRef.current = false;
        return;
      }

      if (settingsNavigationInputModeRef.current !== "keyboard") {
        return;
      }

      const typingControl =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable;
      if (!typingControl) return;

      target.blur();
      restoreLayer3NavigationFocus(true);
      applyLayer3HighlightState({
        behavior: "auto",
        scroll: false,
        editMode: false,
        editTarget: null,
      });
    };

    window.addEventListener("focusin", handleFocusIn, true);
    return () => window.removeEventListener("focusin", handleFocusIn, true);
  }, [
    applyLayer3HighlightState,
    restoreLayer3NavigationFocus,
    settingsLayer,
    settingsLayer3EditMode,
  ]);

  useEffect(() => {
    if (settingsLayer !== 3) {
      layer3ResetKeyRef.current = null;
      setSettingsNavigationInputMode("keyboard");
      return;
    }

    const resetKey = `${settingsLayer}:${settingsActiveTab}`;
    if (layer3ResetKeyRef.current === resetKey) return;
    layer3ResetKeyRef.current = resetKey;

    settingsLayer3EditTargetRef.current = null;
    settingsLayer3PendingEditFocusRef.current = false;
    settingsLayer3EditDraftRef.current = null;
    setSettingsLayer3EditMode(false);
    setSettingsLayer3FocusIndex(0);
    setSettingsNavigationInputMode("keyboard");
    scheduleLayer3HighlightRefreshRef.current();
  }, [setSettingsNavigationInputMode, settingsActiveTab, settingsLayer]);

  useEffect(() => {
    const nextIndex = SETTINGS_TAB_SEQUENCE.indexOf(settingsActiveTab);
    if (nextIndex >= 0 && nextIndex !== settingsFocusIndex) {
      setSettingsFocusIndex(nextIndex);
    }
  }, [settingsActiveTab, settingsFocusIndex]);

  useEffect(() => {
    if (settingsLayer <= 1) return;
    setLastSettingsLayer(settingsLayer as Exclude<SettingsLayer, 1>);
    setLastSettingsTab(settingsActiveTab);
  }, [settingsActiveTab, settingsLayer]);

  useEffect(() => {
    if (settingsLayer === 1 && settingsFullscreen) {
      setSettingsFullscreen(false);
    }
  }, [settingsFullscreen, settingsLayer]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // Effect: Global keyboard-first settings navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      const isTypingTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (isCtrlOrMeta && key === "s" && e.shiftKey) {
        e.preventDefault();
        setSettingsNavigationInputMode("keyboard");
        focusSettingsTab("connection-network");
        goToSettingsLayer(2);
        return;
      }

      if (isCtrlOrMeta && key === "s") {
        e.preventDefault();
        setSettingsNavigationInputMode("keyboard");
        if (settingsLayer === 1) {
          setActiveStudio(null);
          focusSettingsTab(lastSettingsTab);
          goToSettingsLayer(lastSettingsLayer);
          return;
        }
        goToSettingsLayer(1);
        return;
      }

      // --- FEATURE STUDIO TOGGLES ---
      // Ctrl+B (Browser), Ctrl+M (Models), Ctrl+A (ATPO), Ctrl+P (Projects), Ctrl+L (Live)
      if (isCtrlOrMeta && (key === "b" || key === "m" || key === "a" || key === "p" || key === "l") && !e.shiftKey) {
        e.preventDefault();
        const targetStudio =
          key === "b" ? "browser" : key === "m" ? "models" : key === "p" ? "projects" : key === "l" ? "live" : "atpo";
        // Close settings if open
        if (settingsLayer > 1) {
          goToSettingsLayer(1);
        }
        setActiveStudio((current) => {
          // Detect switch: going from one studio directly to another
          studioSwitchingRef.current = current !== null && current !== targetStudio;
          return current === targetStudio ? null : targetStudio;
        });
        setStudioFullscreen(false);
        return;
      }

      // Studio overlay keyboard navigation
      if (activeStudio !== null) {
        if (e.key === "Escape") {
          e.preventDefault();
          setActiveStudio(null);
          setStudioFullscreen(false);
          return;
        }
        if (e.shiftKey && e.code === "Space") {
          e.preventDefault();
          setStudioFullscreen((f) => !f);
          return;
        }
      }

      const moveLeftKey = key === "a" || e.key === "ArrowLeft";
      const moveRightKey = key === "d" || e.key === "ArrowRight";
      const moveUpKey = key === "w" || e.key === "ArrowUp";
      const moveDownKey = key === "s" || e.key === "ArrowDown";
      const categoryPrev = e.shiftKey && moveLeftKey;
      const categoryNext = e.shiftKey && moveRightKey;
      const navigateLeft = moveLeftKey && !e.shiftKey;
      const navigateRight = moveRightKey && !e.shiftKey;
      const navigateUp = moveUpKey;
      const navigateDown = moveDownKey;
      const goUpLayerKey = e.code === "Space" && !e.shiftKey;
      const goDownLayerKey = e.key === "Tab" || e.key === "Backspace";
      const layer3AdjustmentKey =
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown";
      const settingsKeyboardIntent =
        settingsLayer > 1 &&
        (categoryPrev ||
          categoryNext ||
          navigateLeft ||
          navigateRight ||
          navigateUp ||
          navigateDown ||
          goUpLayerKey ||
          goDownLayerKey ||
          layer3AdjustmentKey ||
          e.key === "Enter" ||
          e.key === "Escape" ||
          (e.shiftKey && e.code === "Space"));
      if (settingsKeyboardIntent) {
        setSettingsNavigationInputMode("keyboard");
      }

      if (settingsLayer > 1) {
        if (e.shiftKey && e.code === "Space") {
          e.preventDefault();
          setSettingsFullscreen((current) => !current);
          return;
        }

        if (settingsLayer === 3 && settingsLayer3EditMode) {
          if (e.key === "Escape") {
            e.preventDefault();
            cancelLayer3SettingEdit();
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();
            commitLayer3SettingEdit();
            return;
          }

          const adjustmentKey =
            navigateLeft ||
            navigateRight ||
            navigateUp ||
            navigateDown ||
            e.key === "Home" ||
            e.key === "End" ||
            e.key === "PageUp" ||
            e.key === "PageDown";
          // When the focused element is a native typing control (e.g. a React-controlled
          // input[type="number"]), let the browser handle ArrowUp/Down natively.
          // Direct target.value assignment does not trigger React's synthetic onChange,
          // so we skip the custom adjuster and allow the event to propagate.
          if (adjustmentKey && !isTypingTarget) {
            const adjusted = adjustLayer3SelectedSetting(e);
            if (adjusted) {
              e.preventDefault();
              return;
            }
          }

          if (isTypingTarget) {
            return;
          }
        }

        if (e.key === "Escape") {
          e.preventDefault();
          goToSettingsLayer(settingsLayer === 3 ? 2 : 1);
          return;
        }

        if (goDownLayerKey) {
          e.preventDefault();
          goToSettingsLayer(settingsLayer === 3 ? 2 : 1);
          return;
        }

        if (goUpLayerKey) {
          e.preventDefault();
          if (settingsLayer === 2) {
            goToSettingsLayer(3);
          }
          return;
        }

        if (categoryPrev || categoryNext) {
          e.preventDefault();
          cycleSettingsTab(categoryPrev ? -1 : 1);
          if (settingsLayer === 3) {
            setSettingsLayer3EditMode(false);
            setSettingsLayer3FocusIndex(0);
            scheduleLayer3HighlightRefresh();
          }
          return;
        }

        if (settingsLayer === 2) {
          if (e.key === "Enter") {
            e.preventDefault();
            goToSettingsLayer(3);
            return;
          }
          if (navigateLeft) {
            e.preventDefault();
            moveSettingsGridSelection("left");
            return;
          }
          if (navigateRight) {
            e.preventDefault();
            moveSettingsGridSelection("right");
            return;
          }
          if (navigateUp) {
            e.preventDefault();
            moveSettingsGridSelection("up");
            return;
          }
          if (navigateDown) {
            e.preventDefault();
            moveSettingsGridSelection("down");
            return;
          }
        }

        if (settingsLayer === 3) {
          if (isTypingTarget) return;

          if (e.key === "Enter") {
            const elements = getLayer3InteractiveElements();
            if (!elements.length) return;
            const activeIndex = Math.min(
              Math.max(settingsLayer3FocusIndex, 0),
              elements.length - 1,
            );
            const target = elements[activeIndex] ?? elements[0];
            if (!target) return;

            e.preventDefault();
            settingsLayer3EditTargetRef.current = target;
            settingsLayer3PendingEditFocusRef.current = true;
            settingsLayer3EditDraftRef.current = getElementValue(target);
            setSettingsLayer3EditMode(true);
            target.focus({ preventScroll: true });
            return;
          }

          if (navigateLeft || navigateRight || navigateUp || navigateDown) {
            e.preventDefault();
            const direction: SpatialDirection = navigateLeft
              ? "left"
              : navigateRight
                ? "right"
                : navigateUp
                  ? "up"
                  : "down";
            moveLayer3Highlight(direction);
            return;
          }
        }

        return;
      }

      if (settingsLayer === 1 && e.key === "Enter") {
        e.preventDefault();
        goToSettingsLayer(2);
        return;
      }

      if (settingsLayer === 1 && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        goToSettingsLayer(2);
        setSettingsFullscreen(true);
        return;
      }

      if (settingsLayer === 1 && goUpLayerKey) {
        e.preventDefault();
        goToSettingsLayer(2);
        return;
      }

      // Ignore if the user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (isCtrlOrMeta && key === "b") {
        e.preventDefault();
        setBrowserViewMode((current) => {
          const next =
            current === "default"
              ? "expanded"
              : current === "expanded"
                ? "minimized"
                : "default";
          const nextLabel =
            next === "expanded"
              ? "Expanded"
              : next === "minimized"
                ? "Minimized"
                : "Default";
          setNotice(`Browser mode: ${nextLabel}`);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    adjustLayer3SelectedSetting,
    cancelLayer3SettingEdit,
    commitLayer3SettingEdit,
    cycleSettingsTab,
    focusSettingsTab,
    getElementValue,
    getLayer3InteractiveElements,
    moveSettingsGridSelection,
    moveLayer3Highlight,
    goToSettingsLayer,
    lastSettingsLayer,
    lastSettingsTab,
    setSettingsNavigationInputMode,
    scheduleLayer3HighlightRefresh,
    settingsLayer,
    settingsLayer3EditMode,
    settingsLayer3FocusIndex,

    activeStudio,
  ]);

  useEffect(() => {
    if (connectionState === "connected") setHasEverConnected(true);
  }, [connectionState]);

  useEffect(() => {
    if (!hasEverConnected) {
      setDisconnectedSinceMs(null);
      setOfflineSeconds(0);
      return;
    }
    if (connectionState === "connected") {
      setDisconnectedSinceMs(null);
      setOfflineSeconds(0);
      return;
    }
    if (
      connectionState === "disconnected" ||
      connectionState === "connecting"
    ) {
      setDisconnectedSinceMs((current) => current ?? Date.now());
      return;
    }
  }, [connectionState, hasEverConnected]);

  useEffect(() => {
    if (disconnectedSinceMs === null) return;
    const updateOfflineSeconds = () => {
      setOfflineSeconds(
        Math.max(0, Math.floor((Date.now() - disconnectedSinceMs) / 1000)),
      );
    };
    updateOfflineSeconds();
    const timer = window.setInterval(updateOfflineSeconds, 1000);
    return () => window.clearInterval(timer);
  }, [disconnectedSinceMs]);

  useEffect(() => {
    const onOpenSetupWizard = () => setFirstRun(true);
    window.addEventListener(OPEN_SETUP_WIZARD_EVENT, onOpenSetupWizard);
    return () =>
      window.removeEventListener(OPEN_SETUP_WIZARD_EVENT, onOpenSetupWizard);
  }, []);

  useEffect(() => {
    if (selectedWorkspace === "all") return;
    const exists = sessions.some(
      (session) => session.workspace === selectedWorkspace,
    );
    if (!exists) setSelectedWorkspace("all");
  }, [selectedWorkspace, sessions]);

  const paletteCommands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "new-session",
        title: "Create new session",
        description:
          "Create and select a new daemon session. Optional query: workspace | title",
        keywords: ["new", "thread", "create", "session", "workspace"],
        run: async (query) => {
          const [workspaceInput, titleInput] = query
            .split("|")
            .map((part) => part.trim());
          const workspace =
            workspaceInput ||
            (selectedWorkspace !== "all" ? selectedWorkspace : "Workspace");
          const title = titleInput || undefined;
          const sessionId = await createSession({ workspace, title });
          setSelectedWorkspace(workspace);
          setNotice(`Created session ${sessionId}`);
        },
      },
      {
        id: "track-session",
        title: "Track session by ID",
        description:
          "Add an existing daemon session to the rail using the query text as session ID",
        keywords: ["track", "attach", "id", "session"],
        requiresQuery: true,
        run: async (query) => {
          if (!query.trim()) {
            throw new Error("Provide a session ID in the palette query field.");
          }
          await trackSession(
            query,
            selectedWorkspace !== "all" ? selectedWorkspace : undefined,
          );
          setNotice(`Tracking ${query}`);
        },
      },
      {
        id: "refresh",
        title: "Refresh daemon state",
        description: "Force an immediate metrics + session + events refresh",
        keywords: ["refresh", "poll", "sync"],
        run: async () => {
          await refreshNow();
          setNotice("Daemon data refreshed");
        },
      },
      {
        id: "toggle-terminal",
        title: "Toggle terminal panel",
        description: "Show or hide the right-side runtime panel",
        keywords: ["terminal", "panel", "layout"],
        run: () => setShowTerminal((current) => !current),
      },
      {
        id: "live-browser",
        title: "Toggle Live Browser View",
        description: "Open Live Browser Studio (Ctrl+L)",
        keywords: ["browser", "live", "view", "feed", "stream", "ctrl+l"],
        run: () => {
          goToSettingsLayer(1);
          setActiveStudio((current) => current === "live" ? null : "live");
          setStudioFullscreen(false);
        },
      },
      {
        id: "clear-composer",
        title: "Clear composer draft",
        description: "Remove draft text from the composer",
        keywords: ["composer", "clear", "draft"],
        run: () => setComposerDraft(""),
      },
      {
        id: "open-models",
        title: "Open models control room",
        description: "Switch to LMX model operations and memory view",
        keywords: ["models", "lmx", "memory"],
        run: () => openSettings("lmx-models"),
      },
      {
        id: "open-settings",
        title: "Open settings",
        description: "Open Settings Studio in the connection tab",
        keywords: ["settings", "preferences", "config", "studio"],
        run: () => openSettings("connection-network"),
      },
      {
        id: "open-sessions",
        title: "Open session cockpit",
        description: "Switch to active session orchestration",
        keywords: ["sessions", "timeline", "workspace"],
        run: () => setActivePage("sessions"),
      },
      {
        id: "open-operations",
        title: "Open agent tooling",
        description:
          "Run diff, embedding, rerank, and benchmark operations via daemon API",
        keywords: [
          "tools",
          "operations",
          "benchmark",
          "ceo",
          "embed",
          "rerank",
          "diff",
        ],
        run: () => openSettings("tools-agents-learning"),
      },
      {
        id: "open-app-catalog",
        title: "Open app catalog",
        description: "Install and manage Opta apps through daemon-backed CLI ops",
        keywords: ["apps", "install", "uninstall", "catalog"],
        run: () => openSettings("apps-catalog"),
      },
      {
        id: "open-session-memory",
        title: "Open session memory",
        description:
          "Search, export, and manage persisted sessions via sessions.* operations",
        keywords: ["sessions", "memory", "search", "export", "delete"],
        run: () => openSettings("session-memory"),
      },
      {
        id: "open-system-operations",
        title: "Open system control plane",
        description:
          "Diagnostics, lifecycle, onboarding, and maintenance operations",
        keywords: [
          "system",
          "daemon",
          "serve",
          "doctor",
          "version",
          "update",
          "init",
          "onboard",
          "keychain",
        ],
        run: () => openSettings("daemon-runtime"),
      },
      {
        id: "open-cli-operations",
        title: "Open CLI bridge",
        description:
          "Advanced bridge to full CLI operation families while keeping Opta CLI as primary TUI",
        keywords: [
          "cli",
          "bridge",
          "advanced",
          "tui",
          "parity",
        ],
        run: () => openSettings("cli-system-advanced"),
      },
      {
        id: "open-env-profiles",
        title: "Open env management",
        description: "Run daemon env.* operations for profile management",
        keywords: ["env", "profiles", "environment", "vars", "secrets"],
        run: () => openSettings("environment-profiles"),
      },
      {
        id: "open-mcp-management",
        title: "Open MCP management",
        description: "Run daemon mcp.* operations for server management",
        keywords: ["mcp", "servers", "management", "tools"],
        run: () => openSettings("mcp-integrations"),
      },
      {
        id: "open-config-studio",
        title: "Open config studio",
        description: "Inspect, search, and edit daemon config values",
        keywords: ["config", "settings", "keys", "reset"],
        run: () => openSettings("config-studio"),
      },
      {
        id: "open-account-controls",
        title: "Open account controls",
        description:
          "Manage account auth and account key operations via daemon controls",
        keywords: ["account", "signup", "login", "logout", "keys", "auth"],
        run: () => openSettings("accounts-vault"),
      },
      {
        id: "open-jobs",
        title: "Open background jobs",
        description: "View and manage daemon background processes",
        keywords: ["jobs", "background", "processes", "kill", "output"],
        run: () => openSettings("background-jobs"),
      },
      {
        id: "open-logs",
        title: "Open daemon logs",
        description: "View daemon log entries in real time",
        keywords: ["logs", "daemon", "debug", "errors"],
        run: () => openSettings("daemon-logs"),
      },
      {
        id: "daemon-start",
        title: "Start daemon",
        description: "Start the Opta daemon process",
        keywords: ["daemon", "start", "run", "launch", "server"],
        run: async () => {
          await daemonClient.daemonControlStart(connection);
          setNotice("Daemon start requested");
        },
      },
      {
        id: "daemon-stop",
        title: "Stop daemon",
        description: "Stop the Opta daemon process",
        keywords: ["daemon", "stop", "kill", "shutdown", "server"],
        run: async () => {
          await daemonClient.daemonControlStop(connection);
          setNotice("Daemon stop requested");
        },
      },
      {
        id: "daemon-doctor",
        title: "Run system doctor",
        description: "Run diagnostics and show health check summary",
        keywords: ["doctor", "health", "diagnostics", "check", "fix"],
        run: async () => {
          const info = await daemonClient.doctorRun(connection);
          const { passed, warnings, failures } = info.doctorSummary;
          setNotice(`Doctor: ${passed} passed · ${warnings} warnings · ${failures} failures`);
        },
      },
      {
        id: "studio-browser",
        title: "Open Browser Studio",
        description: "Live browser sessions and localhost registry (Ctrl+B)",
        keywords: ["browser", "localhost", "playwright", "sessions", "ports", "ping"],
        run: () => {
          goToSettingsLayer(1);
          setActiveStudio((current) => current === "browser" ? null : "browser");
          setStudioFullscreen(false);
        },
      },
      {
        id: "studio-models",
        title: "Open Models Studio",
        description: "LMX model management, memory usage and inference (Ctrl+M)",
        keywords: ["models", "lmx", "memory", "inference", "load", "unload", "mlx"],
        run: () => {
          goToSettingsLayer(1);
          setActiveStudio((current) => current === "models" ? null : "models");
          setStudioFullscreen(false);
        },
      },
      {
        id: "studio-atpo",
        title: "Open Atpo Studio",
        description: "Opta apps and MCP server management (Ctrl+A)",
        keywords: ["atpo", "apps", "mcp", "modules", "catalog", "packages"],
        run: () => {
          goToSettingsLayer(1);
          setActiveStudio((current) => current === "atpo" ? null : "atpo");
          setStudioFullscreen(false);
        },
      },
      {
        id: "studio-projects",
        title: "Open Projects Studio",
        description: "Manage projects, workspaces, and sessions (Ctrl+P)",
        keywords: ["projects", "workspaces", "sessions", "create", "delete", "manage"],
        run: () => {
          goToSettingsLayer(1);
          setActiveStudio((current) => current === "projects" ? null : "projects");
          setStudioFullscreen(false);
        },
      },
      {
        id: "export-session",
        title: "Export active session as Markdown",
        description: "Download the active session timeline as a .md file",
        keywords: ["export", "download", "markdown", "save"],
        run: () => {
          if (!activeSessionId) {
            setNotice("No active session to export.");
            return;
          }
          const items = timelineBySession[activeSessionId] ?? [];
          if (items.length === 0) {
            setNotice("Session has no timeline items to export.");
            return;
          }
          const md = exportToMarkdown(activeSessionId, items);
          downloadAsFile(`opta-session-${activeSessionId}.md`, md);
          setNotice("Session exported as Markdown");
        },
      },
    ],
    [
      activeSessionId,
      connection,
      createSession,
      goToSettingsLayer,
      openSettings,
      refreshNow,
      selectedWorkspace,
      setActiveStudio,
      setNotice,
      setStudioFullscreen,
      timelineBySession,
      trackSession,
    ],
  );

  const closePaletteRef = useRef<() => void>(() => undefined);
  const shellBodyRef = useRef<HTMLDivElement | null>(null);
  const handlePaletteApply = useCallback(
    async (command: PaletteCommand, query: string) => {
      try {
        await command.run(query);
        closePaletteRef.current();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    },
    [],
  );

  const palette = useCommandPalette({
    commands: paletteCommands,
    onApply: handlePaletteApply,
  });
  closePaletteRef.current = palette.close;

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const classes = ["platform-macos", "platform-windows", "platform-linux"];
    root.classList.remove(...classes);
    body.classList.remove(...classes);
    if (!platform) {
      root.removeAttribute("data-platform");
      body.removeAttribute("data-platform");
      return;
    }
    const className = `platform-${platform}`;
    root.classList.add(className);
    body.classList.add(className);
    root.setAttribute("data-platform", platform);
    body.setAttribute("data-platform", platform);
  }, [platform]);

  useEffect(() => {
    const root = document.documentElement;
    const cssSupports =
      typeof CSS !== "undefined" && typeof CSS.supports === "function"
        ? CSS.supports.bind(CSS)
        : null;
    const supportsBackdrop = Boolean(
      cssSupports?.("backdrop-filter: blur(1px)") ||
      cssSupports?.("-webkit-backdrop-filter: blur(1px)"),
    );
    root.classList.toggle("opta-backdrop-supported", supportsBackdrop);
    root.classList.toggle("opta-backdrop-fallback", !supportsBackdrop);
  }, []);

  const supportsInert =
    typeof HTMLElement !== "undefined" && "inert" in HTMLElement.prototype;

  useEffect(() => {
    const shellBody = shellBodyRef.current;
    if (!shellBody) return;
    if (palette.isOpen) {
      if (supportsInert) {
        shellBody.setAttribute("inert", "");
      } else {
        shellBody.classList.add("palette-inert-fallback");
      }
    } else {
      shellBody.removeAttribute("inert");
      shellBody.classList.remove("palette-inert-fallback");
    }
  }, [palette.isOpen, supportsInert]);

  const toggleSidebarFromMenuButton = useCallback(() => {
    setSidebarVisible((current) => !current);
  }, [setSidebarVisible]);

  const onSubmitComposer = useCallback(
    async (overrides?: SessionTurnOverrides) => {
      const outbound = composerDraft.trim();
      if (!outbound) return;
      let sessionId = activeSessionId;
      if (!sessionId) {
        // Auto-create a session when the user types their first prompt
        const ws = selectedWorkspace === "all" ? "default" : selectedWorkspace;
        sessionId = await createSession({ workspace: ws });
        setActiveSessionId(sessionId);
        setActivePage("sessions");
      }
      try {
        if (outbound.startsWith("/")) recordCommandUsage(outbound.split(/\s/)[0]!);
        await submitMessage(outbound, submissionMode, overrides);
        setComposerDraft("");
        setNotice(modeSubmitNotice(submissionMode));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    },
    [activeSessionId, composerDraft, createSession, selectedWorkspace, submitMessage, submissionMode],
  );

  const onDictate = useCallback(async (audioBase64: string, autoSubmit?: boolean) => {
    if (!connection) return;
    setNotice("Transcribing audio...");
    try {
      const res = await daemonClient.runOperation(connection, 'audio.transcribe', {
        audioBase64,
        audioFormat: 'webm'
      });
      if (res.ok) {
        const text = (res.result as TranscriptionResult).text;
        if (text) {
          const finalDraft = composerDraft ? `${composerDraft} ${text}` : text;
          if (autoSubmit) {
            setComposerDraft("");
            let sessionId = activeSessionId;
            if (!sessionId) {
              const ws = selectedWorkspace === "all" ? "default" : selectedWorkspace;
              sessionId = await createSession({ workspace: ws });
              setActiveSessionId(sessionId);
              setActivePage("sessions");
            }
            try {
              await submitMessage(finalDraft, submissionMode);
              setNotice(modeSubmitNotice(submissionMode));
            } catch (error) {
              setNotice(error instanceof Error ? error.message : String(error));
            }
          } else {
            setComposerDraft(finalDraft);
            setNotice("Dictation complete.");
          }
        }
      } else {
        setNotice(`Transcription failed: ${res.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      setNotice(`Dictation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [connection, composerDraft, activeSessionId, selectedWorkspace, createSession, setActiveSessionId, submitMessage, submissionMode]);

  const onTts = useCallback(async (text: string) => {
    if (!connection) return undefined;
    try {
      const res = await daemonClient.runOperation(connection, 'audio.tts', { text });
      if (res.ok) {
        return (res.result as TTSResult).audioBase64;
      } else {
        console.error("TTS failed:", res.error);
      }
    } catch (e) {
      console.error("TTS network error:", e);
    }
    return undefined;
  }, [connection]);

  const reconnectEndpoint = `${connection.protocol ?? "http"}://${connection.host}:${connection.port}`;
  const copyReconnectDiagnostics = useCallback(async () => {
    const diagnostics = [
      `timestamp=${new Date().toISOString()}`,
      `endpoint=${reconnectEndpoint}`,
      `state=${connectionState}`,
      `offline_seconds=${offlineSeconds}`,
      `active_session=${activeSessionId ?? "none"}`,
      `tracked_sessions=${sessionCount}`,
      `error=${connectionError ?? "none"}`,
    ].join(" | ");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(diagnostics);
      setNotice("Reconnect diagnostics copied");
    } catch {
      setNotice("Could not copy reconnect diagnostics");
    }
  }, [
    activeSessionId,
    connectionError,
    connectionState,
    offlineSeconds,
    reconnectEndpoint,
    sessionCount,
  ]);

  // Setup wizard gate — renders before anything else
  if (firstRun === null) {
    // Loading: blank OLED screen while we check first-run status
    return <div style={{ background: "#09090b", height: "100vh" }} />;
  }
  if (firstRun) {
    return (
      <Suspense fallback={<div style={{ background: "#09090b", height: "100vh" }} />}>
        <LazySetupWizard onComplete={() => setFirstRun(false)} />
      </Suspense>
    );
  }

  const showReconnectOverlay =
    initialCheckDone && connectionState !== "connected" && hasEverConnected;
  const platformClass = platform ? ` platform-${platform}` : "";

  return (
    <>
      {/* V1 Ambient Blobs */}
      <div className="v1-ambient" aria-hidden="true">
        <div className="v1-blob v1-blob-1" />
        <div className="v1-blob v1-blob-2" />
      </div>
      <div
        className={`app-shell${platformClass} ${palette.isOpen ? "palette-open" : ""}${isSettingsNavigationActive ? " settings-nav-open" : ""}${isSettingsFocusMode ? " settings-focus-mode" : ""}${activeStudio ? ` studio-${activeStudio}-open studio-nav-open` : ""}`}
        data-settings-layer={settingsNavigationState.activeLayer}
        data-settings-highlight={settingsNavigationState.highlightedNodeKey ?? ""}
        data-settings-editing={settingsNavigationState.editMode ? "true" : "false"}
        data-settings-scroll-container={settingsNavigationState.activeScrollContainerKey}
        data-platform={platform ?? undefined}
      >
        <div
          ref={shellBodyRef}
          className="app-shell-body"
          aria-hidden={palette.isOpen ? "true" : undefined}
        >
          {/* V1 Topbar — redesign-9: logo + Accounts only, no search */}
          <header className="v1-topbar" data-tauri-drag-region>
            <div className="v1-top-left" data-tauri-drag-region>
              <div className="v1-logo" data-tauri-drag-region>
                <img
                  src="/opta-code-mark.svg"
                  alt="Opta Code"
                  className="v1-logo-mark"
                  data-tauri-drag-region
                />
                <span className="v1-logo-text" data-tauri-drag-region>OPTA CODE</span>
              </div>
            </div>
            {/* Floating Action Island — inside topbar, positioned top-right */}
            <div className="v1-action-island">
              <button
                type="button"
                className={`v1-island-btn ${sidebarVisible ? "is-active" : ""}`}
                aria-pressed={sidebarVisible}
                title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                onClick={toggleSidebarFromMenuButton}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
                Menu
              </button>
            </div>
          </header>


          {/* V1 Agent Bar — horizontal strip above body */}
          {Object.values(streamingBySession).some(Boolean) && (
            <div className="v1-agent-bar">
              <span className="v1-agent-label">AGENTS</span>
              {sessions
                .filter((s) => streamingBySession[s.sessionId])
                .map((s) => (
                  <button
                    key={s.sessionId}
                    type="button"
                    className="v1-agent-pill"
                    onClick={() => { setActiveSessionId(s.sessionId); setActivePage("sessions"); }}
                  >
                    <span className="v1-agent-dot" />
                    {s.title || s.sessionId.slice(0, 8)}
                    {" "}
                    <span style={{ opacity: 0.6 }}>[{s.workspace}]</span>
                  </button>
                ))}
            </div>
          )}

          {/* V1 3-Column Layout */}
          <div className="v1-body">
            {/* Left: Project Pane */}
            <ProjectPane
              sessions={sessions}
              activeSessionId={activeSessionId}
              streamingBySession={streamingBySession}
              pendingPermissionsBySession={pendingPermissionsBySession}
              connectionState={connectionState}
              connectionHealth={useConnectionHealthResult}
              connectionHost={connection.host}
              connectionPort={connection.port}
              onSelectSession={(sessionId) => {
                setActiveSessionId(sessionId);
                setActivePage("sessions");
                const next = sessions.find((s) => s.sessionId === sessionId);
                if (next) setSelectedWorkspace(next.workspace);
              }}
              onCreateSession={async () => {
                const ws = selectedWorkspace === "all" ? "default" : selectedWorkspace;
                const sessionId = await createSession({ workspace: ws });
                setActiveSessionId(sessionId);
                setActivePage("sessions");
                setNotice(`New session created in "${ws}"`);
              }}
              deviceLabel={deviceLabel}
              onDeviceLabelChange={handleDeviceLabelChange}
              collapsed={!sidebarVisible}
            />

            {/* Center: Chat or Page Content */}
            <div className="v1-center">
              {/* Branding Header (static, globally anchored in sessions mode) */}
              {activePage === "sessions" && (
                <>
                  {!activeSessionId && (
                    <div className="v1-chat-header">
                      <b>Ctrl+S</b> Settings · <b>Ctrl+B</b> Browser · <b>Ctrl+L</b> Live · <b>Ctrl+M</b> Models · <b>Ctrl+A</b> Atpo
                    </div>
                  )}
                  <div className="v1-branding">
                    <div
                      className={`v1-brand-logo ${isSettingsNavigationActive ? "is-settings-open" : ""}`}
                    >
                      {(() => {
                        const word =
                          activeStudio === "browser" ? "BROWSER" :
                            activeStudio === "models" ? "MODELS" :
                              activeStudio === "projects" ? "PROJECT MANAGER" :
                                activeStudio === "atpo" ? "ATPO" :
                                  activeStudio === "live" ? "LIVE" : "OPTA";
                        const wordClass = activeStudio ? ` v1-brand-word--${activeStudio}` : "";
                        return (
                          <div className={`v1-brand-word${wordClass}`} aria-label={word} style={{ perspective: "1000px" }}>
                            <AnimatePresence mode="wait">
                              {word.split("").map((letter, index) => {
                                if (letter === " ") {
                                  return <span key={`${word}-space-${index}`} style={{ width: "0.5em", display: "inline-block" }} aria-hidden="true" />;
                                }
                                return (
                                  <motion.span
                                    key={`${word}-${index}`}
                                    className={`v1-brand-letter v1-brand-letter-${index + 1}`}
                                    custom={index}
                                    variants={{
                                      initial: { opacity: 0, rotateX: 90, scale: 0.95, filter: "blur(2px)" },
                                      animate: (i: number) => ({
                                        opacity: 1,
                                        rotateX: 0,
                                        scale: 1,
                                        filter: "blur(0px)",
                                        transition: {
                                          type: "spring",
                                          stiffness: 150,
                                          damping: 15,
                                          delay: i * 0.03
                                        }
                                      }),
                                      exit: (i: number) => ({
                                        opacity: 0,
                                        rotateX: -90,
                                        scale: 0.95,
                                        filter: "blur(2px)",
                                        transition: {
                                          duration: 0.15,
                                          delay: i * 0.02
                                        }
                                      })
                                    }}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    style={{ display: "inline-block", transformOrigin: "center center", willChange: "transform, opacity, filter" }}
                                  >
                                    {letter}
                                  </motion.span>
                                );
                              })}

                              {/* Recording Circle for LIVE Studio */}
                              {word === "LIVE" && (
                                <motion.span
                                  key="live-recording-circle"
                                  className="v1-brand-letter ml-4"
                                  custom={word.length}
                                  variants={{
                                    initial: { opacity: 0, rotateX: 90, scale: 0.95, filter: "blur(2px)" },
                                    animate: (i: number) => ({
                                      opacity: 1,
                                      rotateX: 0,
                                      scale: 1,
                                      filter: "blur(0px)",
                                      transition: { type: "spring", stiffness: 150, damping: 15, delay: i * 0.03 }
                                    }),
                                    exit: (i: number) => ({
                                      opacity: 0,
                                      rotateX: -90,
                                      scale: 0.95,
                                      filter: "blur(2px)",
                                      transition: { duration: 0.15, delay: i * 0.02 }
                                    })
                                  }}
                                  initial="initial"
                                  animate="animate"
                                  exit="exit"
                                  style={{ display: "inline-flex", alignItems: "center", transformOrigin: "center center", willChange: "transform, opacity, filter" }}
                                >
                                  <span className="pulse-dot bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)] !w-5 !h-5 !m-0" style={{ animationDuration: '1s' }} />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="v1-brand-sub">Code Environment</div>
                  </div>
                </>
              )}

              {/* Middle Layer (receives Settings Overlay) */}
              <div className="v1-middle-layer" ref={settingsMiddleLayerRef}>
                <AnimatePresence mode="wait" custom={settingsLayerTransition} initial={false}>
                  {settingsLayer === 2 && (
                    <motion.div
                      key="settings-layer-2"
                      className="v1-settings-motion-layer"
                      custom={settingsLayerTransition}
                      variants={settingsLayerVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      onAnimationComplete={() => {
                        // The PRO FIX: Trigger heavyweight render ONLY after animation finishes
                        if (!window.__optaDeferredLayer2) {
                          window.__optaDeferredLayer2 = true;
                          window.dispatchEvent(new Event('opta-layer-2-ready'));
                        }
                      }}
                    >
                      <div
                        className={`v1-settings-overlay v1-settings-layer v1-settings-layer-2 dm-overlay-anim dm-overlay-${designMode}${settingsFullscreen ? " v1-settings-overlay-expanded" : ""}`}
                        tabIndex={-1}
                        style={settingsOverlayDockStyle}
                        ref={(element: HTMLDivElement | null) => {
                          settingsLayerRefs.current[2] = element;
                        }}
                      >
                        <Suspense
                          fallback={
                            <SettingsLayerLoadingFallback
                              layer={2}
                              activeTab={settingsActiveTab}
                            />
                          }
                        >
                          <DeferredMount triggerEvent="opta-layer-2-ready">
                            <LazySettingsView
                              designMode={designMode}
                              selectedTab={settingsActiveTab}
                              isFullscreen={settingsFullscreen}
                              onHighlightTab={focusSettingsTab}
                              onOpenSettingsTab={openSettings}
                              navigationInputMode={settingsNavigationInputMode}
                              onPointerActivity={() => {
                                if (settingsNavigationInputModeRef.current !== "pointer") {
                                  setSettingsNavigationInputMode("pointer");
                                }
                              }}
                            />
                          </DeferredMount>
                        </Suspense>
                      </div>
                    </motion.div>
                  )}

                  {/* Feature Studio Overlays — Ctrl+B/M/A */}
                  {settingsLayer === 1 && activeStudio === "browser" && (
                    <motion.div
                      key="studio-browser"
                      className="v1-settings-motion-layer"
                      custom={{ direction: "deeper", motion: studioSwitchingRef.current ? "switch" : "root" }}
                      variants={settingsLayerVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      onAnimationComplete={() => {
                        studioSwitchingRef.current = false;
                        if (!window.__optaDeferredBrowser) {
                          window.__optaDeferredBrowser = true;
                          window.dispatchEvent(new Event('opta-browser-ready'));
                        }
                      }}
                    >
                      <div
                        className={`v1-settings-overlay v1-settings-layer${studioFullscreen ? " v1-settings-overlay-expanded" : ""}`}
                        style={settingsOverlayDockStyle}
                      >
                        <Suspense fallback={null}>
                          <DeferredMount triggerEvent="opta-browser-ready">
                            <LazyBrowserStudio
                              isFullscreen={studioFullscreen}
                              onClose={() => { setActiveStudio(null); setStudioFullscreen(false); window.__optaDeferredBrowser = false; }}
                              liveHostStatus={browserLiveHostStatus}
                              onRefreshLiveHost={refreshLiveHost}
                            />
                          </DeferredMount>
                        </Suspense>
                      </div>
                    </motion.div>
                  )}

                  {settingsLayer === 1 && activeStudio === "models" && (
                    <motion.div
                      key="studio-models"
                      className="v1-settings-motion-layer"
                      custom={{ direction: "deeper", motion: studioSwitchingRef.current ? "switch" : "root" }}
                      variants={settingsLayerVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      onAnimationComplete={() => {
                        studioSwitchingRef.current = false;
                        if (!window.__optaDeferredModels) {
                          window.__optaDeferredModels = true;
                          window.dispatchEvent(new Event('opta-models-ready'));
                        }
                      }}
                    >
                      <div
                        className={`v1-settings-overlay v1-settings-layer${studioFullscreen ? " v1-settings-overlay-expanded" : ""}`}
                        style={settingsOverlayDockStyle}
                      >
                        <Suspense fallback={null}>
                          <DeferredMount triggerEvent="opta-models-ready">
                            <LazyModelsStudio
                              isFullscreen={studioFullscreen}
                              onClose={() => { setActiveStudio(null); setStudioFullscreen(false); window.__optaDeferredModels = false; }}
                              connection={connection}
                            />
                          </DeferredMount>
                        </Suspense>
                      </div>
                    </motion.div>
                  )}

                  {settingsLayer === 1 && activeStudio === "atpo" && (
                    <motion.div
                      key="studio-atpo"
                      className="v1-settings-motion-layer"
                      custom={{ direction: "deeper", motion: studioSwitchingRef.current ? "switch" : "root" }}
                      variants={settingsLayerVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      onAnimationComplete={() => {
                        studioSwitchingRef.current = false;
                        if (!window.__optaDeferredAtpo) {
                          window.__optaDeferredAtpo = true;
                          window.dispatchEvent(new Event('opta-atpo-ready'));
                        }
                      }}
                    >
                      <div
                        className={`v1-settings-overlay v1-settings-layer${studioFullscreen ? " v1-settings-overlay-expanded" : ""}`}
                        style={settingsOverlayDockStyle}
                      >
                        <Suspense fallback={null}>
                          <DeferredMount triggerEvent="opta-atpo-ready">
                            <LazyAtpoStudio
                              isFullscreen={studioFullscreen}
                              onClose={() => { setActiveStudio(null); setStudioFullscreen(false); window.__optaDeferredAtpo = false; }}
                              connection={connection}
                            />
                          </DeferredMount>
                        </Suspense>
                      </div>
                    </motion.div>
                  )}

                  {settingsLayer === 1 && activeStudio === "projects" && (
                    <motion.div
                      key="studio-projects"
                      className="v1-settings-motion-layer"
                      custom={{ direction: "deeper", motion: studioSwitchingRef.current ? "switch" : "root" }}
                      variants={settingsLayerVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      onAnimationComplete={() => {
                        studioSwitchingRef.current = false;
                        if (!window.__optaDeferredProjects) {
                          window.__optaDeferredProjects = true;
                          window.dispatchEvent(new Event('opta-projects-ready'));
                        }
                      }}
                    >
                      <div
                        className={`v1-settings-overlay v1-settings-layer${studioFullscreen ? " v1-settings-overlay-expanded" : ""}`}
                        style={settingsOverlayDockStyle}
                      >
                        <Suspense fallback={null}>
                          <DeferredMount triggerEvent="opta-projects-ready">
                            <LazyProjectsStudio
                              isFullscreen={studioFullscreen}
                              onClose={() => { setActiveStudio(null); setStudioFullscreen(false); window.__optaDeferredProjects = false; }}
                              sessions={sessions}
                              activeSessionId={activeSessionId}
                              onSelectSession={(sid) => {
                                setActiveSessionId(sid);
                                setActivePage("sessions");
                              }}
                              onCreateSession={async (workspace) => {
                                setActiveStudio(null);
                                setStudioFullscreen(false);
                                const ws = workspace === "all" ? "default" : workspace;
                                const sessionId = await createSession({ workspace: ws });
                                setActiveSessionId(sessionId);
                                setActivePage("sessions");
                              }}
                              connectionState={connectionState}
                            />
                          </DeferredMount>
                        </Suspense>
                      </div>
                    </motion.div>
                  )}

                  {/* Live Studio Layout */}
                  {settingsLayer === 1 && activeStudio === "live" && (
                    <motion.div
                      key="studio-live"
                      className="v1-settings-motion-layer"
                      custom={{ direction: "deeper", motion: studioSwitchingRef.current ? "switch" : "root" }}
                      variants={settingsLayerVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      onAnimationComplete={() => {
                        studioSwitchingRef.current = false;
                        if (!window.__optaDeferredLive) {
                          window.__optaDeferredLive = true;
                          window.dispatchEvent(new Event('opta-live-ready'));
                        }
                      }}
                    >
                      <div
                        className={`v1-settings-overlay v1-settings-layer v1-settings-overlay--live${studioFullscreen ? " v1-settings-overlay-expanded" : ""}`}
                        style={settingsOverlayDockStyle}
                      >
                        <Suspense fallback={<div className="feature-studio-loading-placeholder" />}>
                          <DeferredMount triggerEvent="opta-live-ready">
                            <LazyLiveStudio
                              connection={connection}
                              slot={activeBrowserSlot}
                              viewerAuthToken={activeBrowserViewerAuthToken}
                              isFullscreen={studioFullscreen}
                              onClose={() => { setActiveStudio(null); setStudioFullscreen(false); window.__optaDeferredLive = false; }}
                              onToggleFullscreen={() => setStudioFullscreen(!studioFullscreen)}
                            />
                          </DeferredMount>
                        </Suspense>
                      </div>
                    </motion.div>
                  )}

                  {settingsLayer === 3 && (
                    <motion.div
                      key="settings-layer-3"
                      className="v1-settings-motion-layer"
                      custom={settingsLayerTransition}
                      variants={settingsLayerVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      onAnimationComplete={() => {
                        if (!window.__optaDeferredLayer3) {
                          window.__optaDeferredLayer3 = true;
                          window.dispatchEvent(new Event('opta-layer-3-ready'));
                        }
                      }}
                    >
                      <div
                        className={`v1-settings-overlay v1-settings-layer v1-settings-layer-3 dm-overlay-anim dm-overlay-${designMode}${settingsFullscreen ? " v1-settings-overlay-expanded" : ""}`}
                        tabIndex={-1}
                        data-opta-nav-input-mode={settingsNavigationInputMode}
                        data-opta-nav-edit-mode={settingsLayer3EditMode ? "true" : "false"}
                        style={settingsOverlayDockStyle}
                        ref={(element: HTMLDivElement | null) => {
                          settingsLayerRefs.current[3] = element;
                        }}
                      >
                        <Suspense
                          fallback={
                            <SettingsLayerLoadingFallback
                              layer={3}
                              activeTab={settingsActiveTab}
                            />
                          }
                        >
                          <DeferredMount triggerEvent="opta-layer-3-ready">
                            <LazySettingsModal
                              embedded
                              isOpen
                              isDeepLayer
                              isFullscreen={settingsFullscreen}
                              activeTab={settingsActiveTab}
                              initialTab={settingsActiveTab}
                              isSettingEditMode={settingsLayer3EditMode}
                              onActiveTabChange={focusSettingsTab}
                              onBackLayer={() => goToSettingsLayer(2)}
                              onClose={() => goToSettingsLayer(1)}
                              connection={connection}
                              connectionState={connectionState}
                              defaultSessionId={activeSessionId}
                              onManageTiles={() => widgetLayout.toggleEditMode()}
                              onSaveConnection={(conn) => {
                                setConnection(conn);
                                setNotice("Daemon connection updated");
                                void refreshNow();
                              }}
                            />
                          </DeferredMount>
                        </Suspense>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chat Pane (hidden when settings navigation is active) */}
                <div className={`v1-chat-pane ${isAnyOverlayActive ? `v1-chat-hidden dm-chat-anim dm-chat-${designMode}` : ""}`}>
                  {/* Session chat */}
                  {activePage === "sessions" ? (
                    <>
                      {!activeSessionId ? (
                        <div className="v1-messages">
                          <div className="v1-empty-msg">No messages yet. Select a project and start a task.</div>
                        </div>
                      ) : (
                        <div className="v1-timeline-area">
                          {timelineItems.length > 0 && (
                            <div className="session-export-bar">
                              <button
                                type="button"
                                className="session-export-btn"
                                onClick={() => {
                                  const md = exportToMarkdown(activeSessionId, timelineItems);
                                  downloadAsFile(`opta-session-${activeSessionId}.md`, md);
                                  setNotice("Session exported as Markdown");
                                }}
                                title="Export session as Markdown"
                              >
                                <Download size={12} aria-hidden="true" />
                                Export
                              </button>
                            </div>
                          )}
                          <TimelineCards
                            sessionId={activeSessionId}
                            sessionTitle={activeSession?.title}
                            items={timelineItems}
                            isStreaming={isStreaming}
                            pendingPermissions={pendingPermissions}
                            onResolvePermission={resolvePermission}
                            connectionState={connectionState}
                            browserVisualState={activeBrowserVisual}
                          />
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              </div>

              {/* Statically positioned Composer below middle layer */}
              {activePage === "sessions" && (
                <div
                  className={`v1-composer-dock ${isAnyOverlayActive ? "v1-composer-dock--minimized" : ""}`}
                >
                  <Composer
                    value={composerDraft}
                    onChange={setComposerDraft}
                    onSubmit={onSubmitComposer}
                    onCancel={() => void cancelActiveTurn()}
                    onDictate={onDictate}
                    isStreaming={isStreaming}
                    disabled={false}
                    mode={submissionMode}
                    onModeChange={setSubmissionMode}
                    timelineItems={timelineItems}
                    onTts={onTts}
                  />
                </div>
              )}
            </div>

            {/* Right: Widget Pane */}
            {activePage === "sessions" && (
              <>
                <WidgetPane
                  slots={widgetLayout.layout.slots}
                  isEditing={widgetLayout.isEditing}
                  onToggleEdit={widgetLayout.toggleEditMode}
                  onRemoveWidget={widgetLayout.removeWidget}
                  onAddWidget={(wid) => widgetLayout.addWidget(wid, "M")}
                  onMoveWidget={widgetLayout.moveWidget}
                  timelineItems={timelineItems}
                  rawEvents={activeSessionId ? rawEventsBySession[activeSessionId] || [] : []}
                  connection={connection}
                  sessionId={activeSessionId}
                  connectionHealth={useConnectionHealthResult}
                  projectCwd={(activeSession as any)?.workspace ?? null}
                />
                {showTerminal && (
                  <div className="v1-right-panel" style={{ width: '400px', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                    <Suspense fallback={<div className="flex-1" aria-hidden="true" />}>
                      <LazyLiveBrowserView
                        connection={connection}
                        slot={activeBrowserSlot}
                        viewerAuthToken={activeBrowserViewerAuthToken}
                        className="flex-1"
                      />
                    </Suspense>
                  </div>
                )}
              </>
            )}
          </div>

          {showReconnectOverlay ? (
            <div
              className="daemon-reconnect-overlay"
              role="status"
              aria-live="assertive"
            >
              <div className="daemon-reconnect-overlay__panel">
                <h2>Daemon connection lost</h2>
                <p>
                  Opta is retrying automatically. The session view unlocks as
                  soon as the daemon is back online.
                </p>
                <p className="daemon-reconnect-overlay__meta">
                  Endpoint: <code>{reconnectEndpoint}</code>
                </p>
                <p className="daemon-reconnect-overlay__meta">
                  Offline for {offlineSeconds}s. Health checks retry every{" "}
                  {Math.max(1, Math.round(runtimePollDelayMs / 1000))}s.
                </p>
                {connectionError ? (
                  <p className="daemon-reconnect-overlay__error">
                    {connectionError}
                  </p>
                ) : null}
                <div className="daemon-reconnect-overlay__actions">
                  <button
                    type="button"
                    className="opta-button primary"
                    onClick={repairConnection}
                  >
                    Repair daemon connection
                  </button>
                  <button
                    type="button"
                    className="opta-button secondary"
                    onClick={copyReconnectDiagnostics}
                  >
                    Copy diagnostics
                  </button>
                  <button type="button" onClick={() => setDesignMode("0")} style={{ color: designMode === "0" ? "#fff" : "#888", padding: "2px 6px" }}>0: Def</button>
                  <button type="button" onClick={() => setDesignMode("1")} style={{ color: designMode === "1" ? "#fff" : "#888", padding: "2px 6px" }}>1: Topbar</button>
                  <button type="button" onClick={() => setDesignMode("2")} style={{ color: designMode === "2" ? "#fff" : "#888", padding: "2px 6px" }}>2: Widget</button>
                  <button type="button" onClick={() => setDesignMode("3")} style={{ color: designMode === "3" ? "#fff" : "#888", padding: "2px 6px" }}>3: Floating</button>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
                  <button type="button" onClick={() => setDesignMode("4")} style={{ color: designMode === "4" ? "#fff" : "#888", padding: "2px 6px" }}>4: Spatial</button>
                  <button type="button" onClick={() => setDesignMode("5")} style={{ color: designMode === "5" ? "#fff" : "#888", padding: "2px 6px" }}>5: Cinematic</button>
                  <button type="button" onClick={() => setDesignMode("6")} style={{ color: designMode === "6" ? "#fff" : "#888", padding: "2px 6px" }}>6: Fluid</button>
                </div>
              </div>
            </div>
          ) : null}
        </div >

        <CommandPalette
          open={palette.isOpen}
          query={palette.query}
          commands={palette.filteredCommands}
          selectedIndex={palette.selectedIndex}
          onQueryChange={palette.setQuery}
          onSelect={palette.setSelectedIndex}
          onApply={palette.applySelected}
          onClose={palette.close}
        />
      </div >
      {firstPendingPermission && (
        <Suspense fallback={null}>
          <LazyPermissionModal
            request={firstPendingPermission}
            onResolve={resolveSessionPermission}
          />
        </Suspense>
      )
      }
    </>
  );
}

export default App;
