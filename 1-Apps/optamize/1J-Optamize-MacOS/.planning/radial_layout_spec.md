# Radial Layout Specification (Original Opta Design)

**Goal:** Restore the centralized, radial menu layout from the original Opta application, replacing the current sidebar navigation.

## 1. Layout Structure

The interface is centered in the window, floating in a deep purple void/nebula. It consists of two main layers:

### A. The Nucleus ("Opta Text")

- **Position:** Exact Center of the screen.
- **Visuals:** Large, bold typography.
- **Behavior:**
  - **Default State:** Displays "Opta" or specific welcome text.
  - **Hover State:** When the user hovers over a satellite button, this central text changes to match the button's label (e.g., changes to "Games", "Optimize", "Settings").
  - **Color Dynamics:** The text color shifts to match the glow/accent color of the hovered item (e.g., Cyan for Games, Purple for Settings).

### B. The Orbit (Satellite Buttons)

Seven (7) glass-panel buttons arranged in a circle around the nucleus.
**Iconography & Placement:**

1. **Settings** (Gear): Top-Left (approx 10 o'clock)
2. **Dashboard** (Grid): Top-Right (approx 2 o'clock)
3. **Games** (Controller): Right (3 o'clock)
4. **Chess** (Crown): Bottom-Right (approx 5 o'clock)
5. **Optimize** (Lightning): Bottom (6 o'clock)
6. **Pinpoint** (Target): Bottom-Left (approx 7 o'clock)
7. **Score** (Ribbon): Left (9 o'clock)

*Note: The precise angles may need slight adjustment to create a balanced "dial" feel.*

## 2. Satellite Visuals

- **Shape:** Rounded Rectangles (Squ.ircles) or soft glass panels.
- **Style:** Translucent styling (`Material.ultraThin`), faint border strokes, inner shadows.
- **Active/Hover State:**
  - Scale up slightly.
  - Emit an outer glow (shadow) in their specific accent color.
  - Trigger the Central Nucleus update.

## 3. Background Atmosphere

- **Color:** Deep Violet / Indigo gradient (`Color.optaVoid` to `Color.optaDeepPurple`).
- **Texture:** Starfield or Nebula fog layers (using the `ParticleEffectView` or static assets).
- **Floating:** The entire assembly should feel suspended in space.

## 4. Implementation Strategy (Phase 103)

- **Container:** `RadialMenuLayout` View.
- **Geometry:** Use `ZStack` and `offset` with trigonometry (`cos`/`sin`) or fixed offsets to position satellites based on an approximate radius of `150-180pt` from center.
- **State Management:** A `@State var hoveredItem: NavigationItem?` in the parent view controls the Nucleus text and color.
