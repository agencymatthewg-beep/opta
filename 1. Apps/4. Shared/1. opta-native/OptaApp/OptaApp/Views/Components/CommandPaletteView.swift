//
//  CommandPaletteView.swift
//  OptaApp
//
//  Floating command palette overlay with fuzzy search,
//  keyboard navigation, and obsidian+violet styling.
//

import SwiftUI

// MARK: - Command Palette View

/// Full-screen overlay presenting a searchable command palette
struct CommandPaletteView: View {

    @Bindable var viewModel: CommandPaletteViewModel
    @FocusState private var isSearchFocused: Bool
    @Environment(\.colorTemperature) private var colorTemp

    var body: some View {
        ZStack {
            // Semi-transparent backdrop
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    viewModel.dismiss()
                }

            // Floating panel
            VStack(spacing: 0) {
                searchField
                Divider()
                    .background(Color(hex: "8B5CF6").opacity(0.3))
                resultsList
            }
            .frame(width: 500)
            .frame(maxHeight: 400)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(hex: "0A0A0F"))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color(hex: "8B5CF6").opacity(0.4), lineWidth: 1)
            )
            .shadow(color: Color(hex: "8B5CF6").opacity(0.15), radius: 20, x: 0, y: 8)
            .shadow(color: Color.black.opacity(0.5), radius: 30, x: 0, y: 10)
            .scaleEffect(viewModel.isPresented ? 1.0 : 0.95)
            .opacity(viewModel.isPresented ? 1.0 : 0.0)
        }
        .animation(.spring(response: 0.2, dampingFraction: 0.85), value: viewModel.isPresented)
        .onAppear {
            isSearchFocused = true
        }
        .onKeyPress(.upArrow) {
            viewModel.moveSelection(-1)
            return .handled
        }
        .onKeyPress(.downArrow) {
            viewModel.moveSelection(1)
            return .handled
        }
        .onKeyPress(.return) {
            viewModel.executeSelected()
            return .handled
        }
        .onKeyPress(.escape) {
            viewModel.dismiss()
            return .handled
        }
    }

    // MARK: - Search Field

    private var searchField: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: "8B5CF6").opacity(0.7))

            TextField("Type a command...", text: $viewModel.searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 15))
                .foregroundStyle(.white)
                .focused($isSearchFocused)
                .onChange(of: viewModel.searchText) { _, _ in
                    viewModel.selectedIndex = 0
                }

            if !viewModel.searchText.isEmpty {
                Button {
                    viewModel.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.4))
                }
                .buttonStyle(.plain)
            }

            Text("esc")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.3))
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white.opacity(0.08))
                )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    // MARK: - Results List

    private var resultsList: some View {
        Group {
            let commands = viewModel.filteredCommands
            if commands.isEmpty {
                emptyState
            } else {
                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: true) {
                        LazyVStack(spacing: 0) {
                            // Recent section header
                            if viewModel.showRecents {
                                sectionHeader("Recent")
                            }

                            ForEach(Array(commands.enumerated()), id: \.element.id) { index, command in
                                let isSelected = index == viewModel.selectedIndex
                                let isRecent = viewModel.showRecents && index < viewModel.recentsCount

                                CommandRow(
                                    command: command,
                                    isSelected: isSelected,
                                    isRecent: isRecent
                                )
                                .id(command.id)
                                .onTapGesture {
                                    viewModel.execute(command)
                                }
                                .onHover { hovering in
                                    if hovering {
                                        viewModel.selectedIndex = index
                                    }
                                }

                                // Category header between recents and rest
                                if viewModel.showRecents && index == viewModel.recentsCount - 1 {
                                    sectionHeader("All Commands")
                                }
                            }
                        }
                        .padding(.vertical, 6)
                    }
                    .onChange(of: viewModel.selectedIndex) { _, newIndex in
                        if newIndex < commands.count {
                            withAnimation(.easeOut(duration: 0.1)) {
                                proxy.scrollTo(commands[newIndex].id, anchor: .center)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Section Header

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white.opacity(0.35))
                .tracking(0.8)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 4)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 24))
                .foregroundStyle(.white.opacity(0.2))

            Text("No matching commands")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

// MARK: - Command Row

/// Individual command row in the palette results
struct CommandRow: View {

    let command: CommandAction
    let isSelected: Bool
    let isRecent: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: isRecent ? "clock.arrow.circlepath" : command.icon)
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: "8B5CF6"))
                .frame(width: 24, height: 24)

            // Title and subtitle
            VStack(alignment: .leading, spacing: 2) {
                Text(command.title)
                    .font(.system(size: 14, weight: isSelected ? .medium : .regular))
                    .foregroundStyle(.white)

                if let subtitle = command.subtitle {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.4))
                        .lineLimit(1)
                }
            }

            Spacer()

            // Shortcut badge
            if let shortcut = command.shortcut {
                Text(shortcut)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.35))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.white.opacity(0.06))
                    )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isSelected
                    ? Color(hex: "8B5CF6").opacity(0.15)
                    : Color.clear
                )
                .padding(.horizontal, 8)
        )
        .scaleEffect(isSelected ? 1.01 : 1.0)
        .animation(.easeOut(duration: 0.1), value: isSelected)
    }
}
