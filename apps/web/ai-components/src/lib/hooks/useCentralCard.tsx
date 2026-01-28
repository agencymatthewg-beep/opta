"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface CentralCardContextType {
  centralCardId: string | null;
  registerCard: (id: string, element: HTMLElement) => void;
  unregisterCard: (id: string) => void;
}

const CentralCardContext = createContext<CentralCardContextType | null>(null);

export function CentralCardProvider({ children }: { children: ReactNode }) {
  const [centralCardId, setCentralCardId] = useState<string | null>(null);
  const cardsRef = useRef<Map<string, HTMLElement>>(new Map());
  const rafRef = useRef<number | null>(null);

  const calculateCentralCard = useCallback(() => {
    const cards = cardsRef.current;
    if (cards.size === 0) {
      setCentralCardId(null);
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    let closestId: string | null = null;
    let closestDistance = Infinity;

    cards.forEach((element, id) => {
      const rect = element.getBoundingClientRect();
      const cardCenter = rect.top + rect.height / 2;
      const distance = Math.abs(cardCenter - viewportCenter);

      // Only consider cards that are at least partially visible
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = id;
        }
      }
    });

    setCentralCardId(closestId);
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(calculateCentralCard);
  }, [calculateCentralCard]);

  useEffect(() => {
    // Initial calculation
    calculateCentralCard();

    // Listen for scroll events
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleScroll, calculateCentralCard]);

  const registerCard = useCallback((id: string, element: HTMLElement) => {
    cardsRef.current.set(id, element);
    // Recalculate after registration
    requestAnimationFrame(() => {
      calculateCentralCard();
    });
  }, [calculateCentralCard]);

  const unregisterCard = useCallback((id: string) => {
    cardsRef.current.delete(id);
  }, []);

  return (
    <CentralCardContext.Provider
      value={{ centralCardId, registerCard, unregisterCard }}
    >
      {children}
    </CentralCardContext.Provider>
  );
}

export function useCentralCard(cardId: string, elementRef: React.RefObject<HTMLElement | null>) {
  const context = useContext(CentralCardContext);

  useEffect(() => {
    if (!context || !elementRef.current) return;

    context.registerCard(cardId, elementRef.current);
    return () => context.unregisterCard(cardId);
  }, [context, cardId, elementRef]);

  return context?.centralCardId === cardId;
}

export function useCentralCardContext() {
  return useContext(CentralCardContext);
}
