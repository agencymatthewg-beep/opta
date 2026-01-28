import SwiftUI

/// A high-performance Metal-backed view that renders the Opta Ring
/// using signed distance fields and raymarching.
struct MetalRingView: View {
    // MARK: - Properties
    
    /// The current energy level of the ring (0.0 to 1.0)
    var energy: Double
    
    // MARK: - Body
    
    var body: some View {
        TimelineView(.animation) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            
            GeometryReader { geometry in
                let size = geometry.size
                
                Rectangle()
                    .fill(.black) // Base color, shader will overwrite
                    .colorEffect(
                        ShaderLibrary.optaRingShader(
                            .float4(0, 0, size.width, size.height),
                            .float(time),
                            .float(energy)
                        )
                    )
            }
        }
        .drawingGroup() // Ensure GPU compositing
    }
}

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        MetalRingView(energy: 0.8)
            .frame(width: 300, height: 300)
    }
}
