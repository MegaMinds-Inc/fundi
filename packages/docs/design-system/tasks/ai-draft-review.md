# AI draft review (AI Drafting & Triage Service)

Maps to the "BRD: AI Drafting & Triage Service" (`packages/docs/clickup-sync/product/brds/ai-drafting-triage-service.md`)
and ADR-011 (AI as an isolated internal service — **every** draft must pass through this human-review
surface before send; this module set is that compliance boundary, not a nice-to-have UI). No
dependency on `creator-triage-queue.md`'s modules — can build in parallel.

---

## Task: Build `DraftQueue` module

**What it is:** List of pending AI drafts awaiting human approval — the entry point into the
ADR-011 compliance flow ("no AI message leaves without explicit sign-off").

**Location:** `packages/ui/src/modules/DraftQueue.tsx`

**Props/API:**
```ts
interface DraftQueueProps {
  drafts: Array<{
    id: string;
    kind: string;           // e.g. 'reminder' | 'check-in' | 'broadcast'
    recipient: string;
    minutesAgo: number;
    text: string;
    variables: Record<string, string>;
  }>;
  onReview: (draft: DraftQueueProps['drafts'][number]) => void;
}
```

**Composition:** `EmptyState` (icon `ph-sparkle`, shown when `drafts.length === 0`, copy explains
Fundi drafts messages as Signals come in). Each draft rendered as an interactive `Card` with a
tone-coded `Badge` (by kind), recipient, relative time, a 2-line-clamped text preview, and a
secondary "Review draft" `Button`.

**Behavior:** Both the card click and the button click trigger `onReview(draft)` (same
event-target pattern as `ExceptionCard` — one callback, two trigger points).

**Acceptance criteria:**
- [ ] Empty state shows correctly and explains what will appear here (not just "nothing here").
- [ ] Text preview clamps to 2 lines with ellipsis regardless of draft length.
- [ ] Storybook stories: populated queue (3+ drafts of different kinds), empty state.

---

## Task: Build `DraftEditor` module

**What it is:** Drawer for editing an AI draft before it sends — the actual human-approval act.
Template variables render as locked chips (visually distinct from freely-editable text) so a
reviewer can immediately see what's dynamic vs. what they're editing, tying directly to ADR-005's
template-variable regime.

**Location:** `packages/ui/src/modules/DraftEditor.tsx`

**Props/API:**
```ts
interface DraftEditorProps {
  open: boolean;
  draft: {
    id: string;
    kind: string;
    recipient: string;
    templateName: string;
    text: string;
    variables: Record<string, string>;
  } | null;
  onClose: () => void;
  onApprove: (id: string, editedText: string) => void;
  onReject: (id: string) => void;
}
```

**Composition:** Wraps `Drawer` (`title`, `subtitle`, `signalSlot` for a tone `Badge`, `footer`
with two `Button`s). Textarea for free-text editing. Variable chips: small teal-background pills
listing each `variables` entry.

**Behavior:** `text` state syncs from `draft.text` whenever `draft` changes. "Approve & send"
(primary, WhatsApp icon) → `onApprove(draft.id, text)`. "Reject / discard" (secondary) →
`onReject(draft.id)`. Drawer renders nothing (or stays closed) when `draft` is `null`.

**Important — ADR-005 connection:** per the product ADR, drafts sent outside the 24h WhatsApp
session window must use an approved template with fixed variable slots; free text is only valid
for in-window replies. This module's variable-chip pattern is the UI expression of that rule — if
`templateName` is present, the implementer should treat that as "this is a templated send, don't
let arbitrary edits break the approved template structure" (exact enforcement mechanism is a
product/backend decision tracked separately; flagging here so whoever builds this doesn't
accidentally make the textarea fully free-form for template-bound drafts).

**Acceptance criteria:**
- [ ] Variable chips render distinctly from the editable textarea and are not themselves editable.
- [ ] Approve/reject fire the correct callbacks with the current (possibly edited) text.
- [ ] Drawer safely handles `draft === null` (no crash, no stale content flash).
- [ ] Storybook stories: draft with variables, draft without variables, `draft = null`.

---

## Task: Build `AuditTrail` module

**What it is:** Read-only history of what's already been sent/rejected — the compliance record and
the "was the AI's voice trustworthy over time" trust-building surface.

**Location:** `packages/ui/src/modules/AuditTrail.tsx`

**Props/API:**
```ts
interface AuditTrailProps {
  entries: Array<{
    id: string;
    action: 'sent' | 'sent_unedited' | 'rejected';
    recipient: string;
    text: string;
    when: string;
  }>;
}
```

**Composition:** `EmptyState` (icon `ph-clock-counter-clockwise`, "No history yet") when
`entries.length === 0`.

**Behavior:** Fully read-only — no callbacks. Each row: action icon (check-circle for sent variants,
x-circle for rejected) tone-colored, recipient, draft text (italicized specifically when
`action === 'rejected'`, per the handoff — don't drop that distinction), relative timestamp.

**Acceptance criteria:**
- [ ] All three `action` values render with visually distinct icon/tone.
- [ ] Rejected entries' text is italicized; sent entries' is not.
- [ ] Storybook stories: mixed history, empty history.

---

## Task: App screen — "AI Draft Review" (Creator)

**What it is:** The real review screen in **`apps/creator`** — a tabbed screen switching between
`DraftQueue` ("Needs review (N)") and `AuditTrail` ("History"), with `DraftEditor` overlaying as a
drawer when a draft is selected. `ui_kits/ai-draft-review/index.html` is the design reference.

**Do:** Assemble the modules in the creator app using the base `Tabs` (underline variant) to switch
panels, wiring the selected-draft state and approve/reject to the real AI-draft API (ADR-011).

**Acceptance criteria:**
- [ ] Tab switch swaps `DraftQueue`/`AuditTrail` without losing either's state.
- [ ] Selecting a draft opens `DraftEditor`; approve/reject closes it and moves the item into the
      audit trail (via the real mutation).

---

## Item & composition modules

Finer pieces the feature modules above compose (all in `packages/ui/src/modules/`, co-located story each):

- **`DraftCard`** (I) — one pending draft: kind `Badge` + recipient + `RelativeTime` +
  2-line-clamped preview + "Review draft" button. Whole card and button both fire `onReview`. Props:
  `{ kind; recipient; minutesAgo; text; onReview }`. Used by `DraftQueue`.
- **`VariableChip`** (I) — a locked, non-editable teal template-variable pill (ADR-005). Props:
  `{ name; value }`. Used by `DraftEditor`.
- **`AuditRow`** (I) — one history entry: action icon/tone (sent / sent_unedited / rejected) +
  recipient + text (italic when rejected) + timestamp. Props: `{ action; recipient; text; when }`.

Shared primitives used here: `MessageComposer` (DraftEditor edit-and-send), `RelativeTime`.
