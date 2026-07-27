import type { CSSProperties, ReactNode } from 'react';

/**
 * Fundi — shared module-cover generator (ADR-014 generative covers). The creator
 * picks ONE style (gradient or geometric) once for the whole program
 * (`ProgramSetup`); every module then gets its own look deterministically from
 * its position — no per-module effort and no image bytes. Used by the home
 * `ProgramCard`, the builder tree swatch, and the learner-facing preview.
 *
 * Pure / presentational. Ported 1:1 from the design (`ModuleCover.jsx`); keeps
 * the raw base-palette CSS vars so the look flips with the active theme.
 */

export type CoverStyle = 'gradient' | 'geometric';

export interface ModuleCoverProps {
  /** Which generator to use. */
  coverStyle: CoverStyle;
  /** Deterministic seed — the module's position. `idx = seed % 3`. Default 0. */
  seed?: number;
  /** Cover height in px. Default 92. */
  height?: number;
  /** Overlaid content (e.g. a badge). */
  children?: ReactNode;
  /** Extra styles merged onto the cover root. */
  style?: CSSProperties;
}

const GRADIENTS = [
  'radial-gradient(circle at 25% 30%, var(--base-teal-500) 0%, transparent 45%), radial-gradient(circle at 80% 75%, var(--base-green-500) 0%, transparent 50%), var(--base-ink-900)',
  'radial-gradient(circle at 75% 20%, var(--base-green-500) 0%, transparent 40%), radial-gradient(circle at 20% 85%, var(--base-teal-500) 0%, transparent 55%), var(--base-ink-900)',
  'radial-gradient(circle at 50% 100%, var(--base-green-600) 0%, transparent 60%), radial-gradient(circle at 12% 12%, var(--base-teal-500) 0%, transparent 38%), var(--base-ink-900)',
];

interface GeoShape {
  kind: 'square' | 'triangle' | 'circle';
  size: number;
  color: string;
  opacity: number;
  rotate?: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
}

const GEO_SHAPES: GeoShape[][] = [
  [
    { kind: 'square', size: 70, color: 'var(--base-green-500)', opacity: 0.35, rotate: 18, top: -22, left: -14 },
    { kind: 'triangle', size: 64, color: 'var(--base-teal-500)', opacity: 0.3, rotate: 8, bottom: -18, right: 6 },
  ],
  [
    { kind: 'triangle', size: 78, color: 'var(--base-green-500)', opacity: 0.3, rotate: -10, top: -30, left: '20%' },
    { kind: 'square', size: 56, color: 'var(--base-teal-500)', opacity: 0.32, rotate: 38, bottom: -16, right: -10 },
  ],
  [
    { kind: 'circle', size: 60, color: 'var(--base-green-600)', opacity: 0.4, top: 10, left: -18 },
    { kind: 'square', size: 50, color: 'var(--base-teal-500)', opacity: 0.28, rotate: 24, bottom: -14, right: 16 },
  ],
];

function Shape({ shape }: { shape: GeoShape }) {
  const pos: CSSProperties = { position: 'absolute' };
  (['top', 'left', 'right', 'bottom'] as const).forEach((k) => {
    if (shape[k] !== undefined) pos[k] = shape[k];
  });
  if (shape.kind === 'triangle') {
    return (
      <div
        style={{
          ...pos,
          width: 0,
          height: 0,
          borderLeft: shape.size * 0.56 + 'px solid transparent',
          borderRight: shape.size * 0.56 + 'px solid transparent',
          borderBottom: shape.size + 'px solid ' + shape.color,
          opacity: shape.opacity,
          transform: shape.rotate ? 'rotate(' + shape.rotate + 'deg)' : undefined,
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...pos,
        width: shape.size,
        height: shape.size,
        background: shape.color,
        opacity: shape.opacity,
        borderRadius: shape.kind === 'circle' ? '50%' : 12,
        transform: shape.rotate ? 'rotate(' + shape.rotate + 'deg)' : undefined,
      }}
    />
  );
}

export function ModuleCover({ coverStyle, seed = 0, height = 92, children, style }: ModuleCoverProps) {
  const idx = ((seed % 3) + 3) % 3;
  if (coverStyle === 'geometric') {
    return (
      <div style={{ position: 'relative', height, overflow: 'hidden', background: 'var(--base-ink-900)', ...style }}>
        {GEO_SHAPES[idx].map((s, i) => (
          <Shape key={i} shape={s} />
        ))}
        {children}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', background: GRADIENTS[idx], ...style }}>
      {children}
    </div>
  );
}
