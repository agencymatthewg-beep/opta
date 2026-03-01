/**
 * Opta Browser Chrome Overlay
 *
 * Injected into every Playwright page to provide a consistent "Opta" branded
 * aesthetic and visual indicators (animations) for agent interactions.
 * Uses a Shadow DOM to isolate styles from the host page.
 *
 * State-aware visual identity system:
 *   idle      -> violet border (low opacity)
 *   thinking  -> bright violet, pulsing
 *   executing -> cyan
 *   gated     -> amber (permission required)
 *   error     -> red
 *   success   -> green flash, then back to idle
 *
 * Events consumed:
 *   opta:action   -> { type: 'click'|'type', selector?, x?, y? }
 *   opta:state    -> { state: 'idle'|'thinking'|'executing'|'gated'|'error'|'success' }
 *   opta:policy   -> { action: string, decision: 'allowed'|'gated'|'denied' }
 *   opta:navigate -> { url: string }
 */
(() => {
  type WindowWithOpta = typeof window & { __OPTA_CHROME_INITIALIZED__?: boolean };
  const w = window as WindowWithOpta;

  if (typeof window === 'undefined' || w.__OPTA_CHROME_INITIALIZED__) return;
  w.__OPTA_CHROME_INITIALIZED__ = true;

  // --- State label map ---
  const STATE_LABELS: Record<string, string> = {
    idle: 'Ready',
    thinking: 'Thinking...',
    executing: 'Executing...',
    gated: 'Permission Required',
    error: 'Error',
    success: 'Done',
  };

  let currentState = 'idle';

  // --- Build overlay host + Shadow DOM ---
  function createOverlay(): { shadow: ShadowRoot; host: HTMLDivElement } {
    const overlayHost = document.createElement('div');
    overlayHost.id = 'opta-chrome-host';
    overlayHost.style.position = 'fixed';
    overlayHost.style.top = '0';
    overlayHost.style.left = '0';
    overlayHost.style.width = '100vw';
    overlayHost.style.height = '100vh';
    overlayHost.style.pointerEvents = 'none';
    overlayHost.style.zIndex = '2147483647';

    const shadow = overlayHost.attachShadow({ mode: 'closed' });
    return { shadow, host: overlayHost };
  }

  const { shadow, host: overlayHost } = createOverlay();

  // --- Styles ---
  const style = document.createElement('style');
  style.textContent = `
    :host {
      /* Base tokens */
      --opta-accent: #8B5CF6;
      --opta-success: #10B981;
      --opta-glass-bg: rgba(15, 23, 42, 0.75);
      --opta-glass-border: rgba(139, 92, 246, 0.3);
      --opta-text: #F8FAFC;
      --opta-text-dim: rgba(248, 250, 252, 0.6);

      /* State colors */
      --opta-state-idle: #8B5CF6;
      --opta-state-thinking: #A855F7;
      --opta-state-executing: #06B6D4;
      --opta-state-gated: #F59E0B;
      --opta-state-error: #EF4444;
      --opta-state-success: #10B981;

      /* Active state (driven by JS) */
      --opta-active-color: var(--opta-state-idle);
      --opta-border-opacity: 0.2;
    }

    /* Outer Border */
    .opta-border {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 3px solid var(--opta-active-color);
      opacity: var(--opta-border-opacity);
      box-sizing: border-box;
      box-shadow: inset 0 0 20px rgba(139, 92, 246, 0.15);
      pointer-events: none;
      transition: border-color 0.3s ease, opacity 0.3s ease, box-shadow 0.3s ease;
    }

    .opta-border[data-state="thinking"] {
      animation: opta-border-pulse 1.8s ease-in-out infinite;
    }

    @keyframes opta-border-pulse {
      0% { opacity: 0.35; box-shadow: inset 0 0 20px rgba(168, 85, 247, 0.15); }
      50% { opacity: 0.65; box-shadow: inset 0 0 35px rgba(168, 85, 247, 0.35); }
      100% { opacity: 0.35; box-shadow: inset 0 0 20px rgba(168, 85, 247, 0.15); }
    }

    /* Top Info Bar */
    .opta-info-bar {
      position: absolute;
      top: 3px;
      left: 3px;
      right: 3px;
      height: 28px;
      background: var(--opta-glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--opta-glass-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: var(--opta-text);
      box-sizing: border-box;
      overflow: hidden;
      pointer-events: none;
      animation: opta-fade-in 0.4s ease-out;
    }

    .opta-info-bar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    /* State accent stripe on the left edge */
    .opta-info-bar::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--opta-active-color);
      transition: background 0.3s ease;
    }

    /* CSS-only ring icon */
    .opta-ring-icon {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid transparent;
      background:
        linear-gradient(var(--opta-glass-bg), var(--opta-glass-bg)) padding-box,
        linear-gradient(135deg, #8B5CF6, #06B6D4) border-box;
      flex-shrink: 0;
    }

    .opta-hostname {
      color: var(--opta-text-dim);
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 260px;
    }

    .opta-state-label {
      color: var(--opta-text-dim);
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
      transition: color 0.3s ease;
    }

    /* Navigation Shimmer */
    .opta-info-bar.shimmer::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(139, 92, 246, 0.15) 40%,
        rgba(139, 92, 246, 0.3) 50%,
        rgba(139, 92, 246, 0.15) 60%,
        transparent 100%
      );
      animation: opta-shimmer 0.8s ease-out forwards;
      pointer-events: none;
    }

    @keyframes opta-shimmer {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    /* Badge */
    .opta-badge {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: var(--opta-glass-bg);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid var(--opta-glass-border);
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      color: var(--opta-text);
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 15px rgba(139, 92, 246, 0.15);
      animation: opta-fade-in 0.5s ease-out;
      pointer-events: none;
    }

    .opta-dot {
      width: 8px;
      height: 8px;
      background-color: var(--opta-active-color);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--opta-active-color);
      animation: opta-pulse-dot 2s infinite ease-in-out;
      transition: background-color 0.3s ease, box-shadow 0.3s ease;
    }

    /* Animations */
    @keyframes opta-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes opta-pulse-dot {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 12px var(--opta-active-color); }
      100% { transform: scale(0.95); opacity: 0.8; }
    }

    /* Policy flash — brief color pulse on border */
    @keyframes opta-policy-flash {
      0% { opacity: 0.8; }
      50% { opacity: 1; }
      100% { opacity: var(--opta-border-opacity); }
    }

    .opta-border.policy-flash {
      animation: opta-policy-flash 0.6s ease-out forwards;
    }

    /* Action Ripple (Click) */
    .opta-ripple {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(139,92,246,0.8) 0%, rgba(139,92,246,0) 70%);
      transform: translate(-50%, -50%) scale(0);
      pointer-events: none;
      animation: opta-ripple-anim 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }

    @keyframes opta-ripple-anim {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
    }

    /* Type Highlighter */
    .opta-highlight {
      position: absolute;
      border: 2px solid var(--opta-accent);
      border-radius: 4px;
      background: rgba(139, 92, 246, 0.15);
      box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
      pointer-events: none;
      transition: all 0.2s ease-out;
      animation: opta-highlight-fade 0.8s ease-out forwards;
    }

    @keyframes opta-highlight-fade {
      0% { opacity: 0; transform: scale(1.05); }
      20% { opacity: 1; transform: scale(1); }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;

  // --- DOM Elements ---
  const border = document.createElement('div');
  border.className = 'opta-border';

  // Top info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'opta-info-bar';

  const infoBarLeft = document.createElement('div');
  infoBarLeft.className = 'opta-info-bar-left';

  const ringIcon = document.createElement('div');
  ringIcon.className = 'opta-ring-icon';

  const hostnameSpan = document.createElement('span');
  hostnameSpan.className = 'opta-hostname';
  try {
    hostnameSpan.textContent = window.location.hostname || 'about:blank';
  } catch {
    hostnameSpan.textContent = 'unknown';
  }

  infoBarLeft.appendChild(ringIcon);
  infoBarLeft.appendChild(hostnameSpan);

  const stateLabel = document.createElement('span');
  stateLabel.className = 'opta-state-label';
  stateLabel.textContent = STATE_LABELS.idle;

  infoBar.appendChild(infoBarLeft);
  infoBar.appendChild(stateLabel);

  // Badge
  const badge = document.createElement('div');
  badge.className = 'opta-badge';

  const badgeDot = document.createElement('div');
  badgeDot.className = 'opta-dot';

  const badgeText = document.createElement('span');
  badgeText.textContent = 'Opta Agent Active';

  badge.appendChild(badgeDot);
  badge.appendChild(badgeText);

  shadow.appendChild(style);
  shadow.appendChild(border);
  shadow.appendChild(infoBar);
  shadow.appendChild(badge);

  // --- Mount ---
  function mount() {
    if (!overlayHost.parentNode) {
      (document.documentElement || document.body).appendChild(overlayHost);
    }
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }

  // --- MutationObserver Guardian ---
  // Some SPAs strip injected elements on navigation. Watch for removal and re-inject.
  const guardianObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (let i = 0; i < mutation.removedNodes.length; i++) {
        if (mutation.removedNodes[i] === overlayHost) {
          // Re-inject on next microtask to avoid infinite loops during DOM teardown
          queueMicrotask(mount);
          return;
        }
      }
    }
  });

  // Observe the documentElement for child removal
  guardianObserver.observe(document.documentElement, { childList: true });
  // Also observe body if it exists (some SPAs clear body children)
  if (document.body) {
    guardianObserver.observe(document.body, { childList: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      guardianObserver.observe(document.body, { childList: true });
    });
  }

  // --- State Management ---
  function applyState(state: string) {
    currentState = state;

    const colorVar = `var(--opta-state-${state})`;
    const hostEl = shadow.host as HTMLElement;
    if (hostEl) {
      hostEl.style.setProperty('--opta-active-color', colorVar);
    }

    // Update border opacity per state
    let opacity = '0.2';
    if (state === 'thinking') opacity = '0.6';
    else if (state === 'executing') opacity = '0.7';
    else if (state === 'gated') opacity = '0.8';
    else if (state === 'error') opacity = '0.9';
    else if (state === 'success') opacity = '0.8';

    if (hostEl) {
      hostEl.style.setProperty('--opta-border-opacity', opacity);
    }

    // Set data-state for CSS animation selectors
    border.setAttribute('data-state', state);

    // Remove thinking pulse class if not thinking
    if (state !== 'thinking') {
      border.classList.remove('policy-flash');
    }

    // Update info bar state label
    stateLabel.textContent = STATE_LABELS[state] || state;

    // Update badge text
    if (state === 'idle') {
      badgeText.textContent = 'Opta Agent Active';
    } else if (state === 'gated') {
      badgeText.textContent = 'Permission Required';
    } else if (state === 'error') {
      badgeText.textContent = 'Error';
    } else if (state === 'success') {
      badgeText.textContent = 'Complete';
    } else if (state === 'thinking') {
      badgeText.textContent = 'Thinking...';
    } else if (state === 'executing') {
      badgeText.textContent = 'Executing...';
    }
  }

  function flashStateAndReturn(flashState: string, durationMs: number) {
    applyState(flashState);
    setTimeout(() => {
      applyState('idle');
    }, durationMs);
  }

  // --- Shimmer ---
  function triggerShimmer() {
    // Remove and re-add class to restart animation
    infoBar.classList.remove('shimmer');
    // Force reflow to restart animation
    void infoBar.offsetWidth;
    infoBar.classList.add('shimmer');

    setTimeout(() => {
      infoBar.classList.remove('shimmer');
    }, 850);
  }

  // --- Policy Flash ---
  function triggerPolicyFlash(decision: string) {
    const flashColor =
      decision === 'denied'
        ? 'var(--opta-state-error)'
        : decision === 'gated'
          ? 'var(--opta-state-gated)'
          : null;

    if (!flashColor) return;

    const hostEl = shadow.host as HTMLElement;
    if (hostEl) {
      hostEl.style.setProperty('--opta-active-color', flashColor);
      hostEl.style.setProperty('--opta-border-opacity', '0.9');
    }

    border.classList.remove('policy-flash');
    void border.offsetWidth;
    border.classList.add('policy-flash');

    setTimeout(() => {
      border.classList.remove('policy-flash');
      // Restore to current state
      applyState(currentState);
    }, 600);
  }

  // --- Event Listeners ---

  // opta:action (existing — click ripple + type highlight)
  window.addEventListener('opta:action', ((e: CustomEvent) => {
    const detail = e.detail;
    if (!detail) return;

    if (detail.type === 'click') {
      let x = detail.x;
      let y = detail.y;

      if (detail.selector && (typeof x !== 'number' || typeof y !== 'number')) {
        const el = document.querySelector(detail.selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }
      }

      if (typeof x === 'number' && typeof y === 'number') {
        createRipple(x, y);
      }
    } else if (detail.type === 'type') {
      if (detail.selector) {
        const el = document.querySelector(detail.selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          createHighlight(rect);
        }
      }
    }
  }) as EventListener);

  // opta:state — update border color, badge, info bar
  window.addEventListener('opta:state', ((e: CustomEvent) => {
    const detail = e.detail;
    if (!detail || !detail.state) return;

    const state = detail.state as string;

    if (state === 'success') {
      // Brief green flash then return to idle
      flashStateAndReturn('success', 1500);
    } else {
      applyState(state);
    }
  }) as EventListener);

  // opta:policy — brief amber/red flash on border
  window.addEventListener('opta:policy', ((e: CustomEvent) => {
    const detail = e.detail;
    if (!detail || !detail.decision) return;
    triggerPolicyFlash(detail.decision);
  }) as EventListener);

  // opta:navigate — shimmer + hostname update
  window.addEventListener('opta:navigate', ((e: CustomEvent) => {
    const detail = e.detail;
    if (!detail) return;

    // Update hostname
    if (detail.url) {
      try {
        const parsed = new URL(detail.url);
        hostnameSpan.textContent = parsed.hostname || detail.url;
      } catch {
        hostnameSpan.textContent = detail.url;
      }
    }

    // Trigger shimmer animation
    triggerShimmer();
  }) as EventListener);

  // --- Ripple + Highlight Factories ---

  function createRipple(x: number, y: number) {
    const ripple = document.createElement('div');
    ripple.className = 'opta-ripple';

    const clientX = x - window.scrollX;
    const clientY = y - window.scrollY;

    ripple.style.left = `${clientX}px`;
    ripple.style.top = `${clientY}px`;

    const size = 60;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;

    shadow.appendChild(ripple);

    setTimeout(() => {
      if (ripple.parentNode === shadow) {
        shadow.removeChild(ripple);
      }
    }, 600);
  }

  function createHighlight(rect: DOMRect) {
    const hl = document.createElement('div');
    hl.className = 'opta-highlight';

    const padding = 4;
    hl.style.left = `${rect.left - padding}px`;
    hl.style.top = `${rect.top - padding}px`;
    hl.style.width = `${rect.width + padding * 2}px`;
    hl.style.height = `${rect.height + padding * 2}px`;

    shadow.appendChild(hl);

    setTimeout(() => {
      if (hl.parentNode === shadow) {
        shadow.removeChild(hl);
      }
    }, 800);
  }

  // --- Initialize to idle state ---
  applyState('idle');
})();
