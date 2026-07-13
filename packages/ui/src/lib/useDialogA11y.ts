'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Shared dialog accessibility for the overlay components — `Modal`, `Drawer`, and
 * the composite modules that wrap `Drawer` (ActionSheet, DraftEditor, HelpCapture).
 * While `open`:
 *   - moves focus into the dialog, and restores it to the trigger on close;
 *   - traps Tab / Shift+Tab focus within the dialog;
 *   - closes on Escape.
 *
 * Attach the returned ref to the dialog panel (the element carrying
 * `role="dialog"`), and give that element `tabIndex={-1}` so it can hold initial
 * focus and be announced (via `aria-labelledby`) by assistive tech.
 */
export function useDialogA11y(open: boolean, onClose?: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Kept in a ref so a fresh `onClose` identity each render doesn't re-run the
  // effect (which would steal focus back to the top on every parent re-render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    // Remember where focus was, then move it into the dialog.
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.focus();

    function onKeyDown(e: KeyboardEvent) {
      // `dialog` is captured and never reassigned, but TS doesn't carry the
      // outer non-null narrowing into this closure — re-assert it here.
      if (!dialog) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (nodes.length === 0) {
        // Nothing to tab to — keep focus on the dialog itself.
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // Capture phase so the trap wins even if inner content stops propagation.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  return dialogRef;
}
