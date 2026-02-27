//
//  OptaPlusWidgets.swift
//  OptaPlusWidgetExtension
//
//  Widget extension entry point — bundles all widgets and Live Activities.
//  This file belongs in the WidgetKit extension target.
//

import SwiftUI
import WidgetKit

@main
struct OptaPlusWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Home screen widgets
        BotStatusWidget()
        QuickActionWidget()
        
        // Lock screen widgets
        LockScreenBotWidget()
        
        // Live Activities
        TaskProgressLiveActivity()
    }
}
