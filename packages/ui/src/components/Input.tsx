'use client';

import { useId, useState } from 'react';
import type { ChangeEvent, CSSProperties, ReactNode } from 'react';

export interface InputProps {
  label?: string;
  placeholder?: string;
  helperText?: string;
  /** When set, renders in error state and shows this message instead of helperText */
  error?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Leading icon, inset into the pill */
  iconLeft?: ReactNode;
  /** Trailing icon, inset into the pill (e.g. clear button, chevron) */
  iconRight?: ReactNode;
  /** Trailing circular filled action button (search/submit CTA) that overlaps the pill's edge — mutually exclusive with iconRight */
  actionIcon?: ReactNode;
  onAction?: () => void;
  /** Native input type, e.g. 'tel' for phone-number entry */
  type?: string;
  inputMode?: 'text' | 'tel' | 'numeric' | 'email' | 'search';
  name?: string;
  style?: CSSProperties;
}

export function Input({
  label,
  placeholder,
  helperText,
  error,
  disabled = false,
  value,
  onChange,
  iconLeft,
  iconRight,
  actionIcon,
  onAction,
  type = 'text',
  inputMode,
  name,
  style,
}: InputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);
  const [actionHover, setActionHover] = useState(false);
  const hasAction = !!actionIcon;

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
        <label
          htmlFor={id}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '.07em',
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {iconLeft && (
          <span
            style={{
              position: 'absolute',
              left: 17,
              display: 'flex',
              color: focused ? 'var(--color-accent-primary)' : 'var(--color-text-faint)',
              pointerEvents: 'none',
              transition: 'color 160ms ease',
            }}
          >
            {iconLeft}
          </span>
        )}
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: 600,
            padding: `13px ${hasAction ? 58 : iconRight ? 44 : 19}px 13px ${iconLeft ? 44 : 19}px`,
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            outline: 'none',
            background: focused
              ? 'var(--color-bg-elevated)'
              : hover
                ? 'color-mix(in srgb, var(--color-bg-elevated) 70%, var(--color-bg-surface))'
                : 'var(--color-bg-elevated)',
            color: 'var(--color-text-heading)',
            boxShadow: error
              ? 'inset 0 0 0 1.5px var(--color-status-danger-text)'
              : focused
                ? 'var(--shadow-focus)'
                : hover
                  ? 'inset 0 0 0 1px var(--color-border-strong)'
                  : 'inset 0 0 0 1px transparent',
            opacity: disabled ? 0.5 : 1,
            transition: 'box-shadow 180ms ease, background 180ms ease',
          }}
        />
        {!hasAction && iconRight && (
          <span
            style={{
              position: 'absolute',
              right: 17,
              display: 'flex',
              color: focused ? 'var(--color-accent-primary)' : 'var(--color-text-faint)',
              pointerEvents: 'none',
              transition: 'color 160ms ease',
            }}
          >
            {iconRight}
          </span>
        )}
        {hasAction && (
          <button
            type="button"
            aria-label="Submit"
            onClick={onAction}
            onMouseEnter={() => setActionHover(true)}
            onMouseLeave={() => setActionHover(false)}
            disabled={disabled}
            style={{
              position: 'absolute',
              right: 4,
              top: 4,
              bottom: 4,
              aspectRatio: '1',
              border: 'none',
              borderRadius: '50%',
              background: 'var(--color-accent-primary)',
              color: 'var(--color-text-on-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              boxShadow: actionHover
                ? '0 6px 18px -3px color-mix(in srgb, var(--color-accent-primary) 50%, transparent)'
                : '0 2px 10px -3px color-mix(in srgb, var(--color-accent-primary) 30%, transparent)',
              transform: actionHover ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 180ms cubic-bezier(.4,0,.2,1), box-shadow 220ms ease',
            }}
          >
            {actionIcon}
          </button>
        )}
      </div>
      {(helperText || error) && (
        <span
          // Announce validation errors to assistive tech (plan B.7); helper text
          // stays silent so it isn't read out on every keystroke.
          role={error ? 'alert' : undefined}
          aria-live={error ? 'assertive' : undefined}
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: error ? 'var(--color-status-danger-text)' : 'var(--color-text-faint)',
          }}
        >
          {error || helperText}
        </span>
      )}
    </div>
  );
}
