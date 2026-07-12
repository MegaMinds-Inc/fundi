# Creator triage queue — "Needs You" (Signals & Attention Triage)

Maps to Sprint 4 (`packages/docs/clickup-sync/sprints/sprint-4-needs-you-attention-triage.md`) and
ADR-010 (Signal stream + rules-based scoring). **Build order:** `shared-utilities.md`'s
`SIGNAL_META` port → `SignalBadge` → `ExceptionCard`/`ActionSheet` (both use `SignalBadge`) →
`FilterSortBar` (independent, can parallelize) → composed page.

---

## Task: Build `SignalBadge` module

**What it is:** Thin wrapper over the base `Badge` component that adds a Phosphor icon + human
label per Signal type — the single place "what does a Signal look like" is defined visually.

**Location:** `packages/ui/src/modules/SignalBadge.tsx`

**Props/API:**
```ts
interface SignalBadgeProps {
  signal: SignalType;   // from @fundi/types
  compact?: boolean;    // default false
}
```

**Composition:** Wraps `Badge`, reading tone from the ported `SIGNAL_META` (see
`shared-utilities.md` — this task is blocked on that one landing first).

**Behavior:** Icon + label rendered inline (gap 5px). `compact` mode: 10.5px font, 12px icon;
normal: 12px font, 13px icon. Unrecognized signal key → neutral tone + `ph-info` icon (this
fallback should live in `getSignalMeta()`, not be re-implemented here).

**Acceptance criteria:**
- [ ] Renders correct icon/label/tone for all 5 `SignalType` values.
- [ ] `compact` prop changes sizing exactly as specified.
- [ ] Storybook story: one instance per `SignalType`, plus one deliberately-invalid key to confirm
      the fallback.

---

## Task: Build `ExceptionCard` module

**What it is:** The core queue unit — a learner surfaced because a Signal fired. Shows who, which
cohort, why (`SignalBadge`), how stale, an optional AI-suggested next action, and two quick-action
buttons.

**Location:** `packages/ui/src/modules/ExceptionCard.tsx`

**Props/API:**
```ts
interface ExceptionCardProps {
  learner: string;
  cohort: string;
  signal: SignalType;
  hoursAgo: number;
  suggestion?: string;
  onAct: () => void;
  onOpen: () => void;
  onSnooze: () => void;
}
```

**Composition:** Wraps `Card` (`interactive` mode), embeds `SignalBadge`, two `Button`s
(`primary` "Take action" / `ghost` "Snooze", both `sm`).

**Behavior:** Whole card clickable → `onOpen()`. The two action buttons must `stopPropagation()` so
clicking them doesn't also fire `onOpen()` (this exact behavior was explicit in the handoff source
— don't lose it during rebuild).

**Acceptance criteria:**
- [ ] Card click and button clicks fire distinct, correct callbacks (button clicks must not also
      trigger `onOpen`).
- [ ] Layout matches handoff at all three breakpoints this card needs to render inside (mobile
      card stack, tablet 2-up grid — see the composed-page task below for the desktop table
      variant, which is a different rendering, not this component reused at a smaller size).
- [ ] Storybook stories: with/without `suggestion`, each `SignalType`, long learner-name
      truncation.

---

## Task: Build `ActionSheet` module

**What it is:** The take-action drawer opened from an `ExceptionCard` — edit/send an AI-drafted
reply, mark resolved, or snooze with a duration picker (1 day / 3 days / 1 week; 3 days is the
confirmed design default — see the handoff's own note that this was already resolved with product,
not an open question).

**Location:** `packages/ui/src/modules/ActionSheet.tsx`

**Props/API:**
```ts
interface ActionSheetProps {
  open: boolean;
  learner: string;
  cohort: string;
  signal: SignalType;
  draft: string;              // AI-suggested reply text
  onClose: () => void;
  onSend: (text: string) => void;
  onResolve: () => void;
  onSnooze: (days: 1 | 3 | 7) => void;
}
```

**Composition:** Wraps `Drawer` (`title=learner`, `subtitle=cohort`, `signalSlot={<SignalBadge>}`),
`Button` (primary/secondary/ghost at various sizes), a textarea for editing the draft, and a custom
inline snooze popover (3 option rows, "3 days" visually marked as the default).

**Behavior:** `text` state initialized from `draft` prop, resets whenever `learner`/`draft` change.
Footer: "Send on WhatsApp" (primary) → `onSend(text)`; "Snooze" (secondary, toggles the popover)
→ `onSnooze(days)` per option; "Mark resolved" (ghost) → `onResolve()`. All local state resets when
the drawer closes.

**Note — this duplicates `DraftEditor`'s approve/edit/reject pattern** (see `ai-draft-review.md`).
Consider during implementation whether the textarea-edit + primary-send-button pattern should
become a small shared internal piece rather than being written twice — flagging for the
implementer's judgment, not mandating a premature abstraction before both exist.

**Acceptance criteria:**
- [ ] Draft text is editable and resets correctly when a different learner/draft is passed in.
- [ ] Snooze popover shows exactly 3 options with "3 days" visually distinguished as default.
- [ ] All local state (text, popover open) clears when `open` becomes false.
- [ ] Storybook story exercises open/close, edit-then-send, and each snooze option.

---

## Task: Build `FilterSortBar` module

**What it is:** A persistent, single-row filter/sort control for the queue — signal-type filter
via scrollable `Tag` pills, plus a "most stale / least stale" sort toggle.

**Location:** `packages/ui/src/modules/FilterSortBar.tsx`

**Props/API:**
```ts
interface FilterSortBarProps {
  signalFilter: SignalType | null;   // null = "All"
  onSignalFilter: (signal: SignalType | null) => void;
  sort: 'newest' | 'oldest';
  onSort: (sort: 'newest' | 'oldest') => void;
  resultCount: number;
}
```

**Composition:** Uses `Tag` (`selected` state, color mapped from the same `SIGNAL_META` tones —
teal/amber/red/neutral). Custom horizontally-scrollable tag row with a right-edge fade gradient
and hidden scrollbar (`scroll-snap-type: x proximity`, `scrollbar-width: none` — carry these exact
CSS behaviors over, they're load-bearing for the "more content scrolls right" affordance).

**Acceptance criteria:**
- [ ] "All" tag always present and first; selecting a signal tag correctly highlights it and
      clears the others.
- [ ] Fade gradient and scroll-snap behavior present (verify on an actual overflow case — e.g. all
      5 signal types + "All" at a narrow viewport).
- [ ] Storybook story includes a narrow-viewport variant to demonstrate the scroll affordance.

---

## Task: Composed-page story — "Needs You" queue (Creator)

**What it is:** The Storybook equivalent of `ui_kits/creator-triage-queue/index.html` — assembles
`FilterSortBar` + a queue of `ExceptionCard`s + `ActionSheet` overlay + an empty state, at all
three responsive breakpoints the handoff demonstrated.

**Do:** `packages/ui/src/pages/NeedsYouQueue.stories.tsx`. Reproduce the handoff's per-breakpoint
layout switch: **mobile (390px)** card stack, **tablet (820px)** 2-up grid, **desktop (1200px)**
dense table (a distinct rendering, not `ExceptionCard` reused smaller — the handoff's desktop view
is a grid/table with columns: learner / cohort / signal / stale time / actions). Include a snooze
confirmation toast ("Undo" affordance) and a toggle-able empty state ("No one needs you right
now" via the base `EmptyState` component). Reuse the handoff's demo data (5 queue items spanning
different signals).

**Acceptance criteria:**
- [ ] All three breakpoints reproduced via Storybook viewport presets, matching the handoff's
      layouts (verify against the extracted `index.html` if precision is in question).
- [ ] Selecting a queue item opens `ActionSheet` correctly; snoozing removes the item and shows
      the undo toast.
- [ ] Empty state reachable via a Storybook control/toggle, not just by emptying demo data
      manually each time.
