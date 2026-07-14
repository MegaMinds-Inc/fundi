'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, OfflineBanner } from '@fundi/ui';

// Creator first-run onboarding (plan A.6 / B.5 / D5). The only screen reachable
// with an org-less onboarding token: capture the workspace name + the creator's
// own name, POST to the onboarding BFF route (which bootstraps the org and
// re-issues an org-scoped token), then land on the dashboard.
export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    if (submitting) return;
    if (!orgName.trim() || !name.trim()) {
      setFieldError('Please fill in both fields.');
      return;
    }
    setFieldError(null);
    setBanner(null);
    setSubmitting(true);

    let res: Response;
    try {
      res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgName: orgName.trim(), name: name.trim() }),
      });
    } catch {
      setSubmitting(false);
      setBanner("You're offline. Your workspace isn't saved yet — try again when you reconnect.");
      return;
    }
    setSubmitting(false);

    if (res.ok) {
      router.replace('/');
      return;
    }
    if (res.status === 401) {
      router.replace('/login');
      return;
    }
    if (res.status === 503) {
      setBanner("We couldn't reach the server. Your workspace isn't saved yet — please try again.");
      return;
    }
    setFieldError('Something went wrong setting up your workspace. Please try again.');
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          width: '100%',
          maxWidth: 360,
          fontFamily: 'var(--font-body)',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-heading)',
              margin: 0,
            }}
          >
            Set up your workspace
          </h1>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--color-text-muted)',
              margin: '6px 0 0',
            }}
          >
            A couple of details and you&apos;re ready to build your first program.
          </p>
        </div>

        <Input
          label="What should we call your workspace?"
          placeholder="e.g. Ama's Baking School"
          value={orgName}
          error={fieldError && !orgName.trim() ? fieldError : undefined}
          onChange={(e) => {
            setOrgName(e.target.value);
            if (fieldError) setFieldError(null);
          }}
        />
        <Input
          label="What's your name?"
          placeholder="e.g. Ama Mensah"
          value={name}
          error={fieldError && !name.trim() ? fieldError : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldError) setFieldError(null);
          }}
        />
        <Button loading={submitting} onClick={submit}>
          Create workspace
        </Button>
      </div>
    </main>
  );
}
