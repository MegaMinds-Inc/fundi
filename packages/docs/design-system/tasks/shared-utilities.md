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

---

## Shared primitives & compositions (build early — used across ≥2 pages)

Small reusable pieces multiple feature modules compose. All live in `packages/ui/src/modules/`
(or `src/components/` if truly primitive), each with a co-located story, exported from the single
`src/index.ts` barrel. A piece living here doesn't have to be full-page — that's the point.

- **`OtpInput`** (C) — ✅ built (`src/modules/OtpInput.tsx`). N-box numeric code entry (auto-advance,
  backspace, arrow-nav, paste/autofill). Extracted from `AuthFlow`; reusable for any code/PIN entry.
- **`MessageComposer`** (C) — textarea + primary send button (+ optional context slot). Props:
  `{ value; onChange; onSend; placeholder?; sendLabel?; disabled? }`. Composes `Button`. Shared by
  `ActionSheet`, `DraftEditor`, `HelpCapture` — the edit-then-send pattern they all repeat. AC: send
  disabled until non-empty (trimmed); story shows empty / typed / disabled.
- **`AvatarInitial`** (P) — initial-in-a-circle avatar. Props: `{ name; size?; tone? }`; derives the
  initial(s) from `name`. Used by `PendingInviteRow`, `RosterRow`. AC: correct initial for 1- and
  2-word names (unit-testable, like `getSignalMeta`); story shows a few names + sizes.
- **`ProgressBar`** (P) — pill-shaped progress bar. Props: `{ percent (0–100); tone? }`. Used by
  `ProgressHome`, `RosterRow`. AC: width clamps at 0 and 100; story at 0 / 40 / 100.
- **`RelativeTime`** (P) — "3h ago" / "2d ago" formatting. Props: `{ minutesAgo?; hoursAgo? }` (pure).
  Used by `ExceptionCard`, `PendingInviteRow`, `DraftCard`, `AuditRow`. AC: minutes/hours/days
  thresholds (unit-testable); story a couple of values.
- **`Fab`** (P) — fixed circular floating action button. Props: `{ icon; onClick; ariaLabel; tone? }`.
  Backs `HelpButton`. AC: fixed-position, keyboard-focusable `<button>`; story in a positioned stage.
- **`Spinner`** (P) — CSS `@keyframes fundi-spin` loader (add the keyframes to `styles.css` /
  `tokens/animation.css` — CSS keyframes can't be inline). Props: `{ size? }`. Used by `VideoLoading`.
  AC: actually animates; story at a couple of sizes.
