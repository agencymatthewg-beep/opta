import React from 'react'

interface OptaTextLogoProps {
    className?: string
    glowColor?: string
    textColor?: string
}

export function OptaTextLogo({
    className = "",
    glowColor = "#a855f7",
    textColor = "#a1a1aa"
}: OptaTextLogoProps) {
    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div
                className="font-mono uppercase tracking-[0.15em] mb-1 leading-none"
                style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: 'var(--logo-size, 2rem)',
                    color: glowColor,
                    textShadow: `
                        1.5px 1.5px 0 #09090b,
                        2px 2px 0 #09090b,
                        3px 3px 0 ${glowColor},
                        4px 4px 0 #09090b,
                        5px 5px 0 #09090b,
                        6px 6px 0 ${glowColor}
                    `,
                    filter: `drop-shadow(0 0 20px ${glowColor}66)`
                }}
            >
                OPTA
            </div>
            <div
                className="font-mono uppercase font-semibold tracking-[0.4em] leading-none"
                style={{
                    fontSize: 'var(--logo-sub-size, 0.45rem)',
                    color: textColor,
                }}
            >
                Code Environment
            </div>
        </div>
    )
}
