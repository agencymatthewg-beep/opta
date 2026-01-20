//
//  ContentView.swift
//  Opta Scan
//
//  Created by Matthew Byrden
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            Text("Opta Scan")
                .font(.optaDisplay)
                .foregroundStyle(Color.optaTextPrimary)
        }
    }
}

#Preview {
    ContentView()
}
