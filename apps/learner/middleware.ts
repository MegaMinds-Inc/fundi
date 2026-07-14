import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Lightweight auth-presence gate (plan A.7). It only checks for the access
// cookie's presence for routing — it does NOT verify the JWT (that is the API's
// job, enforced per request). Unauthenticated users are sent to /login;
// already-authenticated users are kept out of /login.
const AT_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-fundi_at' : 'fundi_at';

export function middleware(req: NextRequest): NextResponse {
  const authed = req.cookies.has(AT_COOKIE);
  const isLogin = req.nextUrl.pathname === '/login';

  if (!authed && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (authed && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals, and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|icon.svg).*)',
  ],
};
