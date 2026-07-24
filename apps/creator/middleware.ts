import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  AT_COOKIE,
  RT_COOKIE,
  REFRESH_MAX_AGE_S,
  fullHardening,
  refreshOnce,
  rewriteCookieHeader,
} from './app/lib/auth-core';

// Auth-routing gate with PROACTIVE silent refresh (plan A.7 + feature 0010 §1/§6).
//
// Previously presence-only on the access cookie — any user idle > 15 min (the
// access cookie gone) bounced to /login → full phone+OTP even with a valid
// 30-day refresh cookie sitting right there (the dormant-refresh cost leak,
// §1). Now: when the access cookie is absent but a refresh cookie is present we
// attempt a refresh HERE (the one place on a top-level navigation that can set
// cookies on the response), mint a fresh session, and let the request proceed —
// falling through to /login only when no session can be minted. It still never
// verifies the JWT itself (that is the API's job, enforced per request).
//
// Runs on the Edge runtime, so it imports only `auth-core` (no `next/headers`).

function setSessionCookie(res: NextResponse, name: string, value: string, maxAge: number): void {
  res.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: fullHardening,
    sameSite: 'strict',
    path: '/',
    maxAge,
  });
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const isLogin = req.nextUrl.pathname === '/login';
  const hasAccess = req.cookies.has(AT_COOKIE);

  // Established session: keep authed users off /login, otherwise proceed.
  if (hasAccess) {
    if (isLogin) return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  // Access cookie gone — attempt proactive refresh before falling to /login so
  // an idle-but-valid session never drops to OTP (§6).
  const refreshToken = req.cookies.get(RT_COOKIE)?.value;
  if (refreshToken) {
    const outcome = await refreshOnce(refreshToken);
    if (outcome.status === 'refreshed') {
      // Fresh session minted. `/auth/refresh` ROTATED (revoked) the presented RT,
      // so for the PROCEED case we must forward the NEW session cookies into the
      // CURRENT request — not merely set them on the response — or the in-flight
      // RSC render + any in-render `bff.ts`/`authPost` would re-read the OLD RT
      // from `cookies()` and re-present it, tripping the API's reuse/theft branch
      // (feature 0010 H1). Rewrite the forwarded Cookie header for that render.
      // The /login redirect case restarts a fresh middleware pass on `/`, so
      // response cookies alone suffice there.
      let res: NextResponse;
      if (isLogin) {
        res = NextResponse.redirect(new URL('/', req.url));
      } else {
        const headers = new Headers(req.headers);
        headers.set(
          'cookie',
          rewriteCookieHeader(req.headers.get('cookie'), {
            [AT_COOKIE]: outcome.pair.accessToken,
            [RT_COOKIE]: outcome.pair.refreshToken,
          }),
        );
        res = NextResponse.next({ request: { headers } });
      }
      setSessionCookie(res, AT_COOKIE, outcome.pair.accessToken, outcome.pair.expiresIn);
      setSessionCookie(res, RT_COOKIE, outcome.pair.refreshToken, REFRESH_MAX_AGE_S);
      return res;
    }
    // rejected (idle/expired/reuse → the resolver will offer PIN or phone) or
    // unavailable (transient) → no mintable session. Fall through. We do NOT
    // clear cookies on the Edge; the resolver reads the device cookie to pick
    // the entry screen, and the auth flows overwrite the session cookies.
  }

  // No session could be minted. Render the login resolver (which itself decides
  // pin-entry vs phone from the device cookie); redirect everything else to it.
  if (isLogin) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  // Everything except API routes, Next internals, and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|icon.svg).*)',
  ],
};
