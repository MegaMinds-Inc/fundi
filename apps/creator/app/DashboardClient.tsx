'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, CohortRoster, EmptyState, InviteApprove, Tabs, Tag } from '@fundi/ui';
import type { ProgramSummary, RosterResponse } from '@fundi/types';
import { CreatorOnlyBuilderPanel } from './components/CreatorOnlyBuilderPanel';
import { SignOutButton } from './components/SignOutButton';

const PROGRAM_VISIBILITY_TONE = { public: 'live', private: 'draft' } as const;

export function DashboardClient() {
  const [tab, setTab] = useState('programs');
  const [programs, setPrograms] = useState<ProgramSummary[] | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [activeCohortId, setActiveCohortId] = useState<string>('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/programs', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<ProgramSummary[]>) : []))
      .then((data) => {
        setPrograms(data);
        setSelectedProgramId((current) => current ?? data[0]?.id ?? null);
      })
      .catch(() => setPrograms([]));
  }, []);

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
    setTab('cohorts');
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

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 16px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: 'var(--text-eyebrow)',
              letterSpacing: 'var(--tracking-eyebrow)',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Creator
          </span>
          <h1
            style={{
              font: 'var(--text-display-lg)',
              letterSpacing: 'var(--tracking-tight)',
              margin: 0,
              color: 'var(--color-text-heading)',
            }}
          >
            Your programs
          </h1>
        </div>
        <SignOutButton />
      </header>

      <Tabs
        variant="pill"
        value={tab}
        onChange={setTab}
        tabs={[
          { label: 'Programs', value: 'programs' },
          { label: 'Cohorts', value: 'cohorts' },
          { label: 'Needs you', value: 'needs-you' },
        ]}
      />

      {tab === 'needs-you' ? (
        <Card>
          <EmptyState
            icon="ph-check-circle"
            title="No one needs you right now"
            body="When a learner goes quiet or falls behind, they'll surface here. Go create."
          />
        </Card>
      ) : tab === 'programs' ? (
        programs === null ? (
          <Card>
            <EmptyState icon="ph-circle-notch" title="Loading programs…" body="One moment." />
          </Card>
        ) : programs.length === 0 ? (
          <Card>
            <EmptyState
              icon="ph-stack"
              title="No programs yet"
              body="Programs are seeded for dev/test until the builder ships — run `pnpm --filter api db:seed`."
            />
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {programs.map((program) => (
              <Card
                key={program.id}
                interactive
                title={program.title}
                meta={program.shape.replace('_', ' ')}
                onClick={() => selectProgram(program.id)}
                footer={
                  <Badge tone={PROGRAM_VISIBILITY_TONE[program.visibility]}>
                    {program.visibility}
                  </Badge>
                }
              >
                <p
                  style={{
                    font: 'var(--text-body-md)',
                    color: 'var(--color-text-muted)',
                    margin: 0,
                  }}
                >
                  {program.visibility === 'private'
                    ? 'Invited learners need approval to join.'
                    : 'Anyone invited joins immediately.'}
                </p>
              </Card>
            ))}
          </div>
        )
      ) : !selectedProgramId ? (
        <Card>
          <EmptyState
            icon="ph-stack"
            title="Pick a program first"
            body="Choose a program from the Programs tab to invite learners and view its roster."
          />
        </Card>
      ) : (
        <>
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
        </>
      )}

      <CreatorOnlyBuilderPanel />
    </main>
  );
}
