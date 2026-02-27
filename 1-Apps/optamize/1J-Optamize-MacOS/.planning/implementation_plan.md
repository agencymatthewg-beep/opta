# Phase 103: Radial Layout Restoration

**Goal:** Replace the standard sidebar navigation with a custom, immersive "Radial Menu" that matches the original Opta application design.

## User Review Required
>
> [!IMPORTANT]
> This is a significant UX change. The app will no longer use standard macOS sidebar patterns. Navigation will be centralized on the home screen.

## Proposed Changes

### 1. New Components

#### [NEW] [RadialMenuLayout.swift](file:///Users/matthewbyrden/Documents/Opta/Opta MacOS/OptaNative/OptaNative/Views/MainWindow/RadialMenuLayout.swift)

- **Geometry:** Positions 7 buttons in a circle using `offset(x: R * cos(angle), y: R * sin(angle))`.
- **State:** Tracks `hoveredItem` to update the central text.
- **Animations:** Scale and Glow effects on hover.

#### [NEW] [SatelliteButton.swift](file:///Users/matthewbyrden/Documents/Opta/Opta MacOS/OptaNative/OptaNative/Views/Components/SatelliteButton.swift)

- Reusable glass button component for the radial menu items.

### 2. View Updates

#### [MODIFY] [RootView.swift](file:///Users/matthewbyrden/Documents/Opta/Opta MacOS/OptaNative/OptaNative/Views/MainWindow/RootView.swift)

- Replace `NavigationSplitView` with `RadialMenuLayout` as the primary view.
- When an item is clicked, transition to the specific content view (e.g., using a full-screen overlay or transition).

### 3. Logic

- **Angles:**
  - Settings: 225° (Top-Left visual approximation)
  - Dashboard: 315°
  - Games: 0°
  - Chess: 45°
  - Optimize: 90°
  - Pinpoint: 135°
  - Score: 180°
    *(Angles will be tuned visually)*

## Verification Plan

### Manual Verification

1. **Launch App:** Verify the app opens to the Radial Menu (not a sidebar).
2. **Hover Test:** Move mouse over "Games".
    - *Expected:* Central text changes to "Games" in Cyan.
3. **Click Test:** Click "Dashboard".
    - *Expected:* Navigate to the Dashboard view (or placeholder).
4. **Resize Window:** Ensure the radial layout stays centered.
