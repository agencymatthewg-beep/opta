//! Frame command encoder wrapper.
//!
//! Provides a higher-level interface for building GPU command buffers
//! with TBDR-optimized render pass configurations.

/// A wrapper around wgpu::CommandEncoder for frame rendering.
///
/// Provides convenient methods for starting render passes with
/// TBDR-optimized load/store operations for Apple Silicon.
pub struct FrameEncoder {
    encoder: wgpu::CommandEncoder,
}

impl FrameEncoder {
    /// Creates a new frame encoder.
    pub fn new(device: &wgpu::Device) -> Self {
        let encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Frame Encoder"),
        });

        Self { encoder }
    }

    /// Creates a new frame encoder with a custom label.
    pub fn with_label(device: &wgpu::Device, label: &str) -> Self {
        let encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some(label),
        });

        Self { encoder }
    }

    /// Begins a render pass with TBDR-optimized operations.
    ///
    /// Uses:
    /// - LoadOp::Clear for color (avoids loading tile memory)
    /// - StoreOp::Discard for depth (avoids writing depth tiles back)
    ///
    /// # Arguments
    /// * `color_view` - The color attachment texture view
    /// * `depth_view` - Optional depth buffer texture view
    /// * `clear_color` - The color to clear the render target to
    pub fn begin_render_pass<'a>(
        &'a mut self,
        color_view: &'a wgpu::TextureView,
        depth_view: Option<&'a wgpu::TextureView>,
        clear_color: wgpu::Color,
    ) -> wgpu::RenderPass<'a> {
        let depth_stencil_attachment = depth_view.map(|view| wgpu::RenderPassDepthStencilAttachment {
            view,
            depth_ops: Some(wgpu::Operations {
                // TBDR optimization: Clear avoids loading tile memory
                load: wgpu::LoadOp::Clear(1.0),
                // TBDR optimization: Discard avoids writing depth tiles back
                store: wgpu::StoreOp::Discard,
            }),
            stencil_ops: None,
        });

        self.encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: color_view,
                resolve_target: None,
                ops: wgpu::Operations {
                    // TBDR optimization: Clear avoids loading tile memory
                    load: wgpu::LoadOp::Clear(clear_color),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment,
            timestamp_writes: None,
            occlusion_query_set: None,
        })
    }

    /// Begins a render pass that loads existing content (no clear).
    ///
    /// Use this when you need to preserve existing render target content.
    /// Note: This is less efficient on TBDR GPUs as it requires loading tile memory.
    pub fn begin_render_pass_load<'a>(
        &'a mut self,
        color_view: &'a wgpu::TextureView,
        depth_view: Option<&'a wgpu::TextureView>,
    ) -> wgpu::RenderPass<'a> {
        let depth_stencil_attachment = depth_view.map(|view| wgpu::RenderPassDepthStencilAttachment {
            view,
            depth_ops: Some(wgpu::Operations {
                load: wgpu::LoadOp::Load,
                store: wgpu::StoreOp::Discard,
            }),
            stencil_ops: None,
        });

        self.encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Render Pass (Load)"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: color_view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment,
            timestamp_writes: None,
            occlusion_query_set: None,
        })
    }

    /// Returns a mutable reference to the underlying command encoder.
    ///
    /// Use this for advanced operations not covered by the wrapper methods.
    #[inline]
    pub fn encoder_mut(&mut self) -> &mut wgpu::CommandEncoder {
        &mut self.encoder
    }

    /// Finishes encoding and returns the command buffer.
    ///
    /// The command buffer can then be submitted to the queue.
    pub fn finish(self) -> wgpu::CommandBuffer {
        self.encoder.finish()
    }
}

/// Extension trait for submitting frame encoders to a queue.
pub trait QueueExt {
    /// Submits a single frame encoder to the queue.
    fn submit_frame(&self, encoder: FrameEncoder) -> wgpu::SubmissionIndex;
}

impl QueueExt for wgpu::Queue {
    fn submit_frame(&self, encoder: FrameEncoder) -> wgpu::SubmissionIndex {
        self.submit(std::iter::once(encoder.finish()))
    }
}
