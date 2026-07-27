'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFlow, OfflineBanner, type AuthFlowProps } from '@fundi/ui';

type Step = NonNullable<AuthFlowProps['initialStep']>;

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

// A backend outage should read as one, not as a generic failure: the BFF maps an
// unreachable/down API to 503 and an API 5xx to 502. Surface both distinctly so
// "backend down" never masquerades as "couldn't send your code".
function outageBanner(status: number): string | null {
  if (status === 503) return "Can't reach the server — is the backend running?";
  if (status >= 500) return 'The server ran into a problem. Please try again in a moment.';
  return null;
}

// Learner login client (feature 0010 §12.3–12.6). The server `/login` resolver
// pins `initialStep`; this component wires every AuthFlow callback to the
// same-origin BFF routes. Learners are enrolled by a creator (never self-serve,
// plan A.6), so there is no onboarding step; first-run PIN setup is handled by
// the mandatory PIN-setup gate in the authenticated shell (app/page.tsx →
// /pin-setup, feature 0010 CHANGE 1), not here. The browser never sees the API
// URL or a token/secret.
export function LoginClient({ initialStep }: { initialStep: Step }) {
  const router = useRouter();
  const phoneRef = useRef('');
  const [banner, setBanner] = useState<string | null>(null);

  async function onRequestOtp(phone: string): Promise<void> {
    setBanner(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
      throw new Error('otp_request_failed'); // keep AuthFlow on the phone step
    }
    const outage = outageBanner(res.status);
    if (outage) {
      setBanner(outage);
      throw new Error('server_down'); // keep AuthFlow on the phone step
    }
    if (res.status === 429) {
      setBanner('Too many attempts. Please wait a moment before trying again.');
      throw new Error('rate_limited');
    }
    if (!res.ok) {
      setBanner("We couldn't send your code just now. Please try again.");
      throw new Error('otp_request_failed');
    }
    phoneRef.current = phone;
  }

  async function onVerifyOtp(code: string): Promise<boolean> {
    setBanner(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phoneRef.current, code }),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
      return false;
    }
    const outage = outageBanner(res.status);
    if (outage) {
      setBanner(outage);
      return false;
    }
    if (res.ok) {
      // The mandatory PIN-setup gate (feature 0010 CHANGE 1) drives PIN setup off
      // live /auth/me state, so login no longer needs the verify response body.
      return true;
    }
    // 400 = wrong/expired code → let AuthFlow show its inline retry error.
    if (res.status === 400) return false;
    if (res.status === 429) {
      setBanner('Too many attempts. Please wait a moment before trying again.');
      return false;
    }
    setBanner("We couldn't verify your code just now. Please try again.");
    return false;
  }

  // Step-up re-auth (§12.4). A PIN entry mints a fresh session with NO SMS. The
  // uniform 401 `pin_rejected` surfaces as `false` → AuthFlow's generic error.
  async function onVerifyPin(pin: string): Promise<boolean> {
    setBanner(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/pin/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
      return false;
    }
    const outage = outageBanner(res.status);
    if (outage) {
      setBanner(outage);
      return false;
    }
    if (res.ok) return true;
    if (res.status === 401) return false; // wrong or locked — uniform
    if (res.status === 429) {
      setBanner('Too many attempts. Please wait a moment before trying again.');
      return false;
    }
    setBanner("We couldn't verify your PIN just now. Please try again.");
    return false;
  }

  // Forgot-PIN reset submit (§12.6): the phone-based reset — the entered phone,
  // the SMS'd code, and the new PIN in ONE call. On 200 → signed in. 422 →
  // weak/invalid PIN (AuthFlow re-prompts). 401 pin_rejected → the code was
  // wrong/expired (or the phone has no account); ask for a new one.
  async function onResetPin(phone: string, otpCode: string, pin: string): Promise<boolean> {
    setBanner(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/pin/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, otpCode, pin }),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
      return false;
    }
    const outage = outageBanner(res.status);
    if (outage) {
      setBanner(outage);
      return false;
    }
    if (res.ok) return true;
    if (res.status === 422) return false; // weak/invalid PIN → AuthFlow re-prompts
    if (res.status === 401) {
      setBanner("That code didn't work. Tap “Forgot PIN?” again for a new one.");
      return false;
    }
    if (res.status === 429) {
      setBanner('Too many attempts. Please wait a moment before trying again.');
      return false;
    }
    setBanner("We couldn't reset your PIN just now. Please try again.");
    return false;
  }

  // "Not you?" (§12.4) — clears the httpOnly device cookie server-side (JS
  // cannot). AuthFlow itself then transitions to phone entry.
  async function onForgetDevice(): Promise<void> {
    setBanner(null);
    try {
      await fetch('/api/auth/device/forget', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
    }
  }

  // Route on a completed auth. First-run PIN setup is NOT handled here anymore:
  // the mandatory PIN-setup gate in the authenticated shell (app/page.tsx) reads
  // live `needsPinSetup` from /auth/me and redirects to /pin-setup when needed
  // (feature 0010 CHANGE 1), so login just lands the user and lets the gate route
  // them.
  function onAuthSuccess(): void {
    router.replace('/');
  }

  return (
    <main style={wrapper}>
      {banner && <OfflineBanner message={banner} style={{ maxWidth: 360 }} />}
      <AuthFlow
        appName={APP_NAME}
        initialStep={initialStep}
        onRequestOtp={onRequestOtp}
        onVerifyOtp={onVerifyOtp}
        onVerifyPin={onVerifyPin}
        onResetPin={onResetPin}
        onForgetDevice={onForgetDevice}
        onSuccess={onAuthSuccess}
      />
    </main>
  );
}
