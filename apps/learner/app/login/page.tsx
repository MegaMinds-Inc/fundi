'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFlow, OfflineBanner } from '@fundi/ui';

// Learner login (plan A.7 / B.1–B.4). Mounts the shared AuthFlow and wires its
// callbacks to the same-origin BFF routes; the browser never sees the API URL
// or a token. On success the learner lands on their home (enrolled by a creator,
// never self-serve — plan A.6), so there is no onboarding step.
export default function LoginPage() {
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
    if (res.ok) return true;
    // 400 = wrong/expired code → let AuthFlow show its inline retry error.
    if (res.status === 400) return false;
    if (res.status === 429) {
      setBanner('Too many attempts. Please wait a moment before trying again.');
      return false;
    }
    setBanner("We couldn't verify your code just now. Please try again.");
    return false;
  }

  function onSuccess(): void {
    router.replace('/');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '32px 16px',
        maxWidth: 420,
        margin: '0 auto',
      }}
    >
      {banner && <OfflineBanner message={banner} style={{ maxWidth: 360 }} />}
      <AuthFlow
        appName="your Learner home"
        onRequestOtp={onRequestOtp}
        onVerifyOtp={onVerifyOtp}
        onSuccess={onSuccess}
      />
    </main>
  );
}
