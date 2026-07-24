import { redirect } from 'next/navigation';
import { Card, EmptyState } from '@fundi/ui';
import { getMe } from './lib/bff';
import { SignOutButton } from './components/SignOutButton';

// Learner home (plan A.6 / B.6 / D6). Learners are enrolled by a creator, never
// self-serve, so a freshly-authenticated learner legitimately has no programs
// yet. Corrected framing: the learner PWA is a real surface for lessons and
// progress — do NOT imply lessons arrive via WhatsApp.
//
// This is also the authenticated shell + mandatory PIN-setup gate (feature 0010
// CHANGE 1): a Server Component that reads live `needsPinSetup` from /auth/me
// BEFORE paint. No session → /login (defensive; the middleware normally handles
// it first). Needs a PIN → /pin-setup (DB state, not a token claim, so it
// self-clears once the PIN is set — no stale-token loop). /login and /pin-setup
// live outside this shell and are never gated.
export default async function LearnerHomePage() {
  const me = await getMe();
  if (!me) redirect('/login');
  if (me.needsPinSetup) redirect('/pin-setup');
  return (
    <main
      style={{
        minHeight: '100vh',
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
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
            Learner
          </span>
          <h1
            style={{
              font: 'var(--text-display-md)',
              letterSpacing: 'var(--tracking-tight)',
              margin: 0,
              color: 'var(--color-text-heading)',
            }}
          >
            Your learning
          </h1>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <EmptyState
          icon="ph-check-circle"
          title="You're all set"
          body="When your mentor adds you to a program, your lessons and progress will show up here."
        />
      </Card>
    </main>
  );
}
