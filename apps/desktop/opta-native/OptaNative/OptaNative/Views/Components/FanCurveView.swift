//
//  FanCurveView.swift
//  OptaNative
//
//  Thermal intelligence visualization with fan curve and throttle prediction.
//  Shows current temp/RPM, throttle threshold, and time-to-throttle estimate.
//
//  Created for Opta Native macOS - Phase 98-02
//

import SwiftUI
import Charts

// MARK: - Thermal Gauge View

struct ThermalGaugeView: View {
    let temperature: Double
    let throttleThreshold: Double
    let state: ThermalState
    let fanSpeed: Int?

    private var tempProgress: Double {
        min(temperature / throttleThreshold, 1.0)
    }

    private var stateColor: Color {
        switch state {
        case .cool: return .optaSuccess
        case .warm: return .optaNeonAmber
        case .hot: return .orange
        case .critical: return .optaNeonRed
        case .throttling: return .red
        }
    }

    var body: some View {
        VStack(spacing: 12) {
            // Temperature Arc
            ZStack {
                // Background arc
                Circle()
                    .trim(from: 0.0, to: 0.75)
                    .stroke(
                        Color.optaSurface,
                        style: StrokeStyle(lineWidth: 12, lineCap: .round)
                    )
                    .rotationEffect(.degrees(135))

                // Temperature arc
                Circle()
                    .trim(from: 0.0, to: tempProgress * 0.75)
                    .stroke(
                        LinearGradient(
                            colors: [.optaSuccess, .optaNeonAmber, .optaNeonRed],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: 12, lineCap: .round)
                    )
                    .rotationEffect(.degrees(135))
                    .animation(.spring(response: 0.5), value: temperature)

                // Throttle threshold marker
                Circle()
                    .trim(from: 0.74, to: 0.76)
                    .stroke(Color.white.opacity(0.5), lineWidth: 4)
                    .rotationEffect(.degrees(135))

                // Center content
                VStack(spacing: 2) {
                    Text("\(Int(temperature))°")
                        .font(.optaSectionHeader(size: 32))
                        .foregroundStyle(stateColor)

                    Text(state.rawValue)
                        .font(.optaSubtitle(size: 11))
                        .foregroundStyle(Color.optaTextMuted)
                        .textCase(.uppercase)
                }
            }
            .frame(width: 140, height: 140)

            // Fan speed (if available)
            if let rpm = fanSpeed, rpm > 0 {
                HStack(spacing: 6) {
                    Image(systemName: "fan.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.optaTextMuted)
                        .symbolEffect(.variableColor.iterative, options: .speed(0.5))

                    Text("\(rpm) RPM")
                        .font(.optaMono)
                        .foregroundStyle(Color.optaTextSecondary)
                }
            }
        }
    }
}

// MARK: - Throttle Prediction Card

struct ThrottlePredictionCard: View {
    let prediction: ThermalPrediction?
    let temperatureHistory: [(temperature: Double, timestamp: Date)]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(Color.optaNeonPurple)
                Text("Thermal Trend")
                    .font(.opta(size: 14, weight: .semibold))
                    .foregroundStyle(Color.optaTextPrimary)
                Spacer()
            }

            // Mini temperature chart
            if temperatureHistory.count >= 2 {
                Chart {
                    ForEach(Array(temperatureHistory.enumerated()), id: \.offset) { _, sample in
                        LineMark(
                            x: .value("Time", sample.timestamp),
                            y: .value("Temp", sample.temperature)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.optaNeonPurple, .optaElectricBlue],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .lineStyle(StrokeStyle(lineWidth: 2))

                        AreaMark(
                            x: .value("Time", sample.timestamp),
                            y: .value("Temp", sample.temperature)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [
                                    Color.optaNeonPurple.opacity(0.3),
                                    Color.optaNeonPurple.opacity(0.0)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                    }
                }
                .chartYScale(domain: 30...110)
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(values: [50, 75, 100]) { value in
                        AxisValueLabel {
                            Text("\(value.as(Int.self) ?? 0)°")
                                .font(.optaSubtitle(size: 9))
                                .foregroundStyle(Color.optaTextMuted)
                        }
                        AxisGridLine()
                            .foregroundStyle(Color.optaGlassBorder)
                    }
                }
                .frame(height: 80)
            }

            // Prediction info
            if let pred = prediction {
                HStack(spacing: 20) {
                    // Trend indicator
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Trend")
                            .font(.optaSubtitle(size: 10))
                            .foregroundStyle(Color.optaTextMuted)
                        HStack(spacing: 4) {
                            Image(systemName: pred.temperatureTrend > 0 ? "arrow.up.right" : pred.temperatureTrend < 0 ? "arrow.down.right" : "arrow.right")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(pred.temperatureTrend > 1 ? Color.optaNeonRed : pred.temperatureTrend < -1 ? Color.optaSuccess : Color.optaTextMuted)
                            Text(String(format: "%.1f°/min", abs(pred.temperatureTrend)))
                                .font(.optaMono)
                                .foregroundStyle(Color.optaTextSecondary)
                        }
                    }

                    // Time to throttle
                    if let seconds = pred.secondsToThrottle, seconds > 0 {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Throttle In")
                                .font(.optaSubtitle(size: 10))
                                .foregroundStyle(Color.optaTextMuted)
                            Text(formatTimeToThrottle(seconds))
                                .font(.optaMono)
                                .foregroundStyle(seconds < 60 ? Color.optaNeonRed : Color.optaTextSecondary)
                        }
                    }

                    Spacer()

                    // Device info
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(pred.formFactor.rawValue)
                            .font(.optaSubtitle(size: 10))
                            .foregroundStyle(Color.optaTextMuted)
                        if pred.formFactor.hasPassiveCooling {
                            Text("Passive")
                                .font(.optaBadge(size: 9))
                                .foregroundStyle(Color.optaNeonAmber)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule()
                                        .fill(Color.optaNeonAmber.opacity(0.15))
                                )
                        }
                    }
                }
            }

            // Recommendation
            if let rec = prediction?.recommendation {
                HStack(spacing: 8) {
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.optaNeonAmber)
                    Text(rec)
                        .font(.optaSubtitle(size: 12))
                        .foregroundStyle(Color.optaTextSecondary)
                }
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.optaNeonAmber.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(Color.optaNeonAmber.opacity(0.2), lineWidth: 1)
                        )
                )
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaSurface.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
                )
        )
    }

    private func formatTimeToThrottle(_ seconds: Double) -> String {
        if seconds < 60 {
            return "<1 min"
        } else if seconds < 3600 {
            let minutes = Int(seconds / 60)
            return "~\(minutes) min"
        } else {
            return ">1 hr"
        }
    }
}

// MARK: - Fan Curve View (Combined)

struct FanCurveView: View {
    @State private var thermalService = ThermalPredictionService()
    @State private var prediction: ThermalPrediction?
    @State private var history: [(temperature: Double, timestamp: Date)] = []

    // Inject from parent telemetry
    let currentTemperature: Double
    let fanSpeed: Int?

    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Thermal Intelligence")
                        .font(.optaSectionHeader(size: 20))
                        .foregroundStyle(Color.optaTextPrimary)
                    Text("Monitor thermals and predict throttling")
                        .font(.optaSubtitle(size: 12))
                        .foregroundStyle(Color.optaTextMuted)
                }
                Spacer()
            }

            HStack(spacing: 24) {
                // Temperature gauge
                ThermalGaugeView(
                    temperature: currentTemperature,
                    throttleThreshold: prediction?.formFactor.throttleTemperature ?? 100,
                    state: prediction?.state ?? .cool,
                    fanSpeed: fanSpeed
                )

                // Prediction card
                ThrottlePredictionCard(
                    prediction: prediction,
                    temperatureHistory: history
                )
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color.optaSurface.opacity(0.3))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .strokeBorder(
                            LinearGradient(
                                colors: [Color.optaNeonPurple.opacity(0.3), Color.clear],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
        )
        .task {
            await updatePrediction()
        }
        .onChange(of: currentTemperature) { _, _ in
            Task {
                await updatePrediction()
            }
        }
    }

    private func updatePrediction() async {
        prediction = await thermalService.recordTemperature(currentTemperature)
        history = await thermalService.getTemperatureHistory()
    }
}

// MARK: - Preview

#Preview {
    FanCurveView(
        currentTemperature: 72.5,
        fanSpeed: 2400
    )
    .frame(width: 500)
    .padding()
    .background(Color.optaVoid)
}
