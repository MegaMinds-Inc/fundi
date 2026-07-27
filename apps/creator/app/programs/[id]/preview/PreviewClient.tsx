'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, EmptyState, LearnerPreview } from '@fundi/ui';
import type { LearnerPreviewModule, LearnerPreviewProgram } from '@fundi/ui';
import type { ProgramDetail, ModuleDetail } from '@fundi/types';

type Phase = 'loading' | 'not_found' | 'error' | 'ready';

/** ProgramDetail.modules (API DTOs) → the LearnerPreview's presentational
 * shape. `hidden` modules are filtered inside LearnerPreview, so all are passed
 * through here (mapping unlockMode/unlockDays/lessons the preview reads). */
function toPreviewModules(modules: ModuleDetail[]): LearnerPreviewModule[] {
  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? undefined,
    unlockMode: m.unlockMode,
    unlockDays: m.unlockDays ?? undefined,
    lessons: m.lessons.map((l) => ({ id: l.id })),
  }));
}

function toPreviewProgram(d: ProgramDetail): LearnerPreviewProgram {
  return {
    title: d.title,
    coverStyle: d.coverStyle === 'geometric' ? 'geometric' : 'gradient',
    modules: toPreviewModules(d.modules),
  };
}

// Read-only learner-facing preview loader (feature 0012 slice 3). Reuses the
// builder's GET-the-BFF pattern — a live access cookie is guaranteed by the
// middleware + server gate before this renders. Never mutates.
export function PreviewClient({ id }: { id: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [program, setProgram] = useState<LearnerPreviewProgram | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/programs/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setPhase('not_found');
        if (res.status === 401) return router.replace('/login');
        if (!res.ok) return setPhase('error');
        const d = (await res.json().catch(() => null)) as ProgramDetail | null;
        if (!d) return setPhase('error');
        setProgram(toPreviewProgram(d));
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (phase === 'loading') {
    return (
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '80px 24px' }}>
        <Card>
          <EmptyState icon="ph-circle-notch" title="Loading preview…" body="One moment." />
        </Card>
      </main>
    );
  }

  if (phase === 'not_found') {
    return (
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '80px 24px' }}>
        <Card>
          <EmptyState
            icon="ph-magnifying-glass"
            title="Program not found"
            body="This program doesn’t exist, or it isn’t in your organisation."
          />
        </Card>
      </main>
    );
  }

  if (phase === 'error' || !program) {
    return (
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '80px 24px' }}>
        <Card>
          <EmptyState
            icon="ph-cloud-slash"
            title="Couldn’t load this preview"
            body="We couldn’t reach the server. Check your connection and try again."
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => router.back()}>
              Go back
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg-canvas)' }}>
      <LearnerPreview program={program} />
    </main>
  );
}
