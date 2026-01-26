/**
 * Optamize.biz - Main JavaScript
 * Premium polish: Cinematic intro, atmosphere, physics, interactions
 */

// ============================================
// CINEMATIC INTRO (Preloader with Shutter Wipe)
// ============================================

function initCinematicIntro() {
    // Create preloader overlay
    const preloader = document.createElement('div');
    preloader.className = 'cinematic-preloader';
    preloader.innerHTML = `
        <div class="preloader-grid"></div>
        <div class="shutter-panel shutter-left"></div>
        <div class="shutter-panel shutter-right"></div>
        <div class="preloader-logo">
            <div class="preloader-ring">
                <div class="preloader-ring-inner"></div>
            </div>
        </div>
    `;
    document.body.prepend(preloader);

    // Animate the reveal
    setTimeout(() => {
        preloader.classList.add('revealing');
    }, 800);

    setTimeout(() => {
        preloader.classList.add('complete');
        document.body.classList.add('loaded');
    }, 1800);

    setTimeout(() => {
        preloader.remove();
    }, 2500);
}

// ============================================
// ATMOSPHERE LAYER
// ============================================

function initAtmosphere() {
    const atmosphereContainer = document.createElement('div');
    atmosphereContainer.className = 'atmosphere-layer';
    atmosphereContainer.innerHTML = `
        <canvas class="parallax-grid" id="parallaxGrid"></canvas>
        <div class="floating-particles" id="floatingParticles"></div>
        <div class="stardust-layer" id="stardustLayer"></div>
        <div class="cursor-glow" id="cursorGlow"></div>
    `;
    document.body.prepend(atmosphereContainer);

    initParallaxGrid();
    initFloatingParticles();
    initDeepSpaceStardust();
    initCursorGlow();
}

// Mouse Parallax Global Grid
function initParallaxGrid() {
    const canvas = document.getElementById('parallaxGrid');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let mouseX = 0, mouseY = 0;
    let gridOffsetX = 0, gridOffsetY = 0;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Smooth follow with premium physics (heavier damping)
        gridOffsetX += (mouseX * 30 - gridOffsetX) * 0.03;
        gridOffsetY += (mouseY * 30 - gridOffsetY) * 0.03;

        // Subtle breathing effect for the grid
        const time = Date.now() * 0.001;
        const baseOpacity = 0.03;
        const breathing = Math.sin(time) * 0.01 + 0.01; // Oscillates between 0 and 0.02

        ctx.strokeStyle = `rgba(139, 92, 246, ${baseOpacity + breathing})`;
        ctx.lineWidth = 1;

        const gridSize = 60;

        // Vertical lines
        for (let x = gridOffsetX % gridSize; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = gridOffsetY % gridSize; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        requestAnimationFrame(drawGrid);
    }
    drawGrid();
}

// Floating Particles
function initFloatingParticles() {
    const container = document.getElementById('floatingParticles');
    if (!container) return;

    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        particle.style.cssText = `
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            width: ${2 + Math.random() * 4}px;
            height: ${2 + Math.random() * 4}px;
            animation-delay: ${Math.random() * 5}s;
            animation-duration: ${8 + Math.random() * 12}s;
            opacity: ${0.1 + Math.random() * 0.3};
        `;
        container.appendChild(particle);
    }
}

// Deep Space Stardust (multi-layered star field with HD twinkle)
function initDeepSpaceStardust() {
    const container = document.getElementById('stardustLayer');
    if (!container) return;

    const layers = [
        { count: 120, size: [0.5, 1.5], speed: 0.1, opacity: 0.2, blur: 0 }, // Very far
        { count: 80, size: [1, 2], speed: 0.2, opacity: 0.4, blur: 0.5 },    // Far
        { count: 50, size: [2, 3], speed: 0.4, opacity: 0.6, blur: 1 },      // Mid
        { count: 20, size: [3, 4], speed: 0.8, opacity: 0.8, blur: 2 },      // Near
    ];

    layers.forEach((layer, layerIndex) => {
        const layerEl = document.createElement('div');
        layerEl.className = `stardust-sublayer stardust-layer-${layerIndex}`;
        layerEl.style.cssText = `animation-duration: ${120 / layer.speed}s;`;

        for (let i = 0; i < layer.count; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]);

            // HD Polish: Random twinkle phase
            const twinkleDuration = 1 + Math.random() * 4;
            const twinkleDelay = Math.random() * 5;

            star.style.cssText = `
                left: ${Math.random() * 200}%;
                top: ${Math.random() * 100}%;
                width: ${size}px;
                height: ${size}px;
                opacity: ${layer.opacity * (0.5 + Math.random() * 0.5)};
                filter: blur(${layer.blur}px);
                animation: starTwinkle ${twinkleDuration}s ease-in-out ${twinkleDelay}s infinite;
            `;
            layerEl.appendChild(star);
        }
        container.appendChild(layerEl);
    });
}

// Radial Gradient Glow (cursor follower)
function initCursorGlow() {
    const glow = document.getElementById('cursorGlow');
    if (!glow) return;

    let glowX = 0, glowY = 0;
    let targetX = 0, targetY = 0;

    document.addEventListener('mousemove', (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
    });

    function animateGlow() {
        // Premium physics: heavier, smoother follow
        glowX += (targetX - glowX) * 0.08;
        glowY += (targetY - glowY) * 0.08;

        glow.style.transform = `translate(${glowX - 200}px, ${glowY - 200}px)`;
        requestAnimationFrame(animateGlow);
    }
    animateGlow();
}

// ============================================
// MAGNETIC BUTTONS
// ============================================

function initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn, .app-card, .feature-card, .satellite');

    buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Normalize for glow (0 to 100%)
            const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
            const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

            btn.style.setProperty('--mouse-x', `${xPercent}%`);
            btn.style.setProperty('--mouse-y', `${yPercent}%`);

            // Magnetic pull strength
            const strength = 0.25; // Stronger pull
            btn.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
            btn.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            setTimeout(() => {
                btn.style.transition = '';
            }, 500);
        });
    });
}

// ============================================
// STAGGERED ENTRANCE ANIMATIONS
// ============================================

function initStaggeredAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Staggered delay based on element index
                const delay = index * 100;
                entry.target.style.transitionDelay = `${delay}ms`;
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe cards with staggered animation
    document.querySelectorAll('.app-card, .feature-card').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px) scale(0.96)';
        el.dataset.staggerIndex = i;
        observer.observe(el);
    });
}

// ============================================
// COMMAND PALETTE
// ============================================

const commandPalette = document.getElementById('commandPalette');
const commandInput = document.getElementById('commandInput');
const commandResults = document.getElementById('commandResults');

const commands = [
    { type: 'app', icon: '💎', title: 'Opta MacOS', description: 'Premium system optimization for Mac', url: '/apps/macos.html', keywords: ['mac', 'desktop', 'optimization', 'performance'] },
    { type: 'app', icon: '📸', title: 'Opta Scan', description: 'AI-powered document scanner', url: '/apps/scan.html', keywords: ['ios', 'iphone', 'scan', 'document', 'camera'] },
    { type: 'app', icon: '✨', title: 'Opta LM', description: 'Life management assistant', url: '/apps/lm.html', keywords: ['ios', 'life', 'tasks', 'calendar', 'productivity'] },
    { type: 'action', icon: '⬇️', title: 'Download Opta MacOS', description: 'Get the latest version', url: '#download-macos', keywords: ['download', 'install', 'get'] },
    { type: 'action', icon: '📱', title: 'App Store - Opta Scan', description: 'Download on iOS', url: 'https://apps.apple.com', keywords: ['download', 'ios', 'app store'] },
    { type: 'action', icon: '📱', title: 'App Store - Opta LM', description: 'Download on iOS', url: 'https://apps.apple.com', keywords: ['download', 'ios', 'app store'] },
    { type: 'page', icon: '📋', title: 'Changelog', description: 'See what\'s new', url: '/changelog.html', keywords: ['updates', 'releases', 'version', 'new'] },
    { type: 'page', icon: '💬', title: 'Support', description: 'Get help with Opta apps', url: '/support.html', keywords: ['help', 'contact', 'issue', 'bug'] },
    { type: 'page', icon: '🔒', title: 'Privacy', description: 'Privacy policy', url: '/privacy.html', keywords: ['privacy', 'data', 'policy'] },
    { type: 'feature', icon: '🛡️', title: 'Privacy First', description: 'All processing happens locally', url: '#features', keywords: ['privacy', 'local', 'secure'] },
    { type: 'feature', icon: '⚡', title: 'Performance', description: 'Native apps, zero bloat', url: '#features', keywords: ['fast', 'native', 'speed'] },
    { type: 'feature', icon: '🤖', title: 'Smart Automation', description: 'AI that adapts to you', url: '#features', keywords: ['ai', 'automation', 'smart'] },
];

let selectedIndex = 0;
let filteredCommands = [...commands];

function setupCommandPalette() {
    renderResults(commands);

    commandInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            filteredCommands = [...commands];
        } else {
            filteredCommands = commands.filter(cmd => {
                const searchText = `${cmd.title} ${cmd.description} ${cmd.keywords.join(' ')}`.toLowerCase();
                return searchText.includes(query);
            });
        }
        selectedIndex = 0;
        renderResults(filteredCommands);
    });

    commandInput?.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
                updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex]);
                }
                break;
        }
    });
}

function renderResults(results) {
    if (!commandResults) return;

    if (results.length === 0) {
        commandResults.innerHTML = `
            <div class="command-empty">
                <span style="font-size: 2rem; opacity: 0.5;">🔍</span>
                <p style="color: var(--text-muted); margin-top: 0.5rem;">No results found</p>
            </div>
        `;
        return;
    }

    const grouped = {
        app: results.filter(r => r.type === 'app'),
        action: results.filter(r => r.type === 'action'),
        page: results.filter(r => r.type === 'page'),
        feature: results.filter(r => r.type === 'feature'),
    };

    let html = '';
    let globalIndex = 0;
    const typeLabels = { app: 'Apps', action: 'Actions', page: 'Pages', feature: 'Features' };

    for (const [type, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;
        html += `<div class="command-group-label">${typeLabels[type]}</div>`;
        for (const item of items) {
            const isSelected = globalIndex === selectedIndex;
            html += `
                <div class="command-item ${isSelected ? 'selected' : ''}" data-index="${globalIndex}">
                    <span class="command-icon">${item.icon}</span>
                    <div class="command-text">
                        <div class="command-title">${item.title}</div>
                        <div class="command-description">${item.description}</div>
                    </div>
                    <span class="command-shortcut">↵</span>
                </div>
            `;
            globalIndex++;
        }
    }

    commandResults.innerHTML = html;

    document.querySelectorAll('.command-item').forEach((item) => {
        item.addEventListener('click', () => {
            selectedIndex = parseInt(item.dataset.index);
            executeCommand(filteredCommands[selectedIndex]);
        });
        item.addEventListener('mouseenter', () => {
            selectedIndex = parseInt(item.dataset.index);
            updateSelection();
        });
    });
}

function updateSelection() {
    document.querySelectorAll('.command-item').forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
    });
    const selected = document.querySelector('.command-item.selected');
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function executeCommand(command) {
    closeCommandPalette();
    if (command.url.startsWith('#')) {
        const target = document.querySelector(command.url);
        target?.scrollIntoView({ behavior: 'smooth' });
    } else if (command.url.startsWith('http')) {
        window.open(command.url, '_blank');
    } else {
        window.location.href = command.url;
    }
}

function openCommandPalette() {
    commandPalette?.classList.add('active');
    commandInput?.focus();
    commandInput.value = '';
    filteredCommands = [...commands];
    selectedIndex = 0;
    renderResults(commands);
    document.body.style.overflow = 'hidden';
}

function closeCommandPalette() {
    commandPalette?.classList.remove('active');
    document.body.style.overflow = '';
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey && e.key === 'k') || (e.key === '/' && !isInputFocused())) {
            e.preventDefault();
            openCommandPalette();
        }
        if (e.key === 'Escape') {
            closeCommandPalette();
        }
    });
    commandPalette?.addEventListener('click', (e) => {
        if (e.target === commandPalette) {
            closeCommandPalette();
        }
    });
}

function isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
}

// Satellite hover effects
function setupSatelliteHovers() {
    const satellites = document.querySelectorAll('.satellite');
    const ring = document.querySelector('.hero-ring');

    satellites.forEach(satellite => {
        satellite.addEventListener('mouseenter', () => {
            ring?.classList.add('satellite-hover');
        });
        satellite.addEventListener('mouseleave', () => {
            ring?.classList.remove('satellite-hover');
        });
    });
}

// Newsletter form
function setupNewsletter() {
    document.querySelector('.newsletter-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        form.innerHTML = `
            <div style="text-align: center; padding: 1rem;">
                <span style="font-size: 2rem;">✨</span>
                <p style="color: var(--text-primary); margin-top: 0.5rem;">Thanks! You're on the list.</p>
            </div>
        `;
    });
}

// ============================================
// INJECT PREMIUM STYLES
// ============================================

const premiumStyles = document.createElement('style');
premiumStyles.textContent = `
    /* Cinematic Preloader */
    .cinematic-preloader {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: var(--void);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .preloader-grid {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px);
        background-size: 50px 50px;
        opacity: 0;
        animation: gridFadeIn 0.5s 0.3s forwards;
    }

    @keyframes gridFadeIn {
        to { opacity: 1; }
    }

    .shutter-panel {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 50%;
        background: linear-gradient(135deg, var(--surface), var(--void));
        transition: transform 0.8s cubic-bezier(0.77, 0, 0.175, 1);
    }

    .shutter-left { left: 0; transform: translateX(0); }
    .shutter-right { right: 0; transform: translateX(0); }

    .cinematic-preloader.revealing .shutter-left { transform: translateX(-100%); }
    .cinematic-preloader.revealing .shutter-right { transform: translateX(100%); }

    .preloader-logo {
        position: relative;
        z-index: 10;
        opacity: 0;
        transform: scale(0.8);
        animation: logoReveal 0.6s 0.2s forwards;
    }

    @keyframes logoReveal {
        to { opacity: 1; transform: scale(1); }
    }

    .preloader-ring {
        width: 80px;
        height: 80px;
        border: 3px solid var(--primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 40px rgba(139, 92, 246, 0.5);
        animation: preloaderPulse 1s ease-in-out infinite;
    }

    @keyframes preloaderPulse {
        0%, 100% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.5); }
        50% { box-shadow: 0 0 80px rgba(139, 92, 246, 0.8); }
    }

    .preloader-ring-inner {
        width: 30px;
        height: 30px;
        background: var(--primary);
        border-radius: 50%;
        animation: innerPulse 1s ease-in-out infinite;
    }

    @keyframes innerPulse {
        0%, 100% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.2); opacity: 1; }
    }

    .cinematic-preloader.complete {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.5s;
    }

    /* Atmosphere Layer */
    .atmosphere-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
    }

    .parallax-grid {
        position: absolute;
        inset: 0;
        opacity: 0.6;
    }

    /* Floating Particles */
    .floating-particles {
        position: absolute;
        inset: 0;
        overflow: hidden;
    }

    .floating-particle {
        position: absolute;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.8), transparent);
        border-radius: 50%;
        animation: floatParticle linear infinite;
    }

    @keyframes floatParticle {
        0% { transform: translateY(100vh) translateX(0); }
        50% { transform: translateY(50vh) translateX(20px); }
        100% { transform: translateY(-20px) translateX(-20px); }
    }

    /* Deep Space Stardust */
    .stardust-layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
    }

    .stardust-sublayer {
        position: absolute;
        inset: 0;
        animation: starDrift linear infinite;
    }

    @keyframes starDrift {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
    }

    .star {
        position: absolute;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.9), transparent);
        border-radius: 50%;
        animation: starTwinkle 2s ease-in-out infinite;
    }

    @keyframes starTwinkle {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
    }

    /* Cursor Glow */
    .cursor-glow {
        position: fixed;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 1;
        will-change: transform;
    }

    /* Premium Animate In */
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) scale(1) !important;
        transition:
            opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    /* Hero ring satellite hover */
    .hero-ring.satellite-hover {
        box-shadow:
            0 0 60px rgba(139, 92, 246, 0.6),
            0 0 120px rgba(139, 92, 246, 0.4),
            inset 0 0 40px rgba(139, 92, 246, 0.3) !important;
    }

    /* Command palette styles */
    .command-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    }

    .command-group-label {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-muted);
        padding: 0.75rem 1rem 0.5rem;
        border-bottom: 1px solid var(--border);
    }

    .command-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .command-item:hover,
    .command-item.selected {
        background: rgba(139, 92, 246, 0.1);
    }

    .command-item.selected {
        background: rgba(139, 92, 246, 0.15);
    }

    .command-icon {
        font-size: 1.25rem;
        width: 2rem;
        text-align: center;
    }

    .command-text {
        flex: 1;
        min-width: 0;
    }

    .command-title {
        font-weight: 500;
        color: var(--text-primary);
    }

    .command-description {
        font-size: 0.8rem;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .command-shortcut {
        font-size: 0.75rem;
        color: var(--text-muted);
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .command-item.selected .command-shortcut,
    .command-item:hover .command-shortcut {
        opacity: 1;
    }

    /* Body loaded state */
    body:not(.loaded) .hero,
    body:not(.loaded) .nav {
        opacity: 0;
    }

    body.loaded .hero,
    body.loaded .nav {
        opacity: 1;
        transition: opacity 0.5s 0.3s;
    }
`;
document.head.appendChild(premiumStyles);

// ============================================
// 3D TILT CARDS (VanillaTilt style)
// ============================================

function init3DTilt() {
    const cards = document.querySelectorAll('.app-card, .feature-card, .tilt-card');

    cards.forEach(card => {
        // Create glare element if it doesn't exist
        if (!card.querySelector('.card-glare')) {
            const glare = document.createElement('div');
            glare.className = 'card-glare';
            card.appendChild(glare);
        }

        const glare = card.querySelector('.card-glare');

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x position within the element
            const y = e.clientY - rect.top;  // y position within the element

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -10; // Max rotation deg
            const rotateY = ((x - centerX) / centerX) * 10;

            // Glare position
            const glareX = (x / rect.width) * 100;
            const glareY = (y / rect.height) * 100;

            card.style.transform = `
                perspective(1000px)
                rotateX(${rotateX}deg)
                rotateY(${rotateY}deg)
                scale3d(1.02, 1.02, 1.02)
            `;

            if (glare) {
                glare.style.background = `
                    radial-gradient(
                        circle at ${glareX}% ${glareY}%, 
                        rgba(255, 255, 255, 0.1) 0%, 
                        transparent 80%
                    )
                `;
                glare.style.opacity = '1';
            }
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `
                perspective(1000px)
                rotateX(0deg)
                rotateY(0deg)
                scale3d(1, 1, 1)
            `;

            if (glare) {
                glare.style.opacity = '0';
            }
        });
    });
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Note: Cinematic intro is handled by intro-sequence.js
    // initCinematicIntro() removed to avoid conflict
    initAtmosphere();
    setupCommandPalette();
    setupKeyboardShortcuts();
    setupSatelliteHovers();
    setupNewsletter();

    // Delay interactive features until after intro
    document.addEventListener('introComplete', () => {
        initStaggeredAnimations();
        initMagneticButtons();
        init3DTilt();
    }, { once: true });

    // Fallback if intro was skipped
    setTimeout(() => {
        initStaggeredAnimations();
        initMagneticButtons();
        init3DTilt();
    }, 3500);
});

// Console Easter egg
console.log(`
%c◈ OPTA %c
%cThe pursuit of optimal.

Built with obsidian glass and electric violet.
Premium polish: Cinematic intro, stardust, magnetic buttons.
Explore the command palette: Press ⌘K or /
`,
    'color: #8b5cf6; font-size: 24px; font-weight: bold;',
    '',
    'color: #a1a1aa; font-size: 12px;'
);
