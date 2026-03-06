import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  SETTINGS_CATEGORIES,
  normalizeSettingsTabId,
  type SettingsTabId,
} from "./settingsStudioConfig";

interface SettingsViewProps {
  onOpenSettingsTab: (tab: SettingsTabId) => void;
  onHighlightTab?: (tab: SettingsTabId) => void;
  onPointerActivity?: () => void;
  navigationInputMode?: "keyboard" | "pointer";
  designMode?: string;
  selectedTab?: SettingsTabId;
  isFullscreen?: boolean;
  layerHint?: string;
}

export function SettingsView({
  onOpenSettingsTab,
  onHighlightTab,
  onPointerActivity,
  navigationInputMode,
  designMode = "0",
  selectedTab,
  isFullscreen = false,
  layerHint = "Layer 2 · ←↑↓→ or W/A/S/D highlight · Enter open category · Shift+←/→ switch category · Tab/Backspace down layer · Space up layer",
}: SettingsViewProps) {
  const cardRefs = useRef<Partial<Record<SettingsTabId, HTMLButtonElement | null>>>(
    {},
  );
  const resolvedSelectedTab = useMemo(
    () => normalizeSettingsTabId(selectedTab),
    [selectedTab],
  );

  useEffect(() => {
    if (!resolvedSelectedTab) return;
    const card = cardRefs.current[resolvedSelectedTab];
    if (!card) return;
    card.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [resolvedSelectedTab]);

  return (
    <div
      className={`settings-view dm-setting-layout-${designMode}${isFullscreen ? " settings-view--fullscreen" : ""}`}
    >
      <div className="settings-view-header">
        <div className="settings-view-title-wrap">

          <p className="settings-view-subtitle">
            Spatial navigation studio. Select a systems area to configure and
            drill deeper.
          </p>
        </div>
        <span className="settings-view-hint">{layerHint}</span>
      </div>

      <div
        className={`settings-view-grid dm-grid-${designMode}${isFullscreen ? " settings-view-grid--fullscreen" : ""}`}
      >
        {SETTINGS_CATEGORIES.map((category) => (
          <button
            key={category.id}
            className={`settings-view-card ${selectedTab === category.id ? "is-active" : ""}`}
            onClick={() => onOpenSettingsTab(category.id)}
            onMouseEnter={() => {
              if (navigationInputMode !== "keyboard") {
                onHighlightTab?.(category.id);
              }
            }}
            onMouseMove={() => onPointerActivity?.()}
            type="button"
            data-settings-tab-id={category.id}
            ref={(element) => {
              cardRefs.current[category.id] = element;
            }}
            style={
              {
                "--settings-accent": category.accentColor,
              } as CSSProperties
            }
          >
            <div className="settings-card-icon-wrap">
              <category.icon strokeWidth={1.5} />
            </div>
            <div className="settings-card-title">{category.title}</div>
            <div className="settings-card-desc">{category.desc}</div>
            <div className="settings-card-meta">
              {category.supportsDeepLayer ? "Deep Config" : "Quick Config"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
