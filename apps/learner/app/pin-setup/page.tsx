'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFlow, OfflineBanner } from '@fundi/ui';

const APP_NAME = 'your Learner home';

const wrapper = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  padding: '32px 16px',
  maxWidth: 420,
  margin: '0 auto',
};

// Mandatory PIN-setup route (feature 0010 CHANGE 1). This is the single
// authoritative first-run PIN-setup surface: the authenticated server shell
// (app/page.tsx) reads `needsPinSetup` from /auth/me and redirects here whenever
// the account has no PIN yet, so a returning user who never set one is caught on
// their next entry. The route is session-protected by the middleware (no session
// → /login) and exempt from the gate itself (no redirect loop). On success the
// gate re-reads a now-false `needsPinSetup` and lets the dashboard through.
export default function PinSetupPage() {
  const router = useRouter();
  const [banner, setBanner] = useState<string | null>(null);

  // First-run PIN persist (§12.5, first-set → no proof needed). A weak-PIN /
  // invalid rejection (422) surfaces as `false` → AuthFlow restarts enter→confirm.
  async function onSetPin(pin: string): Promise<boolean> {
    setBanner(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/pin/set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
      return false;
    }
    if (res.ok) return true;
    if (res.status === 401) {
      router.replace('/login');
      return false;
    }
    return false; // 422 weak/invalid → AuthFlow re-prompts
  }

  return (
    <main style={wrapper}>
      {banner && <OfflineBanner message={banner} style={{ maxWidth: 360 }} />}
      <AuthFlow
        appName={APP_NAME}
        initialStep="pin-setup"
        onSetPin={onSetPin}
        onSuccess={() => router.replace('/')}
      />
    </main>
  );
}
