"use server";

// ============================================================================
// Weather API Integration (Open-Meteo - Free, no API key needed)
// ============================================================================

// Clarinda, Iowa coordinates (update if different Clarinda)
const CLARINDA_LAT = 40.7419;
const CLARINDA_LON = -95.0386;
const LOCATION_NAME = "Clarinda";

export interface WeatherData {
    location: string;
    current: {
        temperature: number;
        feelsLike: number;
        humidity: number;
        windSpeed: number;
        weatherCode: number;
        weatherDescription: string;
        isDay: boolean;
    };
    daily: {
        date: string;
        tempMax: number;
        tempMin: number;
        weatherCode: number;
        weatherDescription: string;
        precipitationProbability: number;
    }[];
}

// Weather code to description mapping (WMO codes)
const weatherCodes: Record<number, { description: string; icon: string }> = {
    0: { description: "Clear sky", icon: "☀️" },
    1: { description: "Mainly clear", icon: "🌤️" },
    2: { description: "Partly cloudy", icon: "⛅" },
    3: { description: "Overcast", icon: "☁️" },
    45: { description: "Foggy", icon: "🌫️" },
    48: { description: "Depositing rime fog", icon: "🌫️" },
    51: { description: "Light drizzle", icon: "🌧️" },
    53: { description: "Moderate drizzle", icon: "🌧️" },
    55: { description: "Dense drizzle", icon: "🌧️" },
    56: { description: "Freezing drizzle", icon: "🌨️" },
    57: { description: "Dense freezing drizzle", icon: "🌨️" },
    61: { description: "Slight rain", icon: "🌧️" },
    63: { description: "Moderate rain", icon: "🌧️" },
    65: { description: "Heavy rain", icon: "🌧️" },
    66: { description: "Freezing rain", icon: "🌨️" },
    67: { description: "Heavy freezing rain", icon: "🌨️" },
    71: { description: "Slight snow", icon: "❄️" },
    73: { description: "Moderate snow", icon: "❄️" },
    75: { description: "Heavy snow", icon: "❄️" },
    77: { description: "Snow grains", icon: "❄️" },
    80: { description: "Slight rain showers", icon: "🌦️" },
    81: { description: "Moderate rain showers", icon: "🌦️" },
    82: { description: "Violent rain showers", icon: "⛈️" },
    85: { description: "Slight snow showers", icon: "🌨️" },
    86: { description: "Heavy snow showers", icon: "🌨️" },
    95: { description: "Thunderstorm", icon: "⛈️" },
    96: { description: "Thunderstorm with hail", icon: "⛈️" },
    99: { description: "Thunderstorm with heavy hail", icon: "⛈️" },
};

function getWeatherDescription(code: number): string {
    return weatherCodes[code]?.description || "Unknown";
}

export async function getWeather(): Promise<{ success: true; data: WeatherData } | { error: string }> {
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${CLARINDA_LAT}&longitude=${CLARINDA_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=celsius&wind_speed_unit=kmh&timezone=America/Chicago&forecast_days=5`,
            { next: { revalidate: 1800 } } // Cache for 30 minutes
        );

        if (!response.ok) {
            return { error: `Weather API error: ${response.status}` };
        }

        const data = await response.json();

        const weatherData: WeatherData = {
            location: LOCATION_NAME,
            current: {
                temperature: Math.round(data.current.temperature_2m),
                feelsLike: Math.round(data.current.apparent_temperature),
                humidity: data.current.relative_humidity_2m,
                windSpeed: Math.round(data.current.wind_speed_10m),
                weatherCode: data.current.weather_code,
                weatherDescription: getWeatherDescription(data.current.weather_code),
                isDay: data.current.is_day === 1,
            },
            daily: data.daily.time.slice(0, 5).map((date: string, i: number) => ({
                date,
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
                weatherCode: data.daily.weather_code[i],
                weatherDescription: getWeatherDescription(data.daily.weather_code[i]),
                precipitationProbability: data.daily.precipitation_probability_max[i] || 0,
            })),
        };

        return { success: true, data: weatherData };
    } catch (error) {
        console.error("Weather fetch error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch weather" };
    }
}
