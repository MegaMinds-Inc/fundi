# Shared utilities — build this first

Cross-cutting data/logic that multiple composite modules depend on. Not a visual component; no
Storybook story of its own, but every module that imports it should demonstrate it working via
their own stories.

---

## Task: Port `SIGNAL_META` to `packages/types` (or `packages/ui`)

**Blocks:** `SignalBadge`, `FilterSortBar`, `ExceptionCard` (all in `creator-triage-queue.md`).

**What it is:** The design handoff's `ui_kits/shared/signals.js` defines a metadata map keyed by
the 5 ADR-010 Signal types (`lesson_overdue`, `reminder_unacknowledged`, `quiz_failed`,
`help_requested`, `went_quiet`), each with a display `label`, a Phosphor `icon` name, and a Badge
`tone`. In the handoff it's a plain browser global (`window.SIGNAL_META`); that pattern doesn't
belong in a typed monorepo.

**Source (handoff, verbatim):**
```js
const SIGNAL_META = {
  lesson_overdue: { label: 'Lesson overdue', icon: 'ph-calendar-x', tone: 'warn' },
  reminder_unacknowledged: { label: 'Reminder unacknowledged', icon: 'ph-bell-simple-slash', tone: 'warn' },
  quiz_failed: { label: 'Quiz failed', icon: 'ph-x-circle', tone: 'danger' },
  help_requested: { label: 'Asked for help', icon: 'ph-hand-waving', tone: 'draft' },
  went_quiet: { label: 'Went quiet', icon: 'ph-moon-stars', tone: 'neutral' },
};
```

**Where it should live — decide between two options:**
1. **`packages/types/src/signal-meta.ts`**, alongside the existing `SignalType` enum
   (`packages/types/src/signal-type.ts`) — keeps it next to the type it describes, but pulls a
   UI-layer concept (Badge tone, icon name) into a package that's currently pure domain
   types/enums with no UI dependency.
2. **`packages/ui/src/signal-meta.ts`** — keeps UI-flavored metadata (tone, icon) in the UI
   package where `Badge`'s tone values are actually defined, importing `SignalType` from
   `@fundi/types` for the key type. **Recommended** — `Badge`'s tone union
   (`live`/`draft`/`warn`/`danger`/`neutral`) is defined in `packages/ui`, and `SIGNAL_META`'s
   `tone` field must stay a subtype of it; co-locating avoids a cross-package type that has to
   track two files in sync.

**Do:**
- Typed as `Record<SignalType, { label: string; icon: string; tone: BadgeProps['tone'] }>` (or a
  narrower tone union if `Badge`'s isn't directly importable) — this makes it a compile error if a
  new `SignalType` is added to `packages/types` without a matching `SIGNAL_META` entry, catching
  exactly the kind of drift `packages/api`'s `TENANT_SCOPED_MODELS stays in sync with the schema`
  test already guards against for Prisma models.
- Export both the map and a small `getSignalMeta(signal: SignalType)` helper with the same
  "fallback to neutral tone + `ph-info` icon if unrecognized" behavior the handoff's `SignalBadge`
  had inline — move that defensive fallback here so every consumer gets it for free.

**Acceptance criteria:**
- [ ] All 5 `SignalType` values have a `SIGNAL_META` entry; a TypeScript error (not just a runtime
      fallback) if a 6th `SignalType` is ever added without a matching entry.
- [ ] `getSignalMeta()` returns the documented neutral/`ph-info` fallback for an unrecognized key,
      covered by a unit test (mirrors the pattern already established in
      `apps/api/src/prisma/org-scope.test.ts`).
- [ ] No `window.SIGNAL_META` global anywhere in the built output.
