'use client';

import { ModuleCover } from './ModuleCover';
import type { CoverStyle } from './ModuleCover';
import type { UnlockMode } from './ModuleTree';

/**
 * Fundi — read-only learner-facing preview. Module cards only (cover, title,
 * lesson count, description, unlock state), matching the real Learner app's home
 * hierarchy: a learner sees modules first and drills into one to see its
 * lessons — they never see every lesson flattened under every module at once.
 *
 * Pure / presentational. Ported from the design (`PublishBar.jsx` → the
 * `LearnerPreview` half); imports the real `ModuleCover` instead of the
 * `window.ModuleCover` global the snapshot used.
 *
 * ⚠ ADR-014 fix (the vendored design omits it): `hidden` modules
 * (`unlockMode === 'hidden'`) are **invisible to learners** and are filtered out
 * before render — the snapshot rendered every module. The lock overlay is kept
 * for `after_previous` / `after_days`; the first *visible* module and
 * `immediate` modules render with no lock. Because filtering happens first, the
 * "first module" (unlocked) is the first *visible* one, not the raw index 0.
 */

export interface LearnerPreviewModule {
  id: string;
  title: string;
  description?: string;
  unlockMode?: UnlockMode;
  /** Days for `after_days`. Default 3. */
  unlockDays?: number;
  lessons: { id: string }[];
}

export interface LearnerPreviewProgram {
  title: string;
  coverStyle: CoverStyle;
  modules: LearnerPreviewModule[];
}

export interface LearnerPreviewProps {
  program: LearnerPreviewProgram;
}

/** Lock caption for a *visible* module at visible position `idx`; `null` = unlocked. */
function unlockInfo(m: LearnerPreviewModule, idx: number): string | null {
  if (idx === 0 || !m.unlockMode || m.unlockMode === 'immediate') return null;
  if (m.unlockMode === 'after_previous') return 'Unlocks after previous module';
  if (m.unlockMode === 'after_days') {
    const d = m.unlockDays || 3;
    return `Unlocks in ${d} day${d === 1 ? '' : 's'}`;
  }
  return null;
}

export function LearnerPreview({ program }: LearnerPreviewProps) {
  // ADR-014: hidden modules don't exist for a learner — drop them before indexing.
  const visible = program.modules.filter((m) => m.unlockMode !== 'hidden');

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-body)' }}>
      <div
        style={{
          fontSize: 10.5,
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          marginBottom: 6,
        }}
      >
        Learner view
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 20,
          color: 'var(--color-text-heading)',
          marginBottom: 20,
        }}
      >
        {program.title || 'Untitled program'}
      </div>
      {visible.map((m, i) => {
        const lock = unlockInfo(m, i);
        return (
          <div
            key={m.id}
            style={{
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              background: 'var(--color-bg-surface)',
              boxShadow: 'var(--shadow-card)',
              marginBottom: 14,
            }}
          >
            <div style={{ position: 'relative' }}>
              <ModuleCover coverStyle={program.coverStyle} seed={i} height={84} />
              {lock && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(6,12,9,0.55)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <i className="ph-fill ph-lock-simple" style={{ fontSize: 18, color: '#fff' }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9.5,
                      color: '#fff',
                      opacity: 0.85,
                      textAlign: 'center',
                      padding: '0 14px',
                    }}
                  >
                    {lock}
                  </span>
                </div>
              )}
            </div>
            <div style={{ padding: '13px 16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5, color: 'var(--color-text-heading)' }}>{m.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-text-faint)', marginTop: 4 }}>
                {m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}
              </div>
              {m.description && (
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>{m.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
