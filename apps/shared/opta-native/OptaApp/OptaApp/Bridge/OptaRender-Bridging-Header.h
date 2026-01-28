//
//  OptaRender-Bridging-Header.h
//  OptaApp
//
//  Bridging header for Rust FFI (render engine and core)
//

#ifndef OptaRender_Bridging_Header_h
#define OptaRender_Bridging_Header_h

#include <stdint.h>
#include <stdbool.h>

// Include UniFFI-generated header for opta-core
#include "../Generated/opta_coreFFI.h"

#ifdef __cplusplus
extern "C" {
#endif

// MARK: - Opaque Types

/// Opaque pointer to the Rust render context
typedef struct OptaRenderContext OptaRenderContext;

// MARK: - GPU Capabilities

/// GPU capability information returned from Rust
typedef struct {
    /// Maximum supported texture dimension
    uint32_t max_texture_dimension;
    /// Maximum supported buffer size in bytes
    uint64_t max_buffer_size;
    /// Whether compute shaders are supported
    bool supports_compute;
    /// Whether raytracing is supported
    bool supports_raytracing;
    /// GPU vendor name (null-terminated, max 64 chars)
    char vendor[64];
    /// GPU device name (null-terminated, max 128 chars)
    char device_name[128];
    /// Preferred frame rate (matches display refresh rate)
    uint32_t preferred_frame_rate;
} OptaGpuCapabilities;

// MARK: - Result Types

/// Result codes for render operations
typedef enum {
    /// Operation completed successfully
    OPTA_RENDER_OK = 0,
    /// Render context is null or invalid
    OPTA_RENDER_ERROR_NULL_CONTEXT = 1,
    /// Surface configuration failed
    OPTA_RENDER_ERROR_SURFACE_CONFIG = 2,
    /// Frame acquisition failed
    OPTA_RENDER_ERROR_FRAME_ACQUIRE = 3,
    /// Render pass failed
    OPTA_RENDER_ERROR_RENDER_PASS = 4,
    /// Queue submission failed
    OPTA_RENDER_ERROR_QUEUE_SUBMIT = 5,
    /// Surface presentation failed
    OPTA_RENDER_ERROR_PRESENT = 6,
    /// Invalid parameters provided
    OPTA_RENDER_ERROR_INVALID_PARAMS = 7,
    /// GPU device lost
    OPTA_RENDER_ERROR_DEVICE_LOST = 8,
    /// Out of memory
    OPTA_RENDER_ERROR_OUT_OF_MEMORY = 9,
    /// Unknown error
    OPTA_RENDER_ERROR_UNKNOWN = 255,
} OptaRenderResult;

// MARK: - Render Status

/// Current status of the render engine
typedef struct {
    /// Whether the render engine is currently active
    bool is_active;
    /// Whether rendering is paused
    bool is_paused;
    /// Current frames per second
    float current_fps;
    /// Target frames per second
    float target_fps;
    /// Average frame time in milliseconds
    float frame_time_ms;
    /// Total frames rendered since initialization
    uint64_t total_frames;
    /// Number of dropped frames
    uint64_t dropped_frames;
    /// Current render quality (0.0 - 1.0)
    float quality_level;
    /// GPU memory usage in bytes
    uint64_t gpu_memory_usage;
} OptaRenderStatus;

// MARK: - Quality Settings

/// Render quality presets
typedef enum {
    OPTA_QUALITY_LOW = 0,
    OPTA_QUALITY_MEDIUM = 1,
    OPTA_QUALITY_HIGH = 2,
    OPTA_QUALITY_ULTRA = 3,
    OPTA_QUALITY_ADAPTIVE = 4,
} OptaQualityLevel;

// MARK: - Lifecycle Functions

/// Create a new render context
/// @return Pointer to the render context, or NULL on failure
OptaRenderContext* opta_render_create(void);

/// Initialize the render context with Metal layer
/// @param context The render context
/// @param metal_layer Pointer to CAMetalLayer
/// @return Result code
OptaRenderResult opta_render_init(OptaRenderContext* context, void* metal_layer);

/// Destroy the render context and free resources
/// @param context The render context to destroy
void opta_render_destroy(OptaRenderContext* context);

// MARK: - Surface Configuration

/// Configure the render surface with new dimensions
/// @param context The render context
/// @param width Surface width in pixels
/// @param height Surface height in pixels
/// @param scale Backing scale factor (e.g., 2.0 for Retina)
/// @return Result code
OptaRenderResult opta_render_configure_surface(
    OptaRenderContext* context,
    uint32_t width,
    uint32_t height,
    float scale
);

/// Handle surface resize
/// @param context The render context
/// @param width New width in pixels
/// @param height New height in pixels
/// @param scale New backing scale factor
/// @return Result code
OptaRenderResult opta_render_resize(
    OptaRenderContext* context,
    uint32_t width,
    uint32_t height,
    float scale
);

// MARK: - Frame Loop

/// Begin a new frame
/// @param context The render context
/// @param timestamp Current timestamp in seconds
/// @return Result code (OPTA_RENDER_OK if frame should be rendered)
OptaRenderResult opta_render_frame_begin(
    OptaRenderContext* context,
    double timestamp
);

/// End the current frame and present
/// @param context The render context
/// @return Result code
OptaRenderResult opta_render_frame_end(OptaRenderContext* context);

// MARK: - Quality Control

/// Set the render quality level
/// @param context The render context
/// @param quality Quality level preset
/// @return Result code
OptaRenderResult opta_render_set_quality(
    OptaRenderContext* context,
    OptaQualityLevel quality
);

/// Set custom quality value (0.0 - 1.0)
/// @param context The render context
/// @param quality_value Quality value from 0.0 (lowest) to 1.0 (highest)
/// @return Result code
OptaRenderResult opta_render_set_quality_value(
    OptaRenderContext* context,
    float quality_value
);

/// Set target frame rate
/// @param context The render context
/// @param fps Target frames per second
/// @return Result code
OptaRenderResult opta_render_set_target_fps(
    OptaRenderContext* context,
    uint32_t fps
);

// MARK: - Pause Control

/// Pause rendering
/// @param context The render context
/// @return Result code
OptaRenderResult opta_render_pause(OptaRenderContext* context);

/// Resume rendering
/// @param context The render context
/// @return Result code
OptaRenderResult opta_render_resume(OptaRenderContext* context);

/// Set paused state
/// @param context The render context
/// @param paused Whether rendering should be paused
/// @return Result code
OptaRenderResult opta_render_set_paused(
    OptaRenderContext* context,
    bool paused
);

// MARK: - Status Queries

/// Get current render status
/// @param context The render context
/// @param status Pointer to status struct to fill
/// @return Result code
OptaRenderResult opta_render_get_status(
    OptaRenderContext* context,
    OptaRenderStatus* status
);

/// Get GPU capabilities
/// @param context The render context
/// @param capabilities Pointer to capabilities struct to fill
/// @return Result code
OptaRenderResult opta_render_get_capabilities(
    OptaRenderContext* context,
    OptaGpuCapabilities* capabilities
);

/// Get the last error message
/// @param context The render context
/// @return Null-terminated error string, or NULL if no error
const char* opta_render_get_last_error(OptaRenderContext* context);

// MARK: - Haptics Integration

/// Haptic feedback types
typedef enum {
    /// Simple tap feedback
    OPTA_HAPTIC_TAP = 0,
    /// Explosion with aftershock waves
    OPTA_HAPTIC_EXPLOSION = 1,
    /// Gentle ramp up for activation
    OPTA_HAPTIC_WAKE_UP = 2,
    /// Soft pulse for idle breathing
    OPTA_HAPTIC_PULSE = 3,
    /// Double tap warning
    OPTA_HAPTIC_WARNING = 4,
} OptaHapticType;

/// Callback type for haptic feedback from Rust
/// @param haptic_type The type of haptic to play
typedef void (*HapticCallback)(uint32_t haptic_type);

/// Set the haptic callback that Rust will call to trigger haptics
/// @param callback The callback function to invoke for haptic feedback
void opta_render_set_haptic_callback(HapticCallback callback);

// MARK: - Circular Menu Types

/// Opaque pointer to the Rust circular menu
typedef struct OptaCircularMenu OptaCircularMenu;

/// Configuration for circular menu creation
typedef struct {
    /// Center X position in pixels
    float center_x;
    /// Center Y position in pixels
    float center_y;
    /// Outer radius in pixels
    float radius;
    /// Inner radius in pixels
    float inner_radius;
    /// Number of sectors in the menu
    uint32_t sector_count;
    /// Branch energy color red component (0.0-1.0)
    float branch_energy_r;
    /// Branch energy color green component (0.0-1.0)
    float branch_energy_g;
    /// Branch energy color blue component (0.0-1.0)
    float branch_energy_b;
    /// Branch energy intensity (0.0-2.0+)
    float branch_energy_intensity;
    /// Rotation offset in radians
    float rotation_offset;
} OptaCircularMenuConfig;

/// Hit test result for circular menu
typedef struct {
    /// Sector index (-1 if not in menu)
    int32_t sector_index;
    /// Whether the point is within the menu ring
    bool is_in_menu;
    /// X position of the sector center (valid if sector_index >= 0)
    float sector_center_x;
    /// Y position of the sector center (valid if sector_index >= 0)
    float sector_center_y;
} OptaCircularMenuHitTest;

// MARK: - Circular Menu Lifecycle

/// Create a new circular menu
/// @param config Pointer to configuration struct (can be NULL for defaults)
/// @return Pointer to the circular menu, or NULL on failure
OptaCircularMenu* opta_circular_menu_create(const OptaCircularMenuConfig* config);

/// Destroy a circular menu and free resources
/// @param menu The circular menu to destroy
void opta_circular_menu_destroy(OptaCircularMenu* menu);

// MARK: - Circular Menu State

/// Open the circular menu with animation
/// @param menu The circular menu
/// @return Result code
OptaRenderResult opta_circular_menu_open(OptaCircularMenu* menu);

/// Close the circular menu with animation
/// @param menu The circular menu
/// @return Result code
OptaRenderResult opta_circular_menu_close(OptaCircularMenu* menu);

/// Toggle the circular menu open/closed state
/// @param menu The circular menu
/// @return Result code
OptaRenderResult opta_circular_menu_toggle(OptaCircularMenu* menu);

/// Check if the circular menu is open
/// @param menu The circular menu
/// @return true if open, false if closed
bool opta_circular_menu_is_open(const OptaCircularMenu* menu);

/// Check if the menu animation is currently active
/// @param menu The circular menu
/// @return true if animating, false otherwise
bool opta_circular_menu_is_animating(const OptaCircularMenu* menu);

/// Immediately set the open state without animation
/// @param menu The circular menu
/// @param open Whether to open (true) or close (false)
/// @return Result code
OptaRenderResult opta_circular_menu_set_open_immediate(OptaCircularMenu* menu, bool open);

// MARK: - Circular Menu Animation

/// Update the circular menu animation
/// @param menu The circular menu
/// @param dt Time delta in seconds
/// @return Result code
OptaRenderResult opta_circular_menu_update(OptaCircularMenu* menu, float dt);

/// Get the current open progress (0.0 = closed, 1.0 = open)
/// @param menu The circular menu
/// @return Progress value 0.0-1.0
float opta_circular_menu_get_open_progress(const OptaCircularMenu* menu);

/// Get the current highlight progress (0.0 = none, 1.0 = full)
/// @param menu The circular menu
/// @return Progress value 0.0-1.0
float opta_circular_menu_get_highlight_progress(const OptaCircularMenu* menu);

// MARK: - Circular Menu Sectors

/// Set the highlighted sector
/// @param menu The circular menu
/// @param sector Sector index to highlight (-1 for none)
/// @return Result code
OptaRenderResult opta_circular_menu_set_highlighted_sector(OptaCircularMenu* menu, int32_t sector);

/// Get the currently highlighted sector
/// @param menu The circular menu
/// @return Sector index, or -1 if none highlighted
int32_t opta_circular_menu_get_highlighted_sector(const OptaCircularMenu* menu);

/// Set the number of sectors in the menu
/// @param menu The circular menu
/// @param count Number of sectors (1-12)
/// @return Result code
OptaRenderResult opta_circular_menu_set_sector_count(OptaCircularMenu* menu, uint32_t count);

/// Get the number of sectors in the menu
/// @param menu The circular menu
/// @return Number of sectors
uint32_t opta_circular_menu_get_sector_count(const OptaCircularMenu* menu);

// MARK: - Circular Menu Position

/// Set the menu center position
/// @param menu The circular menu
/// @param center_x X coordinate of center
/// @param center_y Y coordinate of center
/// @return Result code
OptaRenderResult opta_circular_menu_set_position(OptaCircularMenu* menu, float center_x, float center_y);

// MARK: - Circular Menu Appearance

/// Set the branch energy color for the highlighted sector
/// @param menu The circular menu
/// @param r Red component (0.0-1.0)
/// @param g Green component (0.0-1.0)
/// @param b Blue component (0.0-1.0)
/// @return Result code
OptaRenderResult opta_circular_menu_set_branch_energy_color(OptaCircularMenu* menu, float r, float g, float b);

// MARK: - Circular Menu Hit Testing

/// Hit test a point against the circular menu
/// @param menu The circular menu
/// @param x X coordinate to test
/// @param y Y coordinate to test
/// @param result Pointer to hit test result struct
/// @return Result code
OptaRenderResult opta_circular_menu_hit_test(
    const OptaCircularMenu* menu,
    float x,
    float y,
    OptaCircularMenuHitTest* result
);

// MARK: - Obsidian Panel Types

/// Opaque pointer to the Rust obsidian panel
typedef struct OptaPanel OptaPanel;

/// Configuration for obsidian panel creation
typedef struct {
    /// Panel position X in pixels
    float position_x;
    /// Panel position Y in pixels
    float position_y;
    /// Panel width in pixels
    float width;
    /// Panel height in pixels
    float height;
    /// Corner radius in pixels
    float corner_radius;
    /// Border width in pixels
    float border_width;
    /// Initial branch energy level [0, 1]
    float energy;
    /// Depth hierarchy layer [0, 1]
    float depth_layer;
    /// Quality level (0=Low, 1=Medium, 2=High, 3=Ultra)
    uint32_t quality_level;
} OptaPanelConfig;

// MARK: - Obsidian Panel Lifecycle

/// Create a new obsidian panel
/// @param ctx Pointer to the render context
/// @param config Pointer to panel configuration (NULL for defaults)
/// @return Pointer to the panel, or NULL on failure
OptaPanel* opta_panel_create(OptaRenderContext* ctx, const OptaPanelConfig* config);

/// Destroy a panel and free resources
/// @param panel The panel to destroy
void opta_panel_destroy(OptaPanel* panel);

// MARK: - Obsidian Panel Properties

/// Set the panel position
OptaRenderResult opta_panel_set_position(OptaPanel* panel, float x, float y);

/// Set the panel size
OptaRenderResult opta_panel_set_size(OptaPanel* panel, float width, float height);

/// Set the branch energy level [0.0, 1.0]
OptaRenderResult opta_panel_set_energy(OptaPanel* panel, float energy);

/// Set the depth layer [0.0 = foreground, 1.0 = background]
OptaRenderResult opta_panel_set_depth(OptaPanel* panel, float depth);

/// Set the quality level (0=Low, 1=Medium, 2=High, 3=Ultra)
OptaRenderResult opta_panel_set_quality(OptaPanel* panel, uint32_t level);

/// Update the panel animation
OptaRenderResult opta_panel_update(OptaPanel* panel, float dt);

/// Render the panel to the current surface
OptaRenderResult opta_panel_render(OptaPanel* panel, OptaRenderContext* ctx);

// MARK: - Branch Meter Types

/// Opaque pointer to the Rust branch meter
typedef struct OptaBranchMeter OptaBranchMeter;

/// Configuration for branch meter creation
typedef struct {
    /// Position X in pixels
    float position_x;
    /// Position Y in pixels
    float position_y;
    /// Width in pixels
    float width;
    /// Height in pixels
    float height;
    /// Corner radius in pixels
    float corner_radius;
    /// Initial fill level [0, 1]
    float fill_level;
    /// Initial branch energy [0, 1]
    float energy;
    /// Quality level (0-3)
    uint32_t quality_level;
    /// Viewport resolution width
    float resolution_width;
    /// Viewport resolution height
    float resolution_height;
} OptaBranchMeterConfig;

// MARK: - Branch Meter Lifecycle

/// Create a new branch meter
/// @param ctx Pointer to the render context
/// @param config Pointer to configuration (NULL for defaults)
/// @return Pointer to the branch meter, or NULL on failure
OptaBranchMeter* opta_branch_meter_create(OptaRenderContext* ctx, const OptaBranchMeterConfig* config);

/// Destroy a branch meter and free resources
void opta_branch_meter_destroy(OptaBranchMeter* meter);

/// Set the fill level [0.0, 1.0]
OptaRenderResult opta_branch_meter_set_fill(OptaBranchMeter* meter, float fill_level);

/// Set the branch energy level [0.0, 1.0]
OptaRenderResult opta_branch_meter_set_energy(OptaBranchMeter* meter, float energy);

/// Update the branch meter animation
OptaRenderResult opta_branch_meter_update(OptaBranchMeter* meter, float dt);

/// Render the branch meter to the current surface
OptaRenderResult opta_branch_meter_render(OptaBranchMeter* meter, OptaRenderContext* ctx);

// MARK: - Branch Indicator Types

/// Opaque pointer to the Rust branch indicator
typedef struct OptaBranchIndicator OptaBranchIndicator;

/// Configuration for branch indicator creation
typedef struct {
    /// Center X position in pixels
    float center_x;
    /// Center Y position in pixels
    float center_y;
    /// Inner core radius in pixels
    float inner_radius;
    /// Outer branch reach in pixels
    float outer_radius;
    /// Initial energy [0, 1]
    float energy;
    /// Number of radial branches
    uint32_t branch_count;
    /// Quality level (0-3)
    uint32_t quality_level;
    /// Viewport resolution width
    float resolution_width;
    /// Viewport resolution height
    float resolution_height;
} OptaBranchIndicatorConfig;

// MARK: - Branch Indicator Lifecycle

/// Create a new branch indicator
/// @param ctx Pointer to the render context
/// @param config Pointer to configuration (NULL for defaults)
/// @return Pointer to the branch indicator, or NULL on failure
OptaBranchIndicator* opta_branch_indicator_create(OptaRenderContext* ctx, const OptaBranchIndicatorConfig* config);

/// Destroy a branch indicator and free resources
void opta_branch_indicator_destroy(OptaBranchIndicator* indicator);

/// Set the energy level [0.0, 1.0]
OptaRenderResult opta_branch_indicator_set_energy(OptaBranchIndicator* indicator, float energy);

/// Update the branch indicator animation
OptaRenderResult opta_branch_indicator_update(OptaBranchIndicator* indicator, float dt);

/// Render the branch indicator to the current surface
OptaRenderResult opta_branch_indicator_render(OptaBranchIndicator* indicator, OptaRenderContext* ctx);

// MARK: - Branch Border Types

/// Opaque pointer to the Rust branch border
typedef struct OptaBranchBorder OptaBranchBorder;

/// Configuration for branch border creation
typedef struct {
    /// Position X in pixels
    float position_x;
    /// Position Y in pixels
    float position_y;
    /// Width in pixels
    float width;
    /// Height in pixels
    float height;
    /// Corner radius in pixels
    float corner_radius;
    /// Border band thickness in pixels
    float border_width;
    /// Initial energy [0, 1]
    float energy;
    /// Quality level (0-3)
    uint32_t quality_level;
    /// Viewport resolution width
    float resolution_width;
    /// Viewport resolution height
    float resolution_height;
} OptaBranchBorderConfig;

// MARK: - Branch Border Lifecycle

/// Create a new branch border
/// @param ctx Pointer to the render context
/// @param config Pointer to configuration (NULL for defaults)
/// @return Pointer to the branch border, or NULL on failure
OptaBranchBorder* opta_branch_border_create(OptaRenderContext* ctx, const OptaBranchBorderConfig* config);

/// Destroy a branch border and free resources
void opta_branch_border_destroy(OptaBranchBorder* border);

/// Set the energy level [0.0, 1.0]
OptaRenderResult opta_branch_border_set_energy(OptaBranchBorder* border, float energy);

/// Update the branch border animation
OptaRenderResult opta_branch_border_update(OptaBranchBorder* border, float dt);

/// Render the branch border to the current surface
OptaRenderResult opta_branch_border_render(OptaBranchBorder* border, OptaRenderContext* ctx);

#ifdef __cplusplus
}
#endif

#endif /* OptaRender_Bridging_Header_h */
