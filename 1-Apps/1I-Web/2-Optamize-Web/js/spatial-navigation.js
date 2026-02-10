/* =================================================================
   OPTA SPATIAL NAVIGATION CONTROLLER
   Arrow key, touch, mouse, and scroll navigation through 3D space
   ================================================================= */

class SpatialNavigation {
    constructor() {
        this.scene = null;
        this.currentLayer = 0;
        this.currentPanel = 0;
        this.maxLayers = 3;
        this.layerDepth = 500; // px between layers

        this.layers = [];
        this.horizontalTracks = new Map();

        // Physics state for smooth movement
        this.targetZ = 0;
        this.targetX = 0;
        this.targetRotationY = 0; // New: Banking target
        this.currentZ = 0;
        this.currentX = 0;
        this.currentRotationY = 0; // New: Banking current

        // Easing configuration (exponential for "liquid" feel)
        this.easing = 0.06; // Weighted feel (was 0.08)
        this.rotationEasing = 0.08; // Snappier rotation
        this.isAnimating = false;

        // Navigation lockout (prevent spam)
        this.navigationLocked = false;
        this.lockoutDuration = 300;

        // Edge proximity state
        this.edgeHints = [];
        this.proximityThreshold = 100;

        // Timer IDs for cleanup
        this.rotationResetTimer = null;
        this.labelTimeout = null;
        this.rafId = null;

        // Bound methods
        this.render = this.render.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
    }

    init() {
        this.scene = document.getElementById('main-content');
        if (!this.scene) {
            console.warn('SpatialNavigation: #main-content not found');
            return;
        }

        this.layers = document.querySelectorAll('.depth-layer');
        this.cacheHorizontalTracks();
        this.createEdgeHints();
        this.createNavIndicator();
        this.createA11yAnnouncer();

        this.bindKeyboard();
        this.bindTouch();
        this.bindMouse();
        this.bindWheel();
        this.bindEdgeProximity();

        this.updateActiveLayer();
        this.startRenderLoop();

        // Connect to Void Background if available
        if (window.voidBackground) {
            console.log('SpatialNavigation: Connected to VoidBackground');
        }

        console.log('SpatialNavigation initialized');
    }

    cacheHorizontalTracks() {
        this.layers.forEach((layer, index) => {
            const track = layer.querySelector('.horizontal-track');
            if (track) {
                const panels = track.querySelectorAll('.horizontal-panel');
                this.horizontalTracks.set(index, {
                    element: track,
                    panelCount: panels.length,
                    currentPanel: 0
                });
            }
        });
    }

    createEdgeHints() {
        const container = document.createElement('div');
        container.className = 'edge-hints';
        container.innerHTML = `
            <div class="edge-hint edge-top" data-direction="up"></div>
            <div class="edge-hint edge-bottom" data-direction="down"></div>
            <div class="edge-hint edge-left" data-direction="left"></div>
            <div class="edge-hint edge-right" data-direction="right"></div>
        `;
        document.body.appendChild(container);

        this.edgeHints = container.querySelectorAll('.edge-hint');
        this.updateEdgeHints();
    }

    createNavIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'nav-indicator';

        for (let i = 0; i <= this.maxLayers; i++) {
            const dot = document.createElement('button');
            dot.className = 'nav-dot';
            dot.setAttribute('aria-label', `Go to layer ${i}`);
            dot.dataset.layer = i;
            dot.addEventListener('click', () => this.goToLayer(i));
            indicator.appendChild(dot);
        }

        document.body.appendChild(indicator);
        this.navDots = indicator.querySelectorAll('.nav-dot');
    }

    createA11yAnnouncer() {
        // Check if announcer already exists in HTML
        if (document.getElementById('a11y-announce')) return;

        const announcer = document.createElement('div');
        announcer.id = 'a11y-announce';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(announcer);
    }

    // ===================== KEYBOARD =====================

    bindKeyboard() {
        document.addEventListener('keydown', this.handleKeydown);
    }

    handleKeydown(e) {
        // Don't navigate if focused on input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.navigateDepth(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateDepth(1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.navigateHorizontal(-1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.navigateHorizontal(1);
                break;
            case 'Home':
                e.preventDefault();
                this.goToLayer(0);
                break;
            case 'End':
                e.preventDefault();
                this.goToLayer(this.maxLayers);
                break;
        }
    }

    // ===================== TOUCH =====================

    bindTouch() {
        let touchStart = { x: 0, y: 0, time: 0 };
        let touchEnd = { x: 0, y: 0 };
        const threshold = 50;
        const velocityThreshold = 0.3; // px/ms

        document.addEventListener('touchstart', (e) => {
            touchStart.x = e.touches[0].clientX;
            touchStart.y = e.touches[0].clientY;
            touchStart.time = Date.now();
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            touchEnd.x = e.changedTouches[0].clientX;
            touchEnd.y = e.changedTouches[0].clientY;

            const deltaX = touchEnd.x - touchStart.x;
            const deltaY = touchEnd.y - touchStart.y;
            const deltaTime = Date.now() - touchStart.time;

            const velocityX = Math.abs(deltaX) / deltaTime;
            const velocityY = Math.abs(deltaY) / deltaTime;

            // Determine primary axis
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (Math.abs(deltaX) > threshold && velocityX > velocityThreshold) {
                    this.navigateHorizontal(deltaX > 0 ? -1 : 1);
                }
            } else {
                // Vertical swipe - note: swipe UP goes FORWARD (down into space)
                if (Math.abs(deltaY) > threshold && velocityY > velocityThreshold) {
                    this.navigateDepth(deltaY > 0 ? -1 : 1);
                }
            }
        }, { passive: true });
    }

    // ===================== MOUSE WHEEL =====================

    bindWheel() {
        document.addEventListener('wheel', this.handleWheel, { passive: false });
    }

    handleWheel(e) {
        // Don't hijack scroll on scrollable elements
        if (e.target.closest('.scrollable')) return;

        e.preventDefault();

        // Debounce wheel events
        if (this.navigationLocked) return;

        const threshold = 50;

        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            // Horizontal scroll
            if (Math.abs(e.deltaX) > threshold) {
                this.navigateHorizontal(e.deltaX > 0 ? 1 : -1);
            }
        } else {
            // Vertical scroll
            if (Math.abs(e.deltaY) > threshold) {
                this.navigateDepth(e.deltaY > 0 ? 1 : -1);
            }
        }
    }

    // ===================== MOUSE DRAG =====================

    bindMouse() {
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        const dragThreshold = 100;

        document.addEventListener('mousedown', (e) => {
            // Don't drag on interactive elements
            if (e.target.closest('a, button, input, .interactive, .no-drag')) return;
            if (e.button !== 0) return; // Left click only

            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };
            document.body.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            // Visual feedback during drag
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            // Apply subtle drag offset (preview)
            const previewX = this.targetX + deltaX * 0.2;
            const previewZ = this.targetZ + deltaY * 0.2;

            this.scene.style.transform = `
                translateZ(${previewZ}px)
                translateX(${previewX}px)
            `;
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.cursor = '';

            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            // Determine if drag was significant enough to navigate
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (Math.abs(deltaX) > dragThreshold) {
                    this.navigateHorizontal(deltaX > 0 ? -1 : 1);
                    return;
                }
            } else {
                if (Math.abs(deltaY) > dragThreshold) {
                    this.navigateDepth(deltaY > 0 ? -1 : 1);
                    return;
                }
            }

            // Snap back if drag wasn't enough
            this.isAnimating = true;
        });
    }

    // ===================== EDGE PROXIMITY =====================

    bindEdgeProximity() {
        document.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;

            // Top
            this.edgeHints[0].classList.toggle('proximity',
                clientY < this.proximityThreshold);

            // Bottom
            this.edgeHints[1].classList.toggle('proximity',
                clientY > innerHeight - this.proximityThreshold);

            // Left
            this.edgeHints[2].classList.toggle('proximity',
                clientX < this.proximityThreshold);

            // Right
            this.edgeHints[3].classList.toggle('proximity',
                clientX > innerWidth - this.proximityThreshold);
        });

        // Click on edge hints to navigate
        this.edgeHints.forEach(hint => {
            hint.addEventListener('click', () => {
                if (!hint.classList.contains('available')) return;

                const direction = hint.dataset.direction;
                switch (direction) {
                    case 'up': this.navigateDepth(-1); break;
                    case 'down': this.navigateDepth(1); break;
                    case 'left': this.navigateHorizontal(-1); break;
                    case 'right': this.navigateHorizontal(1); break;
                }
            });
        });
    }

    // ===================== NAVIGATION LOGIC =====================

    navigateDepth(direction) {
        if (this.navigationLocked) return;

        const newLayer = this.currentLayer + direction;

        if (newLayer < 0 || newLayer > this.maxLayers) {
            this.applyBounce('z', direction);
            return;
        }

        this.lockNavigation();
        this.currentLayer = newLayer;
        this.targetZ = -this.currentLayer * this.layerDepth;

        // Reset horizontal position when changing layers
        this.currentPanel = 0;
        this.targetX = 0;
        this.targetRotationY = 0; // Reset rotation
        this.updateHorizontalTrack();

        this.isAnimating = true;
        this.updateActiveLayer();
        this.updateEdgeHints();
        this.updateNavIndicator();
        this.announceLayer();

        // Trigger Warp Effect
        if (window.triggerOrbWarp) {
            window.triggerOrbWarp(direction > 0 ? 'forward' : 'backward');
        }
    }

    navigateHorizontal(direction) {
        if (this.navigationLocked) return;

        const track = this.horizontalTracks.get(this.currentLayer);
        if (!track) {
            // No horizontal track on this layer - maybe bounce
            this.applyBounce('x', direction);
            return;
        }

        const newPanel = this.currentPanel + direction;

        if (newPanel < 0 || newPanel >= track.panelCount) {
            this.applyBounce('x', direction);
            return;
        }

        this.lockNavigation();
        this.currentPanel = newPanel;
        track.currentPanel = newPanel;
        this.targetX = -this.currentPanel * window.innerWidth;

        // Add banking based on direction
        // -1 (left) -> Tilt positive (right side comes forward)
        // 1 (right) -> Tilt negative (left side comes forward)
        this.targetRotationY = direction * -5;

        // Reset rotation after a delay (settle back to flat)
        clearTimeout(this.rotationResetTimer);
        this.rotationResetTimer = setTimeout(() => {
            this.targetRotationY = 0;
        }, 400);

        this.updateHorizontalTrack();
        this.updateEdgeHints();
    }

    goToLayer(layerIndex) {
        if (this.navigationLocked) return;
        if (layerIndex < 0 || layerIndex > this.maxLayers) return;
        if (layerIndex === this.currentLayer) return;

        this.lockNavigation();
        this.currentLayer = layerIndex;
        this.targetZ = -this.currentLayer * this.layerDepth;

        // Reset horizontal
        this.currentPanel = 0;
        this.targetX = 0;
        this.updateHorizontalTrack();

        this.isAnimating = true;
        this.updateActiveLayer();
        this.updateEdgeHints();
        this.updateNavIndicator();
        this.announceLayer();
    }

    updateHorizontalTrack() {
        const track = this.horizontalTracks.get(this.currentLayer);
        if (track) {
            track.element.style.setProperty('--track-x', `${-this.currentPanel * 100}vw`);
        }
    }

    lockNavigation() {
        this.navigationLocked = true;
        setTimeout(() => {
            this.navigationLocked = false;
        }, this.lockoutDuration);
    }

    applyBounce(axis, direction) {
        // Quick overshoot then return for boundary feedback
        const bounceAmount = 40 * direction;

        if (axis === 'z') {
            this.currentZ = this.targetZ + bounceAmount;
        } else {
            this.currentX = this.targetX + bounceAmount;
        }

        this.isAnimating = true;

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    // ===================== UI UPDATES =====================

    updateActiveLayer() {
        this.layers.forEach((layer, index) => {
            layer.classList.toggle('active', index === this.currentLayer);
        });
    }

    updateEdgeHints() {
        // Top (can go up/back)
        this.edgeHints[0].classList.toggle('available', this.currentLayer > 0);

        // Bottom (can go down/forward)
        this.edgeHints[1].classList.toggle('available', this.currentLayer < this.maxLayers);

        // Left
        this.edgeHints[2].classList.toggle('available', this.currentPanel > 0);

        // Right
        const track = this.horizontalTracks.get(this.currentLayer);
        this.edgeHints[3].classList.toggle('available',
            track && this.currentPanel < track.panelCount - 1);
    }

    updateNavIndicator() {
        if (!this.navDots) return;

        this.navDots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentLayer);
        });
    }

    announceLayer() {
        const layer = this.layers[this.currentLayer];
        const name = layer?.dataset.name || `Layer ${this.currentLayer}`;

        const announcer = document.getElementById('a11y-announce');
        if (announcer) {
            announcer.textContent = `Navigated to ${name}`;
        }

        // Show layer label briefly
        this.showLayerLabel(name);
    }

    showLayerLabel(name) {
        let label = document.querySelector('.layer-label');
        if (!label) {
            label = document.createElement('div');
            label.className = 'layer-label';
            document.body.appendChild(label);
        }

        label.textContent = name;
        label.classList.add('visible');

        clearTimeout(this.labelTimeout);
        this.labelTimeout = setTimeout(() => {
            label.classList.remove('visible');
        }, 1500);
    }

    // ===================== RENDER LOOP =====================

    startRenderLoop() {
        this.rafId = requestAnimationFrame(this.render);
    }

    render() {
        if (this.isAnimating ||
            Math.abs(this.currentZ - this.targetZ) > 0.1 ||
            Math.abs(this.currentX - this.targetX) > 0.1 ||
            Math.abs(this.currentRotationY - this.targetRotationY) > 0.01) {

            // Exponential easing for smooth movement
            const deltaZ = this.targetZ - this.currentZ;
            const deltaX = this.targetX - this.currentX;
            const deltaRot = this.targetRotationY - this.currentRotationY;

            this.currentZ += deltaZ * this.easing;
            this.currentX += deltaX * this.easing;
            this.currentRotationY += deltaRot * this.rotationEasing;

            // Snap when close enough
            if (Math.abs(deltaZ) < 0.1 && Math.abs(deltaX) < 0.1 && Math.abs(deltaRot) < 0.01) {
                this.currentZ = this.targetZ;
                this.currentX = this.targetX;
                this.currentRotationY = this.targetRotationY;
                this.isAnimating = false;
            }

            // Apply transform with banking
            this.scene.style.transform = `
                translateZ(${this.currentZ}px)
                translateX(${this.currentX}px)
                rotateY(${this.currentRotationY}deg)
            `;

            // Sync with Void Background for parallax
            if (window.voidBackground) {
                // Using raw values for normalized parallax
                window.voidBackground.updateParallax(this.currentX, this.currentZ);
            }

            // Seamless looping for ambient elements (if needed later)
            // Currently relies on long tracks, but can add infinite scroll logic here
        }

        this.rafId = requestAnimationFrame(this.render);
    }

    // ===================== PUBLIC API =====================

    getCurrentLayer() {
        return this.currentLayer;
    }

    getCurrentPanel() {
        return this.currentPanel;
    }

    destroy() {
        // Clear timers
        if (this.rotationResetTimer) clearTimeout(this.rotationResetTimer);
        if (this.labelTimeout) clearTimeout(this.labelTimeout);
        if (this.rafId) cancelAnimationFrame(this.rafId);

        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown);
        document.removeEventListener('wheel', this.handleWheel);

        // Remove created DOM elements
        document.querySelector('.edge-hints')?.remove();
        document.querySelector('.nav-indicator')?.remove();
        document.querySelector('.layer-label')?.remove();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for intro to complete if present
    const introComplete = () => {
        window.spatialNav = new SpatialNavigation();
        window.spatialNav.init();
    };

    // Check if intro sequence exists AND is visible (not skipped)
    const preloader = document.querySelector('.cinematic-preloader');
    const preloaderVisible = preloader &&
        window.getComputedStyle(preloader).display !== 'none';

    if (preloaderVisible) {
        // Wait for intro complete event
        document.addEventListener('introComplete', introComplete, { once: true });
    } else {
        // No visible preloader - initialize immediately
        // Use setTimeout to ensure intro-sequence.js has finished dispatching events
        setTimeout(introComplete, 0);
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpatialNavigation;
}
