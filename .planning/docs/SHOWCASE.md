# Opta v5.0 Showcase Guide

Instructions for capturing and creating showcase videos and GIFs of the Premium Visual Experience.

---

## Table of Contents

1. [Key Visual Moments](#key-visual-moments)
2. [Recording Settings](#recording-settings)
3. [Showcase Sequence](#showcase-sequence)
4. [GIF Optimization](#gif-optimization)
5. [Video Export Settings](#video-export-settings)
6. [Social Media Formats](#social-media-formats)

---

## Key Visual Moments

### Must-Capture Moments

| Priority | Moment | Duration | Description |
|----------|--------|----------|-------------|
| 1 | **Ring Wake-Up** | 2-3s | Dormant to active spring animation |
| 2 | **Ring Explosion** | 3-4s | Particle burst with shockwave and bloom |
| 3 | **Particle Environment** | 5-6s | Ambient dust with parallax depth |
| 4 | **Neon Trails** | 3-4s | Energy lines flowing through UI |
| 5 | **Loading States** | 4-5s | Chromatic aberration effect |
| 6 | **Page Transitions** | 3-4s | Choreographed content entry |
| 7 | **Atmospheric Fog** | 4-5s | Breathing fog with color shift |
| 8 | **Deep Glow** | 3-4s | Reactive glow changing with metrics |
| 9 | **Glass Depth** | 3-4s | Multi-layer translucent panels |
| 10 | **Full Journey** | 15-20s | Complete user flow |

### Ideal Capture Conditions

- **Time of Day**: Evening (dark mode aesthetic)
- **System State**: Moderate load (30-50% CPU) for dynamic effects
- **Ring State**: Start from dormant for wake-up captures
- **Browser**: Safari on macOS for native feel, Chrome for consistency

---

## Recording Settings

### Screen Recording (macOS)

**QuickTime Player:**
- Quality: Maximum
- Resolution: Native (2x for Retina)
- Frame Rate: 60fps minimum
- Audio: Optional (for sound design showcase)

**OBS Studio (Recommended):**
```
Resolution: 1920x1080 or 2560x1440
FPS: 60
Encoder: Apple VT H264 Hardware Encoder (macOS) / NVENC (Windows)
Rate Control: CRF
CRF Value: 18-20 (lower = higher quality)
Profile: High
```

### Browser DevTools Settings

Before recording:
1. Open DevTools (Cmd+Opt+I)
2. Disable cache (Network tab > Disable cache)
3. Set throttling to "No throttling"
4. Close DevTools to maximize visible area

### Viewport Preparation

```javascript
// Set consistent viewport for recordings
// Run in browser console
document.body.style.width = '1920px';
document.body.style.height = '1080px';
window.resizeTo(1920, 1080);
```

---

## Showcase Sequence

### Recommended Recording Order

#### 1. Ring Wake-Up (2-3s)

**Setup:**
- Start with app idle for 5+ seconds (ring dormant)
- Position cursor outside the app window

**Capture:**
1. Move cursor into app window
2. Wait for ring to wake (800ms transition)
3. Hold for 1-2s showing active state

**Key frames to capture:**
- Dormant: 15° tilt, slow spin
- Waking: Spring transition to face camera
- Active: Plasma swirl, purple glow

#### 2. Ring Explosion (3-4s)

**Setup:**
- Ring in active state
- Prepare click target (e.g., Stealth Mode button)

**Capture:**
1. Click the trigger element
2. Capture full explosion sequence
3. Hold through recovery phase

**Key frames to capture:**
- Initial flash
- Particle burst outward
- Shockwave ring expansion
- Bloom peak
- Particle fade
- Recovery to active

#### 3. Particle Environment (5-6s)

**Setup:**
- Zoom to area with visible particles
- Ensure good contrast for particles

**Capture:**
1. Pan slowly across the viewport
2. Show parallax depth effect
3. Trigger processing state to show attraction

**Highlight:**
- Varying particle sizes (1-3px)
- Purple/white color mix
- Depth parallax (slower = further)

#### 4. Neon Trails (3-4s)

**Setup:**
- Navigate to page with neon border elements
- Hover over interactive element

**Capture:**
1. Hover to activate neon border
2. Move cursor along element
3. Show traveling light effect

#### 5. Loading States (4-5s)

**Setup:**
- Prepare to trigger a loading state
- Clear any cached data if needed

**Capture:**
1. Trigger data load
2. Show chromatic aberration effect
3. Capture until content appears

**Highlight:**
- RGB channel separation
- Pulse animation
- Smooth transition to loaded content

#### 6. Page Transitions (3-4s)

**Setup:**
- Position cursor on navigation element
- Ensure current page is fully loaded

**Capture:**
1. Click navigation
2. Capture full exit animation
3. Capture full enter animation
4. Wait for content to settle

**Highlight:**
- Staggered element entry
- Ring choreography
- Blur-fade effect

#### 7. Full Journey (15-20s)

**Sequence:**
1. App launch (ring dormant)
2. User engagement (ring wakes)
3. Navigate to Games page (transition)
4. Launch optimization (processing state)
5. Success (explosion)
6. Return to Dashboard

---

## GIF Optimization

### Creating Optimized GIFs

**Using FFmpeg (Recommended):**

```bash
# Step 1: Generate palette for better colors
ffmpeg -i input.mov -vf "fps=30,scale=800:-1:flags=lanczos,palettegen" palette.png

# Step 2: Create GIF using palette
ffmpeg -i input.mov -i palette.png -lavfi "fps=30,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse" output.gif
```

**Optimal Settings by Use Case:**

| Use Case | Width | FPS | Colors | Max Size |
|----------|-------|-----|--------|----------|
| Twitter/X | 800px | 30 | 256 | 15 MB |
| GitHub README | 600px | 24 | 128 | 10 MB |
| Discord | 400px | 24 | 128 | 8 MB |
| Documentation | 800px | 15 | 64 | 5 MB |

### GIF Reduction Techniques

1. **Reduce frame rate**: 30fps → 15fps for subtle animations
2. **Crop to area of interest**: Avoid full-screen GIFs
3. **Reduce dimensions**: 50% of original
4. **Limit duration**: 3-5 seconds optimal
5. **Use lossy compression**: `gifsicle -O3 --lossy=80`

**Using Gifsicle:**

```bash
# Optimize existing GIF
gifsicle -O3 --lossy=80 --colors 128 input.gif -o output.gif
```

### GIF Loop Settings

| Content | Loop |
|---------|------|
| Ring wake-up | Infinite |
| Explosion | 3 loops then stop |
| Particles | Infinite |
| Page transition | 2 loops then stop |
| Full journey | 1 loop |

---

## Video Export Settings

### For YouTube/Vimeo

```
Container: MP4
Codec: H.264 (x264)
Resolution: 1920x1080 or 2560x1440
Frame Rate: 60fps
Bitrate: 10-15 Mbps (1080p) / 20-30 Mbps (1440p)
Audio: AAC 320kbps (if including sound)
Color: Rec. 709
```

### For Twitter/X

```
Container: MP4
Codec: H.264
Resolution: 1920x1080 (max)
Frame Rate: 30-60fps
Bitrate: 5-8 Mbps
Duration: Max 2:20
Max Size: 512 MB
```

### For Product Hunt

```
Container: MP4 or GIF
Resolution: 1200x800 recommended
Duration: 10-20 seconds for video
GIF: 5-10 seconds
```

---

## Social Media Formats

### Hero Showcase (Main Video)

**Purpose:** Product Hunt, landing page, YouTube

**Format:**
- 1920x1080 @ 60fps
- 30-60 seconds
- With ambient music (royalty-free)
- Title cards with feature names

**Structure:**
1. Title card (3s)
2. Ring wake-up + explosion (6s)
3. Particle environment (4s)
4. Page transitions (4s)
5. Telemetry with deep glow (4s)
6. Loading states (3s)
7. Full user journey (6s)
8. End card with logo (3s)

### Feature Highlights (Short Clips)

**Purpose:** Twitter, LinkedIn, Instagram

**Format:**
- 1080x1080 (square) or 1080x1920 (vertical)
- 6-15 seconds
- No audio required
- Single feature focus

**Examples:**
- "Ring Wake-Up" - 6s clip
- "Explosion Effect" - 8s clip
- "Premium Loading" - 10s clip

### README GIFs

**Purpose:** GitHub README, documentation

**Format:**
- 800x450 (16:9)
- 3-5 seconds
- Optimized for small file size

**Examples:**
```markdown
## Features

### Ring Animation
![Ring Wake-Up](./assets/ring-wakeup.gif)

### Premium Effects
![Loading State](./assets/loading.gif)
```

---

## Capture Checklist

### Before Recording

- [ ] Close unnecessary apps
- [ ] Disable notifications (Focus Mode)
- [ ] Set display to native resolution
- [ ] Clear browser cache
- [ ] Reset app state (fresh launch)
- [ ] Verify 60fps in DevTools Performance

### During Recording

- [ ] Smooth, deliberate mouse movements
- [ ] Pause between actions for clarity
- [ ] Complete full animation cycles
- [ ] Avoid accidental UI elements

### After Recording

- [ ] Trim start/end
- [ ] Color grade if needed (match brand purple)
- [ ] Add slow-motion for key moments
- [ ] Export in target formats
- [ ] Verify file sizes within limits

---

## Asset Naming Convention

```
opta-v5-[feature]-[format]-[dimensions].ext

Examples:
opta-v5-ring-wakeup-gif-800x450.gif
opta-v5-explosion-mp4-1080p.mp4
opta-v5-full-journey-hero-1440p.mp4
opta-v5-particles-twitter-square.mp4
```

---

## Distribution Channels

| Channel | Format | Size | Notes |
|---------|--------|------|-------|
| GitHub README | GIF | <10 MB | Feature highlights |
| Product Hunt | MP4 | <20 MB | Hero video |
| Twitter/X | MP4/GIF | <15 MB | Short clips |
| LinkedIn | MP4 | <200 MB | Professional focus |
| YouTube | MP4 | Unlimited | Full showcase |
| Landing Page | WebM + MP4 | <5 MB | Autoplay, muted |
| Discord | GIF | <8 MB | Community sharing |

---

*Version: 5.0*
*Last Updated: Phase 40 - Documentation & Launch*
