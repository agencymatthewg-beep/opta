/* =================================================================
   OPTA CINEMATIC INTRO SEQUENCE CONTROLLER
   Logo materialization → Click warp → Void reveal
   ================================================================= */

class IntroSequence {
    constructor() {
        this.preloader = null;
        this.particleContainer = null;
        this.logoContainer = null;
        this.dropletContainer = null;

        // State
        this.isReady = false;
        this.isWarping = false;
        this.hasCompleted = false;

        // Configuration
        this.particleCount = 50;
        this.dropletCount = 16;

        // Timing (ms)
        this.timing = {
            particlesFall: 1500,
            logoDescend: 2000,
            ringMaterialize: 1200,
            promptAppear: 2800,
            warpDuration: 1200,
            exitDelay: 1000
        };

        // Bound methods
        this.handleClick = this.handleClick.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    init() {
        this.preloader = document.querySelector('.cinematic-preloader');
        if (!this.preloader) {
            console.warn('IntroSequence: .cinematic-preloader not found');
            this.skipIntro();
            return;
        }

        this.particleContainer = this.preloader.querySelector('.intro-particles');
        this.logoContainer = this.preloader.querySelector('.intro-logo-container');
        this.dropletContainer = this.preloader.querySelector('.shatter-droplets');

        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.setupReducedMotion();
        } else {
            this.createParticles();
            this.createDroplets();
        }

        // Schedule ready state
        setTimeout(() => {
            this.setReady();
        }, this.timing.promptAppear);

        console.log('IntroSequence initialized');
    }

    // ===================== PARTICLE GENERATION =====================

    // ===================== PARTICLE GENERATION =====================

    createParticles() {
        if (!this.particleContainer) return;

        // HD Polish: Double particle count for density
        const particleCount = 100;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'intro-particle';

            // Random horizontal position (converging toward center)
            const centerBias = (Math.random() - 0.5) * 0.6; // -0.3 to 0.3
            const xPos = 50 + centerBias * 50; // 35% to 65%
            particle.style.left = `${xPos}%`;

            // Random timing
            const duration = 1 + Math.random() * 1; // 1-2s
            const delay = Math.random() * 1.5; // 0-1.5s stagger
            particle.style.setProperty('--fall-duration', `${duration}s`);
            particle.style.setProperty('--fall-delay', `${delay}s`);

            // Random size variation with HD sub-pixel positioning
            const size = 0.5 + Math.random() * 2.5; // Smaller min size for fine details
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;

            // HD Polish: Add subtle blur based on depth
            const blurAmount = Math.random() * 1; // 0 to 1px blur
            particle.style.filter = `blur(${blurAmount}px)`;

            // Varied opacity for depth
            particle.style.opacity = `${0.3 + Math.random() * 0.7}`;

            this.particleContainer.appendChild(particle);
        }
    }

    // ===================== DROPLET GENERATION =====================

    createDroplets() {
        if (!this.dropletContainer) return;

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        for (let i = 0; i < this.dropletCount; i++) {
            const droplet = document.createElement('div');
            droplet.className = 'droplet';

            // Position at center (ring position)
            droplet.style.left = `${centerX}px`;
            droplet.style.top = `${centerY}px`;

            // Calculate fly-out direction (radial from center)
            const angle = (i / this.dropletCount) * Math.PI * 2;
            const distance = 150 + Math.random() * 200; // 150-350px
            const flyX = Math.cos(angle) * distance;
            const flyY = Math.sin(angle) * distance;

            droplet.style.setProperty('--fly-x', `${flyX}px`);
            droplet.style.setProperty('--fly-y', `${flyY}px`);

            // Random timing
            const duration = 0.4 + Math.random() * 0.3; // 0.4-0.7s
            const delay = Math.random() * 0.1; // 0-0.1s
            droplet.style.setProperty('--fly-duration', `${duration}s`);
            droplet.style.setProperty('--fly-delay', `${delay}s`);

            // Random size
            const size = 4 + Math.random() * 8;
            droplet.style.width = `${size}px`;
            droplet.style.height = `${size}px`;

            this.dropletContainer.appendChild(droplet);
        }
    }

    // ===================== READY STATE =====================

    setReady() {
        if (this.hasCompleted) return;

        this.isReady = true;
        this.preloader.classList.add('ready');

        // Bind interaction
        this.preloader.addEventListener('click', this.handleClick);
        document.addEventListener('keydown', this.handleKeydown);

        console.log('Intro ready - click to enter');
    }

    // ===================== WARP TRANSITION =====================

    handleClick(e) {
        if (!this.isReady || this.isWarping) return;
        this.triggerWarp();
    }

    handleKeydown(e) {
        if (!this.isReady || this.isWarping) return;

        // Enter or Space triggers warp
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.triggerWarp();
        }
    }

    triggerWarp() {
        this.isWarping = true;
        this.preloader.classList.add('warping');

        // Play warp sound if available
        this.playWarpSound();

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate([50, 30, 100]);
        }

        // Schedule completion
        setTimeout(() => {
            this.complete();
        }, this.timing.warpDuration);
    }

    playWarpSound() {
        // Optional: Create procedural warp sound using Web Audio API
        if (!window.AudioContext && !window.webkitAudioContext) return;

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Resume audio context if suspended (required for user-gesture initiated playback)
            if (ctx.state === 'suspended') {
                ctx.resume().then(() => this._playWarpOscillator(ctx)).catch(() => {});
            } else {
                this._playWarpOscillator(ctx);
            }
        } catch (e) {
            // Audio not supported or blocked - silently continue
            console.debug('IntroSequence: Audio playback skipped', e.message);
        }
    }

    _playWarpOscillator(ctx) {
        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);

            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);

            // Clean up audio context after sound completes
            setTimeout(() => {
                ctx.close().catch(() => {});
            }, 600);
        } catch (e) {
            // Oscillator creation failed - silently continue
        }
    }

    // ===================== COMPLETION =====================

    complete() {
        this.hasCompleted = true;
        this.preloader.classList.add('exiting');

        // Dispatch completion event
        document.dispatchEvent(new CustomEvent('introComplete', {
            detail: { timestamp: Date.now() }
        }));

        // Remove preloader after exit animation
        setTimeout(() => {
            this.destroy();
        }, 500);

        console.log('Intro complete');
    }

    // ===================== SKIP / REDUCED MOTION =====================

    setupReducedMotion() {
        // Show static logo immediately
        if (this.logoContainer) {
            this.logoContainer.style.transform = 'none';
            this.logoContainer.style.opacity = '1';
        }

        // Enable click immediately
        setTimeout(() => {
            this.setReady();
        }, 500);
    }

    skipIntro() {
        // Skip directly to main content
        document.dispatchEvent(new CustomEvent('introComplete', {
            detail: { timestamp: Date.now(), skipped: true }
        }));
    }

    // ===================== CLEANUP =====================

    destroy() {
        // Remove event listeners
        if (this.preloader) {
            this.preloader.removeEventListener('click', this.handleClick);
        }
        document.removeEventListener('keydown', this.handleKeydown);

        // Remove preloader from DOM
        if (this.preloader && this.preloader.parentNode) {
            this.preloader.parentNode.removeChild(this.preloader);
        }

        this.preloader = null;
        this.particleContainer = null;
        this.logoContainer = null;
        this.dropletContainer = null;
    }
}

// ===================== INITIALIZE =====================

document.addEventListener('DOMContentLoaded', () => {
    // Check if intro should be skipped (e.g., returning user)
    const skipIntro = sessionStorage.getItem('opta-intro-seen');

    if (skipIntro) {
        // Skip intro for returning users in same session
        const preloader = document.querySelector('.cinematic-preloader');
        if (preloader) {
            // Remove from DOM entirely (not just hide) to prevent race conditions
            preloader.remove();
        }
        // Dispatch event after a microtask to ensure listeners are ready
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('introComplete', {
                detail: { timestamp: Date.now(), skipped: true }
            }));
        }, 0);
    } else {
        // Run intro sequence
        window.introSequence = new IntroSequence();
        window.introSequence.init();

        // Mark as seen for session
        document.addEventListener('introComplete', () => {
            sessionStorage.setItem('opta-intro-seen', 'true');
        }, { once: true });
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntroSequence;
}
