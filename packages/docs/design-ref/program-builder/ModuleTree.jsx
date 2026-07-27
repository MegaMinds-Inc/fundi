// Fundi — Module & Lesson tree: the core daily-use builder canvas. Add/reorder
// modules and lessons; select a lesson to edit it in the adjoining panel.
const TYPE_META = {
  text: { icon: 'ph-text-align-left', label: 'Text' },
  video: { icon: 'ph-play-circle', label: 'Video' },
  attachment: { icon: 'ph-paperclip', label: 'Attachment' },
  live_online: { icon: 'ph-video-camera', label: 'Live online' },
  in_person: { icon: 'ph-map-pin', label: 'In-person' },
  quiz: { icon: 'ph-check-square-offset', label: 'Quiz' },
};

function LessonRow({ lesson, active, onSelect, onMove, isFirst, isLast }) {
  const meta = TYPE_META[lesson.type] || TYPE_META.text;
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px 9px 34px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
        background: active ? 'var(--color-accent-primary-soft)' : 'transparent',
      }}
    >
      <i className={'ph ' + meta.icon} style={{ fontSize: 14, color: active ? 'var(--color-accent-primary)' : 'var(--color-text-faint)', flex: 'none' }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? 'var(--color-text-heading)' : 'var(--color-text-body)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lesson.title}
      </span>
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 2, flex: 'none' }}>
        <i onClick={() => !isFirst && onMove(-1)} className="ph ph-caret-up" style={{ fontSize: 12, padding: 4, color: isFirst ? 'var(--color-text-faint)' : 'var(--color-text-muted)', opacity: isFirst ? 0.3 : 1, cursor: isFirst ? 'default' : 'pointer' }} />
        <i onClick={() => !isLast && onMove(1)} className="ph ph-caret-down" style={{ fontSize: 12, padding: 4, color: isLast ? 'var(--color-text-faint)' : 'var(--color-text-muted)', opacity: isLast ? 0.3 : 1, cursor: isLast ? 'default' : 'pointer' }} />
      </div>
    </div>
  );
}

const UNLOCK_OPTIONS = [
  { value: 'immediate', label: 'Immediately' },
  { value: 'after_previous', label: 'After previous module' },
  { value: 'after_days', label: 'Days after enrollment' },
];

function ModuleBlock({ module, index, total, coverStyle, activeLessonId, onSelectLesson, onMoveLesson, onMoveModule, onAddLesson, onRenameModule, onUpdateModule }) {
  const { Tag } = window.FundiDesignSystem_1eab67;
  const [open, setOpen] = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(module.title);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    onRenameModule(trimmed || module.title);
    if (!trimmed) setDraft(module.title);
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => !editing && setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px', cursor: 'pointer', borderRadius: 'var(--radius-md)' }}
      >
        <i className={'ph ph-caret-' + (open ? 'down' : 'right')} style={{ fontSize: 12, color: 'var(--color-text-faint)', flex: 'none' }} />
        {window.ModuleCover && (
          <div style={{ width: 26, height: 26, borderRadius: 7, overflow: 'hidden', flex: 'none' }}>
            <window.ModuleCover coverStyle={coverStyle} seed={index} height={26} />
          </div>
        )}
        {editing ? (
          <input
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(module.title); setEditing(false); } }}
            style={{
              flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5, color: 'var(--color-text-heading)',
              background: 'var(--color-bg-elevated)', border: 'none', outline: 'none', borderRadius: 'var(--radius-sm)', padding: '3px 6px',
              boxShadow: 'inset 0 0 0 1.5px var(--color-accent-primary)',
            }}
          />
        ) : (
          <span
            onClick={(e) => { e.stopPropagation(); setDraft(module.title); setEditing(true); }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5, color: 'var(--color-text-heading)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
            title="Click to rename"
          >
            {module.title}
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-faint)', flex: 'none' }}>{module.lessons.length}</span>
        <span
          onClick={(e) => { e.stopPropagation(); setSettingsOpen((v) => !v); }}
          style={{ cursor: 'pointer', padding: 4, flex: 'none', color: settingsOpen ? 'var(--color-accent-primary)' : 'var(--color-text-faint)' }}
          title="Module settings"
        >
          <i className="ph ph-faders-horizontal" style={{ fontSize: 13 }} />
        </span>
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 2, flex: 'none' }}>
          <i onClick={() => index > 0 && onMoveModule(-1)} className="ph ph-caret-up" style={{ fontSize: 12, padding: 4, opacity: index === 0 ? 0.3 : 1, color: 'var(--color-text-muted)', cursor: index === 0 ? 'default' : 'pointer' }} />
          <i onClick={() => index < total - 1 && onMoveModule(1)} className="ph ph-caret-down" style={{ fontSize: 12, padding: 4, opacity: index === total - 1 ? 0.3 : 1, color: 'var(--color-text-muted)', cursor: index === total - 1 ? 'default' : 'pointer' }} />
        </div>
      </div>
      {settingsOpen && (
        <div style={{ padding: '4px 10px 16px 34px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Description</div>
            <textarea
              value={module.description || ''}
              onChange={(e) => onUpdateModule(module.id, { description: e.target.value })}
              rows={2}
              placeholder="What will learners get from this module?"
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.5, padding: '9px 11px', borderRadius: 'var(--radius-md)', border: 'none', outline: 'none', resize: 'vertical', background: 'var(--color-bg-elevated)', color: 'var(--color-text-heading)' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Unlocks</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {UNLOCK_OPTIONS.map((o) => (
                <Tag
                  key={o.value}
                  selected={(module.unlockMode || 'immediate') === o.value}
                  color={(module.unlockMode || 'immediate') === o.value ? 'green' : 'neutral'}
                  onClick={() => onUpdateModule(module.id, { unlockMode: o.value })}
                >
                  {o.label}
                </Tag>
              ))}
              {module.unlockMode === 'after_days' && (
                <input
                  type="number"
                  min="1"
                  value={module.unlockDays || 3}
                  onChange={(e) => onUpdateModule(module.id, { unlockDays: e.target.value })}
                  style={{ width: 48, fontSize: 12, fontWeight: 600, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: 'none', outline: 'none', background: 'var(--color-bg-elevated)', color: 'var(--color-text-heading)' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
      {open && (
        <React.Fragment>
          {module.lessons.map((l, i) => (
            <LessonRow
              key={l.id}
              lesson={l}
              active={l.id === activeLessonId}
              onSelect={() => onSelectLesson(l.id)}
              onMove={(dir) => onMoveLesson(i, dir)}
              isFirst={i === 0}
              isLast={i === module.lessons.length - 1}
            />
          ))}
          <div
            onClick={onAddLesson}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 34px', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: 11.5 }}
          >
            <i className="ph ph-plus" style={{ fontSize: 12 }} /> Add lesson
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function ModuleTree({ modules, coverStyle, activeLessonId, onSelectLesson, onMoveLesson, onMoveModule, onAddLesson, onAddModule, onRenameModule, onUpdateModule }) {
  const { EmptyState, Button } = window.FundiDesignSystem_1eab67;

  if (modules.length === 0) {
    return (
      <div style={{ padding: '20px 10px' }}>
        <EmptyState
          icon="ph-stack-plus"
          title="Start with your first module"
          body="Modules group related lessons together — add one to begin structuring this program."
        />
        <Button variant="primary" onClick={onAddModule} icon={<i className="ph ph-plus-circle" />} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
          Add module
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {modules.map((m, i) => (
        <ModuleBlock
          key={m.id}
          module={m}
          index={i}
          total={modules.length}
          coverStyle={coverStyle}
          activeLessonId={activeLessonId}
          onSelectLesson={onSelectLesson}
          onMoveLesson={(li, dir) => onMoveLesson(m.id, li, dir)}
          onMoveModule={(dir) => onMoveModule(i, dir)}
          onAddLesson={() => onAddLesson(m.id)}
          onRenameModule={(title) => onRenameModule(m.id, title)}
          onUpdateModule={onUpdateModule}
        />
      ))}
      <div
        onClick={onAddModule}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 10px', cursor: 'pointer', color: 'var(--color-accent-primary)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, marginTop: 6 }}
      >
        <i className="ph ph-plus-circle" style={{ fontSize: 15 }} /> Add module
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') { window.ModuleTree = ModuleTree; window.LESSON_TYPE_META = TYPE_META; }
