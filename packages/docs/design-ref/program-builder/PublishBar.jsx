// Fundi — Program-level draft/publish state. Sits in the builder's top bar.
// "Preview" opens the learner-facing view in its own tab — a bigger context
// switch than the in-context per-lesson preview, so it gets a real tab, not
// an in-place swap that hides the builder underneath it.
function PublishBar({ program, hasUnpublishedChanges, saveStatus, onPreview, onPublish, onExit }) {
  const { Button, Badge } = window.FundiDesignSystem_1eab67;
  const badgeTone = program.status !== 'published' ? 'draft' : (hasUnpublishedChanges ? 'warn' : 'live');
  const badgeLabel = program.status !== 'published' ? 'Draft' : (hasUnpublishedChanges ? 'Unpublished changes' : 'Published');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: '1px solid var(--color-border-subtle)',
      background: 'var(--color-bg-surface)', flex: 'none', flexWrap: 'wrap', rowGap: 10,
    }}>
      <div
        onClick={onExit}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: 'var(--color-text-muted)', flex: 'none' }}
        title="Back to program details"
      >
        <i className="ph ph-arrow-left" style={{ fontSize: 16 }} />
      </div>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--color-text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {program.title || 'Untitled program'}
        </div>
        {saveStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 10.5, color: 'var(--color-text-faint)' }}>
            <i className={saveStatus === 'saving' ? 'ph ph-circle-notch' : 'ph ph-check'} style={{ fontSize: 11 }} />
            {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
        <Button variant="secondary" size="sm" onClick={onPreview} icon={<i className="ph ph-arrow-square-out" />} style={{ whiteSpace: 'nowrap' }}>
          Preview
        </Button>
        {program.status !== 'published' ? (
          <Button variant="primary" size="sm" onClick={onPublish} icon={<i className="ph ph-rocket-launch" />} style={{ whiteSpace: 'nowrap' }}>
            Publish
          </Button>
        ) : (
          <Button variant="primary" size="sm" disabled={!hasUnpublishedChanges} onClick={onPublish} icon={<i className="ph ph-arrow-clockwise" />} style={{ whiteSpace: 'nowrap' }}>
            {hasUnpublishedChanges ? 'Publish changes' : 'Up to date'}
          </Button>
        )}
      </div>
    </div>
  );
}

// Read-only learner-facing preview — module cards only (cover, title, lesson
// count, description, unlock state), matching the real Learner app's home
// hierarchy: a learner sees modules first and drills into one to see its
// lessons, they never see every lesson flattened under every module at once.
function LearnerPreview({ program }) {
  function unlockInfo(m, idx) {
    if (idx === 0 || !m.unlockMode || m.unlockMode === 'immediate') return null;
    if (m.unlockMode === 'after_previous') return 'Unlocks after previous module';
    if (m.unlockMode === 'after_days') { const d = m.unlockDays || 3; return `Unlocks in ${d} day${d == 1 ? '' : 's'}`; }
    return null;
  }
  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-body)' }}>
      <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Learner view</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--color-text-heading)', marginBottom: 20 }}>{program.title || 'Untitled program'}</div>
      {program.modules.map((m, i) => {
        const lock = unlockInfo(m, i);
        return (
          <div key={m.id} style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--color-bg-surface)', boxShadow: 'var(--shadow-card)', marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              {window.ModuleCover && <window.ModuleCover coverStyle={program.coverStyle} seed={i} height={84} />}
              {lock && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,12,9,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <i className="ph-fill ph-lock-simple" style={{ fontSize: 18, color: '#fff' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#fff', opacity: 0.85, textAlign: 'center', padding: '0 14px' }}>{lock}</span>
                </div>
              )}
            </div>
            <div style={{ padding: '13px 16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5, color: 'var(--color-text-heading)' }}>{m.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-text-faint)', marginTop: 4 }}>{m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}</div>
              {m.description && <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>{m.description}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

if (typeof window !== 'undefined') { window.PublishBar = PublishBar; window.LearnerPreview = LearnerPreview; }
