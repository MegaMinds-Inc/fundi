/**
 * Generic empty/zero-state pattern — icon circle, heading, optional body copy.
 * Use whenever a list/queue has nothing to show; per brand voice this should
 * read as reassuring confirmation, not a blank/broken screen.
 *
 * `icon` is a Phosphor icon class suffix; the icon font is loaded by the app
 * (see @fundi/ui README — Phosphor via CDN is the substituted set).
 */
export interface EmptyStateProps {
  /** Phosphor icon class suffix, e.g. 'ph-check-circle' (default) */
  icon?: string;
  title: string;
  body?: string;
  /** 'primary' (green icon circle, default) or 'neutral' (muted icon circle) */
  tone?: 'primary' | 'neutral';
}

export function EmptyState({
  icon = 'ph-check-circle',
  title,
  body,
  tone = 'primary',
}: EmptyStateProps) {
  const bg = tone === 'primary' ? 'var(--color-accent-primary-soft)' : 'var(--color-bg-elevated)';
  const fg = tone === 'primary' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '52px 28px',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <i className={'ph ' + icon} style={{ fontSize: 28, color: fg }} />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--color-text-heading)',
        }}
      >
        {title}
      </div>
      {body && (
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'var(--color-text-muted)',
            maxWidth: 260,
          }}
        >
          {body}
        </div>
      )}
    </div>
  );
}
