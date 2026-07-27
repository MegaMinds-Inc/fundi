'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '../components/Button';
import { Tag } from '../components/Tag';
import { EmptyState } from '../components/EmptyState';
import { ModuleCover } from './ModuleCover';
import type { CoverStyle } from './ModuleCover';

/**
 * Fundi — Module & Lesson tree: the core daily-use builder canvas. Add and
 * reorder modules and lessons (caret up/down `/move`, not drag-and-drop —
 * locked decision), rename a module inline, open a per-module settings panel
 * (description + unlock/visibility), and select a lesson to edit it in the
 * adjoining `LessonEditor`.
 *
 * Pure / presentational — the app owns the module array and every mutation
 * happens through the injected callbacks (the `AuthFlow`/`ProgramSetup`
 * pattern). Ported from the design (`ModuleTree.jsx`); imports the real DS
 * components instead of the `window.*` globals the design snapshot used.
 *
 * ⚠ DEVIATION from the vendored source: the design's `UNLOCK_OPTIONS` only
 * covered the timing modes (`immediate`/`after_previous`/`after_days`). ADR-014
 * makes `hidden` a valid `unlockMode` (module visibility gate — PublishBar and
 * slice-3 depend on it), so a distinct "Hidden" control was added to the unlock
 * row (amber pill + eye-slash icon, separated from the green timing pills) plus
 * a hidden indicator on the module header. See the report for detail.
 */

export type LessonType = 'text' | 'video' | 'attachment' | 'live_online' | 'in_person';

/** `unlockMode` values — timing modes plus the ADR-014 `hidden` visibility gate. */
export type UnlockMode = 'immediate' | 'after_previous' | 'after_days' | 'hidden';

export interface ModuleTreeLesson {
  id: string;
  title: string;
  type: LessonType;
}

export interface ModuleTreeModule {
  id: string;
  title: string;
  lessons: ModuleTreeLesson[];
  description?: string;
  unlockMode?: UnlockMode;
  /** Days-after-enrollment for `unlockMode: 'after_days'`. String or number (the raw input value). */
  unlockDays?: number | string;
}

/** Partial applied to a module — description / unlockMode / unlockDays. */
export type ModulePatch = Partial<Pick<ModuleTreeModule, 'description' | 'unlockMode' | 'unlockDays'>>;

export interface ModuleTreeProps {
  modules: ModuleTreeModule[];
  /** Program-wide cover style, used for each module's swatch. */
  coverStyle: CoverStyle;
  /** The lesson currently open in the editor (highlighted). */
  activeLessonId?: string | null;
  onSelectLesson: (lessonId: string) => void;
  /** Reorder a lesson within its module. `dir` is -1 (up) or 1 (down). */
  onMoveLesson: (moduleId: string, lessonIdx: number, dir: -1 | 1) => void;
  /** Reorder a module within the program. `dir` is -1 (up) or 1 (down). */
  onMoveModule: (idx: number, dir: -1 | 1) => void;
  onAddLesson: (moduleId: string) => void;
  onAddModule: () => void;
  onRenameModule: (moduleId: string, title: string) => void;
  onUpdateModule: (moduleId: string, patch: ModulePatch) => void;
}

const TYPE_META: Record<LessonType, { icon: string; label: string }> = {
  text: { icon: 'ph-text-align-left', label: 'Text' },
  video: { icon: 'ph-play-circle', label: 'Video' },
  attachment: { icon: 'ph-paperclip', label: 'Attachment' },
  live_online: { icon: 'ph-video-camera', label: 'Live online' },
  in_person: { icon: 'ph-map-pin', label: 'In-person' },
};

/** Timing-only unlock modes — the `hidden` visibility gate is a distinct control. */
const UNLOCK_OPTIONS: readonly { value: Exclude<UnlockMode, 'hidden'>; label: string }[] = [
  { value: 'immediate', label: 'Immediately' },
  { value: 'after_previous', label: 'After previous module' },
  { value: 'after_days', label: 'Days after enrollment' },
] as const;

const uppercaseLabel = {
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '.06em',
  marginBottom: 6,
};

interface LessonRowProps {
  lesson: ModuleTreeLesson;
  active: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}

function LessonRow({ lesson, active, onSelect, onMove, isFirst, isLast }: LessonRowProps) {
  const meta = TYPE_META[lesson.type] || TYPE_META.text;
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px 9px 34px',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        background: active ? 'var(--color-accent-primary-soft)' : 'transparent',
      }}
    >
      <i
        className={'ph ' + meta.icon}
        style={{ fontSize: 14, color: active ? 'var(--color-accent-primary)' : 'var(--color-text-faint)', flex: 'none' }}
      />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: active ? 'var(--color-text-heading)' : 'var(--color-text-body)',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {lesson.title}
      </span>
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 2, flex: 'none' }}>
        <i
          onClick={() => !isFirst && onMove(-1)}
          className="ph ph-caret-up"
          aria-label="Move lesson up"
          style={{ fontSize: 12, padding: 4, color: isFirst ? 'var(--color-text-faint)' : 'var(--color-text-muted)', opacity: isFirst ? 0.3 : 1, cursor: isFirst ? 'default' : 'pointer' }}
        />
        <i
          onClick={() => !isLast && onMove(1)}
          className="ph ph-caret-down"
          aria-label="Move lesson down"
          style={{ fontSize: 12, padding: 4, color: isLast ? 'var(--color-text-faint)' : 'var(--color-text-muted)', opacity: isLast ? 0.3 : 1, cursor: isLast ? 'default' : 'pointer' }}
        />
      </div>
    </div>
  );
}

interface ModuleBlockProps {
  module: ModuleTreeModule;
  index: number;
  total: number;
  coverStyle: CoverStyle;
  activeLessonId?: string | null;
  onSelectLesson: (lessonId: string) => void;
  onMoveLesson: (lessonIdx: number, dir: -1 | 1) => void;
  onMoveModule: (dir: -1 | 1) => void;
  onAddLesson: () => void;
  onRenameModule: (title: string) => void;
  onUpdateModule: (moduleId: string, patch: ModulePatch) => void;
}

function ModuleBlock({
  module,
  index,
  total,
  coverStyle,
  activeLessonId,
  onSelectLesson,
  onMoveLesson,
  onMoveModule,
  onAddLesson,
  onRenameModule,
  onUpdateModule,
}: ModuleBlockProps) {
  const [open, setOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(module.title);

  const unlockMode: UnlockMode = module.unlockMode || 'immediate';
  const hidden = unlockMode === 'hidden';

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    onRenameModule(trimmed || module.title);
    if (!trimmed) setDraft(module.title);
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      setDraft(module.title);
      setEditing(false);
    }
  }

  return (
    <div style={{ marginBottom: 4, opacity: hidden ? 0.72 : 1 }}>
      <div
        onClick={() => !editing && setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px', cursor: 'pointer', borderRadius: 'var(--radius-md)' }}
      >
        <i className={'ph ph-caret-' + (open ? 'down' : 'right')} style={{ fontSize: 12, color: 'var(--color-text-faint)', flex: 'none' }} />
        <div style={{ width: 26, height: 26, borderRadius: 7, overflow: 'hidden', flex: 'none' }}>
          <ModuleCover coverStyle={coverStyle} seed={index} height={26} />
        </div>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onDraftKeyDown}
            aria-label="Module title"
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 12.5,
              color: 'var(--color-text-heading)',
              background: 'var(--color-bg-elevated)',
              border: 'none',
              outline: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 6px',
              boxShadow: 'inset 0 0 0 1.5px var(--color-accent-primary)',
            }}
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setDraft(module.title);
              setEditing(true);
            }}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 12.5,
              color: 'var(--color-text-heading)',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'text',
            }}
            title="Click to rename"
          >
            {module.title}
          </span>
        )}
        {hidden && (
          <i
            className="ph ph-eye-slash"
            title="Hidden from learners"
            aria-label="Hidden from learners"
            style={{ fontSize: 13, color: 'var(--base-amber-500)', flex: 'none' }}
          />
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-faint)', flex: 'none' }}>{module.lessons.length}</span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen((v) => !v);
          }}
          role="button"
          aria-label="Module settings"
          aria-expanded={settingsOpen}
          style={{ cursor: 'pointer', padding: 4, flex: 'none', color: settingsOpen ? 'var(--color-accent-primary)' : 'var(--color-text-faint)' }}
          title="Module settings"
        >
          <i className="ph ph-faders-horizontal" style={{ fontSize: 13 }} />
        </span>
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 2, flex: 'none' }}>
          <i
            onClick={() => index > 0 && onMoveModule(-1)}
            className="ph ph-caret-up"
            aria-label="Move module up"
            style={{ fontSize: 12, padding: 4, opacity: index === 0 ? 0.3 : 1, color: 'var(--color-text-muted)', cursor: index === 0 ? 'default' : 'pointer' }}
          />
          <i
            onClick={() => index < total - 1 && onMoveModule(1)}
            className="ph ph-caret-down"
            aria-label="Move module down"
            style={{ fontSize: 12, padding: 4, opacity: index === total - 1 ? 0.3 : 1, color: 'var(--color-text-muted)', cursor: index === total - 1 ? 'default' : 'pointer' }}
          />
        </div>
      </div>
      {settingsOpen && (
        <div style={{ padding: '4px 10px 16px 34px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={uppercaseLabel}>Description</div>
            <textarea
              value={module.description || ''}
              onChange={(e) => onUpdateModule(module.id, { description: e.target.value })}
              rows={2}
              placeholder="What will learners get from this module?"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                lineHeight: 1.5,
                padding: '9px 11px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-heading)',
              }}
            />
          </div>
          <div>
            <div style={uppercaseLabel}>Unlocks</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {UNLOCK_OPTIONS.map((o) => (
                <Tag
                  key={o.value}
                  selected={unlockMode === o.value}
                  color={unlockMode === o.value ? 'green' : 'neutral'}
                  onClick={() => onUpdateModule(module.id, { unlockMode: o.value })}
                >
                  {o.label}
                </Tag>
              ))}
              {unlockMode === 'after_days' && (
                <input
                  type="number"
                  min={1}
                  value={module.unlockDays ?? 3}
                  onChange={(e) => onUpdateModule(module.id, { unlockDays: e.target.value })}
                  aria-label="Days after enrollment"
                  style={{
                    width: 48,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    outline: 'none',
                    background: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-heading)',
                  }}
                />
              )}
              {/* ADR-014 `hidden` visibility gate — deliberately set apart from the
                  green timing pills above: a divider, an amber hue, and an
                  eye-slash icon signal it gates visibility rather than schedules. */}
              <span aria-hidden style={{ width: 1, height: 18, background: 'var(--color-border-subtle)', margin: '0 2px' }} />
              <Tag
                selected={hidden}
                color={hidden ? 'amber' : 'neutral'}
                onClick={() => onUpdateModule(module.id, { unlockMode: hidden ? 'immediate' : 'hidden' })}
              >
                <i className="ph ph-eye-slash" style={{ fontSize: 12 }} /> Hidden
              </Tag>
            </div>
          </div>
        </div>
      )}
      {open && (
        <>
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
        </>
      )}
    </div>
  );
}

export function ModuleTree({
  modules,
  coverStyle,
  activeLessonId,
  onSelectLesson,
  onMoveLesson,
  onMoveModule,
  onAddLesson,
  onAddModule,
  onRenameModule,
  onUpdateModule,
}: ModuleTreeProps) {
  if (modules.length === 0) {
    return (
      <div style={{ padding: '20px 10px', fontFamily: 'var(--font-body)' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
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
