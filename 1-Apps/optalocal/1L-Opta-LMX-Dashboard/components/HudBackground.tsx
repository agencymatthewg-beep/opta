'use client'

/**
 * HudBackground — animated conic-gradient background overlay.
 * Provides the spinning violet wash behind all dashboard content.
 */
export function HudBackground() {
    return (
        <div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: -1 }}
        >
            <div
                className="absolute top-1/2 left-1/2"
                style={{
                    width: '200vw',
                    height: '200vh',
                    transform: 'translate(-50%, -50%)',
                    background: `
                        radial-gradient(circle at center, rgba(168,85,247,0.05) 0%, transparent 60%),
                        conic-gradient(from 0deg at 50% 50%, transparent 0, rgba(168,85,247,0.08) 10deg, transparent 20deg)
                    `,
                    animation: 'hud-bg-spin 60s linear infinite',
                }}
            />
        </div>
    )
}
