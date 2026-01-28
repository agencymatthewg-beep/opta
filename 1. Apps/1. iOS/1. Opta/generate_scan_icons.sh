#!/bin/bash

# Define paths
SOURCE_IMG="/Users/matthewbyrden/Documents/Opta/1. Apps/4. Shared/2. design-assets/Opta Aesthetic Vision/Active/OPTA LM Logo.png"
SCAN_DESIGN_DIR="/Users/matthewbyrden/Documents/Opta/1. Apps/1. iOS/1. Opta/Opta Scan/Design"
ICON_DIR="/Users/matthewbyrden/Documents/Opta/1. Apps/1. iOS/1. Opta/Opta Scan/Assets.xcassets/AppIcon.appiconset"

# Copy master logo
mkdir -p "$SCAN_DESIGN_DIR"
cp "$SOURCE_IMG" "$SCAN_DESIGN_DIR/Opta LM Logo.png"

# Create directory
mkdir -p "$ICON_DIR"

# Generate images using sips
sips -z 1024 1024 "$SOURCE_IMG" --out "$ICON_DIR/1024.png"
sips -z 180 180 "$SOURCE_IMG" --out "$ICON_DIR/180.png"
sips -z 120 120 "$SOURCE_IMG" --out "$ICON_DIR/120.png"
sips -z 167 167 "$SOURCE_IMG" --out "$ICON_DIR/167.png"
sips -z 152 152 "$SOURCE_IMG" --out "$ICON_DIR/152.png"
sips -z 87 87 "$SOURCE_IMG" --out "$ICON_DIR/87.png"
sips -z 80 80 "$SOURCE_IMG" --out "$ICON_DIR/80.png"
sips -z 60 60 "$SOURCE_IMG" --out "$ICON_DIR/60.png"
sips -z 58 58 "$SOURCE_IMG" --out "$ICON_DIR/58.png"
sips -z 40 40 "$SOURCE_IMG" --out "$ICON_DIR/40.png"
sips -z 29 29 "$SOURCE_IMG" --out "$ICON_DIR/29.png"
sips -z 20 20 "$SOURCE_IMG" --out "$ICON_DIR/20.png"

# Create Contents.json
cat > "$ICON_DIR/Contents.json" <<EOF
{
  "images" : [
    {
      "size" : "20x20",
      "idiom" : "iphone",
      "filename" : "40.png",
      "scale" : "2x"
    },
    {
      "size" : "20x20",
      "idiom" : "iphone",
      "filename" : "60.png",
      "scale" : "3x"
    },
    {
      "size" : "29x29",
      "idiom" : "iphone",
      "filename" : "58.png",
      "scale" : "2x"
    },
    {
      "size" : "29x29",
      "idiom" : "iphone",
      "filename" : "87.png",
      "scale" : "3x"
    },
    {
      "size" : "40x40",
      "idiom" : "iphone",
      "filename" : "80.png",
      "scale" : "2x"
    },
    {
      "size" : "40x40",
      "idiom" : "iphone",
      "filename" : "120.png",
      "scale" : "3x"
    },
    {
      "size" : "60x60",
      "idiom" : "iphone",
      "filename" : "120.png",
      "scale" : "2x"
    },
    {
      "size" : "60x60",
      "idiom" : "iphone",
      "filename" : "180.png",
      "scale" : "3x"
    },
    {
      "size" : "20x20",
      "idiom" : "ipad",
      "filename" : "20.png",
      "scale" : "1x"
    },
    {
      "size" : "20x20",
      "idiom" : "ipad",
      "filename" : "40.png",
      "scale" : "2x"
    },
    {
      "size" : "29x29",
      "idiom" : "ipad",
      "filename" : "29.png",
      "scale" : "1x"
    },
    {
      "size" : "29x29",
      "idiom" : "ipad",
      "filename" : "58.png",
      "scale" : "2x"
    },
    {
      "size" : "40x40",
      "idiom" : "ipad",
      "filename" : "40.png",
      "scale" : "1x"
    },
    {
      "size" : "40x40",
      "idiom" : "ipad",
      "filename" : "80.png",
      "scale" : "2x"
    },
    {
      "size" : "76x76",
      "idiom" : "ipad",
      "filename" : "76.png",
      "scale" : "1x"
    },
    {
      "size" : "76x76",
      "idiom" : "ipad",
      "filename" : "152.png",
      "scale" : "2x"
    },
    {
      "size" : "83.5x83.5",
      "idiom" : "ipad",
      "filename" : "167.png",
      "scale" : "2x"
    },
    {
      "size" : "1024x1024",
      "idiom" : "ios-marketing",
      "filename" : "1024.png",
      "scale" : "1x"
    }
  ],
  "info" : {
    "version" : 1,
    "author" : "xcode"
  }
}
EOF
