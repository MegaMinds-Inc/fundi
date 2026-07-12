# Enrollment & cohort management

Maps to Sprint 2 (`packages/docs/clickup-sync/sprints/sprint-2-program-access-enrollment.md`) and
the "BRD: Enrollment & Cohort Management". Build order: `EnrollmentBadge` first (used by
`CohortRoster`), `InviteApprove` independent, can parallelize.

---

## Task: Build `EnrollmentBadge` module

**What it is:** Status pill for an enrollment's lifecycle state, reused anywhere an enrollment is
listed (roster, program dashboard, etc.) — the enrollment-domain equivalent of `SignalBadge`.

**Location:** `packages/ui/src/modules/EnrollmentBadge.tsx`

**Props/API:**
```ts
interface EnrollmentBadgeProps {
  state: EnrollmentState;  // from @fundi/types: pending_approval | active | completed | dropped
  compact?: boolean;
}
```

**Composition:** Wraps `Badge`. Tone/icon mapping (own metadata map, same pattern as
`SIGNAL_META` — consider whether this belongs alongside it in `packages/ui/src/` for consistency,
implementer's call): `pending_approval`→warn, `active`→live, `completed`→draft, `dropped`→neutral.

**Behavior:** `compact` hides the label, icon stays visible. Defaults to `active` styling if an
unrecognized state is passed (mirrors `SignalBadge`'s defensive fallback pattern).

**Acceptance criteria:**
- [ ] All 4 `EnrollmentState` values render with the mapped tone/icon exactly as specified.
- [ ] Storybook story: one per state, plus `compact` variants.

---

## Task: Build `InviteApprove` module

**What it is:** Invite-by-phone form + pending-approval queue — only relevant for **private**
programs (public programs skip approval entirely, per ADR/product brief §10 and §13).

**Location:** `packages/ui/src/modules/InviteApprove.tsx`

**Props/API:**
```ts
interface InviteApproveProps {
  pending: Array<{ id: string; name: string; phone: string; hoursAgo: number }>;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
  onInvite: (phone: string) => void;
}
```

**Composition:** `Input` (phone icon slot) + `Button` (primary "Send invite"). Each pending row:
avatar-initial circle, name, phone, relative time, `Decline` (ghost, sm) / `Approve` (primary, sm)
buttons.

**Behavior:** Local `phone` input state; "Send invite" disabled until non-empty (trimmed), clears
input and calls `onInvite(phone.trim())` on submit. Approve/decline pass the specific `pending.id`.

**Acceptance criteria:**
- [ ] Send-invite button correctly disabled/enabled based on trimmed input state.
- [ ] Approve/decline fire with the correct `id` when multiple pending entries exist.
- [ ] Storybook stories: empty pending list, populated list, invite-in-progress state.

---

## Task: Build `CohortRoster` module

**What it is:** Cohort switcher + learner roster, rendering as a card list (mobile) or dense table
(desktop) — matches ADR-012 §8's "adapt, don't just shrink" responsive principle already
established by the Needs You queue's own breakpoint handling.

**Location:** `packages/ui/src/modules/CohortRoster.tsx`

**Props/API:**
```ts
interface CohortRosterProps {
  cohorts: Array<{
    id: string;
    name: string;
    schedule?: string;
    roster: Array<{ name: string; progressPercent: number; state: EnrollmentState }>;
  }>;
  activeId: string;
  onSelect: (cohortId: string) => void;
  dense?: boolean;   // table layout vs. card list
}
```

**Composition:** Custom cohort-tab row (pill buttons showing name + learner count). Per-learner:
avatar-initial circle, name, progress %, `EnrollmentBadge`. `EmptyState` when the active cohort's
roster is empty (or no cohorts at all).

**Behavior:** Tab click → `onSelect(cohortId)`. `dense=true` switches to a table grid (columns:
learner / progress % / status) instead of the card list — this is a genuine layout switch, not
just a CSS density tweak, per the handoff.

**Acceptance criteria:**
- [ ] Both `dense` layouts (card list, table) render the same data correctly.
- [ ] Empty-cohort and zero-cohorts states both covered (`EmptyState`, not a blank screen).
- [ ] Storybook stories: multiple cohorts (one empty, one populated), `dense` toggle.

---

## Task: Composed-page story — "Enrollment & Roster" (Creator)

**What it is:** Storybook equivalent of `ui_kits/enrollment/index.html` — tabbed screen ("Invite &
approve" / "Cohorts & roster") switching between `InviteApprove` and `CohortRoster`, with a
device-size toggle demonstrating `dense` switching automatically at the desktop breakpoint.

**Do:** `packages/ui/src/pages/EnrollmentRoster.stories.tsx`. Reuse the handoff's demo data (2
pending invites; 2 cohorts — one with 4 learners, one empty). Approve/decline should visibly move
an entry out of the pending list and (conceptually) onto the roster within the story's local state,
matching the handoff's own interactive demo behavior.

**Acceptance criteria:**
- [ ] Tab switch and device-size toggle both work independently and together.
- [ ] Approve/decline actions visibly update pending list and roster in the story's local state,
      not just log to Actions.
