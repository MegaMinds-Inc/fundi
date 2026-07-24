# Sprint 2 (Program Access & Enrollment) — questions for the product owner

Written during implementation (see `packages/docs/features/0011-sprint-2-enrollment.md` for what
shipped). Two categories: decisions already made with the user acting as PO during this pass
(recorded here for the record — revisit if they turn out wrong), and items deliberately deferred
that still need a real answer.

## Decided (confirmed before implementation started)

1. **Decline hard-deletes the `Enrollment` row.** No `declined` state exists in the
   `EnrollmentState` enum (`pending_approval | active | completed | dropped`), and the AC's own
   wording ("removes the pending entry") was taken literally. **Trade-off accepted:** no audit
   trail of who was declined or when. If that history becomes valuable (e.g. for a "we already
   tried to invite this person" check, or reporting), it needs a schema change — either a real
   `declined` state or a separate append-only log.
2. **Self-serve join is deferred, not built.** This sprint's invite flow is mentor-initiated only,
   for both public and private programs. No public "join by phone" endpoint or UI exists — the
   design kit's `InviteApprove.jsx` only covers the mentor-invites flow.
3. **Cohort on invite = the currently-active cohort tab** in the same screen the invite form lives
   in. Self-paced programs get `cohortId: null`. **Follow-on, found during implementation:** a
   cohort-shaped program now *requires* a real `cohortId` — `null` is rejected outright (see the
   bug writeup in the feature doc). This is stricter than originally scoped but was necessary: the
   original "just default to null" framing would have silently produced invisible enrollments.
4. **Invite creates `Learner` + `Enrollment` only** — no `Account`/`Membership`. A learner can't log
   into the Learner PWA from an invite alone; that binding happens lazily on their first real OTP
   login to that phone number, matching Sprint 1's existing pattern.

## Still open (not decided, defaulted for now — please review)

5. **The dashboard's old "Invite a learner" copy claimed "They'll get a WhatsApp invite."** That's
   not true yet — WhatsApp/messaging integration is still an untouched stub (ADR-011). The invite
   flow now only writes `Learner`/`Enrollment` rows; no message of any kind is queued or sent, and
   the UI copy was rewritten to not promise one. **Open question:** should inviting create a
   `pending` `Message` row (so it's ready to send once messaging ships), or is that explicitly out
   of scope until then? Left undone this pass to avoid `enrollment` reaching into `messaging`'s
   domain before that module's real shape is decided.
6. **"Low-enrollment" (non-zero, few-learners) styling is undefined** — the sprint doc itself
   already flags this as unspecified in the design kit. Only the zero-state `EmptyState` was built;
   there's no visual distinction for "1-3 learners" vs. "40 learners."
7. **Self-paced programs render through `CohortRoster` as a single synthetic cohort** (one tab
   pill, labelled with the program's title), not a bespoke "no tabs at all" layout. The sprint doc
   flagged this exact ambiguity ("confirm with design whether this is a hidden single-tab or a
   genuinely different layout") and it's still unresolved — this pass picked the simpler of the two
   options to ship something rather than block on it.
8. **No RBAC differentiation** between `owner`/`admin`/`mentor` roles on invite/approve/decline —
   any authenticated creator-app principal in the org can do all three. Flag if a specific role
   should be required (e.g. only `owner`/`admin` can approve).
9. **No Program list/detail page exists.** Program Builder UI is explicitly blocked, so this sprint
   added the minimum glue — a plain program-picker grid on the dashboard — to have something to
   invite/view a roster against. A real program list/detail page is implicitly needed once the
   builder unblocks and should probably become its own story rather than staying folded into the
   dashboard.
10. **The Invite + Roster UI is one stacked view, not two sub-tabs.** The design-system task
    backlog (`packages/docs/design-system/tasks/enrollment.md`) originally suggested a nested
    "Invite & approve" / "Cohorts & roster" tab pair inside the Cohorts tab. This pass stacked both
    sections vertically instead (simpler, and `ui_kits/enrollment/index.html` wasn't re-checked
    pixel-by-pixel for a nested-tab layout). Worth a design pass if the stacked layout feels wrong
    in practice.

## Unrelated, pre-existing issues found along the way (not fixed — out of Sprint 2 scope)

- Local `apps/api/.env` has `OTP_DELIVERY_DRIVER="sms"` instead of the `.env.example` default
  `"stub"`. This breaks `auth.integration.test.ts`'s OTP-flow tests locally (`delivery.lastCodeFor
  is not a function` — the real `SmsOtpDeliveryService` doesn't have that stub-only recording
  method) and would also break manual login testing in a browser without a real SMS provider
  reachable. Confirmed pre-existing (reproduced on a clean `git stash`, before any Sprint 2 change).
  Whoever last tested the real SMS path should flip this back, or the team should decide `.env`
  needs a comment warning against committing/leaving it on `sms`.
