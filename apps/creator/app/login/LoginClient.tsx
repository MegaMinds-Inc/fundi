'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFlow, OfflineBanner, type AuthFlowProps } from '@fundi/ui';

type Step = NonNullable<AuthFlowProps['initialStep']>;

const APP_NAME = 'your Creator dashboard';

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

// Creator login client (feature 0010 §12.3–12.6). The server `/login` resolver
// pins `initialStep`; this component wires every AuthFlow callback to the
// same-origin BFF routes. The browser never sees the API URL or a token/secret.
export function LoginClient({ initialStep }: { initialStep: Step }) {
  const router = useRouter();
  const phoneRef = useRef('');
  const needsOnboardingRef = useRef(false);
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
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        needsOnboarding?: boolean;
      } | null;
      needsOnboardingRef.current = !!data?.needsOnboarding;
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
    if (res.ok) return true;
    if (res.status === 401) return false; // wrong or locked — uniform
    if (res.status === 429) {
      setBanner('Too many attempts. Please wait a moment before trying again.');
      return false;
    }
    setBanner("We couldn't verify your PIN just now. Please try again.");
    return false;
  }

  // "Forgot PIN?" (§12.6) — server-driven OTP send (the client holds no phone).
  // On success AuthFlow drives the in-place OTP(reset) → new-PIN sub-flow; a
  // rejection keeps it on pin-entry so the banner is seen (no second SMS, no
  // phone re-entry).
  async function onForgotPin(): Promise<void> {
    setBanner(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/pin/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
      throw new Error('forgot_pin_failed'); // keep AuthFlow on pin-entry
    }
    if (res.status === 429) {
      setBanner('Too many attempts. Please wait a moment before requesting another code.');
      throw new Error('rate_limited');
    }
    if (!res.ok) {
      setBanner("We couldn't send your reset code just now. Please try again.");
      throw new Error('forgot_pin_failed');
    }
    // 204 → SMS sent. AuthFlow now shows OTP(reset) → new-PIN.
  }

  // Forgot-PIN reset submit (§12.6): the SMS'd code + the new PIN in ONE call.
  // On 200 → signed in. 422 → weak/invalid PIN (AuthFlow re-prompts). 401
  // pin_rejected → the code was wrong/expired; ask for a new one.
  async function onResetPin(otpCode: string, pin: string): Promise<boolean> {
    setBanner(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/pin/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ otpCode, pin }),
      });
    } catch {
      setBanner("You're offline. Check your connection and try again.");
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
  // them. A first-time creator still onboards (create a workspace) before the
  // dashboard; the gate then catches the missing PIN on the way in.
  function onAuthSuccess(): void {
    if (needsOnboardingRef.current) {
      router.replace('/onboarding');
      return;
    }
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
        onForgotPin={onForgotPin}
        onResetPin={onResetPin}
        onForgetDevice={onForgetDevice}
        onSuccess={onAuthSuccess}
      />
    </main>
  );
}
