import Foundation
import CoreLocation

// MARK: - Simple Weather Service (Mock Implementation)
// Note: For production, integrate with a weather API like OpenWeatherMap or Apple's WeatherKit

@MainActor
@Observable
final class WeatherService: NSObject, CLLocationManagerDelegate {
    static let shared = WeatherService()

    private let locationManager = CLLocationManager()
    private var currentLocation: CLLocation?

    var isLocationAuthorized = false

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    // MARK: - Location Authorization

    func requestLocationPermission() {
        locationManager.requestWhenInUseAuthorization()
    }

    func checkAuthorizationStatus() -> Bool {
        let status = locationManager.authorizationStatus
        #if os(iOS)
        isLocationAuthorized = status == .authorizedWhenInUse || status == .authorizedAlways
        #else
        isLocationAuthorized = status == .authorized
        #endif
        return isLocationAuthorized
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            _ = checkAuthorizationStatus()
        }
    }

    // MARK: - Location Delegate

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            currentLocation = locations.last
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[WeatherService] Location error: \(error.localizedDescription)")
    }

    // MARK: - Schedule Weather Notifications

    func scheduleWeatherNotifications() async {
        guard checkAuthorizationStatus() else {
            print("[WeatherService] Location not authorized")
            return
        }

        // Request location if needed
        if currentLocation == nil {
            locationManager.requestLocation()
            // Give it a moment to get location
            try? await Task.sleep(for: .seconds(2))
        }

        guard let location = currentLocation else {
            print("[WeatherService] No location available")
            return
        }

        // Mock weather data based on location
        // In production, replace with actual API call
        let mockWeather = generateMockWeather(for: location)

        if mockWeather.shouldNotify {
            await MainActor.run {
                NotificationManager.shared.notifyWeatherUpdate(
                    temperature: mockWeather.temperature,
                    condition: mockWeather.condition,
                    message: mockWeather.message
                )
            }
        }
    }

    // MARK: - Mock Weather Data

    private func generateMockWeather(for location: CLLocation) -> (temperature: Int, condition: String, message: String, shouldNotify: Bool) {
        // Generate semi-realistic mock data based on location
        let latitude = location.coordinate.latitude

        // Simple temperature model based on latitude
        let baseTemp = Int(20 - abs(latitude) / 3)
        let randomVariation = Int.random(in: -5...5)
        let temperature = baseTemp + randomVariation

        let conditions = ["Clear", "Partly Cloudy", "Cloudy", "Light Rain", "Rain"]
        let condition = conditions.randomElement() ?? "Clear"

        // Determine if should notify (extreme conditions)
        let shouldNotify = temperature < 5 || temperature > 30 || condition.contains("Rain")

        let message: String
        if temperature < 5 {
            message = "Bundle up! It's cold at \(temperature)°C with \(condition.lowercased())"
        } else if temperature > 30 {
            message = "Stay cool! It's hot at \(temperature)°C with \(condition.lowercased())"
        } else if condition.contains("Rain") {
            message = "\(condition) expected. Don't forget an umbrella!"
        } else {
            message = "\(temperature)°C with \(condition.lowercased()) in your area"
        }

        return (temperature, condition, message, shouldNotify)
    }
}
