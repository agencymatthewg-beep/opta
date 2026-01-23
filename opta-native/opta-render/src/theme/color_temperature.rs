//! Color temperature system for consistent theming across app states.
//!
//! Maps application states to visual color palettes, providing a unified
//! look and feel throughout the Opta app based on current activity level.
//!
//! # States
//!
//! - **Dormant**: Deep obsidian blacks, minimal color - the app is sleeping
//! - **Idle**: Cool grays with subtle hints - ready but not active
//! - **Active**: Vibrant Opta purple - engaged and responding
//! - **Processing**: Energized purple-blue - working hard
//! - **Alert**: Warning amber/red - attention required
//!
//! # Example
//!
//! ```ignore
//! use opta_render::theme::{ColorTemperature, TemperatureColors};
//!
//! let colors = ColorTemperature::Active.get_colors();
//! println!("Primary: {:?}", colors.primary); // [0.545, 0.361, 0.965]
//!
//! // Map energy level to temperature
//! let temp = ColorTemperature::from_energy(0.7);
//! assert_eq!(temp, ColorTemperature::Active);
//! ```

/// The five color temperature states for the Opta visual system.
///
/// Each state represents a different level of activity and maps to
/// a distinct color palette.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub enum ColorTemperature {
    /// Deep obsidian blacks, colorless.
    /// Used when the app is in standby mode.
    #[default]
    Dormant,

    /// Cool grays with subtle hints.
    /// Used when the app is ready but not actively engaged.
    Idle,

    /// Vibrant Opta purple (#8B5CF6).
    /// Used when the app is actively engaged with the user.
    Active,

    /// Energized purple-blue.
    /// Used when the app is processing or computing.
    Processing,

    /// Warning amber/red states.
    /// Used for alerts and critical notifications.
    Alert,
}

impl ColorTemperature {
    /// Convert from integer value.
    ///
    /// Values outside the valid range default to Dormant.
    #[must_use]
    pub fn from_u32(value: u32) -> Self {
        match value {
            0 => Self::Dormant,
            1 => Self::Idle,
            2 => Self::Active,
            3 => Self::Processing,
            4 => Self::Alert,
            _ => Self::Dormant,
        }
    }

    /// Convert to integer value.
    #[must_use]
    pub fn as_u32(self) -> u32 {
        match self {
            Self::Dormant => 0,
            Self::Idle => 1,
            Self::Active => 2,
            Self::Processing => 3,
            Self::Alert => 4,
        }
    }

    /// Get the name of this temperature state.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Dormant => "Dormant",
            Self::Idle => "Idle",
            Self::Active => "Active",
            Self::Processing => "Processing",
            Self::Alert => "Alert",
        }
    }

    /// Get the colors for this temperature state.
    #[must_use]
    pub fn get_colors(self) -> TemperatureColors {
        get_colors(self)
    }

    /// Map an energy level (0.0 to 1.0) to a color temperature.
    ///
    /// Energy levels map to temperatures as follows:
    /// - 0.0 - 0.2: Dormant
    /// - 0.2 - 0.4: Idle
    /// - 0.4 - 0.7: Active
    /// - 0.7 - 0.9: Processing
    /// - 0.9 - 1.0: Alert (or Processing depending on context)
    #[must_use]
    pub fn from_energy(energy: f32) -> Self {
        temperature_from_energy(energy)
    }

    /// Get the target energy level for this temperature.
    ///
    /// This is the inverse of `from_energy()`.
    #[must_use]
    pub fn target_energy(self) -> f32 {
        match self {
            Self::Dormant => 0.1,
            Self::Idle => 0.3,
            Self::Active => 0.55,
            Self::Processing => 0.8,
            Self::Alert => 0.95,
        }
    }
}

/// Color palette for a temperature state.
///
/// Contains all colors needed for consistent theming:
/// - `primary`: Main accent color for interactive elements
/// - `glow`: Emission/glow color for effects
/// - `background`: Background tint for panels
/// - `text`: Text and UI element color
#[derive(Debug, Clone, Copy)]
pub struct TemperatureColors {
    /// Main accent color (RGB).
    pub primary: [f32; 3],

    /// Glow/emission color (RGB).
    pub glow: [f32; 3],

    /// Background tint color (RGB).
    pub background: [f32; 3],

    /// Text/UI element color (RGB).
    pub text: [f32; 3],
}

impl TemperatureColors {
    /// Create a new color palette.
    #[must_use]
    pub const fn new(
        primary: [f32; 3],
        glow: [f32; 3],
        background: [f32; 3],
        text: [f32; 3],
    ) -> Self {
        Self {
            primary,
            glow,
            background,
            text,
        }
    }

    /// Interpolate between two temperature colors.
    ///
    /// `t` should be in the range 0.0 to 1.0:
    /// - 0.0 returns `from`
    /// - 1.0 returns `to`
    #[must_use]
    pub fn interpolate(from: &Self, to: &Self, t: f32) -> Self {
        let t = t.clamp(0.0, 1.0);
        let inv_t = 1.0 - t;

        Self {
            primary: [
                from.primary[0] * inv_t + to.primary[0] * t,
                from.primary[1] * inv_t + to.primary[1] * t,
                from.primary[2] * inv_t + to.primary[2] * t,
            ],
            glow: [
                from.glow[0] * inv_t + to.glow[0] * t,
                from.glow[1] * inv_t + to.glow[1] * t,
                from.glow[2] * inv_t + to.glow[2] * t,
            ],
            background: [
                from.background[0] * inv_t + to.background[0] * t,
                from.background[1] * inv_t + to.background[1] * t,
                from.background[2] * inv_t + to.background[2] * t,
            ],
            text: [
                from.text[0] * inv_t + to.text[0] * t,
                from.text[1] * inv_t + to.text[1] * t,
                from.text[2] * inv_t + to.text[2] * t,
            ],
        }
    }

    /// Get the primary color with an alpha value.
    #[must_use]
    pub fn primary_with_alpha(&self, alpha: f32) -> [f32; 4] {
        [self.primary[0], self.primary[1], self.primary[2], alpha]
    }

    /// Get the glow color with an alpha value.
    #[must_use]
    pub fn glow_with_alpha(&self, alpha: f32) -> [f32; 4] {
        [self.glow[0], self.glow[1], self.glow[2], alpha]
    }

    /// Calculate the luminance of the primary color.
    ///
    /// Uses sRGB luminance coefficients.
    #[must_use]
    pub fn primary_luminance(&self) -> f32 {
        0.2126 * self.primary[0] + 0.7152 * self.primary[1] + 0.0722 * self.primary[2]
    }
}

impl Default for TemperatureColors {
    fn default() -> Self {
        get_colors(ColorTemperature::default())
    }
}

// =============================================================================
// Color Definitions
// =============================================================================

/// Opta brand purple: #8B5CF6
const OPTA_PURPLE: [f32; 3] = [0.545, 0.361, 0.965];

/// Opta purple-blue for processing: #7C3AED shifted toward blue
const OPTA_PURPLE_BLUE: [f32; 3] = [0.400, 0.450, 0.980];

/// Deep obsidian black
const OBSIDIAN_BLACK: [f32; 3] = [0.04, 0.04, 0.05];

/// Cool gray for idle
const COOL_GRAY: [f32; 3] = [0.25, 0.27, 0.30];

/// Alert amber
const ALERT_AMBER: [f32; 3] = [1.0, 0.75, 0.0];

/// Alert red for critical
const ALERT_RED: [f32; 3] = [0.95, 0.25, 0.25];

/// Get the colors for a specific temperature state.
#[must_use]
pub fn get_colors(temperature: ColorTemperature) -> TemperatureColors {
    match temperature {
        ColorTemperature::Dormant => TemperatureColors {
            primary: OBSIDIAN_BLACK,
            glow: [0.08, 0.08, 0.10], // Very subtle glow
            background: [0.02, 0.02, 0.03],
            text: [0.4, 0.4, 0.45], // Muted text
        },

        ColorTemperature::Idle => TemperatureColors {
            primary: COOL_GRAY,
            glow: [0.3, 0.35, 0.45], // Subtle blue hint
            background: [0.08, 0.08, 0.10],
            text: [0.7, 0.7, 0.75],
        },

        ColorTemperature::Active => TemperatureColors {
            primary: OPTA_PURPLE,
            glow: [0.6, 0.4, 1.0], // Bright purple glow
            background: [0.12, 0.10, 0.18], // Purple-tinted background
            text: [0.95, 0.95, 1.0],
        },

        ColorTemperature::Processing => TemperatureColors {
            primary: OPTA_PURPLE_BLUE,
            glow: [0.5, 0.6, 1.0], // Blue-shifted glow
            background: [0.10, 0.12, 0.20],
            text: [0.95, 0.95, 1.0],
        },

        ColorTemperature::Alert => TemperatureColors {
            primary: ALERT_AMBER,
            glow: lerp_color(ALERT_AMBER, ALERT_RED, 0.3), // Amber-red glow
            background: [0.15, 0.08, 0.05], // Warm warning background
            text: [1.0, 0.95, 0.9],
        },
    }
}

/// Map an energy level to a color temperature.
///
/// # Arguments
///
/// * `energy` - Energy level from 0.0 to 1.0
///
/// # Returns
///
/// The appropriate `ColorTemperature` for the given energy level.
#[must_use]
pub fn temperature_from_energy(energy: f32) -> ColorTemperature {
    let energy = energy.clamp(0.0, 1.0);

    if energy < 0.2 {
        ColorTemperature::Dormant
    } else if energy < 0.4 {
        ColorTemperature::Idle
    } else if energy < 0.7 {
        ColorTemperature::Active
    } else if energy < 0.9 {
        ColorTemperature::Processing
    } else {
        // High energy could be alert or processing depending on context
        // Default to Processing; Alert is typically set explicitly
        ColorTemperature::Processing
    }
}

/// Linear interpolation between two colors.
#[inline]
fn lerp_color(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    let inv_t = 1.0 - t;
    [
        a[0] * inv_t + b[0] * t,
        a[1] * inv_t + b[1] * t,
        a[2] * inv_t + b[2] * t,
    ]
}

/// Smoothly interpolate colors based on energy level.
///
/// Unlike `get_colors()` which returns discrete palettes, this function
/// smoothly blends between adjacent temperature states for seamless transitions.
///
/// # Arguments
///
/// * `energy` - Energy level from 0.0 to 1.0
///
/// # Returns
///
/// Smoothly interpolated `TemperatureColors`.
#[must_use]
pub fn colors_for_energy(energy: f32) -> TemperatureColors {
    let energy = energy.clamp(0.0, 1.0);

    // Define energy boundaries for each state
    let boundaries = [0.0, 0.2, 0.4, 0.7, 0.9, 1.0];
    let temps = [
        ColorTemperature::Dormant,
        ColorTemperature::Idle,
        ColorTemperature::Active,
        ColorTemperature::Processing,
        ColorTemperature::Processing, // High energy stays at processing
    ];

    // Find which segment we're in
    for i in 0..temps.len() {
        if energy < boundaries[i + 1] {
            let from = temps[i];
            let to = if i + 1 < temps.len() {
                temps[i + 1]
            } else {
                temps[i]
            };

            // Calculate interpolation factor within this segment
            let segment_start = boundaries[i];
            let segment_end = boundaries[i + 1];
            let t = (energy - segment_start) / (segment_end - segment_start);

            return TemperatureColors::interpolate(&from.get_colors(), &to.get_colors(), t);
        }
    }

    // Fallback (should not reach)
    get_colors(ColorTemperature::Processing)
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_temperature_from_u32() {
        assert_eq!(ColorTemperature::from_u32(0), ColorTemperature::Dormant);
        assert_eq!(ColorTemperature::from_u32(1), ColorTemperature::Idle);
        assert_eq!(ColorTemperature::from_u32(2), ColorTemperature::Active);
        assert_eq!(ColorTemperature::from_u32(3), ColorTemperature::Processing);
        assert_eq!(ColorTemperature::from_u32(4), ColorTemperature::Alert);
        assert_eq!(ColorTemperature::from_u32(99), ColorTemperature::Dormant);
    }

    #[test]
    fn test_temperature_as_u32() {
        assert_eq!(ColorTemperature::Dormant.as_u32(), 0);
        assert_eq!(ColorTemperature::Idle.as_u32(), 1);
        assert_eq!(ColorTemperature::Active.as_u32(), 2);
        assert_eq!(ColorTemperature::Processing.as_u32(), 3);
        assert_eq!(ColorTemperature::Alert.as_u32(), 4);
    }

    #[test]
    fn test_temperature_names() {
        assert_eq!(ColorTemperature::Dormant.name(), "Dormant");
        assert_eq!(ColorTemperature::Active.name(), "Active");
        assert_eq!(ColorTemperature::Alert.name(), "Alert");
    }

    #[test]
    fn test_temperature_from_energy() {
        assert_eq!(temperature_from_energy(0.0), ColorTemperature::Dormant);
        assert_eq!(temperature_from_energy(0.1), ColorTemperature::Dormant);
        assert_eq!(temperature_from_energy(0.25), ColorTemperature::Idle);
        assert_eq!(temperature_from_energy(0.5), ColorTemperature::Active);
        assert_eq!(temperature_from_energy(0.75), ColorTemperature::Processing);
        assert_eq!(temperature_from_energy(0.95), ColorTemperature::Processing);
        assert_eq!(temperature_from_energy(1.0), ColorTemperature::Processing);
    }

    #[test]
    fn test_temperature_colors_distinct() {
        let dormant = ColorTemperature::Dormant.get_colors();
        let active = ColorTemperature::Active.get_colors();
        let alert = ColorTemperature::Alert.get_colors();

        // Each temperature should have distinct primary colors
        assert_ne!(dormant.primary, active.primary);
        assert_ne!(active.primary, alert.primary);

        // Active should have the Opta purple
        assert!((active.primary[0] - OPTA_PURPLE[0]).abs() < 0.001);
        assert!((active.primary[1] - OPTA_PURPLE[1]).abs() < 0.001);
        assert!((active.primary[2] - OPTA_PURPLE[2]).abs() < 0.001);
    }

    #[test]
    fn test_color_interpolation() {
        let from = ColorTemperature::Dormant.get_colors();
        let to = ColorTemperature::Active.get_colors();

        // t=0.0 should equal from
        let at_0 = TemperatureColors::interpolate(&from, &to, 0.0);
        assert!((at_0.primary[0] - from.primary[0]).abs() < 0.001);

        // t=1.0 should equal to
        let at_1 = TemperatureColors::interpolate(&from, &to, 1.0);
        assert!((at_1.primary[0] - to.primary[0]).abs() < 0.001);

        // t=0.5 should be midpoint
        let at_half = TemperatureColors::interpolate(&from, &to, 0.5);
        let expected = (from.primary[0] + to.primary[0]) / 2.0;
        assert!((at_half.primary[0] - expected).abs() < 0.001);
    }

    #[test]
    fn test_colors_for_energy_smooth() {
        // Colors should change smoothly as energy increases
        let colors_low = colors_for_energy(0.35);
        let colors_mid = colors_for_energy(0.45);
        let colors_high = colors_for_energy(0.55);

        // Primary should get more purple as energy increases
        assert!(colors_mid.primary[2] > colors_low.primary[2], "Blue should increase");
        assert!(colors_high.primary[2] >= colors_mid.primary[2], "Blue should continue increasing");
    }

    #[test]
    fn test_primary_luminance() {
        let dormant = ColorTemperature::Dormant.get_colors();
        let active = ColorTemperature::Active.get_colors();
        let alert = ColorTemperature::Alert.get_colors();

        // Dormant should be darkest
        assert!(dormant.primary_luminance() < active.primary_luminance());
        // Alert should be bright
        assert!(alert.primary_luminance() > dormant.primary_luminance());
    }

    #[test]
    fn test_alpha_helpers() {
        let colors = ColorTemperature::Active.get_colors();

        let rgba = colors.primary_with_alpha(0.5);
        assert_eq!(rgba[0], colors.primary[0]);
        assert_eq!(rgba[1], colors.primary[1]);
        assert_eq!(rgba[2], colors.primary[2]);
        assert!((rgba[3] - 0.5).abs() < 0.001);

        let glow_rgba = colors.glow_with_alpha(0.8);
        assert!((glow_rgba[3] - 0.8).abs() < 0.001);
    }

    #[test]
    fn test_target_energy() {
        // Each temperature should have a unique target energy
        let dormant = ColorTemperature::Dormant.target_energy();
        let idle = ColorTemperature::Idle.target_energy();
        let active = ColorTemperature::Active.target_energy();
        let processing = ColorTemperature::Processing.target_energy();
        let alert = ColorTemperature::Alert.target_energy();

        assert!(dormant < idle);
        assert!(idle < active);
        assert!(active < processing);
        assert!(processing < alert);
    }
}
