'use client'

/**
 * PageHeader — shared page header component.
 * Consistent header with icon, title, subtitle across all dashboard pages.
 */

import type { ElementType } from 'react'

interface PageHeaderProps {
    title: string
    subtitle: string
    icon: ElementType
    action?: React.ReactNode
}

export function PageHeader({ title, subtitle, icon: Icon, action }: PageHeaderProps) {
    return (
        <div className="border-b border-[var(--opta-border)] px-8 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                            <Icon size={18} />
                        </div>
                        <h1 className="text-lg font-semibold">{title}</h1>
                    </div>
                    <p className="text-sm text-text-secondary ml-12">{subtitle}</p>
                </div>
                {action && <div>{action}</div>}
            </div>
        </div>
    )
}
