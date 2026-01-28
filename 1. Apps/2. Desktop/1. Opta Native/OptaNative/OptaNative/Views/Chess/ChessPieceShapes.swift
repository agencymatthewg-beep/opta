//
//  ChessPieceShapes.swift
//  OptaNative
//
//  Custom SwiftUI Path-based chess piece shapes.
//  Premium, smooth design aligned with Opta's obsidian glass aesthetic.
//
//  Created for Opta Native macOS - Modularization v1.0
//

import SwiftUI

// MARK: - AnyShape Type Erasure

struct AnyShape: Shape {
    private let pathBuilder: (CGRect) -> Path

    init<S: Shape>(_ shape: S) {
        pathBuilder = { rect in
            shape.path(in: rect)
        }
    }

    func path(in rect: CGRect) -> Path {
        pathBuilder(rect)
    }
}

// MARK: - Piece Shape Factory

func chessPieceShape(for type: ChessPieceType) -> AnyShape {
    switch type {
    case .king:
        return AnyShape(KingShape())
    case .queen:
        return AnyShape(QueenShape())
    case .rook:
        return AnyShape(RookShape())
    case .bishop:
        return AnyShape(BishopShape())
    case .knight:
        return AnyShape(KnightShape())
    case .pawn:
        return AnyShape(PawnShape())
    }
}

// MARK: - Pawn Shape

struct PawnShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Smooth pawn - rounded head, tapered body, wide base
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.12))

        // Head (circle approximation)
        path.addCurve(
            to: CGPoint(x: w * 0.65, y: h * 0.25),
            control1: CGPoint(x: w * 0.62, y: h * 0.12),
            control2: CGPoint(x: w * 0.65, y: h * 0.18)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.38),
            control1: CGPoint(x: w * 0.65, y: h * 0.32),
            control2: CGPoint(x: w * 0.58, y: h * 0.38)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.35, y: h * 0.25),
            control1: CGPoint(x: w * 0.42, y: h * 0.38),
            control2: CGPoint(x: w * 0.35, y: h * 0.32)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.12),
            control1: CGPoint(x: w * 0.35, y: h * 0.18),
            control2: CGPoint(x: w * 0.38, y: h * 0.12)
        )

        // Neck
        path.move(to: CGPoint(x: w * 0.42, y: h * 0.38))
        path.addLine(to: CGPoint(x: w * 0.38, y: h * 0.48))

        // Body curve
        path.addCurve(
            to: CGPoint(x: w * 0.25, y: h * 0.82),
            control1: CGPoint(x: w * 0.30, y: h * 0.55),
            control2: CGPoint(x: w * 0.25, y: h * 0.70)
        )

        // Base
        path.addLine(to: CGPoint(x: w * 0.20, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.80, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.75, y: h * 0.82))

        // Body curve (right side)
        path.addCurve(
            to: CGPoint(x: w * 0.62, y: h * 0.48),
            control1: CGPoint(x: w * 0.75, y: h * 0.70),
            control2: CGPoint(x: w * 0.70, y: h * 0.55)
        )

        path.addLine(to: CGPoint(x: w * 0.58, y: h * 0.38))

        path.closeSubpath()
        return path
    }
}

// MARK: - Rook Shape

struct RookShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Battlements (top)
        path.move(to: CGPoint(x: w * 0.20, y: h * 0.12))
        path.addLine(to: CGPoint(x: w * 0.20, y: h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.32, y: h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.32, y: h * 0.12))
        path.addLine(to: CGPoint(x: w * 0.44, y: h * 0.12))
        path.addLine(to: CGPoint(x: w * 0.44, y: h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.56, y: h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.56, y: h * 0.12))
        path.addLine(to: CGPoint(x: w * 0.68, y: h * 0.12))
        path.addLine(to: CGPoint(x: w * 0.68, y: h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.80, y: h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.80, y: h * 0.12))

        // Right side down
        path.addLine(to: CGPoint(x: w * 0.80, y: h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.72, y: h * 0.32))
        path.addLine(to: CGPoint(x: w * 0.70, y: h * 0.75))
        path.addLine(to: CGPoint(x: w * 0.78, y: h * 0.80))
        path.addLine(to: CGPoint(x: w * 0.82, y: h * 0.88))

        // Base
        path.addLine(to: CGPoint(x: w * 0.18, y: h * 0.88))

        // Left side up
        path.addLine(to: CGPoint(x: w * 0.22, y: h * 0.80))
        path.addLine(to: CGPoint(x: w * 0.30, y: h * 0.75))
        path.addLine(to: CGPoint(x: w * 0.28, y: h * 0.32))
        path.addLine(to: CGPoint(x: w * 0.20, y: h * 0.28))

        path.closeSubpath()
        return path
    }
}

// MARK: - Knight Shape

struct KnightShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Smooth horse head profile
        path.move(to: CGPoint(x: w * 0.30, y: h * 0.88))

        // Base
        path.addLine(to: CGPoint(x: w * 0.75, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.72, y: h * 0.78))

        // Back of neck
        path.addCurve(
            to: CGPoint(x: w * 0.68, y: h * 0.35),
            control1: CGPoint(x: w * 0.70, y: h * 0.65),
            control2: CGPoint(x: w * 0.72, y: h * 0.48)
        )

        // Ear
        path.addCurve(
            to: CGPoint(x: w * 0.55, y: h * 0.12),
            control1: CGPoint(x: w * 0.65, y: h * 0.22),
            control2: CGPoint(x: w * 0.60, y: h * 0.12)
        )

        // Forehead
        path.addCurve(
            to: CGPoint(x: w * 0.35, y: h * 0.25),
            control1: CGPoint(x: w * 0.48, y: h * 0.12),
            control2: CGPoint(x: w * 0.38, y: h * 0.18)
        )

        // Nose/muzzle
        path.addCurve(
            to: CGPoint(x: w * 0.22, y: h * 0.42),
            control1: CGPoint(x: w * 0.28, y: h * 0.28),
            control2: CGPoint(x: w * 0.20, y: h * 0.35)
        )

        // Mouth area
        path.addCurve(
            to: CGPoint(x: w * 0.35, y: h * 0.52),
            control1: CGPoint(x: w * 0.24, y: h * 0.48),
            control2: CGPoint(x: w * 0.30, y: h * 0.52)
        )

        // Chin/throat
        path.addCurve(
            to: CGPoint(x: w * 0.32, y: h * 0.78),
            control1: CGPoint(x: w * 0.38, y: h * 0.62),
            control2: CGPoint(x: w * 0.35, y: h * 0.72)
        )

        path.addLine(to: CGPoint(x: w * 0.30, y: h * 0.88))

        path.closeSubpath()
        return path
    }
}

// MARK: - Bishop Shape

struct BishopShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Top finial
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.08))
        path.addCurve(
            to: CGPoint(x: w * 0.56, y: h * 0.14),
            control1: CGPoint(x: w * 0.54, y: h * 0.08),
            control2: CGPoint(x: w * 0.56, y: h * 0.10)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.20),
            control1: CGPoint(x: w * 0.56, y: h * 0.18),
            control2: CGPoint(x: w * 0.54, y: h * 0.20)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.44, y: h * 0.14),
            control1: CGPoint(x: w * 0.46, y: h * 0.20),
            control2: CGPoint(x: w * 0.44, y: h * 0.18)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.08),
            control1: CGPoint(x: w * 0.44, y: h * 0.10),
            control2: CGPoint(x: w * 0.46, y: h * 0.08)
        )

        // Mitre (head)
        path.move(to: CGPoint(x: w * 0.5, y: h * 0.18))
        path.addCurve(
            to: CGPoint(x: w * 0.65, y: h * 0.38),
            control1: CGPoint(x: w * 0.62, y: h * 0.22),
            control2: CGPoint(x: w * 0.65, y: h * 0.30)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.52),
            control1: CGPoint(x: w * 0.65, y: h * 0.46),
            control2: CGPoint(x: w * 0.58, y: h * 0.52)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.35, y: h * 0.38),
            control1: CGPoint(x: w * 0.42, y: h * 0.52),
            control2: CGPoint(x: w * 0.35, y: h * 0.46)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.18),
            control1: CGPoint(x: w * 0.35, y: h * 0.30),
            control2: CGPoint(x: w * 0.38, y: h * 0.22)
        )

        // Collar
        path.move(to: CGPoint(x: w * 0.38, y: h * 0.52))
        path.addLine(to: CGPoint(x: w * 0.35, y: h * 0.58))
        path.addLine(to: CGPoint(x: w * 0.65, y: h * 0.58))
        path.addLine(to: CGPoint(x: w * 0.62, y: h * 0.52))

        // Body
        path.move(to: CGPoint(x: w * 0.35, y: h * 0.58))
        path.addCurve(
            to: CGPoint(x: w * 0.25, y: h * 0.80),
            control1: CGPoint(x: w * 0.30, y: h * 0.65),
            control2: CGPoint(x: w * 0.25, y: h * 0.72)
        )
        path.addLine(to: CGPoint(x: w * 0.20, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.80, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.75, y: h * 0.80))
        path.addCurve(
            to: CGPoint(x: w * 0.65, y: h * 0.58),
            control1: CGPoint(x: w * 0.75, y: h * 0.72),
            control2: CGPoint(x: w * 0.70, y: h * 0.65)
        )

        path.closeSubpath()
        return path
    }
}

// MARK: - Queen Shape

struct QueenShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Crown points with orbs
        let crownPoints = 5
        for i in 0..<crownPoints {
            let angle = Double(i) * (Double.pi / Double(crownPoints - 1)) - Double.pi
            let x = w * 0.5 + w * 0.32 * cos(angle)
            let y = h * 0.12 - h * 0.06 * sin(angle * 2)

            // Small orb at each point
            path.addEllipse(in: CGRect(
                x: x - w * 0.04,
                y: y - h * 0.04,
                width: w * 0.08,
                height: h * 0.08
            ))
        }

        // Crown band
        path.move(to: CGPoint(x: w * 0.18, y: h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.22, y: h * 0.18))
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.10),
            control1: CGPoint(x: w * 0.30, y: h * 0.13),
            control2: CGPoint(x: w * 0.40, y: h * 0.10)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.78, y: h * 0.18),
            control1: CGPoint(x: w * 0.60, y: h * 0.10),
            control2: CGPoint(x: w * 0.70, y: h * 0.13)
        )
        path.addLine(to: CGPoint(x: w * 0.82, y: h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.18, y: h * 0.28))
        path.closeSubpath()

        // Neck
        path.move(to: CGPoint(x: w * 0.30, y: h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.28, y: h * 0.38))
        path.addLine(to: CGPoint(x: w * 0.72, y: h * 0.38))
        path.addLine(to: CGPoint(x: w * 0.70, y: h * 0.28))
        path.closeSubpath()

        // Body
        path.move(to: CGPoint(x: w * 0.28, y: h * 0.38))
        path.addCurve(
            to: CGPoint(x: w * 0.20, y: h * 0.78),
            control1: CGPoint(x: w * 0.22, y: h * 0.52),
            control2: CGPoint(x: w * 0.20, y: h * 0.68)
        )
        path.addLine(to: CGPoint(x: w * 0.18, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.82, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.80, y: h * 0.78))
        path.addCurve(
            to: CGPoint(x: w * 0.72, y: h * 0.38),
            control1: CGPoint(x: w * 0.80, y: h * 0.68),
            control2: CGPoint(x: w * 0.78, y: h * 0.52)
        )
        path.closeSubpath()

        return path
    }
}

// MARK: - King Shape

struct KingShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Cross on top
        // Vertical
        path.addRect(CGRect(
            x: w * 0.44, y: h * 0.05,
            width: w * 0.12, height: h * 0.18
        ))
        // Horizontal
        path.addRect(CGRect(
            x: w * 0.36, y: h * 0.10,
            width: w * 0.28, height: h * 0.08
        ))

        // Crown band
        path.move(to: CGPoint(x: w * 0.22, y: h * 0.32))
        path.addLine(to: CGPoint(x: w * 0.25, y: h * 0.22))
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.18),
            control1: CGPoint(x: w * 0.32, y: h * 0.19),
            control2: CGPoint(x: w * 0.42, y: h * 0.18)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.75, y: h * 0.22),
            control1: CGPoint(x: w * 0.58, y: h * 0.18),
            control2: CGPoint(x: w * 0.68, y: h * 0.19)
        )
        path.addLine(to: CGPoint(x: w * 0.78, y: h * 0.32))
        path.addLine(to: CGPoint(x: w * 0.22, y: h * 0.32))
        path.closeSubpath()

        // Neck collar
        path.move(to: CGPoint(x: w * 0.28, y: h * 0.32))
        path.addLine(to: CGPoint(x: w * 0.26, y: h * 0.42))
        path.addLine(to: CGPoint(x: w * 0.74, y: h * 0.42))
        path.addLine(to: CGPoint(x: w * 0.72, y: h * 0.32))
        path.closeSubpath()

        // Body
        path.move(to: CGPoint(x: w * 0.26, y: h * 0.42))
        path.addCurve(
            to: CGPoint(x: w * 0.20, y: h * 0.78),
            control1: CGPoint(x: w * 0.20, y: h * 0.55),
            control2: CGPoint(x: w * 0.18, y: h * 0.68)
        )
        path.addLine(to: CGPoint(x: w * 0.16, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.84, y: h * 0.88))
        path.addLine(to: CGPoint(x: w * 0.80, y: h * 0.78))
        path.addCurve(
            to: CGPoint(x: w * 0.74, y: h * 0.42),
            control1: CGPoint(x: w * 0.82, y: h * 0.68),
            control2: CGPoint(x: w * 0.80, y: h * 0.55)
        )
        path.closeSubpath()

        return path
    }
}
