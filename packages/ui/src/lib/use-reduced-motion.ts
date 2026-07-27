'use client';

import { useEffect, useState } from 'react';

/**
 * Reports the user's `prefers-reduced-motion` setting, reactively.
 *
 * SSR-safe: returns `false` on the server and first client paint (motion is the
 * design default), then flips to the real value once the media query resolves —
 * so a reduced-motion user never sees a flash of animated transitions.
 *
 * Consumers gate transitions / transforms behind this (auth a11y, plan B.7):
 * `transition: reduced ? 'none' : '…'`.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
