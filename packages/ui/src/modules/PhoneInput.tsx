'use client';

import type { CSSProperties } from 'react';
import { Input } from '../components/Input';

/**
 * Default region for local-number entry. The hand-off uses a familiar local
 * format (leading `0`) rather than forcing `+E.164` on users; canonical E.164
 * normalization happens server-side (plan B.2 / D4). Ghana is the launch market
 * (Africa/Accra); change this one constant to re-home the default dial context.
 */
export const DEFAULT_PHONE_REGION = 'GH';
export const DEFAULT_DIAL_CODE = '+233';

export interface PhoneInputProps {
  /** Raw entered value (light-grouped local digits, e.g. "080 123 4567"). Controlled. */
  value: string;
  /** Fires with the raw entered value — server owns E.164 normalization. */
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  /** Error message — puts the field in the danger state. */
  error?: string;
  disabled?: boolean;
  /** ISO 3166-1 alpha-2 region shown in the leading affordance. Default 'GH'. */
  regionCode?: string;
  /** Dial code shown in the leading affordance. Default '+233'. */
  dialCode?: string;
  name?: string;
  style?: CSSProperties;
}

/** Two-letter region code → flag emoji (regional-indicator symbols). */
function regionFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => base + c.charCodeAt(0) - 65),
  );
}

/**
 * Light 3-3-N grouping so typed digits stay readable ("080 123 4567") without
 * imposing a strict mask — purely cosmetic. Digits are capped at 12 (longest
 * plausible national number); the leading `0` is preserved as users expect.
 */
function groupDigits(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 12);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/**
 * Friendly phone-number entry (plan B.2 / D1). Composes `Input`, prefixes a
 * dial-code/region affordance (default GH · +233), and applies light as-you-type
 * grouping. It does **formatting only** — the emitted value is the raw local
 * number the user typed; the server normalizes to canonical E.164. Sprint 2
 * enrollment reuses this so the friendly local entry never regresses.
 */
export function PhoneInput({
  value,
  onChange,
  label = 'Phone number',
  placeholder = '080 123 4567',
  helperText,
  error,
  disabled = false,
  regionCode = DEFAULT_PHONE_REGION,
  dialCode = DEFAULT_DIAL_CODE,
  name,
  style,
}: PhoneInputProps) {
  const flag = regionFlag(regionCode);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        fontFamily: 'var(--font-body)',
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '.07em',
          }}
        >
          {label}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div
          aria-label={`${regionCode} country code ${dialCode}`}
          title={`${regionCode} · ${dialCode}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            height: 44,
            padding: '0 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-bg-elevated)',
            boxShadow: 'inset 0 0 0 1px var(--color-border-strong)',
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--color-text-heading)',
            opacity: disabled ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {flag && (
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
              {flag}
            </span>
          )}
          <span>{dialCode}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input
            type="tel"
            inputMode="tel"
            name={name}
            placeholder={placeholder}
            value={value}
            error={error}
            helperText={helperText}
            disabled={disabled}
            onChange={(e) => onChange(groupDigits(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
