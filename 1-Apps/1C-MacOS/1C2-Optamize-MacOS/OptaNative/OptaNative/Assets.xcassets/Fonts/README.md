# Custom Fonts (Outfit)

## Quick Context
- Opta application source code and documentation
- Contains: iOS, macOS, web, CLI implementations
- Use for: building and extending Opta products


To achieve the exact "Opta Text" look envisioned:

1. Download the **Outfit** font family (Google Fonts).
2. Place the `.ttf` files in this folder (or drag them into the Xcode project under a group named "Fonts").
3. Add the font filenames to `Info.plist` under the key `UIAppFonts`.

## Fallback Behavior

The application is currently using the **System Rounded** design, which provides a very similar modern, geometric aesthetic to Outfit.
