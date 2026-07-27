'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, CSSProperties, KeyboardEvent } from 'react';
import { usePrefersReducedMotion } from '../lib/use-reduced-motion';

export interface OtpInputProps {
  /** Number of digit boxes. Default 6. */
  length?: number;
  /**
   * Accessible label for the box group — screen readers read the boxes as one
   * field, not N. Default 'One-time code'.
   */
  groupLabel?: string;
  /** Current value — a string of up to `length` digits. Controlled. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once the final box is filled (value reaches `length` digits). */
  onComplete?: (value: string) => void;
  /** Render every box in the error/danger state. */
  error?: boolean;
  disabled?: boolean;
  /** Focus the first box on mount. */
  autoFocus?: boolean;
  /** Base name for the boxes — each box is named `${name}-${i}`. */
  name?: string;
  /**
   * Mask each box as a password dot (`type="password"`) while keeping the
   * numeric keypad (`inputMode="numeric"`). Use for a chosen secret like a PIN;
   * OTP entry (visible, temporary) leaves this false. Default false.
   */
  mask?: boolean;
  /**
   * `autocomplete` value applied to the first box (the OS autofill anchor);
   * remaining boxes stay `off`. Default `'one-time-code'` for OTP. A chosen PIN
   * must pass `'off'` — it is a secret, never an SMS autofill target.
   */
  autoComplete?: string;
}

const BOX_STYLE: CSSProperties = {
  width: 44,
  height: 52,
  textAlign: 'center',
  fontFamily: 'var(--font-mono)',
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--color-text-heading)',
  background: 'var(--color-bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  outline: 'none',
  boxShadow: 'inset 0 0 0 1px var(--color-border-strong)',
  transition: 'box-shadow 160ms ease',
};

/**
 * Reusable N-box one-time-code entry: numeric-only, auto-advance on type,
 * backspace-to-previous, arrow-key navigation, and paste/autofill that spreads
 * a whole code across the boxes. Controlled via `value` (a digit string).
 * `AuthFlow` composes this; it works standalone for any OTP/PIN entry.
 */
export function OtpInput({
  length = 6,
  groupLabel = 'One-time code',
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
  autoFocus = false,
  name = 'otp',
  mask = false,
  autoComplete = 'one-time-code',
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const digits = value.split('').slice(0, length);

  function focusBox(i: number) {
    const clamped = Math.max(0, Math.min(i, length - 1));
    const el = refs.current[clamped];
    el?.focus();
    el?.select();
  }

  function commit(next: string) {
    const cleaned = next.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) onComplete?.(cleaned);
  }

  function fillFrom(startIndex: number, incoming: string) {
    const arr = value.split('');
    const clean = incoming.replace(/\D/g, '');
    for (let k = 0; k < clean.length && startIndex + k < length; k += 1) {
      arr[startIndex + k] = clean[k];
    }
    commit(arr.join(''));
    focusBox(startIndex + clean.length);
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return; // deletions are handled in keydown
    if (raw.length > 1) {
      fillFrom(i, raw); // paste / OTP autofill landing in one box
      return;
    }
    const arr = value.split('');
    arr[i] = raw;
    commit(arr.join(''));
    if (i < length - 1) focusBox(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = value.split('');
      if (arr[i]) {
        arr[i] = '';
        onChange(arr.join(''));
      } else if (i > 0) {
        arr[i - 1] = '';
        onChange(arr.join(''));
        focusBox(i - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(i + 1);
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fillFrom(i, e.clipboardData.getData('text'));
  }

  return (
    <div role="group" aria-label={groupLabel} style={{ display: 'flex', gap: 8 }}>
      {Array.from({ length }).map((_, i) => (
        <input
          // Fixed-length set whose order never changes — a stable index key is correct here.
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          name={`${name}-${i}`}
          type={mask ? 'password' : 'text'}
          inputMode="numeric"
          autoComplete={i === 0 ? autoComplete : 'off'}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={digits[i] ?? ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => {
            setFocused(i);
            e.target.select();
          }}
          onBlur={() => setFocused((f) => (f === i ? null : f))}
          style={{
            ...BOX_STYLE,
            // prefers-reduced-motion (plan B.7): drop the focus-ring transition.
            transition: reduced ? 'none' : BOX_STYLE.transition,
            opacity: disabled ? 0.5 : 1,
            boxShadow: error
              ? 'inset 0 0 0 1.5px var(--color-status-danger-text)'
              : focused === i
                ? 'var(--shadow-focus)'
                : BOX_STYLE.boxShadow,
          }}
        />
      ))}
    </div>
  );
}
