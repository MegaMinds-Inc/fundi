'use client';

import { useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * The three responsive tiers, matching `tokens/layout.css`. These pixel values
 * are the canonical source for the hardcoded `@media` queries in `*.module.css`
 * (CSS custom properties can't be used inside media conditions).
 */
export const BREAKPOINTS = { tablet: 768, desktop: 1200 } as const;

function currentBreakpoint(): Breakpoint {
  const w = window.innerWidth;
  if (w >= BREAKPOINTS.desktop) return 'desktop';
  if (w >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/**
 * The current responsive tier. SSR-safe via `useSyncExternalStore`: the server
 * snapshot (and hydration) is mobile-first, then it updates after mount and on
 * resize — so no hydration mismatch.
 *
 * Prefer CSS `@media` (in a `*.module.css`) for pure restyling; reach for this
 * only when a module must render a genuinely *different subtree* per breakpoint
 * (e.g. a card list vs. a data table), not merely reflow.
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, currentBreakpoint, () => 'mobile');
}
