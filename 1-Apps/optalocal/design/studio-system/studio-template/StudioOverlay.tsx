/**
 * Studio Overlay Template
 *
 * Copy this file to src/components/MyStudio.tsx and:
 * 1. Replace STUDIO_NAME and STUDIO_SUB_LABEL with your Studio's identity
 * 2. Replace ACCENT with the canonical feature hex color (see ECOSYSTEM-IDENTITY.md)
 * 3. Replace the logo-letter modifier class (e.g. --browser, --models, --atpo, --custom)
 * 4. Fill in the content section with your Studio's purpose-built UI
 * 5. Register in lazyAppModules.tsx
 * 6. Add keyboard handler in App.tsx (see pattern at the Ctrl+B block)
 *
 * Rules (non-negotiable, from STUDIO-SYSTEM.md):
 * - Always use .opta-studio-shell.opta-studio-shell--embedded as the root class
 * - Always include the logo-reserve block with is-docked + conditional is-active
 * - Always include the top-chrome with close button
 * - Shift+Space fullscreen toggle must be wired (handled in App.tsx keyboard handler)
 * - Escape to close must be wired (handled in App.tsx keyboard handler)
 * - Feature accent is passed via CSS var --studio-feature-accent on the root element
 */

import { type CSSProperties } from "react";
import { X } from "lucide-react";

const OPTA_LOGO_LETTERS = ["O", "P", "T", "A"] as const;

// ─── CHANGE THESE ───────────────────────────────────────────────────────────
const STUDIO_NAME = "MY STUDIO";          // e.g. "OPTA BROWSER"
const STUDIO_SUB_LABEL = "My Purpose";   // e.g. "Localhost & Web Sessions"
const ACCENT = "#8b5cf6";                // canonical hex from ECOSYSTEM-IDENTITY.md
const LOGO_MODIFIER = "custom";          // e.g. "browser" | "models" | "atpo" | "custom"
// ─────────────────────────────────────────────────────────────────────────────

interface StudioOverlayProps {
  isFullscreen: boolean;
  onClose: () => void;
}

export function StudioOverlay({ isFullscreen, onClose }: StudioOverlayProps) {
  const shellClass = [
    "opta-studio-shell",
    "opta-studio-shell--embedded",
    isFullscreen ? "opta-studio-shell--fullscreen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellClass}
      style={{ "--studio-feature-accent": ACCENT } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Opta Text Logo ─────────────────────────────────────────────── */}
      {/* The logo minimizes when is-docked. It expands when is-active.     */}
      {/* is-active is applied in fullscreen mode to maximize branding.     */}
      <div
        className={`opta-studio-logo-reserve is-docked ${isFullscreen ? "is-active" : ""}`}
        aria-hidden="true"
      >
        <div className="opta-studio-logo-stack">
          <div className="opta-studio-logo-word" aria-label="OPTA">
            {OPTA_LOGO_LETTERS.map((letter, index) => (
              <span
                key={`studio-logo-${letter}`}
                className={`opta-studio-logo-letter opta-studio-logo-letter-${index + 1} opta-studio-logo-letter--${LOGO_MODIFIER}`}
              >
                {letter}
              </span>
            ))}
          </div>
          {/* The sub-label text — unique to each Studio */}
          <div
            className="opta-studio-logo-settings"
            style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}88` }}
          >
            {STUDIO_NAME}
          </div>
          <div className="opta-studio-logo-sub">{STUDIO_SUB_LABEL}</div>
        </div>
      </div>

      {/* ── Top Chrome ─────────────────────────────────────────────────── */}
      {/* Keyboard hint + title badge + close button — same across all     */}
      {/* Studios. Only the hint text and badge label change.              */}
      <div className="opta-studio-top-chrome">
        <div className="opta-studio-top-chrome-left">
          <div className="opta-studio-shortcut-panel">
            <span className="opta-studio-shortcut-title">{STUDIO_NAME}</span>
            <span className="opta-studio-shortcut-copy">
              Ctrl+? toggle · Shift+Space fullscreen · Esc close
            </span>
          </div>
        </div>
        <div className="opta-studio-top-chrome-center">
          <div className="opta-studio-command-row">
            <div className="opta-studio-panel-title">
              <span
                className="opta-studio-layer-badge"
                style={{ "--settings-accent": ACCENT } as CSSProperties}
              >
                {STUDIO_SUB_LABEL}
              </span>
            </div>
          </div>
        </div>
        <div className="opta-studio-top-chrome-right">
          <button
            type="button"
            onClick={onClose}
            className="opta-studio-close-btn"
            aria-label={`Close ${STUDIO_NAME}`}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Studio Content ─────────────────────────────────────────────── */}
      {/* Replace this section with your Studio's purpose-built UI.        */}
      {/* Use .feature-studio-content as the root to inherit scroll/flex.  */}
      <div className="feature-studio-content">
        <div className="feature-studio-empty-state">
          <p>Replace this with your Studio content.</p>
          <p className="feature-studio-empty-hint">
            See BrowserStudio.tsx, ModelsStudio.tsx, AtpoStudio.tsx for examples.
          </p>
        </div>
      </div>
    </div>
  );
}

/*
 * ── App.tsx wiring pattern ─────────────────────────────────────────────────
 *
 * 1. Add to FeatureStudioId union type:
 *    type FeatureStudioId = "browser" | "models" | "atpo" | "mystudio";
 *
 * 2. Add keyboard handler (in the Ctrl+B/M/A block):
 *    key === "x" ? "mystudio" :    // x = your chosen key
 *
 * 3. Add render block (in AnimatePresence):
 *    {settingsLayer === 1 && activeStudio === "mystudio" && (
 *      <motion.div key="studio-mystudio" ...same pattern as browser...>
 *        <LazyMyStudio isFullscreen={studioFullscreen} onClose={closeStudio} />
 *      </motion.div>
 *    )}
 *
 * 4. Add to lazyAppModules.tsx:
 *    const loadMyStudio = async () => ({
 *      default: (await import("./components/MyStudio")).MyStudio,
 *    });
 *    export const LazyMyStudio = lazy(loadMyStudio);
 *
 * 5. Add logo modifier CSS (in opta.css, after .opta-studio-logo-letter--atpo):
 *    .opta-studio-logo-letter--custom { text-shadow: 0 0 0 #youraccent, ... }
 */
