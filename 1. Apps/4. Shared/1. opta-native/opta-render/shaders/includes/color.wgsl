// Color space utilities.
//
// Include with: #include "color.wgsl"
//
// Provides:
// - sRGB/Linear conversions
// - HSL/HSV conversions
// - Color blending operations
// - Tone mapping

// =============================================================================
// sRGB / Linear Conversions
// =============================================================================

/// Convert sRGB gamma to linear.
fn srgb_to_linear(color: vec3<f32>) -> vec3<f32> {
    let cutoff = step(color, vec3<f32>(0.04045));
    let low = color / 12.92;
    let high = pow((color + 0.055) / 1.055, vec3<f32>(2.4));
    return mix(high, low, cutoff);
}

/// Convert linear to sRGB gamma.
fn linear_to_srgb(color: vec3<f32>) -> vec3<f32> {
    let cutoff = step(color, vec3<f32>(0.0031308));
    let low = color * 12.92;
    let high = 1.055 * pow(color, vec3<f32>(1.0 / 2.4)) - 0.055;
    return mix(high, low, cutoff);
}

/// Fast approximate sRGB to linear (cheaper, less accurate).
fn srgb_to_linear_fast(color: vec3<f32>) -> vec3<f32> {
    return pow(color, vec3<f32>(2.2));
}

/// Fast approximate linear to sRGB (cheaper, less accurate).
fn linear_to_srgb_fast(color: vec3<f32>) -> vec3<f32> {
    return pow(color, vec3<f32>(1.0 / 2.2));
}

// =============================================================================
// HSL Conversions
// =============================================================================

/// Convert RGB to HSL.
fn rgb_to_hsl(rgb: vec3<f32>) -> vec3<f32> {
    let cmax = max(rgb.r, max(rgb.g, rgb.b));
    let cmin = min(rgb.r, min(rgb.g, rgb.b));
    let delta = cmax - cmin;
    
    var h: f32 = 0.0;
    var s: f32 = 0.0;
    let l = (cmax + cmin) * 0.5;
    
    if delta > 0.0001 {
        s = delta / (1.0 - abs(2.0 * l - 1.0));
        
        if cmax == rgb.r {
            h = ((rgb.g - rgb.b) / delta) % 6.0;
        } else if cmax == rgb.g {
            h = (rgb.b - rgb.r) / delta + 2.0;
        } else {
            h = (rgb.r - rgb.g) / delta + 4.0;
        }
        h = h / 6.0;
        if h < 0.0 { h = h + 1.0; }
    }
    
    return vec3<f32>(h, s, l);
}

/// Convert HSL to RGB.
fn hsl_to_rgb(hsl: vec3<f32>) -> vec3<f32> {
    let h = hsl.x;
    let s = hsl.y;
    let l = hsl.z;
    
    let c = (1.0 - abs(2.0 * l - 1.0)) * s;
    let x = c * (1.0 - abs((h * 6.0) % 2.0 - 1.0));
    let m = l - c * 0.5;
    
    var rgb: vec3<f32>;
    let segment = u32(h * 6.0);
    
    switch segment {
        case 0u: { rgb = vec3<f32>(c, x, 0.0); }
        case 1u: { rgb = vec3<f32>(x, c, 0.0); }
        case 2u: { rgb = vec3<f32>(0.0, c, x); }
        case 3u: { rgb = vec3<f32>(0.0, x, c); }
        case 4u: { rgb = vec3<f32>(x, 0.0, c); }
        default: { rgb = vec3<f32>(c, 0.0, x); }
    }
    
    return rgb + m;
}

// =============================================================================
// HSV Conversions
// =============================================================================

/// Convert RGB to HSV.
fn rgb_to_hsv(rgb: vec3<f32>) -> vec3<f32> {
    let cmax = max(rgb.r, max(rgb.g, rgb.b));
    let cmin = min(rgb.r, min(rgb.g, rgb.b));
    let delta = cmax - cmin;
    
    var h: f32 = 0.0;
    var s: f32 = 0.0;
    let v = cmax;
    
    if cmax > 0.0001 {
        s = delta / cmax;
    }
    
    if delta > 0.0001 {
        if cmax == rgb.r {
            h = ((rgb.g - rgb.b) / delta) % 6.0;
        } else if cmax == rgb.g {
            h = (rgb.b - rgb.r) / delta + 2.0;
        } else {
            h = (rgb.r - rgb.g) / delta + 4.0;
        }
        h = h / 6.0;
        if h < 0.0 { h = h + 1.0; }
    }
    
    return vec3<f32>(h, s, v);
}

/// Convert HSV to RGB.
fn hsv_to_rgb(hsv: vec3<f32>) -> vec3<f32> {
    let h = hsv.x;
    let s = hsv.y;
    let v = hsv.z;
    
    let c = v * s;
    let x = c * (1.0 - abs((h * 6.0) % 2.0 - 1.0));
    let m = v - c;
    
    var rgb: vec3<f32>;
    let segment = u32(h * 6.0);
    
    switch segment {
        case 0u: { rgb = vec3<f32>(c, x, 0.0); }
        case 1u: { rgb = vec3<f32>(x, c, 0.0); }
        case 2u: { rgb = vec3<f32>(0.0, c, x); }
        case 3u: { rgb = vec3<f32>(0.0, x, c); }
        case 4u: { rgb = vec3<f32>(x, 0.0, c); }
        default: { rgb = vec3<f32>(c, 0.0, x); }
    }
    
    return rgb + m;
}

// =============================================================================
// Luminance
// =============================================================================

/// Calculate relative luminance (sRGB coefficients).
fn luminance(color: vec3<f32>) -> f32 {
    return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

/// Calculate perceived brightness.
fn brightness(color: vec3<f32>) -> f32 {
    return dot(color, vec3<f32>(0.299, 0.587, 0.114));
}

// =============================================================================
// Tone Mapping
// =============================================================================

/// Reinhard tone mapping.
fn tonemap_reinhard(color: vec3<f32>) -> vec3<f32> {
    return color / (color + vec3<f32>(1.0));
}

/// ACES filmic tone mapping.
fn tonemap_aces(color: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

/// Uncharted 2 tone mapping.
fn tonemap_uncharted2(color: vec3<f32>) -> vec3<f32> {
    let A = 0.15;
    let B = 0.50;
    let C = 0.10;
    let D = 0.20;
    let E = 0.02;
    let F = 0.30;
    return ((color * (A * color + C * B) + D * E) / (color * (A * color + B) + D * F)) - E / F;
}

// =============================================================================
// Blending
// =============================================================================

/// Overlay blend mode.
fn blend_overlay(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    let low = 2.0 * base * blend;
    let high = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    return mix(low, high, step(vec3<f32>(0.5), base));
}

/// Soft light blend mode.
fn blend_softlight(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    return mix(
        2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
        sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
        step(vec3<f32>(0.5), blend)
    );
}

/// Screen blend mode.
fn blend_screen(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    return 1.0 - (1.0 - base) * (1.0 - blend);
}

/// Multiply blend mode.
fn blend_multiply(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    return base * blend;
}

// =============================================================================
// Color Temperature System
// =============================================================================

/// Color temperature state constants.
const TEMPERATURE_DORMANT: u32 = 0u;
const TEMPERATURE_IDLE: u32 = 1u;
const TEMPERATURE_ACTIVE: u32 = 2u;
const TEMPERATURE_PROCESSING: u32 = 3u;
const TEMPERATURE_ALERT: u32 = 4u;

/// Opta brand purple (#8B5CF6) in linear space.
const OPTA_PURPLE: vec3<f32> = vec3<f32>(0.545, 0.361, 0.965);

/// Opta purple-blue for processing state.
const OPTA_PURPLE_BLUE: vec3<f32> = vec3<f32>(0.400, 0.450, 0.980);

/// Deep obsidian black for dormant state.
const OBSIDIAN_BLACK: vec3<f32> = vec3<f32>(0.04, 0.04, 0.05);

/// Cool gray for idle state.
const COOL_GRAY: vec3<f32> = vec3<f32>(0.25, 0.27, 0.30);

/// Alert amber for warning state.
const ALERT_AMBER: vec3<f32> = vec3<f32>(1.0, 0.75, 0.0);

/// Get primary color for a temperature state.
fn temperature_primary(state: u32) -> vec3<f32> {
    switch state {
        case TEMPERATURE_DORMANT: { return OBSIDIAN_BLACK; }
        case TEMPERATURE_IDLE: { return COOL_GRAY; }
        case TEMPERATURE_ACTIVE: { return OPTA_PURPLE; }
        case TEMPERATURE_PROCESSING: { return OPTA_PURPLE_BLUE; }
        case TEMPERATURE_ALERT: { return ALERT_AMBER; }
        default: { return OPTA_PURPLE; }
    }
}

/// Get glow color for a temperature state.
fn temperature_glow(state: u32) -> vec3<f32> {
    switch state {
        case TEMPERATURE_DORMANT: { return vec3<f32>(0.08, 0.08, 0.10); }
        case TEMPERATURE_IDLE: { return vec3<f32>(0.3, 0.35, 0.45); }
        case TEMPERATURE_ACTIVE: { return vec3<f32>(0.6, 0.4, 1.0); }
        case TEMPERATURE_PROCESSING: { return vec3<f32>(0.5, 0.6, 1.0); }
        case TEMPERATURE_ALERT: { return vec3<f32>(1.0, 0.6, 0.2); }
        default: { return vec3<f32>(0.6, 0.4, 1.0); }
    }
}

/// Blend between two temperature colors.
/// t=0 returns from_color, t=1 returns to_color.
fn temperature_blend(from_color: vec3<f32>, to_color: vec3<f32>, t: f32) -> vec3<f32> {
    return mix(from_color, to_color, clamp(t, 0.0, 1.0));
}

/// Map energy level (0.0-1.0) to temperature state.
fn energy_to_temperature(energy: f32) -> u32 {
    if energy < 0.2 {
        return TEMPERATURE_DORMANT;
    } else if energy < 0.4 {
        return TEMPERATURE_IDLE;
    } else if energy < 0.7 {
        return TEMPERATURE_ACTIVE;
    } else {
        return TEMPERATURE_PROCESSING;
    }
}

/// Get smoothly interpolated temperature color based on energy.
fn temperature_color_for_energy(energy: f32) -> vec3<f32> {
    let e = clamp(energy, 0.0, 1.0);

    // Define energy thresholds
    if e < 0.2 {
        // Dormant
        return OBSIDIAN_BLACK;
    } else if e < 0.4 {
        // Transition Dormant -> Idle
        let t = (e - 0.2) / 0.2;
        return mix(OBSIDIAN_BLACK, COOL_GRAY, t);
    } else if e < 0.7 {
        // Transition Idle -> Active
        let t = (e - 0.4) / 0.3;
        return mix(COOL_GRAY, OPTA_PURPLE, t);
    } else if e < 0.9 {
        // Transition Active -> Processing
        let t = (e - 0.7) / 0.2;
        return mix(OPTA_PURPLE, OPTA_PURPLE_BLUE, t);
    } else {
        // High energy stays at processing
        return OPTA_PURPLE_BLUE;
    }
}

// =============================================================================
// Accessibility Utilities
// =============================================================================

/// Calculate WCAG contrast ratio between two colors.
/// Returns ratio >= 1.0 where higher is better.
fn contrast_ratio(color1: vec3<f32>, color2: vec3<f32>) -> f32 {
    let l1 = luminance(color1) + 0.05;
    let l2 = luminance(color2) + 0.05;
    return max(l1, l2) / min(l1, l2);
}

/// Boost contrast of a color against a background to meet target ratio.
fn apply_contrast_boost(color: vec3<f32>, background: vec3<f32>, target_ratio: f32) -> vec3<f32> {
    let current_ratio = contrast_ratio(color, background);
    if current_ratio >= target_ratio {
        return color;
    }

    let bg_lum = luminance(background);
    let color_lum = luminance(color);
    let go_lighter = color_lum > bg_lum;

    // Calculate required luminance
    let required_lum = select(
        (bg_lum + 0.05) / target_ratio - 0.05,  // go darker
        target_ratio * (bg_lum + 0.05) - 0.05,  // go lighter
        go_lighter
    );

    // Scale color to reach required luminance
    let scale = select(
        required_lum / max(color_lum, 0.001),
        min(required_lum / max(color_lum, 0.001), 1.5),
        go_lighter
    );

    return clamp(color * scale, vec3<f32>(0.0), vec3<f32>(1.0));
}

/// Desaturate a color for reduced color mode.
/// amount=0 is full color, amount=1 is grayscale.
fn desaturate(color: vec3<f32>, amount: f32) -> vec3<f32> {
    let gray = luminance(color);
    return mix(color, vec3<f32>(gray), clamp(amount, 0.0, 1.0));
}

/// Adjust luminance of a color while preserving hue.
/// factor > 1 increases brightness, factor < 1 decreases.
fn luminance_adjust(color: vec3<f32>, factor: f32) -> vec3<f32> {
    let hsv = rgb_to_hsv(color);
    let new_v = clamp(hsv.z * factor, 0.0, 1.0);
    return hsv_to_rgb(vec3<f32>(hsv.x, hsv.y, new_v));
}

/// Detect edges using luminance gradient for high contrast mode.
/// Returns edge intensity (0.0-1.0).
fn high_contrast_edge(
    center: vec3<f32>,
    left: vec3<f32>,
    right: vec3<f32>,
    up: vec3<f32>,
    down: vec3<f32>
) -> f32 {
    let lc = luminance(center);
    let ll = luminance(left);
    let lr = luminance(right);
    let lu = luminance(up);
    let ld = luminance(down);

    // Sobel-like gradient magnitude
    let gx = abs(lr - ll);
    let gy = abs(lu - ld);
    let gradient = sqrt(gx * gx + gy * gy);

    return clamp(gradient * 2.0, 0.0, 1.0);
}

/// Apply high contrast solid edge outline.
fn apply_solid_edge(
    color: vec3<f32>,
    edge_intensity: f32,
    edge_color: vec3<f32>,
    threshold: f32
) -> vec3<f32> {
    if edge_intensity > threshold {
        return edge_color;
    }
    return color;
}

/// Invert color for inverted contrast mode.
fn invert_color(color: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(1.0) - color;
}

/// Apply reduced color saturation for colorblind-friendly mode.
fn colorblind_adjust(color: vec3<f32>, mode: u32) -> vec3<f32> {
    // mode 0 = normal, 1 = protanopia, 2 = deuteranopia, 3 = tritanopia
    switch mode {
        case 1u: {
            // Protanopia simulation (reduce red perception)
            return vec3<f32>(
                0.567 * color.r + 0.433 * color.g,
                0.558 * color.r + 0.442 * color.g,
                0.242 * color.g + 0.758 * color.b
            );
        }
        case 2u: {
            // Deuteranopia simulation (reduce green perception)
            return vec3<f32>(
                0.625 * color.r + 0.375 * color.g,
                0.7 * color.r + 0.3 * color.g,
                0.3 * color.g + 0.7 * color.b
            );
        }
        case 3u: {
            // Tritanopia simulation (reduce blue perception)
            return vec3<f32>(
                0.95 * color.r + 0.05 * color.g,
                0.433 * color.g + 0.567 * color.b,
                0.475 * color.g + 0.525 * color.b
            );
        }
        default: {
            return color;
        }
    }
}
