//
//  SystemOrbitalView.swift
//  OptaNative
//
//  Holographic 3D orbital visualization of system metrics using SceneKit.
//  CPU cores as spinning rings, memory as a filling cylinder, processes as orbiting dots.
//  Created for Opta Native macOS - Plan 20-09
//

import SwiftUI
import SceneKit

// MARK: - Process Info Model

/// Lightweight process info for orbital visualization
struct ProcessOrbitalInfo: Identifiable {
    let id = UUID()
    let name: String
    let cpuPercent: Double
    let memoryMB: Double
}

// MARK: - System Orbital View

/// Holographic 3D visualization of system metrics
struct SystemOrbitalView: View {
    let cpuUsage: Double
    let memoryPercent: Double
    let processes: [ProcessOrbitalInfo]

    @State private var scene: SCNScene?

    var body: some View {
        SceneView(
            scene: scene ?? createOrbitalScene(),
            options: [.autoenablesDefaultLighting, .allowsCameraControl]
        )
        .background(Color.black.opacity(0.3))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 1)
        )
        .onAppear {
            scene = createOrbitalScene()
        }
        .onChange(of: cpuUsage) { _, _ in
            updateScene()
        }
        .onChange(of: memoryPercent) { _, _ in
            updateScene()
        }
    }

    // MARK: - Scene Creation

    private func createOrbitalScene() -> SCNScene {
        let scene = SCNScene()
        scene.background.contents = NSColor.clear

        // Central memory cylinder
        let memoryCylinder = createMemoryCylinder()
        memoryCylinder.name = "memoryCylinder"
        scene.rootNode.addChildNode(memoryCylinder)

        // CPU core rings
        let cpuRings = createCPURings()
        cpuRings.enumerated().forEach { index, ring in
            ring.name = "cpuRing_\(index)"
            scene.rootNode.addChildNode(ring)
        }

        // Orbiting process nodes
        let processNodes = createProcessNodes()
        processNodes.enumerated().forEach { index, node in
            node.name = "process_\(index)"
            scene.rootNode.addChildNode(node)
        }

        // Camera
        let cameraNode = SCNNode()
        cameraNode.camera = SCNCamera()
        cameraNode.position = SCNVector3(x: 0, y: 2, z: 5)
        cameraNode.look(at: SCNVector3(x: 0, y: 0, z: 0))
        cameraNode.camera?.fieldOfView = 45
        scene.rootNode.addChildNode(cameraNode)

        // Ambient light
        let ambientLight = SCNNode()
        ambientLight.light = SCNLight()
        ambientLight.light?.type = .ambient
        ambientLight.light?.color = NSColor(white: 0.4, alpha: 1)
        scene.rootNode.addChildNode(ambientLight)

        // Directional light for highlights
        let directionalLight = SCNNode()
        directionalLight.light = SCNLight()
        directionalLight.light?.type = .directional
        directionalLight.light?.color = NSColor.white
        directionalLight.light?.intensity = 500
        directionalLight.eulerAngles = SCNVector3(x: -.pi / 4, y: .pi / 4, z: 0)
        scene.rootNode.addChildNode(directionalLight)

        return scene
    }

    private func updateScene() {
        guard let scene = scene else { return }

        // Update memory cylinder fill
        if let container = scene.rootNode.childNode(withName: "memoryCylinder", recursively: false) {
            if let fill = container.childNode(withName: "memoryFill", recursively: false) {
                let fillHeight = 2.0 * (memoryPercent / 100.0)
                fill.position = SCNVector3(x: 0, y: CGFloat(-1 + fillHeight / 2), z: 0)

                if let cylinder = fill.geometry as? SCNCylinder {
                    cylinder.height = fillHeight
                }
            }
        }

        // Update CPU ring speeds
        for i in 0..<4 {
            if let ring = scene.rootNode.childNode(withName: "cpuRing_\(i)", recursively: false) {
                ring.removeAllActions()
                let rotationSpeed = 2.0 + (cpuUsage / 100.0) * 3.0
                let rotation = SCNAction.rotateBy(
                    x: 0,
                    y: CGFloat(rotationSpeed),
                    z: 0,
                    duration: 2.0
                )
                ring.runAction(SCNAction.repeatForever(rotation))
            }
        }
    }

    // MARK: - Memory Cylinder

    private func createMemoryCylinder() -> SCNNode {
        let memoryUsage = memoryPercent / 100.0

        // Outer shell (full height, transparent)
        let shellGeometry = SCNCylinder(radius: 0.5, height: 2)
        let shellMaterial = SCNMaterial()
        shellMaterial.diffuse.contents = NSColor.purple.withAlphaComponent(0.1)
        shellMaterial.transparency = 0.8
        shellMaterial.isDoubleSided = true
        shellGeometry.firstMaterial = shellMaterial
        let shellNode = SCNNode(geometry: shellGeometry)

        // Inner fill (height based on usage)
        let fillHeight = max(2.0 * memoryUsage, 0.1)
        let fillGeometry = SCNCylinder(radius: 0.45, height: fillHeight)

        // Gradient color based on usage
        let fillColor: NSColor = {
            if memoryUsage > 0.85 { return .systemRed }
            if memoryUsage > 0.6 { return .systemOrange }
            return .systemCyan
        }()

        let fillMaterial = SCNMaterial()
        fillMaterial.diffuse.contents = fillColor
        fillMaterial.emission.contents = fillColor.withAlphaComponent(0.5)
        fillMaterial.transparency = 0.9
        fillGeometry.firstMaterial = fillMaterial

        let fillNode = SCNNode(geometry: fillGeometry)
        fillNode.name = "memoryFill"
        fillNode.position = SCNVector3(x: 0, y: CGFloat(-1 + fillHeight / 2), z: 0)

        // Container node
        let containerNode = SCNNode()
        containerNode.addChildNode(shellNode)
        containerNode.addChildNode(fillNode)

        // Subtle pulsing animation for fill
        let pulseUp = SCNAction.scale(to: 1.05, duration: 1.0)
        let pulseDown = SCNAction.scale(to: 1.0, duration: 1.0)
        pulseUp.timingMode = .easeInEaseOut
        pulseDown.timingMode = .easeInEaseOut
        fillNode.runAction(SCNAction.repeatForever(SCNAction.sequence([pulseUp, pulseDown])))

        return containerNode
    }

    // MARK: - CPU Rings

    private func createCPURings() -> [SCNNode] {
        let cpuUsageNormalized = cpuUsage / 100.0
        var rings: [SCNNode] = []

        // Create 4 rings representing CPU cores/clusters
        for i in 0..<4 {
            let radius = 1.2 + Double(i) * 0.25
            let torusGeometry = SCNTorus(ringRadius: radius, pipeRadius: 0.025)

            // Color based on CPU usage
            let color: NSColor = {
                if cpuUsageNormalized > 0.85 { return .systemRed }
                if cpuUsageNormalized > 0.6 { return .systemCyan }
                return .systemPurple
            }()

            let material = SCNMaterial()
            material.diffuse.contents = color.withAlphaComponent(0.8)
            material.emission.contents = color.withAlphaComponent(0.6)
            material.metalness.contents = 0.5
            material.roughness.contents = 0.3
            torusGeometry.firstMaterial = material

            let ringNode = SCNNode(geometry: torusGeometry)
            ringNode.eulerAngles.x = .pi / 2 // Horizontal orientation

            // Slight tilt for visual interest
            ringNode.eulerAngles.z = CGFloat(i) * 0.1

            // Rotation animation - speed based on CPU usage
            let rotationSpeed = 2.0 + cpuUsageNormalized * 3.0
            // Alternate rotation direction for visual effect
            let direction: CGFloat = i % 2 == 0 ? 1 : -1
            let rotation = SCNAction.rotateBy(
                x: 0,
                y: CGFloat(rotationSpeed) * direction,
                z: 0,
                duration: 2.0
            )
            ringNode.runAction(SCNAction.repeatForever(rotation))

            rings.append(ringNode)
        }

        return rings
    }

    // MARK: - Process Nodes

    private func createProcessNodes() -> [SCNNode] {
        var nodes: [SCNNode] = []

        // If no real processes, create placeholder particles
        let processCount = processes.isEmpty ? 8 : min(processes.count, 8)

        for index in 0..<processCount {
            let process = processes.indices.contains(index) ? processes[index] : nil
            let cpuPercent = process?.cpuPercent ?? Double.random(in: 1...10)

            // Size based on CPU usage
            let size = 0.06 + (cpuPercent / 100.0) * 0.04
            let sphereGeometry = SCNSphere(radius: size)

            // Glowing material
            let material = SCNMaterial()
            material.diffuse.contents = NSColor.white
            material.emission.contents = NSColor.cyan.withAlphaComponent(0.8)
            material.transparency = 0.9
            sphereGeometry.firstMaterial = material

            let processNode = SCNNode(geometry: sphereGeometry)

            // Initial position in orbit
            let angle = Double(index) * (2 * .pi / Double(processCount))
            let orbitRadius = 1.8
            processNode.position = SCNVector3(
                x: CGFloat(cos(angle) * orbitRadius),
                y: CGFloat(sin(Double(index) * 0.5) * 0.3),
                z: CGFloat(sin(angle) * orbitRadius)
            )

            // Orbit animation - custom action for smooth orbital motion
            let orbitDuration: TimeInterval = 8 + Double(index) * 0.5
            let orbitAction = SCNAction.customAction(duration: orbitDuration) { node, time in
                let progress = Double(time) / orbitDuration
                let currentAngle = angle + progress * 2 * .pi
                let wobble = sin(currentAngle * 3) * 0.15

                node.position = SCNVector3(
                    x: CGFloat(cos(currentAngle) * orbitRadius),
                    y: CGFloat(sin(currentAngle * 2) * 0.25 + wobble),
                    z: CGFloat(sin(currentAngle) * orbitRadius)
                )
            }
            processNode.runAction(SCNAction.repeatForever(orbitAction))

            // Subtle pulsing glow
            let pulseAction = SCNAction.sequence([
                SCNAction.scale(to: 1.2, duration: 0.5 + Double(index) * 0.1),
                SCNAction.scale(to: 1.0, duration: 0.5 + Double(index) * 0.1)
            ])
            processNode.runAction(SCNAction.repeatForever(pulseAction))

            nodes.append(processNode)
        }

        return nodes
    }
}

// MARK: - Preview

#Preview("SystemOrbitalView") {
    ZStack {
        Color.optaBackground

        SystemOrbitalView(
            cpuUsage: 45,
            memoryPercent: 62,
            processes: [
                ProcessOrbitalInfo(name: "Safari", cpuPercent: 8.5, memoryMB: 512),
                ProcessOrbitalInfo(name: "Xcode", cpuPercent: 15.2, memoryMB: 2048),
                ProcessOrbitalInfo(name: "Slack", cpuPercent: 3.1, memoryMB: 256),
            ]
        )
        .frame(width: 280, height: 200)
    }
    .frame(width: 320, height: 240)
}

#Preview("SystemOrbitalView - High Load") {
    ZStack {
        Color.optaBackground

        SystemOrbitalView(
            cpuUsage: 92,
            memoryPercent: 88,
            processes: []
        )
        .frame(width: 280, height: 200)
    }
    .frame(width: 320, height: 240)
}
