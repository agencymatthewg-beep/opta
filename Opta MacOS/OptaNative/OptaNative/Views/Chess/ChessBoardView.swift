//
//  ChessBoardView.swift
//  OptaNative
//
//  Premium Chess Interface.
//  Features a high-fidelity board, glassmorphism controls, and sophisticated player profiles.
//  Created for Opta Native macOS - Phase 111 (v12.0)
//

import SwiftUI

// MARK: - Chess Theme
struct ChessTheme {
    static let darkSquare = Color(hex: 0x4B7399) // Slate Blue (Classic Digital)
    static let lightSquare = Color(hex: 0xEAE9D2) // Off-white/Cream
    static let highlight = Color.optaNeonPurple
    static let lastMove = Color.yellow.opacity(0.4)
}

struct ChessBoardView: View {
    @State private var viewModel = ChessViewModel()
    
    // Layout State
    @State private var boardSize: CGFloat = 600
    
    var body: some View {
        HStack(spacing: 32) {
            
            // Left: Game Area
            VStack(spacing: 0) {
                // Opponent Info
                PlayerInfoRow(
                    name: "Opponent",
                    rating: 1500,
                    avatar: "person.circle.fill",
                    color: .red,
                    isUser: false
                )
                
                // The Board
                ZStack {
                    // Board Border/Frame
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(hex: 0x1A1A1A))
                        .shadow(color: .black.opacity(0.5), radius: 20, x: 0, y: 10)
                    
                    // Grid
                    VStack(spacing: 0) {
                        ForEach(0..<8, id: \.self) { row in
                            HStack(spacing: 0) {
                                ForEach(0..<8, id: \.self) { col in
                                    let rank = 7 - row
                                    let file = col
                                    let pos = Position(rank: rank, file: file)
                                    let isWhite = (rank + file) % 2 != 0
                                    
                                    ZStack {
                                        // Square Background
                                        Rectangle()
                                            .fill(
                                                viewModel.selectedSquare == pos ? ChessTheme.highlight.opacity(0.6) :
                                                (isWhite ? ChessTheme.lightSquare : ChessTheme.darkSquare)
                                            )
                                        
                                        // Board Coordinates
                                        if file == 0 {
                                            Text("\(rank + 1)")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundStyle(isWhite ? ChessTheme.darkSquare : ChessTheme.lightSquare)
                                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                                                .padding(3)
                                        }
                                        if rank == 0 {
                                            Text(["a","b","c","d","e","f","g","h"][file])
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundStyle(isWhite ? ChessTheme.darkSquare : ChessTheme.lightSquare)
                                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                                                .padding(3)
                                        }
                                        
                                        // Piece
                                        if let piece = viewModel.state.board.piece(at: pos) {
                                            ChessPieceView(piece: piece)
                                                .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 2)
                                                .scaleEffect(viewModel.selectedSquare == pos ? 1.1 : 1.0)
                                                .animation(.spring(response: 0.3), value: viewModel.selectedSquare)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    .onTapGesture {
                                        viewModel.selectSquare(pos)
                                    }
                                }
                            }
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding(16) // Board Border Padding
                }
                .aspectRatio(1.0, contentMode: .fit)
                
                // User Info
                PlayerInfoRow(
                    name: "You",
                    rating: 1200,
                    avatar: "person.crop.circle.fill",
                    color: .green,
                    isUser: true
                )
            }
            .padding(.vertical, 24)
            .padding(.leading, 24)
            
            // Right: Control Panel
            VStack(spacing: 24) {
                // Header Tabs
                HStack(spacing: 0) {
                    TabButton(title: "New Game", icon: "plus", isSelected: true)
                    TabButton(title: "Games", icon: "list.bullet", isSelected: false)
                    TabButton(title: "Players", icon: "person.2", isSelected: false)
                }
                .background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                
                // Game Mode Selector
                VStack(spacing: 16) {
                    Button(action: {}) {
                        HStack {
                            Image(systemName: "clock")
                                .foregroundStyle(Color.optaTextMuted)
                            Text("10 min • Rapid")
                                .font(.opta(size: 16, weight: .medium))
                                .foregroundStyle(.white)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .foregroundStyle(Color.optaTextMuted)
                        }
                        .padding()
                        .background(Color.white.opacity(0.05))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    
                    // Large Play Button
                    Button(action: viewModel.resetGame) {
                        HStack {
                            Image(systemName: "play.fill")
                            Text("Start Game")
                        }
                        .font(.opta(size: 20, weight: .bold))
                        .foregroundStyle(Color.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                colors: [Color(hex: 0x81B64C), Color(hex: 0x458723)], // Classic Green
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .shadow(color: Color(hex: 0x458723).opacity(0.5), radius: 10, y: 5)
                    }
                    .buttonStyle(.plain)
                }
                .padding()
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.1), lineWidth: 1))
                
                Spacer()
                
                // Chat / Footer
                HStack {
                    Text("129,209 Playing")
                        .font(.caption)
                        .foregroundStyle(Color.optaTextMuted)
                    Spacer()
                }
            }
            .frame(width: 320)
            .padding(.trailing, 24)
            .padding(.vertical, 24)
        }
        .background(Color.optaVoid.ignoresSafeArea())
    }
}

// MARK: - Subviews

struct PlayerInfoRow: View {
    let name: String
    let rating: Int
    let avatar: String
    let color: Color
    let isUser: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: avatar)
                .resizable()
                .frame(width: 32, height: 32)
                .foregroundStyle(Color.white)
                .background(Color.white.opacity(0.1))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.opta(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                Text("\(rating)")
                    .font(.caption)
                    .foregroundStyle(Color.optaTextMuted)
            }
            
            Spacer()
            
            // Timer
            Text("10:00")
                .font(.opta(size: 20, weight: .medium)) // Monospaced numbers
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.1))
                .cornerRadius(6)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 4)
    }
}

struct TabButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 16))
            Text(title)
                .font(.opta(size: 11, weight: .medium))
        }
        .foregroundStyle(isSelected ? Color.white : Color.optaTextMuted)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(isSelected ? Color.white.opacity(0.1) : Color.clear)
    }
}

struct ChessPieceView: View {
    let piece: ChessPiece
    
    var body: some View {
        Text(piece.symbol)
            .font(.system(size: 48))
            .foregroundStyle(piece.color == .white ? .white : .black)
            // Emulate "Piece" look with strokes/shadows
            .shadow(color: piece.color == .white ? .black.opacity(0.5) : .white.opacity(0.3), radius: 0, x: 0, y: 0)
    }
}

#Preview {
    ChessBoardView()
        .frame(width: 1200, height: 800)
}
