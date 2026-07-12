'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface ButtonProps {
  /** Button label / content — omit when iconOnly is true */
  children?: ReactNode;
  /** Visual style */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Icon element — the whole button content when iconOnly is true, a leading icon otherwise */
  icon?: ReactNode;
  /** Renders a circular icon-only button (no label) — requires aria-label */
  iconOnly?: boolean;
  'aria-label'?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
}

const SIZE_STYLES: Record<'sm' | 'md' | 'lg', CSSProperties> = {
  sm: { padding: '9px 16px', fontSize: 12.5 },
  md: { padding: '12px 22px', fontSize: 13.5 },
  lg: { padding: '15px 28px', fontSize: 14.5 },
};

const ICON_ONLY_SIZE = { sm: 32, md: 40, lg: 48 } as const;

function variantStyle(
  variant: ButtonProps['variant'],
  hover: boolean,
  disabled: boolean,
): CSSProperties {
  switch (variant) {
    case 'secondary':
      return {
        background: hover && !disabled ? 'var(--color-bg-elevated)' : 'transparent',
        color: 'var(--color-text-heading)',
        boxShadow: 'inset 0 0 0 1.5px var(--color-border-strong)',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--color-accent-primary)',
        padding: 0,
      };
    case 'danger':
      return {
        background: 'var(--color-status-danger-text)',
        color: '#fff',
      };
    case 'primary':
    default:
      return {
        background: 'var(--color-accent-primary)',
        color: 'var(--color-text-on-accent)',
      };
  }
}

function glow(variant: ButtonProps['variant'], hover: boolean, disabled: boolean): string {
  if (disabled || variant !== 'primary') return 'none';
  return hover
    ? '0 8px 20px -5px color-mix(in srgb, var(--color-accent-primary-strong) 32%, transparent)'
    : '0 3px 10px -4px color-mix(in srgb, var(--color-accent-primary-strong) 20%, transparent)';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon = null,
  iconOnly = false,
  'aria-label': ariaLabel,
  onClick,
  type = 'button',
  style,
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;
  const vStyle = variantStyle(variant, hover, disabled);
  const filled = variant === 'primary' || variant === 'danger';
  const isGhost = variant === 'ghost';
  const dim = ICON_ONLY_SIZE[size] ?? ICON_ONLY_SIZE.md;

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-label={iconOnly ? ariaLabel : undefined}
      style={{
        position: 'relative',
        overflow: 'visible',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        justifyContent: iconOnly ? 'center' : undefined,
        border: 'none',
        borderRadius: iconOnly ? '50%' : isGhost ? 0 : 'var(--radius-pill)',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        boxShadow: glow(variant, hover, disabled),
        transform: disabled
          ? 'none'
          : pressed
            ? 'scale(0.96)'
            : hover
              ? 'translateY(-1px)'
              : 'translateY(0)',
        transition:
          'transform 160ms cubic-bezier(.4,0,.2,1), box-shadow 220ms ease, background 160ms ease',
        ...sizeStyle,
        ...vStyle,
        ...(iconOnly ? { width: dim, height: dim, padding: 0 } : {}),
        ...style,
      }}
    >
      {filled && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '55%',
              background:
                'linear-gradient(115deg, transparent, rgba(255,255,255,0.4), transparent)',
              transform: hover && !disabled ? 'translateX(260%)' : 'translateX(-160%)',
              transition: 'transform 700ms cubic-bezier(.22,1,.36,1)',
            }}
          />
        </span>
      )}
      {isGhost && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: -2,
            height: 2,
            width: hover ? '100%' : '0%',
            background: 'currentColor',
            borderRadius: 'var(--radius-pill)',
            transition: 'width 260ms cubic-bezier(.4,0,.2,1)',
          }}
        />
      )}
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: iconOnly ? 0 : 8,
          transform: isGhost && hover ? 'translateX(2px)' : 'translateX(0)',
          transition: 'transform 220ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        {icon}
        {!iconOnly && children}
      </span>
    </button>
  );
}
