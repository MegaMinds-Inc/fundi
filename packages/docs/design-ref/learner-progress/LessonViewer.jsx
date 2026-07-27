// Fundi — Lesson content viewer, per type. Since WhatsApp never carries
// lesson content, this is where every lesson type actually gets consumed:
// text reader, embedded video, attachment/file, live/in-person details.
function TextLesson({ body }) {
  return <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text-body)' }}>{body}</div>;
}

function VideoLesson({ duration }) {
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-bg-elevated)', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <i className="ph-fill ph-play-circle" style={{ fontSize: 44, color: 'var(--color-text-on-accent)', opacity: 0.9 }} />
      <span style={{ position: 'absolute', bottom: 10, right: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '2px 7px', borderRadius: 6 }}>{duration}</span>
    </div>
  );
}

function AttachmentLesson({ name, size }) {
  const { Card, Button } = window.FundiDesignSystem_1eab67;
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <i className="ph ph-file-pdf" style={{ fontSize: 26, color: 'var(--color-accent-teal)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-heading)' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>{size}</div>
        </div>
        <Button size="sm" variant="secondary" icon={<i className="ph ph-download-simple" />} iconOnly aria-label="Download" />
      </div>
    </Card>
  );
}

function LiveLesson({ when, where }) {
  const { Badge } = window.FundiDesignSystem_1eab67;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
      <Badge tone="draft" style={{ alignSelf: 'flex-start' }}>Live session</Badge>
      <div style={{ fontSize: 13, color: 'var(--color-text-heading)', fontWeight: 600 }}>{when}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{where}</div>
    </div>
  );
}

function LessonViewer({ lesson, onDone }) {
  const { Button } = window.FundiDesignSystem_1eab67;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-accent-primary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{lesson.moduleTitle}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--color-text-heading)', marginTop: 4 }}>{lesson.title}</div>
      </div>
      {lesson.type === 'text' && <TextLesson body={lesson.body} />}
      {lesson.type === 'video' && <VideoLesson duration={lesson.duration} />}
      {lesson.type === 'attachment' && <AttachmentLesson name={lesson.name} size={lesson.size} />}
      {(lesson.type === 'live_online' || lesson.type === 'in_person') && <LiveLesson when={lesson.when} where={lesson.where} />}
      <Button variant="primary" onClick={onDone}>Mark done</Button>
    </div>
  );
}

if (typeof window !== 'undefined') { window.LessonViewer = LessonViewer; }
