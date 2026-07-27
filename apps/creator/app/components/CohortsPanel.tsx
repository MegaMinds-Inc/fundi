'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CohortRoster, EmptyState, InviteApprove, Tag } from '@fundi/ui';
import type { ProgramSummary, RosterResponse } from '@fundi/types';

// The REAL Sprint-2 invite / approve / roster enrollment UI, extracted verbatim
// from the old DashboardClient's Cohorts tab so it can be injected into
// `ProgramsHome`'s `cohortsSlot` (feature 0012 reconciliation) — do NOT regress
// to the design's "next up in the build queue" placeholder.
//
// The one behavioural change vs. the old dashboard: program selection used to be
// driven by clicking a card on the Programs tab (which now navigates to the
// builder instead). So this panel owns its own program picker — a Tag row when
// there is more than one program — and loads that program's roster.
export function CohortsPanel({ programs }: { programs: ProgramSummary[] }) {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    programs[0]?.id ?? null,
  );
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [activeCohortId, setActiveCohortId] = useState<string>('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadRoster = useCallback((programId: string) => {
    fetch(`/api/enrollment/roster?programId=${encodeURIComponent(programId)}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? (res.json() as Promise<RosterResponse>) : null))
      .then((data) => {
        setRoster(data);
        setActiveCohortId((current) => {
          const cohorts = data?.cohorts ?? [];
          if (cohorts.some((c) => c.id === current)) return current;
          return cohorts[0]?.id ?? '';
        });
      })
      .catch(() => setRoster(null));
  }, []);

  useEffect(() => {
    if (selectedProgramId) loadRoster(selectedProgramId);
  }, [selectedProgramId, loadRoster]);

  function selectProgram(programId: string) {
    setSelectedProgramId(programId);
    setRoster(null);
  }

  async function handleInvite(phone: string) {
    if (!selectedProgramId) return;
    setInviteError(null);
    const res = await fetch('/api/enrollment/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        programId: selectedProgramId,
        cohortId: activeCohortId || null,
        phone,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setInviteError(
        data?.error === 'already_enrolled' ? 'Already invited.' : 'Could not send invite.',
      );
      return;
    }
    loadRoster(selectedProgramId);
  }

  async function handleApprove(id: string) {
    await fetch(`/api/enrollment/${id}/approve`, { method: 'POST' });
    if (selectedProgramId) loadRoster(selectedProgramId);
  }

  async function handleDecline(id: string) {
    await fetch(`/api/enrollment/${id}/decline`, { method: 'POST' });
    if (selectedProgramId) loadRoster(selectedProgramId);
  }

  if (!selectedProgramId) {
    return (
      <Card>
        <EmptyState
          icon="ph-stack"
          title="Pick a program first"
          body="Choose a program to invite learners and view its roster."
        />
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {programs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {programs.map((p) => (
            <Tag
              key={p.id}
              color="teal"
              selected={selectedProgramId === p.id}
              onClick={() => selectProgram(p.id)}
            >
              {p.title}
            </Tag>
          ))}
        </div>
      )}

      {roster && roster.cohorts.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {roster.cohorts.map((c) => (
            <Tag
              key={c.id}
              color="teal"
              selected={activeCohortId === c.id}
              onClick={() => setActiveCohortId(c.id)}
            >
              {c.name}
            </Tag>
          ))}
        </div>
      )}

      {roster?.program.visibility === 'private' && (
        <Card title="Invite & approve">
          <InviteApprove
            pending={roster.pending}
            onInvite={handleInvite}
            onApprove={handleApprove}
            onDecline={handleDecline}
          />
          {inviteError && (
            <p
              style={{
                font: 'var(--text-body-sm)',
                color: 'var(--color-status-danger-text)',
                margin: '8px 0 0',
              }}
            >
              {inviteError}
            </p>
          )}
        </Card>
      )}

      {roster?.program.visibility === 'public' && (
        <Card title="Invite a learner">
          <InviteApprove
            pending={[]}
            onInvite={handleInvite}
            onApprove={() => {}}
            onDecline={() => {}}
          />
          {inviteError && (
            <p
              style={{
                font: 'var(--text-body-sm)',
                color: 'var(--color-status-danger-text)',
                margin: '8px 0 0',
              }}
            >
              {inviteError}
            </p>
          )}
        </Card>
      )}

      <Card title="Roster">
        {roster ? (
          <CohortRoster
            cohorts={roster.cohorts}
            activeId={activeCohortId}
            onSelect={setActiveCohortId}
          />
        ) : (
          <EmptyState icon="ph-circle-notch" title="Loading roster…" body="One moment." />
        )}
      </Card>
    </div>
  );
}
