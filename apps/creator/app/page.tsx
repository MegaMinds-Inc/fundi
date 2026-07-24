import { redirect } from 'next/navigation';
import { getMe } from './lib/bff';
import { DashboardClient } from './DashboardClient';

// The authenticated shell + mandatory PIN-setup gate (feature 0010 CHANGE 1).
// This is the single authoritative enforcement point: a Server Component that
// reads live `needsPinSetup` from /auth/me BEFORE the dashboard paints. The
// middleware has already ensured a fresh session on top-level navigation, so by
// the time this renders a present access cookie is a live one.
//   • no session (getMe → null) → /login (defensive; the middleware normally
//     handles this first).
//   • needs a PIN (never set one) → /pin-setup. Self-clears the instant the PIN
//     is set, because it is DB state, not a token claim — no stale-token loop.
// Exempt routes (/login, /onboarding, /pin-setup) live OUTSIDE this shell and so
// are never gated; /api + static are already skipped by the middleware matcher.
export default async function DashboardPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  if (me.needsPinSetup) redirect('/pin-setup');
  return <DashboardClient />;
}
