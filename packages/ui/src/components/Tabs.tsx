'use client';

import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useIsomorphicLayoutEffect } from '../lib/useIsomorphicLayoutEffect';

export interface TabItem {
  label: string;
  value: string;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** pill (default), underline, or boxed — the animated indicator adapts to each */
  variant?: 'pill' | 'underline' | 'boxed';
  style?: CSSProperties;
}

interface VariantConfig {
  trackBg: string;
  trackRadius: CSSProperties['borderRadius'];
  trackPadding: number;
  gap: number;
  indicatorRadius: CSSProperties['borderRadius'];
  indicatorBg: string;
  indicatorInsetY: number;
  indicatorBottomOnly: boolean;
  indicatorGlow: boolean;
  indicatorBorder: string;
  activeColor: string;
  inactiveColor: string;
  tabPadding: string;
}

const VARIANTS: Record<NonNullable<TabsProps['variant']>, VariantConfig> = {
  pill: {
    trackBg: 'var(--color-bg-elevated)',
    trackRadius: 'var(--radius-pill)',
    trackPadding: 4,
    gap: 2,
    indicatorRadius: 'var(--radius-pill)',
    indicatorBg: 'var(--color-accent-primary)',
    indicatorInsetY: 4,
    indicatorBottomOnly: false,
    indicatorGlow: true,
    indicatorBorder: 'none',
    activeColor: 'var(--color-text-on-accent)',
    inactiveColor: 'var(--color-text-muted)',
    tabPadding: '9px 18px',
  },
  underline: {
    trackBg: 'transparent',
    trackRadius: 0,
    trackPadding: 0,
    gap: 22,
    indicatorRadius: 'var(--radius-pill)',
    indicatorBg: 'var(--color-accent-primary)',
    indicatorInsetY: 0,
    indicatorBottomOnly: true,
    indicatorGlow: true,
    indicatorBorder: 'none',
    activeColor: 'var(--color-text-heading)',
    inactiveColor: 'var(--color-text-faint)',
    tabPadding: '8px 2px 13px',
  },
  boxed: {
    trackBg: 'var(--color-bg-elevated)',
    trackRadius: 'var(--radius-md)',
    trackPadding: 4,
    gap: 2,
    indicatorRadius: 'var(--radius-sm)',
    indicatorBg: 'var(--color-bg-surface)',
    indicatorInsetY: 4,
    indicatorBottomOnly: false,
    indicatorGlow: false,
    indicatorBorder: 'inset 0 0 0 1px var(--color-border-strong)',
    activeColor: 'var(--color-text-heading)',
    inactiveColor: 'var(--color-text-muted)',
    tabPadding: '9px 16px',
  },
};

export function Tabs({ tabs, defaultValue, onChange, variant = 'pill', style }: TabsProps) {
  const [active, setActive] = useState<string | undefined>(defaultValue ?? tabs[0]?.value);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });
  const cfg = VARIANTS[variant] ?? VARIANTS.pill;

  useIsomorphicLayoutEffect(() => {
    const el = active ? itemRefs.current[active] : null;
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ left: elRect.left - containerRect.left, width: elRect.width, ready: true });
    }
  }, [active, tabs, variant]);

  function select(v: string) {
    setActive(v);
    onChange?.(v);
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        gap: cfg.gap,
        padding: cfg.trackPadding,
        borderRadius: cfg.trackRadius,
        background: cfg.trackBg,
        boxShadow:
          cfg.trackRadius !== 0 && !cfg.indicatorBottomOnly && variant === 'boxed'
            ? 'inset 0 0 0 1px var(--color-border-subtle)'
            : 'none',
        borderBottom: cfg.indicatorBottomOnly ? '1px solid var(--color-border-subtle)' : 'none',
        fontFamily: 'var(--font-display)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: cfg.indicatorBottomOnly ? 'auto' : cfg.indicatorInsetY,
          bottom: cfg.indicatorBottomOnly ? -1 : cfg.indicatorInsetY,
          height: cfg.indicatorBottomOnly ? 3 : 'auto',
          left: indicator.left,
          width: indicator.width,
          borderRadius: cfg.indicatorRadius,
          background: cfg.indicatorBg,
          boxShadow: cfg.indicatorBottomOnly ? '0 0 0 0' : cfg.indicatorBorder,
          opacity: indicator.ready ? 1 : 0,
          transition:
            'left 260ms cubic-bezier(.4,0,.2,1), width 260ms cubic-bezier(.4,0,.2,1), opacity 200ms ease',
        }}
      >
        {cfg.indicatorGlow && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: cfg.indicatorRadius,
              boxShadow:
                '0 4px 14px -2px color-mix(in srgb, var(--color-accent-primary) 45%, transparent)',
            }}
          />
        )}
      </div>
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <button
            key={t.value}
            type="button"
            ref={(el) => {
              itemRefs.current[t.value] = el;
            }}
            onClick={() => select(t.value)}
            style={{
              position: 'relative',
              zIndex: 1,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12.5,
              padding: cfg.tabPadding,
              borderRadius: cfg.indicatorRadius,
              background: 'transparent',
              color: isActive ? cfg.activeColor : cfg.inactiveColor,
              transition: 'color 220ms ease',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
