import { NextResponse } from 'next/server';
import { APP, clearAuthCookies, getRefreshTokenForLogout, postPublic } from '../../../lib/bff';

// POST /api/auth/logout — revoke this app's refresh token (+ family) server-side
// and clear the httpOnly cookies (plan A.5/US-004). Scoped by `app`, so it can
// never touch the creator origin's session. Upstream failure is best-effort; we
// always clear locally so the user is signed out here regardless.
export async function POST(): Promise<NextResponse> {
  const refreshToken = await getRefreshTokenForLogout();
  if (refreshToken) {
    await postPublic('/auth/logout', { refreshToken, app: APP });
  }
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
