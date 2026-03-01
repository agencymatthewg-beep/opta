import React from "react";

interface OptaRingProps {
    size?: 48 | 64 | 80 | 120;
    className?: string;
    paused?: boolean;
}

export function OptaRing({ size = 80, className = "", paused = false }: OptaRingProps) {
    return (
        <div
            className={
                "opta-ring-wrap" +
                (size === 48 ? " opta-ring-48" : "") +
                (size === 64 ? " opta-ring-64" : "") +
                (size === 80 ? " opta-ring-80" : "") +
                (size === 120 ? " opta-ring-120" : "") +
                (className ? " " + className : "")
            }
            data-paused={paused ? "true" : undefined}
        >
            <div className="opta-ring-ambient" />
            <div className="opta-ring-scaler">
                <div className="opta-ring-core">
                    <div className="opta-singularity" />
                    <div className="opta-dust opta-dust-1" />
                    <div className="opta-dust opta-dust-2" />
                    <div className="opta-dust opta-dust-3" />
                </div>
            </div>
            <div className="opta-ring-body" />
            <div className="opta-ring-rims" />
        </div>
    );
}
