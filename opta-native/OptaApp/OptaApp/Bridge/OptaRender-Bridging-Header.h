//
//  OptaRender-Bridging-Header.h
//  OptaApp
//
//  Bridging header for Rust render engine FFI
//

#ifndef OptaRender_Bridging_Header_h
#define OptaRender_Bridging_Header_h

#include <stdint.h>
#include <stdbool.h>

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

#ifdef __cplusplus
}
#endif

#endif /* OptaRender_Bridging_Header_h */
