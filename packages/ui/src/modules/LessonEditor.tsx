'use client';

import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Tag } from '../components/Tag';
import { Modal } from '../components/Modal';
import { Drawer } from '../components/Drawer';
import { LessonViewer } from './LessonViewer';
import type { LessonType } from './ModuleTree';

/**
 * Fundi — Lesson type editor: fields switch entirely by lesson type. A lesson
 * is one type's payload, not a bag of every type's fields, so switching type
 * clears the previous type's content — with a confirm `Modal` when the current
 * type actually has content. The `live_online` ⇄ `in_person` pair shares the
 * same when/where/notes shape, so toggling between just those two keeps its
 * values. Per-lesson preview opens a `Drawer` rendering `LessonViewer`.
 *
 * Pure / presentational — the app owns the lesson and every edit flows through
 * `onChange(updatedLesson)` (the `AuthFlow`/`ProgramSetup` pattern). Ported from
 * the design (`LessonEditor.jsx`); imports the real DS components instead of the
 * `window.*` globals the snapshot used. Video is embed-only (locked decision)
 * and `quiz` is out of scope.
 *
 * ⚠ DEFERRED: the `attachment` file drop-zone has no backend (no object storage
 * yet — same gap as the cover image). The type is selectable, but the drop-zone
 * renders disabled ("file upload coming soon") so it never implies a working
 * upload. Flag in the report.
 */

export interface EditableLesson {
  id: string;
  title: string;
  type: LessonType;
  /** `text` / `live_online` / `in_person` body copy. */
  body?: string;
  /** `video` — embed URL (embed-only, no hosted upload). */
  videoUrl?: string;
  /** `video` — display duration, e.g. "6:12". */
  duration?: string;
  /** `attachment` — file name (deferred: no upload yet). */
  fileName?: string;
  /** `attachment` — human file size (deferred). */
  fileSize?: string;
  /** `attachment` — file URL (PDF-by-link for now; uploads pending storage). */
  fileUrl?: string;
  /** `live_online` / `in_person` — schedule. */
  when?: string;
  /** `live_online` meeting link / `in_person` location. */
  where?: string;
}

export interface LessonEditorProps {
  /** The lesson to edit, or null/undefined for the no-selection empty state. */
  lesson: EditableLesson | null | undefined;
  /** Parent module title — shown as the eyebrow in the preview drawer. */
  moduleTitle?: string;
  /** Fired on every edit with the full next lesson. */
  onChange: (updatedLesson: EditableLesson) => void;
  /** Fired when the delete (trash) action is pressed. */
  onDelete: () => void;
}

const TYPES: readonly LessonType[] = ['text', 'video', 'attachment', 'live_online', 'in_person'];
const TYPE_LABEL: Record<LessonType, string> = {
  text: 'Text',
  video: 'Video',
  attachment: 'Attachment',
  live_online: 'Live online',
  in_person: 'In-person',
};

const isSchedule = (t: LessonType) => t === 'live_online' || t === 'in_person';

function hasContent(lesson: EditableLesson): boolean {
  switch (lesson.type) {
    case 'text':
      return !!(lesson.body && lesson.body.trim());
    case 'video':
      return !!(lesson.videoUrl || lesson.duration);
    case 'attachment':
      return !!(lesson.fileName || lesson.fileUrl);
    case 'live_online':
    case 'in_person':
      return !!(lesson.when || lesson.where || (lesson.body && lesson.body.trim()));
    default:
      return false;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
      {children}
    </div>
  );
}

function Textarea({
  value,
  onChange,
  rows = 6,
  placeholder,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 13,
        lineHeight: 1.6,
        padding: 14,
        borderRadius: 'var(--radius-md)',
        border: 'none',
        outline: 'none',
        background: 'var(--color-bg-elevated)',
        color: 'var(--color-text-heading)',
        boxShadow: 'inset 0 0 0 1px var(--color-border-subtle)',
      }}
    />
  );
}

export function LessonEditor({ lesson, moduleTitle, onChange, onDelete }: LessonEditorProps) {
  const [pendingType, setPendingType] = useState<LessonType | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!lesson) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 10,
          color: 'var(--color-text-faint)',
          padding: 40,
          textAlign: 'center',
          fontFamily: 'var(--font-body)',
        }}
      >
        <i className="ph ph-cursor-click" style={{ fontSize: 26 }} />
        <div style={{ fontSize: 12.5 }}>Select a lesson to edit it, or add a new one.</div>
      </div>
    );
  }

  // narrowed non-null lesson for closures below
  const current = lesson;

  function set<K extends keyof EditableLesson>(key: K, val: EditableLesson[K]) {
    onChange({ ...current, [key]: val });
  }

  function applySwitch(newType: LessonType) {
    const keepShared = isSchedule(current.type) && isSchedule(newType);
    onChange({
      id: current.id,
      title: current.title,
      type: newType,
      ...(keepShared ? { when: current.when, where: current.where, body: current.body } : {}),
    });
  }

  function selectType(newType: LessonType) {
    if (newType === current.type) return;
    const keepShared = isSchedule(current.type) && isSchedule(newType);
    if (!keepShared && hasContent(current)) {
      setPendingType(newType);
      return;
    }
    applySwitch(newType);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, maxWidth: 520, fontFamily: 'var(--font-body)' }}>
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
        <>
          <Field label="Embed URL">
            <Input placeholder="https://youtube.com/watch?v=…" value={lesson.videoUrl || ''} onChange={(e) => set('videoUrl', e.target.value)} iconLeft={<i className="ph ph-link" />} />
          </Field>
          <Field label="Duration">
            <Input placeholder="e.g. 6:12" value={lesson.duration || ''} onChange={(e) => set('duration', e.target.value)} />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--color-text-faint)', lineHeight: 1.6 }}>Embed-only for now — hosted upload is pending a technical spike.</div>
        </>
      )}

      {lesson.type === 'attachment' && (
        <>
          {/* PDF-by-link for now: hosted uploads are pending object storage, but
              a public PDF URL renders inline in the lesson + learner view. */}
          <Field label="PDF link (URL)">
            <Input
              placeholder="https://example.com/handout.pdf"
              value={lesson.fileUrl || ''}
              onChange={(e) => set('fileUrl', e.target.value)}
              iconLeft={<i className="ph ph-link" />}
            />
          </Field>
          <Field label="Display name">
            <Input
              placeholder="e.g. Praise & Worship handout.pdf"
              value={lesson.fileName || ''}
              onChange={(e) => set('fileName', e.target.value)}
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--color-text-faint)', lineHeight: 1.6 }}>
            Paste a public PDF link — it renders in the lesson. File uploads are coming with object storage; PDF-by-link only for now.
          </div>
        </>
      )}

      {(lesson.type === 'live_online' || lesson.type === 'in_person') && (
        <>
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
        </>
      )}

      {/* The Drawer stays mounted for its slide transition and is `position:
          absolute`, so it needs a full-viewport, positioned, CLIPPING host —
          otherwise the closed (translated-down) sheet leaks into the editor
          panel's scroll area and shows unbidden. This fixed overlay is that host
          (per Drawer's own "wrap in a full-viewport container" guidance); when
          closed it is click-through and clips the off-screen sheet. */}
      <div
        aria-hidden={!previewOpen}
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          zIndex: 60,
          pointerEvents: previewOpen ? 'auto' : 'none',
        }}
      >
        <Drawer open={previewOpen} title="Learner preview" subtitle={moduleTitle || 'Module'} onClose={() => setPreviewOpen(false)} heightPercent="92%">
          <LessonViewer
            lesson={{
              title: lesson.title,
              type: lesson.type,
              moduleTitle: moduleTitle || 'Module',
              body: lesson.body,
              duration: lesson.duration,
              when: lesson.when,
              where: lesson.where,
              videoUrl: lesson.videoUrl,
              name: lesson.fileName,
              size: lesson.fileSize,
              fileUrl: lesson.fileUrl,
            }}
            onDone={() => {}}
          />
        </Drawer>
      </div>

      <Modal
        open={!!pendingType}
        title="Switch lesson type?"
        onClose={() => setPendingType(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingType(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (pendingType) applySwitch(pendingType);
                setPendingType(null);
              }}
            >
              Switch &amp; discard
            </Button>
          </>
        }
      >
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-body)' }}>
          This lesson has {TYPE_LABEL[lesson.type]} content. Switching to {pendingType && TYPE_LABEL[pendingType]} will discard it — this can&apos;t be undone.
        </div>
      </Modal>
    </div>
  );
}
