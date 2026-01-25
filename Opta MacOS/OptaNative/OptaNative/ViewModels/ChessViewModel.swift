//
//  ChessViewModel.swift
//  OptaNative
//
//  ViewModel for the Native Chess Game.
//  Manages selection, move execution, and engine state.
//  Created for Opta Native macOS - Plan 100-01 (v12.0)
//

import SwiftUI

@Observable
@MainActor
class ChessViewModel {
    
    // MARK: - Published Properties
    
    var state: ChessState
    var selectedSquare: Position?
    var legalDestinations: [Position] = []
    var isWhiteTurn: Bool { state.turn == .white }
    var gameStatus: String = "White to move"
    
    // MARK: - Initialization
    
    init() {
        self.state = ChessState()
    }
    
    // MARK: - User Intent
    
    func selectSquare(_ pos: Position) {
        // If selecting same square, deselect
        if selectedSquare == pos {
            deselect()
            return
        }
        
        // If square has piece of current turn color, select it
        if let piece = state.board.piece(at: pos), piece.color == state.turn {
            selectedSquare = pos
            // TODO: Generate actual legal moves here
            // For MVP, allow pseudo-all moves to empty squares for testing UI
            legalDestinations = [] 
        } 
        // If square is empty or opponent, and we have selection, try move
        else if let from = selectedSquare {
            tryMove(from: from, to: pos)
        }
    }
    
    private func tryMove(from: Position, to: Position) {
        // Basic pseudo-validation
        let move = ChessMove(from: from, to: to, promotion: nil)
        
        // Update state
        state.board.makeMove(move)
        state.turn = state.turn.opposite
        
        gameStatus = "\(state.turn == .white ? "White" : "Black") to move"
        
        deselect()
    }
    
    private func deselect() {
        selectedSquare = nil
        legalDestinations = []
    }
    
    func resetGame() {
        state = ChessState()
        deselect()
        gameStatus = "White to move"
    }
}
