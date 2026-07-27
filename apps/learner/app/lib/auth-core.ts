// Edge-safe auth transport (feature 0010 §6/§12.1).
//
// This module is shared by BOTH the Node route handlers (`app/lib/bff.ts`) and
// the Edge middleware (`middleware.ts`). It therefore imports NO `next/headers`
// — that module is unavailable in the Edge runtime. It owns the pieces both
// runtimes need to agree on: the cookie-name resolution, the API URL builder,
// and the single-flight silent-refresh transport (so the `/login` resolver,
// the middleware proactive refresh, and `authFetch` never drift on how a
// refresh is called or on what a rejection means).
//
// Everything here reads only `process.env` + `fetch`, both available on Edge.

import { AppClient } from '@fundi/types';

/**
 * This app's client identity (learner PWA). Carried as the `app` field on the
 * refresh call so rotation stays scoped to this origin — creator and learner
 * are separate cookie jars (plan A.4 per-app scoping).
 */
export const APP: AppClient = AppClient.LEARNER;

// Cookie hardening flag (mirrors bff.ts, kept here so middleware resolves the
// SAME cookie names). FULL = `__Host-` prefix + Secure; defaults ON in
// production, opt out on plain-http localhost with COOKIE_HARDENING=dev.
const cookieHardening = process.env.COOKIE_HARDENING; // 'full' | 'dev' | undefined
export const fullHardening =
  cookieHardening === 'full' ||
  (cookieHardening !== 'dev' && process.env.NODE_ENV === 'production');

export const AT_COOKIE = fullHardening ? '__Host-fundi_at' : 'fundi_at';
export const RT_COOKIE = fullHardening ? '__Host-fundi_rt' : 'fundi_rt';
// Trusted-device cookie (feature 0010 §5). Distinct jar from the session so
// device trust can outlive a session; browser-facing, set/cleared by the BFF.
export const DT_COOKIE = fullHardening ? '__Host-fundi_dt' : 'fundi_dt';

// Refresh cookie lifetime mirrors the refresh-token TTL (30d default).
export const REFRESH_MAX_AGE_S = 60 * 60 * 24 * 30;
// Trusted-device cookie lifetime mirrors TRUSTED_DEVICE_TTL_SECONDS (180d).
export const DEVICE_MAX_AGE_S = 60 * 60 * 24 * 180;

function apiBaseUrl(): string {
  const base = process.env.API_BASE_URL;
  if (!base) {
    throw new Error('API_BASE_URL is not set (server-side env — see .env.example).');
  }
  return base.replace(/\/+$/, '');
}

// The API serves all routes under this versioned prefix (see apps/api main.ts
// setGlobalPrefix). Bump together with the API for v2.
const API_PREFIX = '/api/v1';

export function apiUrl(path: string): string {
  return `${apiBaseUrl()}${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Rewrite a raw `Cookie` request-header string, overriding (or adding) the named
 * cookies and preserving the rest. Pure string work (no `next/headers`), so it
 * is Edge-safe and unit-testable in isolation.
 *
 * Used by the middleware after a PROACTIVE silent refresh (feature 0010 H1): the
 * `/auth/refresh` call ROTATES (revokes) the presented refresh token, so the new
 * session cookies must be forwarded into the CURRENT request — not just set on
 * the response — or the in-flight RSC render + any in-render `bff.ts`/`authPost`
 * would still read the OLD (now-revoked) refresh token from `cookies()` and
 * re-present it, tripping the API's reuse/theft branch. Rewriting the forwarded
 * `Cookie` header makes the render see the NEW access + refresh tokens.
 */
export function rewriteCookieHeader(
  original: string | null | undefined,
  overrides: Record<string, string>,
): string {
  // Preserve insertion order: existing cookies first (values updated in place),
  // then any brand-new names. A Map keyed by cookie name dedupes cleanly.
  const jar = new Map<string, string>();
  if (original) {
    for (const part of original.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (!name) continue;
      jar.set(name, part.slice(eq + 1).trim());
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    jar.set(name, value);
  }
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Browser-safe token pair the BFF writes to httpOnly cookies. The opaque
 * refresh token rides the internal (API → BFF) response but is NEVER forwarded
 * to the browser body — the BFF stores it in the httpOnly refresh cookie.
 */
export interface ApiTokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

/**
 * Distinct refresh-rejection codes the API returns on the expiry split (§6):
 * `reauth_required` (idle) / `session_expired` (absolute cap) → the user should
 * step up with a PIN; `invalid_grant` (reuse/theft/race/genuine expiry) → full
 * re-auth.
 */
export type RefreshRejectionCode = 'reauth_required' | 'session_expired' | 'invalid_grant';

export type RefreshOutcome =
  | { status: 'refreshed'; pair: ApiTokenPair }
  | { status: 'rejected'; code: RefreshRejectionCode } // refresh token itself rejected
  | { status: 'unavailable' }; // network / 5xx — keep the session, retryable

/**
 * Extract a token pair from a FLAT API body (`IssuedTokens`: the shape of
 * `/auth/refresh` and `/auth/pin/verify`). Distinct from `tokensFrom` in
 * bff.ts, which reads a nested `{ tokens: {...} }` (otp/verify, onboarding).
 */
export function pairFromFlat(data: unknown): ApiTokenPair | null {
  const t = data as Partial<ApiTokenPair> | null;
  if (t?.accessToken && t.refreshToken && typeof t.expiresIn === 'number') {
    return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresIn: t.expiresIn };
  }
  return null;
}

async function callRefresh(refreshToken: string): Promise<RefreshOutcome> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken, app: APP }),
      cache: 'no-store',
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (res.ok) {
    const pair = pairFromFlat(await res.json().catch(() => null));
    return pair ? { status: 'refreshed', pair } : { status: 'unavailable' };
  }
  // 401/403 = the refresh token itself is rejected → surface the API `code` so
  // the login resolver can branch idle/expired (→ PIN) vs invalid (→ phone).
  if (res.status === 401 || res.status === 403) {
    const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
    const code = body?.code;
    const known: RefreshRejectionCode =
      code === 'reauth_required' || code === 'session_expired' ? code : 'invalid_grant';
    return { status: 'rejected', code: known };
  }
  // 5xx / anything else → transient; do not eject the user.
  return { status: 'unavailable' };
}

// ── Single-flight silent refresh (plan A.4 / C.2.4) ──────────────────────────
// Concurrent AT-absent requests (two tabs, a page + its prefetch) in this
// runtime share ONE /auth/refresh call, keyed by the refresh token — a benign
// refresh race never looks like token reuse (which would revoke the family).
const refreshInFlight = new Map<string, Promise<RefreshOutcome>>();

export function refreshOnce(refreshToken: string): Promise<RefreshOutcome> {
  const existing = refreshInFlight.get(refreshToken);
  if (existing) return existing;
  // Set synchronously (no await between get and set) so a concurrent caller
  // always observes the in-flight promise.
  const p = callRefresh(refreshToken).finally(() => refreshInFlight.delete(refreshToken));
  refreshInFlight.set(refreshToken, p);
  return p;
}
