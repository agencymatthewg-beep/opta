//! Depth buffer management for 3D rendering and z-ordering.
//!
//! Provides a resizable depth buffer optimized for TBDR (Tile-Based Deferred Rendering)
//! on Apple Silicon GPUs.

/// A depth buffer texture for z-testing.
///
/// Uses TBDR-optimized StoreOp::Discard to avoid writing depth tiles back to memory.
pub struct DepthBuffer {
    texture: wgpu::Texture,
    view: wgpu::TextureView,
    width: u32,
    height: u32,
}

impl DepthBuffer {
    /// The texture format used for depth buffers.
    ///
    /// Depth32Float is widely supported and provides good precision.
    pub const FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float;

    /// Creates a new depth buffer with the specified dimensions.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `width` - Width in physical pixels
    /// * `height` - Height in physical pixels
    pub fn new(device: &wgpu::Device, width: u32, height: u32) -> Self {
        let (texture, view) = Self::create_texture(device, width, height);

        Self {
            texture,
            view,
            width,
            height,
        }
    }

    /// Resizes the depth buffer to new dimensions.
    ///
    /// Only recreates the texture if dimensions actually changed.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `width` - New width in physical pixels
    /// * `height` - New height in physical pixels
    pub fn resize(&mut self, device: &wgpu::Device, width: u32, height: u32) {
        if self.width == width && self.height == height {
            return;
        }

        let (texture, view) = Self::create_texture(device, width, height);
        self.texture = texture;
        self.view = view;
        self.width = width;
        self.height = height;
    }

    /// Returns a reference to the depth texture view.
    #[inline]
    pub fn view(&self) -> &wgpu::TextureView {
        &self.view
    }

    /// Returns a reference to the underlying texture.
    #[inline]
    pub fn texture(&self) -> &wgpu::Texture {
        &self.texture
    }

    /// Returns the current width in pixels.
    #[inline]
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Returns the current height in pixels.
    #[inline]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Creates a depth stencil attachment descriptor for render passes.
    ///
    /// Uses TBDR-optimized operations:
    /// - LoadOp::Clear to avoid loading tile memory
    /// - StoreOp::Discard to avoid writing tiles back to memory
    pub fn attachment(&self) -> wgpu::RenderPassDepthStencilAttachment<'_> {
        wgpu::RenderPassDepthStencilAttachment {
            view: &self.view,
            depth_ops: Some(wgpu::Operations {
                // TBDR optimization: Clear avoids loading tile memory
                load: wgpu::LoadOp::Clear(1.0),
                // TBDR optimization: Discard avoids writing depth tiles back
                store: wgpu::StoreOp::Discard,
            }),
            stencil_ops: None,
        }
    }

    /// Creates a depth texture and view.
    fn create_texture(device: &wgpu::Device, width: u32, height: u32) -> (wgpu::Texture, wgpu::TextureView) {
        let size = wgpu::Extent3d {
            width: width.max(1),
            height: height.max(1),
            depth_or_array_layers: 1,
        };

        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Depth Buffer"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: Self::FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        (texture, view)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_depth_format() {
        assert_eq!(DepthBuffer::FORMAT, wgpu::TextureFormat::Depth32Float);
    }
}
