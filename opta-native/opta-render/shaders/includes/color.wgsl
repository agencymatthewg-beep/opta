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
