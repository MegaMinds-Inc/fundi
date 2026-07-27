// Fundi — Lesson type editor: fields switch entirely by lesson type. Video
// hosting is embed-only for MVP (per BRD "confirm video hosting" spike —
// design assumes embed URL, flagged as dependent on that spike's outcome).
function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
      {children}
    </div>
  );
}

function Textarea({ value, onChange, rows = 6, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-body)', fontWeight: 500,
        fontSize: 13, lineHeight: 1.6, padding: 14, borderRadius: 'var(--radius-md)', border: 'none', outline: 'none',
        background: 'var(--color-bg-elevated)', color: 'var(--color-text-heading)', boxShadow: 'inset 0 0 0 1px var(--color-border-subtle)',
      }}
    />
  );
}

function hasContent(lesson) {
  switch (lesson.type) {
    case 'text': return !!(lesson.body && lesson.body.trim());
    case 'video': return !!(lesson.videoUrl || lesson.duration);
    case 'attachment': return !!lesson.fileName;
    case 'live_online': case 'in_person': return !!(lesson.when || lesson.where || (lesson.body && lesson.body.trim()));
    default: return false;
  }
}

function LessonEditor({ lesson, moduleTitle, onChange, onDelete }) {
  const { Input, Button, Tag, Modal, Drawer } = window.FundiDesignSystem_1eab67;
  const [pendingType, setPendingType] = React.useState(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  if (!lesson) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--color-text-faint)', padding: 40, textAlign: 'center' }}>
        <i className="ph ph-cursor-click" style={{ fontSize: 26 }} />
        <div style={{ fontSize: 12.5 }}>Select a lesson to edit it, or add a new one.</div>
      </div>
    );
  }

  function set(key, val) { onChange({ ...lesson, [key]: val }); }

  // A lesson is one type's payload, not a bag of every type's fields — switching
  // type clears the previous type's content so nothing orphaned lingers in the
  // record. Live online <-> in-person share the same when/where/notes shape, so
  // that pair keeps its values when toggling between just those two. If the
  // current type actually has content, confirm before discarding it.
  function applySwitch(newType) {
    const bothSchedule = (t) => t === 'live_online' || t === 'in_person';
    const keepShared = bothSchedule(lesson.type) && bothSchedule(newType);
    onChange({
      id: lesson.id,
      title: lesson.title,
      type: newType,
      ...(keepShared ? { when: lesson.when, where: lesson.where, body: lesson.body } : {}),
    });
  }

  function selectType(newType) {
    if (newType === lesson.type) return;
    const bothSchedule = (t) => t === 'live_online' || t === 'in_person';
    const keepShared = bothSchedule(lesson.type) && bothSchedule(newType);
    if (!keepShared && hasContent(lesson)) { setPendingType(newType); return; }
    applySwitch(newType);
  }

  const TYPES = ['text', 'video', 'attachment', 'live_online', 'in_person'];
  const TYPE_LABEL = { text: 'Text', video: 'Video', attachment: 'Attachment', live_online: 'Live online', in_person: 'In-person' };
  const TYPE_ICON = { text: 'ph-text-align-left', video: 'ph-play-circle', attachment: 'ph-paperclip', live_online: 'ph-video-camera', in_person: 'ph-map-pin' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, maxWidth: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
        <Input label="Lesson title" value={lesson.title} onChange={(e) => set('title', e.target.value)} style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <Button variant="secondary" size="sm" iconOnly aria-label="Preview this lesson" onClick={() => setPreviewOpen(true)} icon={<i className="ph ph-eye" />} />
          <Button variant="secondary" size="sm" iconOnly aria-label="Delete lesson" onClick={onDelete} icon={<i className="ph ph-trash" />} />
        </div>
      </div>

      <Field label="Type">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TYPES.map((t) => (
            <Tag key={t} selected={lesson.type === t} color={lesson.type === t ? 'green' : 'neutral'} onClick={() => selectType(t)}>
              {TYPE_LABEL[t]}
            </Tag>
          ))}
        </div>
      </Field>

      {lesson.type === 'text' && (
        <Field label="Body">
          <Textarea value={lesson.body || ''} onChange={(e) => set('body', e.target.value)} placeholder="Write the lesson content…" />
        </Field>
      )}

      {lesson.type === 'video' && (
        <React.Fragment>
          <Field label="Embed URL">
            <Input placeholder="https://youtube.com/watch?v=…" value={lesson.videoUrl || ''} onChange={(e) => set('videoUrl', e.target.value)} iconLeft={<i className="ph ph-link" />} />
          </Field>
          <Field label="Duration">
            <Input placeholder="e.g. 6:12" value={lesson.duration || ''} onChange={(e) => set('duration', e.target.value)} />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--color-text-faint)', lineHeight: 1.6 }}>Embed-only for now — hosted upload is pending a technical spike.</div>
        </React.Fragment>
      )}

      {lesson.type === 'attachment' && (
        <Field label="File">
          <div style={{
            border: '1.5px dashed var(--color-border-strong)', borderRadius: 'var(--radius-lg)', padding: '22px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)',
          }}>
            <i className="ph ph-upload-simple" style={{ fontSize: 20 }} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>{lesson.fileName || 'Drop a file, or click to browse'}</div>
            {lesson.fileName && <div style={{ fontSize: 10.5, color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>{lesson.fileSize || ''}</div>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-faint)', lineHeight: 1.6, marginTop: 8 }}>PDF, DOCX or PPT. Keep it under 5MB where you can — learners on slower connections may not download larger files.</div>
        </Field>
      )}

      {(lesson.type === 'live_online' || lesson.type === 'in_person') && (
        <React.Fragment>
          <Field label="When">
            <Input placeholder="Thursday, 6:00 PM WAT" value={lesson.when || ''} onChange={(e) => set('when', e.target.value)} iconLeft={<i className="ph ph-calendar" />} />
          </Field>
          <Field label={lesson.type === 'live_online' ? 'Meeting link' : 'Location'}>
            <Input
              placeholder={lesson.type === 'live_online' ? 'Zoom / Google Meet link' : 'Address or venue name'}
              value={lesson.where || ''}
              onChange={(e) => set('where', e.target.value)}
              iconLeft={<i className={lesson.type === 'live_online' ? 'ph ph-video-camera' : 'ph ph-map-pin'} />}
            />
          </Field>
          <Field label="Notes">
            <Textarea rows={4} value={lesson.body || ''} onChange={(e) => set('body', e.target.value)} placeholder="Anything learners should prep or bring…" />
          </Field>
        </React.Fragment>
      )}

      {Drawer && (
        <Drawer open={previewOpen} title="Learner preview" subtitle={moduleTitle || 'Module'} onClose={() => setPreviewOpen(false)} heightPercent="92%">
          {window.LessonViewer ? (
            <window.LessonViewer
              lesson={{ ...lesson, moduleTitle: moduleTitle || 'Module', name: lesson.fileName, size: lesson.fileSize }}
              onDone={() => {}}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--color-text-faint)' }}>Preview unavailable.</div>
          )}
        </Drawer>
      )}

      {Modal && (
        <Modal
          open={!!pendingType}
          title="Switch lesson type?"
          onClose={() => setPendingType(null)}
          footer={(
            <React.Fragment>
              <Button variant="secondary" size="sm" onClick={() => setPendingType(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => { applySwitch(pendingType); setPendingType(null); }}>Switch &amp; discard</Button>
            </React.Fragment>
          )}
        >
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-body)' }}>
            This lesson has {TYPE_LABEL[lesson.type]} content. Switching to {pendingType && TYPE_LABEL[pendingType]} will discard it — this can't be undone.
          </div>
        </Modal>
      )}
    </div>
  );
}

if (typeof window !== 'undefined') { window.LessonEditor = LessonEditor; }
