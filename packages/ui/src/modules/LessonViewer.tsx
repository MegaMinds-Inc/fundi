'use client';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

/**
 * Fundi — read-only lesson content viewer, rendered per type. Since WhatsApp
 * never carries lesson content, this is where every lesson type actually gets
 * consumed: text reader, embedded video, attachment/file, live/in-person
 * details. Used by the builder's per-lesson preview `Drawer` (`LessonEditor`)
 * and, later, the learner surface.
 *
 * Pure / presentational — no data fetching. Ported from the learner-progress
 * design (`LessonViewer.jsx`); imports the real DS components instead of the
 * `window.*` globals the design snapshot used.
 */

export type LessonViewerType = 'text' | 'video' | 'attachment' | 'live_online' | 'in_person';

export interface LessonViewerLesson {
  title: string;
  type: LessonViewerType;
  /** Uppercase eyebrow above the title — the parent module's name. */
  moduleTitle?: string;
  /** `text` / `live_online` / `in_person` body copy. */
  body?: string;
  /** `video` — display duration, e.g. "6:12". */
  duration?: string;
  /** `video` — embed URL (e.g. a YouTube link); rendered as an inline player when recognisable. */
  videoUrl?: string;
  /** `attachment` — file name. `fileName` is accepted as a fallback. */
  name?: string;
  fileName?: string;
  /** `attachment` — human file size. `fileSize` is accepted as a fallback. */
  size?: string;
  fileSize?: string;
  /** `attachment` — file URL; PDFs are rendered inline. */
  fileUrl?: string;
  /** `live_online` / `in_person` — schedule + place. */
  when?: string;
  where?: string;
}

export interface LessonViewerProps {
  lesson: LessonViewerLesson;
  /** Fired when the learner taps "Mark done". */
  onDone?: () => void;
}

function TextLesson({ body }: { body?: string }) {
  return <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text-body)' }}>{body}</div>;
}

/** Convert a YouTube watch/short/youtu.be link to its `/embed/ID` form (query
 * params like `?si=` stripped). Returns null for anything not recognisably a
 * YouTube URL, so the caller can fall back to a placeholder. */
function youtubeEmbedUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0] || null;
    } else if (host === 'youtube.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        id = u.pathname.split('/')[2] || null;
      }
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

/** True when the file looks like a PDF (by URL or name) — PDF is the only
 * inline-rendered attachment type for now. */
function isPdf(name?: string, url?: string): boolean {
  const s = (url || name || '').toLowerCase().split('?')[0];
  return s.endsWith('.pdf');
}

function VideoLesson({ videoUrl, duration }: { videoUrl?: string; duration?: string }) {
  const embed = youtubeEmbedUrl(videoUrl);
  if (embed) {
    return (
      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: '#000',
          aspectRatio: '16/9',
        }}
      >
        <iframe
          src={embed}
          title="Lesson video"
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  // No recognisable embeddable URL → placeholder (+ duration).
  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-bg-elevated)',
        aspectRatio: '16/9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <i className="ph ph-play-circle" style={{ fontSize: 44, color: 'var(--color-text-muted)', opacity: 0.9 }} />
      {duration && (
        <span
          style={{
            position: 'absolute',
            bottom: 10,
            right: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#fff',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 7px',
            borderRadius: 6,
          }}
        >
          {duration}
        </span>
      )}
    </div>
  );
}

function AttachmentLesson({ name, size, fileUrl }: { name?: string; size?: string; fileUrl?: string }) {
  const label = name || 'Untitled file';
  const pdf = !!fileUrl && isPdf(name, fileUrl);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <i className="ph ph-file-pdf" style={{ fontSize: 26, color: 'var(--color-accent-teal)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-heading)' }}>
              {label}
            </div>
            {size && <div style={{ fontSize: 11, color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>{size}</div>}
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<i className={fileUrl ? 'ph ph-arrow-square-out' : 'ph ph-download-simple'} />}
            iconOnly
            aria-label={fileUrl ? 'Open file in a new tab' : 'Download'}
            disabled={!fileUrl}
            onClick={fileUrl ? () => window.open(fileUrl, '_blank', 'noopener,noreferrer') : undefined}
          />
        </div>
      </Card>
      {pdf && (
        <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
          <iframe
            src={fileUrl}
            title={label}
            style={{ width: '100%', height: 460, border: 0, display: 'block', background: 'var(--color-bg-elevated)' }}
          />
        </div>
      )}
    </div>
  );
}

function LiveLesson({ when, where }: { when?: string; where?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
      }}
    >
      <Badge tone="draft" style={{ alignSelf: 'flex-start' }}>
        Live session
      </Badge>
      <div style={{ fontSize: 13, color: 'var(--color-text-heading)', fontWeight: 600 }}>{when}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{where}</div>
    </div>
  );
}

export function LessonViewer({ lesson, onDone }: LessonViewerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-body)' }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-accent-primary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {lesson.moduleTitle}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: 'var(--color-text-heading)', marginTop: 4 }}>
          {lesson.title}
        </div>
      </div>
      {lesson.type === 'text' && <TextLesson body={lesson.body} />}
      {lesson.type === 'video' && <VideoLesson videoUrl={lesson.videoUrl} duration={lesson.duration} />}
      {lesson.type === 'attachment' && (
        <AttachmentLesson name={lesson.name ?? lesson.fileName} size={lesson.size ?? lesson.fileSize} fileUrl={lesson.fileUrl} />
      )}
      {(lesson.type === 'live_online' || lesson.type === 'in_person') && <LiveLesson when={lesson.when} where={lesson.where} />}
      <Button variant="primary" onClick={onDone}>
        Mark done
      </Button>
    </div>
  );
}
