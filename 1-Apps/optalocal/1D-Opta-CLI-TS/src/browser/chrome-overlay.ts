/**
 * Opta Browser Chrome Overlay
 * 
 * Injected into every Playwright page to provide a consistent "Opta" branded
 * aesthetic and visual indicators (animations) for agent interactions.
 * Uses a Shadow DOM to isolate styles from the host page.
 */
(() => {
  type WindowWithOpta = typeof window & { __OPTA_CHROME_INITIALIZED__?: boolean };
  const w = window as WindowWithOpta;

  if (typeof window === 'undefined' || w.__OPTA_CHROME_INITIALIZED__) return;
  w.__OPTA_CHROME_INITIALIZED__ = true;

  // Initialize the overlay container and Shadow DOM
  const overlayHost = document.createElement('div');
  overlayHost.id = 'opta-chrome-host';
  // Ensure the host is out of the page layout but covers everything
  overlayHost.style.position = 'fixed';
  overlayHost.style.top = '0';
  overlayHost.style.left = '0';
  overlayHost.style.width = '100vw';
  overlayHost.style.height = '100vh';
  overlayHost.style.pointerEvents = 'none'; // Click-through
  overlayHost.style.zIndex = '2147483647'; // Max z-index

  const shadow = overlayHost.attachShadow({ mode: 'closed' });

  // --- Styles ---
  const style = document.createElement('style');
  style.textContent = `
    :host {
      --opta-accent: #8B5CF6; /* Electric Violet */
      --opta-success: #10B981;
      --opta-glass-bg: rgba(15, 23, 42, 0.75); /* Obsidian */
      --opta-glass-border: rgba(139, 92, 246, 0.3);
      --opta-text: #F8FAFC;
    }

    /* Outer Border */
    .opta-border {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 3px solid var(--opta-accent);
      box-sizing: border-box;
      box-shadow: inset 0 0 20px rgba(139, 92, 246, 0.2);
      pointer-events: none;
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
      background-color: var(--opta-success);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--opta-success);
      animation: opta-pulse-dot 2s infinite ease-in-out;
    }

    /* Animations */
    @keyframes opta-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes opta-pulse-dot {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 12px var(--opta-success); }
      100% { transform: scale(0.95); opacity: 0.8; }
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

  const badge = document.createElement('div');
  badge.className = 'opta-badge';
  badge.innerHTML = `
    <div class="opta-dot"></div>
    <span>Opta Agent Active</span>
  `;

  shadow.appendChild(style);
  shadow.appendChild(border);
  shadow.appendChild(badge);

  // Mount to document on load or immediately if already loaded
  if (document.body) {
    document.documentElement.appendChild(overlayHost);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.appendChild(overlayHost);
    });
  }

  // --- Event Listeners for Agent Actions ---
  window.addEventListener('opta:action', ((e: CustomEvent) => {
    const detail = e.detail;
    if (!detail) return;

    if (detail.type === 'click') {
      let x = detail.x;
      let y = detail.y;

      // If selector was provided but no exact coordinates, approximate from element center
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

  function createRipple(x: number, y: number) {
    const ripple = document.createElement('div');
    ripple.className = 'opta-ripple';

    // Account for scroll offset since our host is position fixed
    const clientX = x - window.scrollX;
    const clientY = y - window.scrollY;

    ripple.style.left = `${clientX}px`;
    ripple.style.top = `${clientY}px`;

    const size = 60; // Max size of ripple
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;

    shadow.appendChild(ripple);

    // Cleanup
    setTimeout(() => {
      if (ripple.parentNode === shadow) {
        shadow.removeChild(ripple);
      }
    }, 600);
  }

  function createHighlight(rect: DOMRect) {
    const hl = document.createElement('div');
    hl.className = 'opta-highlight';

    // Add some padding to the rect
    const padding = 4;
    hl.style.left = `${rect.left - padding}px`;
    hl.style.top = `${rect.top - padding}px`;
    hl.style.width = `${rect.width + padding * 2}px`;
    hl.style.height = `${rect.height + padding * 2}px`;

    shadow.appendChild(hl);

    // Cleanup
    setTimeout(() => {
      if (hl.parentNode === shadow) {
        shadow.removeChild(hl);
      }
    }, 800);
  }
})();
