'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Tabs } from '../components/Tabs';
import { EmptyState } from '../components/EmptyState';
import { ModuleCover } from './ModuleCover';
import type { CoverStyle } from './ModuleCover';

/**
 * Fundi — Creator home: the post-login landing. One primary action only —
 * Create program — since Cohorts/Enrollment need a program to exist first.
 *
 * Presentational + injected callbacks (like `AuthFlow`): the app feeds real
 * `programs` (from `GET /programs`) and wires navigation via `onNewProgram` /
 * `onOpenProgram`. The Cohorts and Needs-you tabs render app-injected slots so
 * the real enrollment/roster and triage content can be passed in — the design's
 * "next up in the build queue" placeholders are only fallbacks when a slot is
 * absent. Ported from `ProgramsHome.jsx`.
 */

export interface ProgramCardData {
  id: string;
  title: string;
  status: 'draft' | 'published';
  coverStyle?: string;
  seed?: number;
  moduleCount: number;
  learnerCount: number;
}

export interface ProgramsHomeProps {
  /** Programs to render as cards. Empty → the EmptyState. */
  programs: ProgramCardData[];
  /** New-program CTA (both the header button and the empty-state action). */
  onNewProgram: () => void;
  /** Card click — opens that program in the builder. */
  onOpenProgram: (id: string) => void;
  /** Sign-out link in the header. Hidden when absent. */
  onSignOut?: () => void;
  /**
   * Real enrollment/roster content for the Cohorts tab (invite/approve/roster).
   * When absent, a placeholder is shown instead — do NOT hardcode the design's
   * placeholder when the app has real content to inject.
   */
  cohortsSlot?: ReactNode;
  /** Real triage content for the Needs-you tab. Falls back to a placeholder. */
  needsYouSlot?: ReactNode;
}

type TabValue = 'programs' | 'cohorts' | 'needs_you';

const placeholderPanel = {
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--color-bg-surface)',
  padding: '72px 30px',
  textAlign: 'center' as const,
  color: 'var(--color-text-faint)',
  fontSize: 12.5,
};

function ProgramCard({
  program,
  onOpen,
}: {
  program: ProgramCardData;
  onOpen: (id: string) => void;
}) {
  const coverStyle: CoverStyle = program.coverStyle === 'geometric' ? 'geometric' : 'gradient';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(program.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(program.id);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        background: 'var(--color-bg-surface)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative' }}>
        <ModuleCover coverStyle={coverStyle} seed={program.seed ?? 0} height={104} />
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Badge tone={program.status === 'published' ? 'live' : 'draft'}>
            {program.status === 'published' ? 'Published' : 'Draft'}
          </Badge>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14.5,
            color: 'var(--color-text-heading)',
          }}
        >
          {program.title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--color-text-faint)',
            marginTop: 5,
          }}
        >
          {program.moduleCount} module{program.moduleCount === 1 ? '' : 's'} ·{' '}
          {program.learnerCount} learner
          {program.learnerCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

export function ProgramsHome({
  programs,
  onNewProgram,
  onOpenProgram,
  onSignOut,
  cohortsSlot,
  needsYouSlot,
}: ProgramsHomeProps) {
  const [tab, setTab] = useState<TabValue>('programs');
  const hasPrograms = programs.length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-canvas)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 90px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 26,
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--color-text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 6,
              }}
            >
              Creator
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 26,
                letterSpacing: '-0.02em',
                color: 'var(--color-text-heading)',
              }}
            >
              Your programs
            </div>
          </div>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--color-accent-primary)',
                padding: '8px 0',
                flex: 'none',
              }}
            >
              Sign out
            </button>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <Tabs
            variant="pill"
            tabs={[
              { value: 'programs', label: 'Programs' },
              { value: 'cohorts', label: 'Cohorts' },
              { value: 'needs_you', label: 'Needs you' },
            ]}
            defaultValue="programs"
            onChange={(v) => setTab(v as TabValue)}
          />
        </div>

        {tab === 'programs' &&
          (hasPrograms ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={onNewProgram}
                  icon={<i className="ph ph-plus" />}
                >
                  New program
                </Button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 18,
                }}
              >
                {programs.map((p) => (
                  <ProgramCard key={p.id} program={p} onOpen={onOpenProgram} />
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--color-bg-surface)',
                padding: '48px 30px',
              }}
            >
              <EmptyState
                icon="ph-stack"
                title="Nothing built yet"
                body="Turn what you teach into a structured program learners move through, delivered mostly over WhatsApp. Start with your first one."
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={onNewProgram}
                  icon={<i className="ph ph-plus" />}
                >
                  Create your first program
                </Button>
              </div>
            </div>
          ))}

        {tab === 'cohorts' &&
          (cohortsSlot !== undefined ? (
            cohortsSlot
          ) : hasPrograms ? (
            <div style={placeholderPanel}>
              Cohort scheduling &amp; roster — next up in the build queue.
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--color-bg-surface)',
                padding: '48px 30px',
              }}
            >
              <EmptyState
                icon="ph-users-three"
                title="No cohorts yet"
                body="Cohorts live inside a program — create a program first, then invite learners into it."
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onNewProgram}
                  icon={<i className="ph ph-plus" />}
                >
                  Create a program
                </Button>
              </div>
            </div>
          ))}

        {tab === 'needs_you' &&
          (needsYouSlot !== undefined ? (
            needsYouSlot
          ) : (
            <div style={placeholderPanel}>
              Nothing needs you right now — the full triage queue lives under Needs You.
            </div>
          ))}
      </div>
    </div>
  );
}
