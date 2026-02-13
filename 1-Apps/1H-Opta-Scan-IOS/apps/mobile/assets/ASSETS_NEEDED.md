# Required Assets

Create the following assets in this directory:

## icon.png
- App icon for iOS and Android
- Size: 1024x1024px
- Format: PNG with transparency
- Design: Opta logo (stylized "O" or optimization symbol)
- Colors: Cyan (#06b6d4) on dark background (#0a0a0f)

## splash.png
- Splash screen shown during app load
- Size: 1284x2778px (iPhone 14 Pro Max)
- Format: PNG
- Design: Centered Opta logo with tagline
- Background: #0a0a0f

## adaptive-icon.png
- Android adaptive icon foreground
- Size: 512x512px
- Format: PNG with transparency
- Design: Same as icon.png, centered with padding

## favicon.png
- Web favicon
- Size: 48x48px
- Format: PNG

## Temporary Setup

For development, you can use placeholder images:
```bash
# Generate placeholder images (requires ImageMagick)
convert -size 1024x1024 xc:#0a0a0f -fill '#06b6d4' -pointsize 200 -gravity center -draw "text 0,0 'O'" icon.png
convert -size 1284x2778 xc:#0a0a0f -fill '#06b6d4' -pointsize 120 -gravity center -draw "text 0,0 'Opta'" splash.png
convert -size 512x512 xc:#0a0a0f -fill '#06b6d4' -pointsize 100 -gravity center -draw "text 0,0 'O'" adaptive-icon.png
convert -size 48x48 xc:#0a0a0f -fill '#06b6d4' -pointsize 24 -gravity center -draw "text 0,0 'O'" favicon.png
```
