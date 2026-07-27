'use client';

import { OtpInput } from './OtpInput';
import type { OtpInputProps } from './OtpInput';

/**
 * PIN entry — a thin, opinionated preset over {@link OtpInput} for a *chosen*
 * secret (step-up re-auth, PIN setup), as opposed to the temporary SMS code the
 * bare `OtpInput` handles. It hard-wires the secret-appropriate behaviour so no
 * screen can accidentally leak a PIN into browser autofill:
 *
 * - **masked** boxes (`type="password"`, dots) — a PIN is never shown,
 * - **`autoComplete="off"`** — a chosen PIN is *not* an `one-time-code` autofill
 *   target (0010 §12.4/§12.7),
 * - numeric keypad and the same paste/auto-advance/arrow-key mechanics as OTP.
 *
 * `mask` and `autoComplete` are intentionally not overridable here; everything
 * else (length, `groupLabel`, `value`/`onChange`, `onComplete`, `error`,
 * `disabled`, `autoFocus`, `name`) passes straight through. Default length 6 —
 * the minimum PIN length in 0010 §7.3.
 */
export type PinInputProps = Omit<OtpInputProps, 'mask' | 'autoComplete'>;

export function PinInput({ groupLabel = 'PIN', ...props }: PinInputProps) {
  return <OtpInput {...props} groupLabel={groupLabel} mask autoComplete="off" />;
}
