import { Card, EmptyState } from '@fundi/ui';
import { SignOutButton } from './components/SignOutButton';

// Learner home (plan A.6 / B.6 / D6). Learners are enrolled by a creator, never
// self-serve, so a freshly-authenticated learner legitimately has no programs
// yet. Corrected framing: the learner PWA is a real surface for lessons and
// progress — do NOT imply lessons arrive via WhatsApp.
export default function LearnerHomePage() {
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
