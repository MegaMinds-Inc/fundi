'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProgramSetup } from '@fundi/ui';
import type { ProgramSetupValue } from '@fundi/ui';
import type { ProgramCreated } from '@fundi/types';

const UNREACHABLE_MSG = "Can't reach the server — is the backend running?";

// Client owner of the create-program form. `ProgramSetup` is controlled; on
// Continue we POST /api/programs and, on 201, replace into the new draft's
// builder. Business/transport failures surface as an inline message.
export function NewProgramClient() {
  const router = useRouter();
  const [value, setValue] = useState<ProgramSetupValue>({ title: '', coverStyle: 'gradient' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleContinue(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);

    let res: Response;
    try {
      res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: value.title,
          shape: value.shape,
          visibility: value.visibility,
          coverStyle: value.coverStyle,
        }),
      });
    } catch {
      setError(UNREACHABLE_MSG);
      setBusy(false);
      return;
    }

    if (res.status === 201) {
      const data = (await res.json().catch(() => null)) as ProgramCreated | null;
      if (data?.id) {
        router.replace(`/programs/${data.id}/build`);
        return; // keep `busy` — we're navigating away.
      }
      setError('Something went wrong creating the program. Please try again.');
      setBusy(false);
      return;
    }

    if (res.status === 401) {
      router.replace('/login');
      return;
    }

    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    const code = data?.error;
    if (res.status === 503) setError(UNREACHABLE_MSG);
    else if (res.status === 502)
      setError('The server had a problem. Please try again in a moment.');
    else if (code === 'not_a_creator')
      setError(
        'Your account isn’t set up to create programs yet. Ask an org owner for creator access.',
      );
    else if (code === 'invalid_field')
      setError('Please give the program a title and pick a shape and visibility, then try again.');
    else setError('Couldn’t create the program. Please try again.');
    setBusy(false);
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg-canvas)' }}>
      {error && (
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px 24px 0' }}>
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-status-danger-bg)',
              color: 'var(--color-status-danger-text)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        </div>
      )}
      <ProgramSetup value={value} onChange={setValue} onContinue={handleContinue} />
    </main>
  );
}
