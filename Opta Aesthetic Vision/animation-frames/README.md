# Opta Ring Animation Reference Frames

> **Purpose**: Visual reference for implementing the 3D Opta Ring animations.
> **Generated**: 2026-01-17

---

## Frame Sequences

### `/spinning/` - Idle Rotation (6 frames)
**Use Case**: Dormant state animation

The ring should gently spin on its Y-axis when the user is not engaged. This is the "resting" state of Opta.

- Frame rate: ~1 fps extracted (original video was faster)
- Rotation: Y-axis spin
- Energy: 0% (dark obsidian, minimal glow)

### `/glassmorphism/` - Material Quality (6 frames)
**Use Case**: Shader/material reference

These frames demonstrate the target quality for the glassmorphism material:
- Fresnel edge glow
- Internal purple energy
- Specular highlights that move with rotation
- Refraction/translucency effect

### `/explosion/` - Click Feedback (16 frames)
**Use Case**: Explosion effect on click

When user clicks the Opta ring, trigger this sequence:
1. Frames 1-4: Energy building
2. Frames 5-8: Peak explosion (white-hot core, shockwave)
3. Frames 9-12: Energy dispersing
4. Frames 13-16: Return to active state

**Timing**: 800ms total, peak at ~300ms

### `/wake-up/` - Facing Camera (16 frames)
**Use Case**: Wake-up animation on engagement

**This is the signature interaction.** When user hovers over the app or starts typing:
1. Frames 1-4: Ring is tilted (dormant)
2. Frames 5-8: Ring begins rotating on X-axis
3. Frames 9-12: Ring faces camera, energy starts glowing
4. Frames 13-16: Ring settles into active state

**Timing**: 800ms total

---

## How to Use These Frames

### For Implementation Reference
Open frames side-by-side with your code to match:
- Rotation angles
- Glow intensity
- Timing/easing curves
- Color values

### For Stakeholder Communication
Use these frames to demonstrate the planned animation behavior.

### For QA Testing
Compare implemented animations against these reference frames.

---

## Related Documentation

- `/.planning/phases/20-rich-interactions/ring-animation/OPTA_RING_ANIMATION_SPEC.md` - Full technical specification
- `/.planning/phases/20-rich-interactions/ring-animation/IMPLEMENTATION_PLAN.md` - Step-by-step guide
- `/.claude/skills/opta-ring-animation.md` - Claude Code skill for implementation
- `/DESIGN_SYSTEM.md` - Color and animation guidelines

---

## To Add Frames

If you generate new reference videos:
1. Extract frames using: `ffmpeg -i video.mp4 -vf "fps=2" frame_%02d.png`
2. Place in appropriate subdirectory
3. Update this README with context
