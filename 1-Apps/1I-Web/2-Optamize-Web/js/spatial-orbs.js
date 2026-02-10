/**
 * Opta Spatial Orbs
 * Generates ambient floating elements at various Z-depths
 */

function initSpatialOrbs() {
    // Skip for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scene = document.querySelector('.spatial-scene') || document.getElementById('main-content');
    if (!scene) return;

    // Create container if not exists
    let container = scene.querySelector('.spatial-orbs-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'spatial-orbs-container';
        scene.prepend(container);
    }

    const orbCount = 18;
    const colors = ['orb-violet', 'orb-violet', 'orb-blue', 'orb-mint'];
    const drifts = ['drift-vertical', 'drift-orbit', 'drift-wander', 'drift-figure8'];

    // Clear existing
    container.innerHTML = '';

    for (let i = 0; i < orbCount; i++) {
        const orb = document.createElement('div');

        // Random properties
        const size = Math.random() * 300 + 100; // 100px to 400px
        const x = (Math.random() - 0.5) * 180; // Spread wide
        const y = (Math.random() - 0.5) * 180;
        const z = Math.random() * 2500 - 2000; // Deep field

        const colorClass = colors[Math.floor(Math.random() * colors.length)];
        const driftType = drifts[Math.floor(Math.random() * drifts.length)];

        const breatheDuration = Math.random() * 6 + 8; // 8-14s breathing
        const driftDuration = Math.random() * 20 + 40; // 40-60s drift (slow)
        const delay = Math.random() * -20;
        const direction = Math.random() > 0.5 ? 'normal' : 'reverse';

        orb.className = `spatial-orb`; // Reset, class moved to inner

        // Static layout
        orb.style.width = `${size}px`;
        orb.style.height = `${size}px`;
        orb.style.left = `50%`;
        orb.style.top = `50%`;

        // Base transform for 3D position
        // We use a wrapper CSS variable or just set it here directly
        // Note: To combine with drift keyframes (which use translate3d), we need to be careful.
        // Best approach: Use margin for base offset, or nested elements.
        // Simpler: Apply base position to 'top/left' via calc, and use transform ONLY for animation.
        // BUT we need Z. So we'll use a wrapper approach implicitly by creating a container for each orb?
        // No, let's keep it simple: `transform` overrides.
        // We will put the specific drift animation on a pseudo-element or inner div if possible?
        // Actually, CSS keyframes translate3d adds to current? No, it replaces.
        // FIX: Put the static 3D position on the ORB. Put the drift animation on an INNER element.

        orb.style.transform = `
            translate3d(-50%, -50%, 0) 
            translate3d(${x}vw, ${y}vh, ${z}px)
        `;

        // Inner element for drift
        const inner = document.createElement('div');
        inner.className = 'orb-inner';
        inner.style.width = '100%';
        inner.style.height = '100%';
        inner.style.borderRadius = '50%';
        inner.style.background = 'inherit'; // Inherit gradient from parent (we'll move class)

        // Move background class to inner to ensure it moves
        inner.className = `orb-inner ${colorClass}`;

        inner.style.animation = `
            orb-breathe ${breatheDuration}s ease-in-out ${delay}s infinite alternate,
            ${driftType} ${driftDuration}s linear ${delay}s infinite ${direction}
        `;

        orb.appendChild(inner);
        container.appendChild(orb);
    }
}

/**
 * Triggers a "warp speed" effect on orbs during navigation
 * @param {string} direction 'forward' or 'backward' (z-axis)
 */
function triggerOrbWarp(direction = 'forward') {
    const orbs = document.querySelectorAll('.spatial-orb');
    if (orbs.length === 0) return;

    // Add direction-specific class for CSS to handle different warp styles
    const warpClass = direction === 'backward' ? 'warping-reverse' : 'warping';

    orbs.forEach(orb => {
        orb.classList.add(warpClass);
    });

    setTimeout(() => {
        orbs.forEach(orb => {
            orb.classList.remove('warping', 'warping-reverse');
        });
    }, 800); // Match transition duration
}

// Export
window.initSpatialOrbs = initSpatialOrbs;
window.triggerOrbWarp = triggerOrbWarp;
