# Opta App Icon Files

This directory requires the following PNG files for the macOS App Store:

## Required Files

| Filename | Dimensions | Purpose |
|----------|------------|---------|
| icon_16x16.png | 16x16 px | Finder sidebar (1x) |
| icon_16x16@2x.png | 32x32 px | Finder sidebar (Retina) |
| icon_32x32.png | 32x32 px | Finder list view (1x) |
| icon_32x32@2x.png | 64x64 px | Finder list view (Retina) |
| icon_128x128.png | 128x128 px | Finder icon view (1x) |
| icon_128x128@2x.png | 256x256 px | Finder icon view (Retina) |
| icon_256x256.png | 256x256 px | Dock icon (1x) |
| icon_256x256@2x.png | 512x512 px | Dock icon (Retina) |
| icon_512x512.png | 512x512 px | App Store (1x) |
| icon_512x512@2x.png | 1024x1024 px | App Store (Retina) |

## Design Guidelines

The Opta icon should convey:

- **Performance/Optimization** - Bolt, gauge, or ring motif
- **Premium Quality** - Glass effect with depth and reflections
- **Brand Color** - Purple accent (#8B5CF6) on dark background (#09090B)

## Creating Icons

1. Design master icon at 1024x1024 px
2. Export at each required size
3. Use PNG format with transparency
4. Ensure sharp edges at all sizes (no blur from downscaling)

## Tools

- Sketch / Figma for design
- `iconutil` CLI for conversion: `iconutil -c icns icon.iconset`
- Or use apps like Icon Set Creator, Asset Catalog Creator
