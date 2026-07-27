import { redirect } from 'next/navigation';
import { getMe } from './bff';

// Shared authenticated + mandatory-PIN-setup gate for protected creator server
// segments (feature 0010 CHANGE 1). This is the SAME enforcement `app/page.tsx`
// runs inline; the `/programs/*` routes are outside that page, so each of their
// server components calls this before rendering their client child. The Edge
// middleware has already ensured a fresh session on the top-level navigation, so
// a present access cookie is live by the time this reads `/auth/me`.
//   • no session (getMe → null) → /login (defensive; middleware normally first).
//   • needs a PIN (never set one) → /pin-setup. Self-clears once the PIN is set
//     (DB state, not a token claim — no stale-token loop).
export async function requireCreatorSession(): Promise<void> {
  const me = await getMe();
  if (!me) redirect('/login');
  if (me.needsPinSetup) redirect('/pin-setup');
}
