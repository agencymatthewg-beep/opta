# Instructions: Copy Animation Frames

The animation reference frames are in a zip file that needs to be extracted.

## Step 1: Download the Zip File

The zip file `video_inspiration_package.zip` should be in your downloads or the location where you saved it from the Claude session.

## Step 2: Extract Frames

Run these commands in Terminal:

```bash
# Navigate to Opta Vision
cd "/Users/matthewbyrden/Documents/Opta/Opta Vision/animation-frames"

# Extract the zip (adjust path to where you saved it)
unzip ~/Downloads/video_inspiration_package.zip -d /tmp/opta-frames

# Copy frames to their directories
cp /tmp/opta-frames/video_inspiration_package/spinning_frame_*.png spinning/
cp /tmp/opta-frames/video_inspiration_package/glassmorphism_frame_*.png glassmorphism/
cp /tmp/opta-frames/video_inspiration_package/ring_explosion_frame_*.png explosion/
cp /tmp/opta-frames/video_inspiration_package/opta_facing_frame_*.png wake-up/

# Verify
ls -la spinning/ glassmorphism/ explosion/ wake-up/

# Cleanup
rm -rf /tmp/opta-frames
```

## Step 3: Verify

You should have:
- `spinning/`: 6 PNG files
- `glassmorphism/`: 6 PNG files
- `explosion/`: 16 PNG files
- `wake-up/`: 16 PNG files

## Alternative: Manual Copy

1. Unzip `video_inspiration_package.zip`
2. Copy files matching `spinning_frame_*.png` to `spinning/`
3. Copy files matching `glassmorphism_frame_*.png` to `glassmorphism/`
4. Copy files matching `ring_explosion_frame_*.png` to `explosion/`
5. Copy files matching `opta_facing_frame_*.png` to `wake-up/`

---

## What's in the Zip

The package also contains:
- `OPTA_AESTHETIC_ANALYSIS.md` - Design analysis (already in .planning)
- `CLAUDE_CODE_OPTA_RING_SPEC.md` - Tech spec (already in .planning)
- `IMPLEMENTATION_PLAN.md` - Implementation guide (already in .planning)
- `GlassmorphismSpinner.tsx/css` - Demo components (optional)
- `example.html` / `example-with-explosion.html` - Live demos (optional)
