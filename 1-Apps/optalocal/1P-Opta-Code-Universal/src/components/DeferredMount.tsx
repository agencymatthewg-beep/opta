import { useState, useEffect, type ReactNode } from "react";

interface DeferredMountProps {
    children: ReactNode;
    triggerEvent: string;
}

/**
 * A wrapper component that defers rendering its children until a specific window event is fired.
 * This is used to prevent heavy React sub-tree mounting from blocking the main thread during
 * Framer Motion entrance animations.
 */
export function DeferredMount({ children, triggerEvent }: DeferredMountProps) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // If the event already fired before we mounted, we don't want to get stuck.
        // The safest fallback is to forcefully mount after 400ms (Framer spring takes ~350ms).
        const fallbackTimer = setTimeout(() => {
            setIsReady(true);
        }, 400);

        const handleReady = () => {
            setIsReady(true);
            clearTimeout(fallbackTimer);
        };

        window.addEventListener(triggerEvent, handleReady);
        return () => {
            window.removeEventListener(triggerEvent, handleReady);
            clearTimeout(fallbackTimer);
        };
    }, [triggerEvent]);

    return isReady ? <>{children}</> : null;
}
