import { NextResponse } from 'next/server';
import { APP, clearSessionCookies, getRefreshTokenForLogout, postPublic } from '../../../lib/bff';

// POST /api/auth/logout — revoke this app's refresh token (+ family) server-side
// and clear ONLY the session cookies (plan A.5/US-004 + feature 0010 §13.3/CHANGE
// 2). Device trust (the `__Host-fundi_dt` cookie + row) is deliberately KEPT, so
// the next entry is a free PIN step-up, not a paid SMS-OTP; full un-trust is the
// explicit "Not you?"/device-forget action. Scoped by `app`, so it can never
// touch the other origin's session. Upstream failure is best-effort; we always
// clear locally so the user is signed out here regardless.
export async function POST(): Promise<NextResponse> {
  const refreshToken = await getRefreshTokenForLogout();
  if (refreshToken) {
    await postPublic('/auth/logout', { refreshToken, app: APP });
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
