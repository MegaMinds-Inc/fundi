'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@fundi/ui';

// Signs out via the BFF logout route (revokes this app's refresh token + clears
// the httpOnly cookies), then returns to login. Per-app scoped (plan US-004).
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut(): Promise<void> {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort: the cookies are httpOnly and cleared server-side; if the
      // request never lands we still send the user to login.
    }
    router.replace('/login');
  }

  return (
    <Button variant="ghost" size="sm" loading={busy} onClick={signOut}>
      Sign out
    </Button>
  );
}
