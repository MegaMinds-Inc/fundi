'use client';

import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

/**
 * Fundi — program-level draft/publish state. Sits in the builder's top bar.
 * "Preview" opens the learner-facing view in its own tab — a bigger context
 * switch than the in-context per-lesson preview, so it gets a real tab, not an
 * in-place swap that hides the builder underneath it.
 *
 * Pure / presentational — injected-callback pattern (like `AuthFlow`). Ported
 * from the design (`PublishBar.jsx`); imports the real DS `Button`/`Badge`
 * instead of the `window.*` globals the snapshot used.
 *
 * ⚠ Design gap (kept faithfully): the design has **no Unpublish control**, so
 * one is NOT invented here. Unpublish is surfaced elsewhere (program settings).
 */

export type ProgramStatus = 'draft' | 'published';

export interface PublishBarProgram {
  title: string;
  status: ProgramStatus;
}

export interface PublishBarProps {
  program: PublishBarProgram;
  /** `status==='published' && updatedAt > publishedAt` — drives the badge + button copy. */
  hasUnpublishedChanges: boolean;
  /** Autosave indicator; `null`/omitted hides it. */
  saveStatus?: 'saving' | 'saved' | null;
  /** Opens the learner-facing preview (its own tab in the app). */
  onPreview: () => void;
  /** Publish / publish-changes. */
  onPublish: () => void;
  /** Back / exit affordance — returns to program details. */
  onExit: () => void;
}

export function PublishBar({
  program,
  hasUnpublishedChanges,
  saveStatus,
  onPreview,
  onPublish,
  onExit,
}: PublishBarProps) {
  const published = program.status === 'published';
  const badgeTone = !published ? 'draft' : hasUnpublishedChanges ? 'warn' : 'live';
  const badgeLabel = !published
    ? 'Draft'
    : hasUnpublishedChanges
      ? 'Unpublished changes'
      : 'Published';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 22px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-surface)',
        flex: 'none',
        flexWrap: 'wrap',
        rowGap: 10,
        fontFamily: 'var(--font-body)',
      }}
    >
      <button
        type="button"
        onClick={onExit}
        aria-label="Back to program details"
        title="Back to program details"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          flex: 'none',
        }}
      >
        <i className="ph ph-arrow-left" style={{ fontSize: 16 }} />
      </button>

      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 15,
            color: 'var(--color-text-heading)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {program.title || 'Untitled program'}
        </div>
        {saveStatus && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginTop: 2,
              fontSize: 10.5,
              color: 'var(--color-text-faint)',
            }}
          >
            <i
              className={saveStatus === 'saving' ? 'ph ph-circle-notch' : 'ph ph-check'}
              style={{ fontSize: 11 }}
            />
            {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
        <Button
          variant="secondary"
          size="sm"
          onClick={onPreview}
          icon={<i className="ph ph-arrow-square-out" />}
          style={{ whiteSpace: 'nowrap' }}
        >
          Preview
        </Button>
        {!published ? (
          <Button
            variant="primary"
            size="sm"
            onClick={onPublish}
            icon={<i className="ph ph-rocket-launch" />}
            style={{ whiteSpace: 'nowrap' }}
          >
            Publish
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!hasUnpublishedChanges}
            onClick={onPublish}
            icon={<i className="ph ph-arrow-clockwise" />}
            style={{ whiteSpace: 'nowrap' }}
          >
            {hasUnpublishedChanges ? 'Publish changes' : 'Up to date'}
          </Button>
        )}
      </div>
    </div>
  );
}
