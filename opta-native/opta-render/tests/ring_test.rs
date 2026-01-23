//! Integration tests for the Opta Ring component.

use opta_render::components::{generate_torus_geometry, RingConfig, RingQualityLevel, RingState, RingUniforms, RingVertex};

#[test]
fn test_ring_config_defaults() {
    let config = RingConfig::default();
    
    // Verify default values
    assert!((config.major_radius - 1.0).abs() < f32::EPSILON, "Major radius should default to 1.0");
    assert!((config.minor_radius - 0.15).abs() < f32::EPSILON, "Minor radius should default to 0.15");
    assert_eq!(config.major_segments, 64, "Major segments should default to 64");
    assert_eq!(config.minor_segments, 32, "Minor segments should default to 32");
    assert!((config.roughness - 0.03).abs() < f32::EPSILON, "Roughness should default to 0.03");

    // Verify obsidian base color
    assert!((config.base_color[0] - 0.02).abs() < f32::EPSILON, "Base color red should be 0.02");
    assert!((config.base_color[1] - 0.02).abs() < f32::EPSILON, "Base color green should be 0.02");
    assert!((config.base_color[2] - 0.03).abs() < f32::EPSILON, "Base color blue should be 0.03");
}

#[test]
fn test_ring_state_enum_values() {
    // Test that all states have valid values
    let states = [
        RingState::Dormant,
        RingState::Waking,
        RingState::Active,
        RingState::Processing,
        RingState::Exploding,
        RingState::Recovering,
    ];
    
    for state in &states {
        // Rotation speeds should be positive and reasonable
        let speed = state.rotation_speed();
        assert!(speed > 0.0, "Rotation speed should be positive for {:?}", state);
        assert!(speed <= 5.0, "Rotation speed should be <= 5.0 for {:?}", state);
        
        // Tilt angles should be in valid range
        let tilt = state.tilt_angle();
        assert!(tilt >= 0.0, "Tilt angle should be >= 0 for {:?}", state);
        assert!(tilt <= std::f32::consts::PI / 2.0, "Tilt angle should be <= PI/2 for {:?}", state);
        
        // Energy levels should be in [0, 1]
        let energy = state.energy_level();
        assert!(energy >= 0.0 && energy <= 1.0, "Energy level should be in [0,1] for {:?}", state);
        
        // Transition duration should be positive
        let duration = state.transition_duration();
        assert!(duration > 0.0, "Transition duration should be positive for {:?}", state);
    }
}

#[test]
fn test_ring_state_default() {
    let state = RingState::default();
    assert_eq!(state, RingState::Dormant, "Default state should be Dormant");
}

#[test]
fn test_ring_state_transition_speeds() {
    // Verify the progression of rotation speeds through states
    assert!(RingState::Dormant.rotation_speed() < RingState::Waking.rotation_speed());
    assert!(RingState::Waking.rotation_speed() < RingState::Active.rotation_speed());
    assert!(RingState::Active.rotation_speed() < RingState::Processing.rotation_speed());
    assert!(RingState::Processing.rotation_speed() < RingState::Exploding.rotation_speed());
}

#[test]
fn test_ring_state_energy_levels() {
    // Verify energy levels increase toward Processing/Exploding
    assert!(RingState::Dormant.energy_level() < RingState::Active.energy_level());
    assert!(RingState::Active.energy_level() < RingState::Processing.energy_level());
    assert!(RingState::Processing.energy_level() < RingState::Exploding.energy_level());
    
    // Exploding should have maximum energy
    assert!((RingState::Exploding.energy_level() - 1.0).abs() < f32::EPSILON);
}

#[test]
fn test_ring_vertex_layout() {
    // Verify vertex structure size
    let size = std::mem::size_of::<RingVertex>();
    assert_eq!(size, 32, "RingVertex should be 32 bytes");
    
    // Verify alignment
    let align = std::mem::align_of::<RingVertex>();
    assert_eq!(align, 4, "RingVertex should have 4-byte alignment");
}

#[test]
fn test_ring_uniforms_layout() {
    // Verify uniforms structure size (for GPU alignment)
    let size = std::mem::size_of::<RingUniforms>();
    assert_eq!(size, 176, "RingUniforms should be 176 bytes");
    
    // Verify the default uniforms have sensible values
    let uniforms = RingUniforms::default();
    assert!(uniforms.time == 0.0);
    assert!((uniforms.energy_level - 0.2).abs() < f32::EPSILON);
    assert!((uniforms.fresnel_power - 3.0).abs() < f32::EPSILON);
    assert!((uniforms.roughness - 0.03).abs() < f32::EPSILON);
}

#[test]
fn test_generate_torus_geometry_basic() {
    let config = RingConfig {
        major_radius: 1.0,
        minor_radius: 0.1,
        major_segments: 8,
        minor_segments: 4,
        roughness: 0.03,
        base_color: [0.02, 0.02, 0.03],
        energy_color: [0.545, 0.361, 0.965],
        quality_level: RingQualityLevel::Low,
    };
    
    let (vertices, indices) = generate_torus_geometry(&config);
    
    // Check expected counts
    let expected_verts = (config.major_segments + 1) * (config.minor_segments + 1);
    assert_eq!(vertices.len(), expected_verts as usize, "Unexpected vertex count");
    
    let expected_indices = config.major_segments * config.minor_segments * 6;
    assert_eq!(indices.len(), expected_indices as usize, "Unexpected index count");
}

#[test]
fn test_generate_torus_geometry_normals() {
    let config = RingConfig::default();
    let (vertices, _) = generate_torus_geometry(&config);
    
    // All normals should be unit length
    for (i, vertex) in vertices.iter().enumerate() {
        let n = &vertex.normal;
        let len = (n[0] * n[0] + n[1] * n[1] + n[2] * n[2]).sqrt();
        assert!(
            (len - 1.0).abs() < 0.001,
            "Normal {} not normalized: length = {}",
            i,
            len
        );
    }
}

#[test]
fn test_generate_torus_geometry_uvs() {
    let config = RingConfig::default();
    let (vertices, _) = generate_torus_geometry(&config);
    
    // All UVs should be in [0, 1]
    for (i, vertex) in vertices.iter().enumerate() {
        assert!(
            vertex.uv[0] >= 0.0 && vertex.uv[0] <= 1.0,
            "U coordinate {} out of range: {}",
            i,
            vertex.uv[0]
        );
        assert!(
            vertex.uv[1] >= 0.0 && vertex.uv[1] <= 1.0,
            "V coordinate {} out of range: {}",
            i,
            vertex.uv[1]
        );
    }
}

#[test]
fn test_generate_torus_geometry_bounds() {
    let config = RingConfig {
        major_radius: 2.0,
        minor_radius: 0.5,
        major_segments: 16,
        minor_segments: 8,
        roughness: 0.03,
        base_color: [0.02, 0.02, 0.03],
        energy_color: [0.545, 0.361, 0.965],
        quality_level: RingQualityLevel::Low,
    };
    
    let (vertices, _) = generate_torus_geometry(&config);
    
    let max_extent = config.major_radius + config.minor_radius;
    
    for vertex in &vertices {
        let p = &vertex.position;
        
        // X and Z should be within major + minor radius
        let horizontal_dist = (p[0] * p[0] + p[2] * p[2]).sqrt();
        assert!(
            horizontal_dist <= max_extent + 0.001,
            "Position exceeds expected horizontal bounds: {} > {}",
            horizontal_dist,
            max_extent
        );
        
        // Y should be within minor radius
        assert!(
            p[1].abs() <= config.minor_radius + 0.001,
            "Y coordinate exceeds minor radius: {} > {}",
            p[1].abs(),
            config.minor_radius
        );
    }
}

#[test]
fn test_ring_state_equality() {
    assert_eq!(RingState::Dormant, RingState::Dormant);
    assert_ne!(RingState::Dormant, RingState::Active);
    assert_ne!(RingState::Processing, RingState::Exploding);
}

#[test]
fn test_ring_config_custom() {
    let config = RingConfig {
        major_radius: 2.5,
        minor_radius: 0.3,
        major_segments: 128,
        minor_segments: 64,
        roughness: 0.05,
        base_color: [0.02, 0.02, 0.03],
        energy_color: [0.545, 0.361, 0.965],
        quality_level: RingQualityLevel::High,
    };

    assert!((config.major_radius - 2.5).abs() < f32::EPSILON);
    assert!((config.minor_radius - 0.3).abs() < f32::EPSILON);
    assert_eq!(config.major_segments, 128);
    assert_eq!(config.minor_segments, 64);
    assert!((config.roughness - 0.05).abs() < f32::EPSILON);
}
