'use client'

/**
 * HudRing — reusable animated data-ring component.
 * Displays a value inside a spinning dashed-border ring.
 */

interface HudRingProps {
    value: string
    label: string
    unit?: string
    reverse?: boolean
    variant?: 'default' | 'green' | 'cyan' | 'amber'
    size?: number
}

export function HudRing({
    value,
    label,
    unit,
    reverse = false,
    variant = 'default',
    size = 180,
}: HudRingProps) {
    const variantClass = reverse
        ? 'reverse'
        : variant === 'green'
            ? 'reverse'
            : variant === 'cyan'
                ? 'cyan'
                : variant === 'amber'
                    ? 'amber'
                    : ''

    return (
        <div
            className={`hud-ring ${variantClass}`}
            style={{ width: size, height: size }}
        >
            <div className="font-mono text-4xl font-light text-white" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                {value}
                {unit && <span className="text-lg text-white/50 ml-1">{unit}</span>}
            </div>
            <div className="text-[10px] tracking-[2px] uppercase text-white/50 mt-2 text-center">
                {label}
            </div>
        </div>
    )
}
