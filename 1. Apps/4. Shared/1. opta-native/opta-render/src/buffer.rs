//! Vertex and index buffer types for 2D rendering.
//!
//! Provides GPU buffer management with proper memory layouts for wgpu rendering.

use wgpu::util::DeviceExt;

/// A GPU vertex buffer containing 2D vertices.
pub struct VertexBuffer {
    buffer: wgpu::Buffer,
    vertex_count: u32,
}

impl VertexBuffer {
    /// Creates a new vertex buffer from a slice of vertices.
    pub fn new(device: &wgpu::Device, vertices: &[Vertex2D], label: Option<&str>) -> Self {
        let buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label,
            contents: bytemuck::cast_slice(vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        Self {
            buffer,
            vertex_count: vertices.len() as u32,
        }
    }

    /// Returns a reference to the underlying wgpu buffer.
    #[inline]
    pub fn buffer(&self) -> &wgpu::Buffer {
        &self.buffer
    }

    /// Returns the number of vertices in this buffer.
    #[inline]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }
}

/// A GPU index buffer for indexed drawing.
pub struct IndexBuffer {
    buffer: wgpu::Buffer,
    index_count: u32,
    format: wgpu::IndexFormat,
}

impl IndexBuffer {
    /// Creates a new index buffer from a slice of u16 indices.
    pub fn new_u16(device: &wgpu::Device, indices: &[u16], label: Option<&str>) -> Self {
        let buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label,
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        Self {
            buffer,
            index_count: indices.len() as u32,
            format: wgpu::IndexFormat::Uint16,
        }
    }

    /// Creates a new index buffer from a slice of u32 indices.
    pub fn new_u32(device: &wgpu::Device, indices: &[u32], label: Option<&str>) -> Self {
        let buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label,
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        Self {
            buffer,
            index_count: indices.len() as u32,
            format: wgpu::IndexFormat::Uint32,
        }
    }

    /// Returns a reference to the underlying wgpu buffer.
    #[inline]
    pub fn buffer(&self) -> &wgpu::Buffer {
        &self.buffer
    }

    /// Returns the number of indices in this buffer.
    #[inline]
    pub fn index_count(&self) -> u32 {
        self.index_count
    }

    /// Returns the index format (Uint16 or Uint32).
    #[inline]
    pub fn format(&self) -> wgpu::IndexFormat {
        self.format
    }
}

/// A 2D vertex with position, texture coordinates, and color.
///
/// Memory layout is optimized for GPU access with 32-byte alignment.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Vertex2D {
    /// Position in 2D space (x, y).
    pub position: [f32; 2],
    /// Texture coordinates (u, v).
    pub tex_coords: [f32; 2],
    /// RGBA color (r, g, b, a).
    pub color: [f32; 4],
}

impl Vertex2D {
    /// Creates a new 2D vertex.
    pub const fn new(position: [f32; 2], tex_coords: [f32; 2], color: [f32; 4]) -> Self {
        Self {
            position,
            tex_coords,
            color,
        }
    }

    /// Returns the vertex buffer layout descriptor for this vertex type.
    ///
    /// Layout:
    /// - location 0: position (vec2<f32>)
    /// - location 1: tex_coords (vec2<f32>)
    /// - location 2: color (vec4<f32>)
    pub const fn desc() -> wgpu::VertexBufferLayout<'static> {
        const ATTRIBUTES: [wgpu::VertexAttribute; 3] = [
            // Position at location 0
            wgpu::VertexAttribute {
                offset: 0,
                shader_location: 0,
                format: wgpu::VertexFormat::Float32x2,
            },
            // Tex coords at location 1
            wgpu::VertexAttribute {
                offset: std::mem::size_of::<[f32; 2]>() as wgpu::BufferAddress,
                shader_location: 1,
                format: wgpu::VertexFormat::Float32x2,
            },
            // Color at location 2
            wgpu::VertexAttribute {
                offset: std::mem::size_of::<[f32; 4]>() as wgpu::BufferAddress,
                shader_location: 2,
                format: wgpu::VertexFormat::Float32x4,
            },
        ];

        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<Vertex2D>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &ATTRIBUTES,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vertex2d_size() {
        // Vertex2D should be 32 bytes (2 + 2 + 4 floats = 8 floats * 4 bytes)
        assert_eq!(std::mem::size_of::<Vertex2D>(), 32);
    }

    #[test]
    fn test_vertex2d_alignment() {
        // Should be 4-byte aligned (f32 alignment)
        assert_eq!(std::mem::align_of::<Vertex2D>(), 4);
    }
}
