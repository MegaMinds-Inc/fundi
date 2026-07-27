import { NextResponse } from 'next/server';
import { clearDeviceCookie } from '../../../../lib/bff';

// GET /api/auth/device/clear — server-side clear of a stale/invalid trusted-device
// cookie (feature 0010 §12.1 / Fix 4). The `/login` resolver redirects here when
// the device cookie is present but does NOT resolve to a live, PIN-backed device
// (JS cannot delete an httpOnly cookie). We drop the cookie and bounce straight
// back to /login; the resolver's next pass sees no device cookie and renders
// phone entry with no further redirect — so there is no loop. This route is under
// /api (excluded from the middleware matcher), so it never triggers the auth gate.
export async function GET(req: Request): Promise<NextResponse> {
  await clearDeviceCookie();
  return NextResponse.redirect(new URL('/login', req.url));
}
