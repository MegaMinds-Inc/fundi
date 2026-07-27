'use client';

import type { CSSProperties } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ModuleCover } from './ModuleCover';
import type { CoverStyle } from './ModuleCover';

/**
 * Fundi — Program creation: title + shape + visibility + cover style (BRD:
 * Program & Curriculum Builder). First step of "idea to published program in
 * one sitting". Shape determines how Enrollment/Scheduling treat the program
 * later; visibility controls whether joining requires creator approval.
 *
 * Controlled — the app owns `value`; UI/validation only, no backend. On
 * Continue the app creates the draft program (POST) then routes to the builder.
 * Ported from the design (`ProgramSetup.jsx`); the `<image-slot>` cover-image
 * upload is deferred (no object storage yet — TDD known gap) and rendered as a
 * disabled "coming soon" affordance. `coverStyle` is the working cover mechanism.
 */

export interface ProgramShapeOption {
  value: string;
  label: string;
  icon: string;
  desc: string;
}

/** Maps 1:1 to the `Program.shape` schema enum. */
export const SHAPES: readonly ProgramShapeOption[] = [
  { value: 'self_paced', label: 'Self-paced', icon: 'ph-fast-forward', desc: 'Learners move through modules on their own schedule.' },
  { value: 'cohort', label: 'Cohort', icon: 'ph-users-three', desc: 'A group moves through the program together, on a schedule.' },
  { value: 'one_to_one', label: 'One-to-one', icon: 'ph-user-focus', desc: 'A single learner, individually mentored.' },
  { value: 'workshop', label: 'Workshop', icon: 'ph-chalkboard-teacher', desc: 'A short, focused live-taught session or series.' },
  { value: 'hybrid', label: 'Hybrid', icon: 'ph-shuffle', desc: 'Mix of self-paced content and scheduled live sessions.' },
] as const;

export interface ProgramVisibilityOption {
  value: string;
  label: string;
  icon: string;
  desc: string;
}

/** Maps 1:1 to the `Program.visibility` schema enum. */
export const VISIBILITIES: readonly ProgramVisibilityOption[] = [
  { value: 'public', label: 'Public', icon: 'ph-globe', desc: 'Anyone with the link can join instantly.' },
  { value: 'private', label: 'Private, approval-gated', icon: 'ph-lock-key', desc: 'Learners request to join; you approve each one.' },
] as const;

const COVER_STYLES: readonly CoverStyle[] = ['gradient', 'geometric'] as const;

export interface ProgramSetupValue {
  title: string;
  shape?: string;
  visibility?: string;
  coverStyle?: string;
}

export interface ProgramSetupProps {
  /** Controlled form value — the app owns this. */
  value: ProgramSetupValue;
  /** Fired on every field change with the full next value. */
  onChange: (value: ProgramSetupValue) => void;
  /** Fired when Continue is pressed (only enabled once title + shape + visibility are set). */
  onContinue: () => void;
}

const sectionLabel: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: 12,
};

export function ProgramSetup({ value, onChange, onContinue }: ProgramSetupProps) {
  const coverStyle: CoverStyle = value.coverStyle === 'geometric' ? 'geometric' : 'gradient';
  const canContinue = !!value.title && !!value.shape && !!value.visibility;

  return (
    <div
      style={{
        maxWidth: 620,
        margin: '0 auto',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        fontFamily: 'var(--font-body)',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-heading)',
            marginBottom: 8,
          }}
        >
          New program
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          Structure your craft into a program, then guide every learner through it.
        </div>
      </div>

      <Input
        label="Program title"
        placeholder="e.g. Copywriting for Creators"
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />

      {/* Cover image — DEFERRED: no object storage yet (TDD known gap). Rendered
          as a disabled "coming soon" affordance; `coverStyle` below is the
          working cover mechanism. */}
      <div>
        <div style={sectionLabel}>Cover image</div>
        <div
          aria-disabled="true"
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 14,
            border: '1.5px dashed var(--color-border-strong)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-faint)',
            opacity: 0.7,
            cursor: 'not-allowed',
            textAlign: 'center',
            padding: 16,
          }}
        >
          <i className="ph ph-image" style={{ fontSize: 26 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            Image upload coming soon
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.5, maxWidth: 320 }}>
            For now, pick a generated module cover below — it applies across the whole program.
          </div>
        </div>
      </div>

      <div>
        <div style={sectionLabel}>Shape</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SHAPES.map((s) => {
            const selected = value.shape === s.value;
            return (
              <div
                key={s.value}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => onChange({ ...value, shape: s.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange({ ...value, shape: s.value });
                  }
                }}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  background: selected ? 'var(--color-accent-primary-soft)' : 'var(--color-bg-surface)',
                  boxShadow: selected
                    ? 'inset 0 0 0 1.5px var(--color-accent-primary)'
                    : 'inset 0 0 0 1px var(--color-border-subtle)',
                }}
              >
                <i
                  className={'ph ' + s.icon}
                  style={{
                    fontSize: 19,
                    color: selected ? 'var(--color-accent-primary)' : 'var(--color-text-faint)',
                    marginTop: 1,
                  }}
                />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-heading)' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={sectionLabel}>Visibility</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {VISIBILITIES.map((v) => {
            const selected = value.visibility === v.value;
            return (
              <div
                key={v.value}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => onChange({ ...value, visibility: v.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange({ ...value, visibility: v.value });
                  }
                }}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  background: selected ? 'var(--color-accent-primary-soft)' : 'var(--color-bg-surface)',
                  boxShadow: selected
                    ? 'inset 0 0 0 1.5px var(--color-accent-primary)'
                    : 'inset 0 0 0 1px var(--color-border-subtle)',
                }}
              >
                <i
                  className={'ph ' + v.icon}
                  style={{ fontSize: 19, color: selected ? 'var(--color-accent-primary)' : 'var(--color-text-faint)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-heading)' }}>
                    {v.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{v.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ ...sectionLabel, marginBottom: 4 }}>Module covers</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)', marginBottom: 12, lineHeight: 1.5 }}>
          Chosen once for the whole program — every module gets its own look automatically, no per-module effort.
        </div>
        <div role="radiogroup" aria-label="Module cover style" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {COVER_STYLES.map((cs) => {
            const selected = coverStyle === cs;
            return (
              <div
                key={cs}
                role="radio"
                tabIndex={0}
                aria-checked={selected}
                aria-label={cs}
                onClick={() => onChange({ ...value, coverStyle: cs })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange({ ...value, coverStyle: cs });
                  }
                }}
                style={{
                  position: 'relative',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  // Selected ring is drawn OUTSIDE the box (a full-bleed
                  // ModuleCover child would paint over an `inset` ring), so the
                  // selection stays visible over the cover image.
                  boxShadow: selected
                    ? '0 0 0 2px var(--color-accent-primary)'
                    : 'inset 0 0 0 1px var(--color-border-subtle)',
                }}
              >
                <ModuleCover coverStyle={cs} seed={0} height={54} />
                {selected && (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--color-accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                    }}
                  >
                    <i className="ph ph-check" style={{ fontSize: 12, fontWeight: 700, color: '#fff' }} />
                  </div>
                )}
                <div
                  style={{
                    padding: '9px 12px',
                    background: selected
                      ? 'var(--color-accent-primary-soft)'
                      : 'var(--color-bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 12,
                      color: selected ? 'var(--color-accent-primary)' : 'var(--color-text-heading)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {cs}
                  </span>
                  {selected && <i className="ph ph-check-circle" style={{ fontSize: 15, color: 'var(--color-accent-primary)' }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button variant="primary" disabled={!canContinue} onClick={onContinue} style={{ width: '100%', justifyContent: 'center' }}>
        Continue to builder
      </Button>
    </div>
  );
}
