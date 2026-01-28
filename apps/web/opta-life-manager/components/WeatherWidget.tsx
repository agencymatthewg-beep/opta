"use client";

import { useEffect, useState } from "react";
import { Cloud, Droplets, Wind, ThermometerSun, RefreshCw } from "lucide-react";
import { getWeather, WeatherData } from "@/lib/weather";
import { cn } from "@/lib/utils";

// Weather code to icon mapping (WMO codes) - client-side utility
const weatherIcons: Record<number, string> = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌧️", 53: "🌧️", 55: "🌧️",
    56: "🌨️", 57: "🌨️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    66: "🌨️", 67: "🌨️",
    71: "❄️", 73: "❄️", 75: "❄️", 77: "❄️",
    80: "🌦️", 81: "🌦️", 82: "⛈️",
    85: "🌨️", 86: "🌨️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
};

function getWeatherIcon(code: number, isDay: boolean = true): string {
    if ((code === 0 || code === 1) && !isDay) return "🌙";
    return weatherIcons[code] || "🌡️";
}

export function WeatherWidget() {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadWeather = async () => {
        setLoading(true);
        const result = await getWeather();
        if ("error" in result) {
            setError(result.error);
        } else {
            setWeather(result.data);
            setError(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadWeather();
        // Refresh every 30 minutes
        const interval = setInterval(loadWeather, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !weather) {
        return (
            <div className="animate-pulse space-y-3">
                <div className="h-16 bg-white/5 rounded-lg" />
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex-1 h-20 bg-white/5 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-4">
                <Cloud className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">{error}</p>
                <button onClick={loadWeather} className="text-xs text-primary mt-2">
                    Try Again
                </button>
            </div>
        );
    }

    if (!weather) return null;

    const getDayName = (dateStr: string, index: number) => {
        if (index === 0) return "Today";
        if (index === 1) return "Tomorrow";
        return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" });
    };

    return (
        <div className="space-y-4">
            {/* Current Weather */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-4xl">
                        {getWeatherIcon(weather.current.weatherCode, weather.current.isDay)}
                    </div>
                    <div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-text-primary tracking-tight">
                                {weather.current.temperature}°
                            </span>
                            <span className="text-xs text-text-muted uppercase tracking-wider">C</span>
                        </div>
                        <p className="text-xs text-text-secondary uppercase tracking-wider">{weather.current.weatherDescription}</p>
                        <p className="text-[10px] text-text-muted uppercase tracking-[0.1em]">{weather.location}</p>
                    </div>
                </div>

                <button
                    onClick={loadWeather}
                    disabled={loading}
                    className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            {/* Weather Details */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                    <ThermometerSun className="w-3 h-3 mx-auto text-neon-amber mb-1" />
                    <p className="text-[9px] text-text-muted uppercase tracking-[0.1em]">Feels like</p>
                    <p className="text-sm font-bold text-text-primary">{weather.current.feelsLike}°</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                    <Droplets className="w-3 h-3 mx-auto text-neon-blue mb-1" />
                    <p className="text-[9px] text-text-muted uppercase tracking-[0.1em]">Humidity</p>
                    <p className="text-sm font-bold text-text-primary">{weather.current.humidity}%</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                    <Wind className="w-3 h-3 mx-auto text-neon-cyan mb-1" />
                    <p className="text-[9px] text-text-muted uppercase tracking-[0.1em]">Wind</p>
                    <p className="text-sm font-bold text-text-primary">{weather.current.windSpeed} km/h</p>
                </div>
            </div>

            {/* 5-Day Forecast */}
            <div className="flex gap-2">
                {weather.daily.map((day, i) => (
                    <div
                        key={day.date}
                        className={cn(
                            "flex-1 text-center p-2 rounded-lg transition-colors",
                            i === 0 ? "bg-primary/10 border border-primary/20" : "bg-white/5"
                        )}
                    >
                        <p className="text-[9px] text-text-muted uppercase tracking-[0.15em] mb-1 font-medium">
                            {getDayName(day.date, i)}
                        </p>
                        <div className="text-lg mb-1">
                            {getWeatherIcon(day.weatherCode, true)}
                        </div>
                        <p className="text-xs">
                            <span className="text-text-primary">{day.tempMax}°</span>
                            <span className="text-text-muted"> / {day.tempMin}°</span>
                        </p>
                        {day.precipitationProbability > 20 && (
                            <p className="text-[10px] text-neon-blue mt-1">
                                {day.precipitationProbability}% 💧
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
