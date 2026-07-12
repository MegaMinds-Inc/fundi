import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` logs a warning when run during server rendering. Components
 * that measure the DOM (e.g. Tabs' sliding indicator) use this instead: it is
 * `useLayoutEffect` in the browser and a no-op-safe `useEffect` on the server.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
