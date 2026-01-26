/* =================================================================
   OPTA VOID BACKGROUND CONTROLLER
   Parallax physics and glint particle generation
   ================================================================= */

class VoidBackground {
    constructor() {
        this.container = null;
        this.glintLayer = null;
        this.nebulaLayer = null;
        this.dustLayer = null;

        // Parallax state
        this.parallaxX = 0;
        this.parallaxY = 0;
        this.targetParallaxX = 0;
        this.targetParallaxY = 0;

        // Heavy parallax - universe barely shifts (1:10 ratio)
        this.parallaxStrength = 0.1;
        this.parallaxEasing = 0.05;

        // Glint configuration
        this.glintCount = 20;
        this.glints = [];

        // Animation state
        this.isAnimating = false;
        this.rafId = null;

        // Bound methods
        this.render = this.render.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);
    }

    init() {
        // Skip heavy animations for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            console.log('VoidBackground: Skipping due to reduced motion preference');
            return;
        }

        this.container = document.querySelector('.void-background');
        if (!this.container) {
            console.warn('VoidBackground: .void-background not found');
            return;
        }

        this.glintLayer = document.getElementById('glintLayer');
        this.nebulaLayer = this.container.querySelector('.nebula-layer');
        this.dustLayer = this.container.querySelector('.dust-layer');

        this.createGlints();
        this.bindParallax();
        this.startRenderLoop();

        // Enable parallax mode
        this.container.classList.add('parallax-enabled');

        console.log('VoidBackground initialized');
    }

    // ===================== GLINT PARTICLES =====================

    createGlints() {
        if (!this.glintLayer) return;

        // Clear existing glints
        this.glintLayer.innerHTML = '';
        this.glints = [];

        for (let i = 0; i < this.glintCount; i++) {
            const glint = document.createElement('div');
            glint.className = 'glint';

            // Random positioning
            glint.style.left = `${Math.random() * 100}%`;
            glint.style.top = `${Math.random() * 100}%`;

            // Random timing
            const duration = 3 + Math.random() * 4; // 3-7 seconds
            const delay = Math.random() * 5; // 0-5 second delay
            const maxOpacity = 0.2 + Math.random() * 0.3; // 0.2-0.5 opacity

            glint.style.setProperty('--duration', `${duration}s`);
            glint.style.setProperty('--delay', `${delay}s`);
            glint.style.setProperty('--max-opacity', maxOpacity);

            // Occasional large glints (10% chance)
            if (Math.random() < 0.1) {
                glint.classList.add('large');
            }

            // Occasional purple glints (20% chance)
            if (Math.random() < 0.2) {
                glint.classList.add('purple');
            }

            this.glintLayer.appendChild(glint);
            this.glints.push({
                element: glint,
                baseX: parseFloat(glint.style.left),
                baseY: parseFloat(glint.style.top)
            });
        }
    }

    // ===================== PARALLAX =====================

    bindParallax() {
        // Mouse parallax (desktop)
        if (window.matchMedia('(hover: hover)').matches) {
            document.addEventListener('mousemove', this.handleMouseMove);
        }

        // Device orientation parallax (mobile)
        if (window.DeviceOrientationEvent) {
            // Request permission on iOS 13+
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // Will need user gesture to request
                document.addEventListener('click', () => {
                    DeviceOrientationEvent.requestPermission()
                        .then(response => {
                            if (response === 'granted') {
                                window.addEventListener('deviceorientation', this.handleDeviceOrientation);
                            }
                        })
                        .catch(console.error);
                }, { once: true });
            } else {
                window.addEventListener('deviceorientation', this.handleDeviceOrientation);
            }
        }
    }

    handleMouseMove(e) {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;

        // Calculate offset from center (-1 to 1)
        const offsetX = (clientX / innerWidth - 0.5) * 2;
        const offsetY = (clientY / innerHeight - 0.5) * 2;

        // Apply heavy parallax - subtle movement
        this.targetParallaxX = offsetX * 50; // Max 50px offset
        this.targetParallaxY = offsetY * 30; // Max 30px offset
    }

    handleDeviceOrientation(e) {
        const { beta, gamma } = e;
        if (beta === null || gamma === null) return;

        // Clamp values
        const clampedBeta = Math.max(-30, Math.min(30, beta));
        const clampedGamma = Math.max(-30, Math.min(30, gamma));

        // Map to parallax
        this.targetParallaxX = (clampedGamma / 30) * 30;
        this.targetParallaxY = (clampedBeta / 30) * 20;
    }

    // ===================== SPATIAL NAVIGATION INTEGRATION =====================

    /**
     * Called by spatial navigation when depth layer changes
     * Adds subtle depth-based parallax shift
     */
    onLayerChange(layerIndex, maxLayers) {
        const depthProgress = layerIndex / maxLayers; // 0 to 1

        // Subtle Y shift as we go deeper
        const depthOffset = depthProgress * 20;

        // Add to existing parallax
        this.targetParallaxY += depthOffset;
    }

    /**
     * Called during navigation animation
     * Provides Z-velocity for motion blur effect
     */
    onNavigationStart(direction, axis) {
        // ... (existing implementation)
    }

    /**
     * Updates parallax based on external input (e.g. spatial navigation position)
     * @param {number} x - Raw X position
     * @param {number} z - Raw Z position
     */
    updateParallax(x, z) {
        // Convert large spatial coordinates to subtle parallax offsets
        // Scale down significantly to keep the background feeling distant
        this.targetParallaxX = -x * 0.05;

        // Z movement creates a "zoom" feel in the background elements via spread
        // We can simulate this by slightly scaling the nebula or adding Y drift
        // For now, let's map Z to a subtle Y drift to feel like we're moving "into" the void
        this.targetParallaxY = -z * 0.02;
    }

    // ===================== RENDER LOOP =====================

    startRenderLoop() {
        // Simulated Motion Blur: Stretch stars along Z-axis
        if (axis === 'z') {
            const starLayer = document.getElementById('stardustLayer');
            if (starLayer) {
                // Determine stretch direction
                const scale = direction > 0 ? 3 : 0.2;

                starLayer.style.transition = 'transform 0.2s ease-in';
                starLayer.style.transform = `scale(${scale})`; // Simple scale warp
                starLayer.style.filter = 'blur(4px)'; // Add speed blur

                setTimeout(() => {
                    starLayer.style.transition = 'transform 0.5s ease-out';
                    starLayer.style.transform = 'scale(1)';
                    starLayer.style.filter = 'blur(0)';
                }, 400);
            }

            // Viewport "tunnel" effect
            this.container.classList.add('navigating-depth');
            setTimeout(() => {
                this.container.classList.remove('navigating-depth');
            }, 600);
        }
    }

    // ===================== RENDER LOOP =====================

    startRenderLoop() {
        this.isAnimating = true;
        this.render();
    }

    render() {
        if (!this.isAnimating) return;

        // Smooth physics with damper (velocity-based)
        // Target - Current gives the "pull"
        const pullX = (this.targetParallaxX - this.parallaxX) * 0.05;
        const pullY = (this.targetParallaxY - this.parallaxY) * 0.05;

        // Add to position
        this.parallaxX += pullX;
        this.parallaxY += pullY;

        // Apply to CSS custom properties with high precision
        this.container.style.setProperty('--parallax-x', `${this.parallaxX.toFixed(3)}px`);
        this.container.style.setProperty('--parallax-y', `${this.parallaxY.toFixed(3)}px`);

        // Update glint positions with layered depth
        this.updateGlintPositions();

        this.rafId = requestAnimationFrame(this.render);
    }

    updateGlintPositions() {
        const glintParallaxRatio = 0.02; // Even lighter than background

        this.glints.forEach(glint => {
            const offsetX = this.parallaxX * glintParallaxRatio;
            const offsetY = this.parallaxY * glintParallaxRatio;

            glint.element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        });
    }

    // ===================== INTRO SEQUENCE HOOKS =====================

    /**
     * Hide void background before intro
     */
    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }

    /**
     * Reveal void background with iris-open animation
     */
    reveal() {
        if (this.container) {
            this.container.classList.remove('hidden');
            this.container.classList.add('revealing');

            // Remove class after animation
            setTimeout(() => {
                this.container.classList.remove('revealing');
            }, 1200);
        }
    }

    /**
     * Instant show (skip animation)
     */
    show() {
        if (this.container) {
            this.container.classList.remove('hidden', 'revealing');
        }
    }

    // ===================== CLEANUP =====================

    destroy() {
        this.isAnimating = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        document.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);

        if (this.glintLayer) {
            this.glintLayer.innerHTML = '';
        }
    }
}

// ===================== INITIALIZE =====================

document.addEventListener('DOMContentLoaded', () => {
    // Wait for intro to complete if present
    const initVoid = () => {
        window.voidBg = new VoidBackground();
        window.voidBg.init();

        // Connect to spatial navigation if available
        if (window.spatialNav) {
            // Hook into navigation events
            const originalNavigateDepth = window.spatialNav.navigateDepth.bind(window.spatialNav);
            window.spatialNav.navigateDepth = function (direction) {
                window.voidBg.onNavigationStart(direction, 'z');
                originalNavigateDepth(direction);
                window.voidBg.onLayerChange(
                    window.spatialNav.currentLayer,
                    window.spatialNav.maxLayers
                );
            };
        }
    };

    // Check if intro sequence exists
    if (document.querySelector('.cinematic-preloader')) {
        // Start hidden, reveal after intro
        const tempVoid = new VoidBackground();
        tempVoid.container = document.querySelector('.void-background');
        if (tempVoid.container) {
            tempVoid.hide();
        }

        document.addEventListener('introComplete', () => {
            initVoid();
            window.voidBg.reveal();
        }, { once: true });
    } else {
        // No intro - init immediately
        initVoid();
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoidBackground;
}
