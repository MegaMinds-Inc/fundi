'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, EmptyState, ProgramsHome } from '@fundi/ui';
import type { ProgramCardData } from '@fundi/ui';
import type { ProgramSummary } from '@fundi/types';
import { CohortsPanel } from './components/CohortsPanel';
import { CreatorOnlyBuilderPanel } from './components/CreatorOnlyBuilderPanel';

// Creator home (feature 0012): adopt the shipped `@fundi/ui` `ProgramsHome`,
// fed by the REAL org-scoped `GET /api/programs`. The Programs tab now navigates
// into the builder (`/programs/[id]/build`) or the create flow (`/programs/new`);
// the Cohorts tab injects the real Sprint-2 invite/approve/roster enrollment UI
// via `cohortsSlot` (see `CohortsPanel`) — the design's placeholder is never used.

// Deterministic per-program cover seed: sum of the id's char codes, so each card
// gets a stable generative cover that varies program-to-program.
function seedFromId(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return sum;
}

function toCardData(p: ProgramSummary): ProgramCardData {
  return {
    id: p.id,
    title: p.title,
    status: p.status === 'published' ? 'published' : 'draft',
    coverStyle: p.coverStyle,
    seed: seedFromId(p.id),
    moduleCount: p.moduleCount,
    learnerCount: p.learnerCount,
  };
}

type LoadState =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; programs: ProgramSummary[] };

export function DashboardClient() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/programs', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<ProgramSummary[]>) : Promise.reject()))
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', programs: Array.isArray(data) ? data : [] });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleSignOut(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort: cookies are httpOnly and cleared server-side; head to login regardless.
    }
    router.replace('/login');
  }

  if (state.kind === 'loading') {
    return (
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '80px 24px' }}>
        <Card>
          <EmptyState icon="ph-circle-notch" title="Loading programs…" body="One moment." />
        </Card>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '80px 24px' }}>
        <Card>
          <EmptyState
            icon="ph-cloud-slash"
            title="Couldn't load your programs"
            body="We couldn't reach the server. Check your connection and try again."
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <Button
              variant="primary"
              onClick={() => {
                setState({ kind: 'loading' });
                setReloadKey((k) => k + 1);
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const { programs } = state;

  return (
    <>
      <ProgramsHome
        programs={programs.map(toCardData)}
        onNewProgram={() => router.push('/programs/new')}
        onOpenProgram={(id) => router.push(`/programs/${id}/build`)}
        onSignOut={handleSignOut}
        cohortsSlot={programs.length > 0 ? <CohortsPanel programs={programs} /> : undefined}
      />
      <CreatorOnlyBuilderPanel />
    </>
  );
}
