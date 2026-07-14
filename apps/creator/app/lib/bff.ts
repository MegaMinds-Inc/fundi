// Backend-for-Frontend (BFF) server-side helpers (plan A.4/A.7).
//
// This module runs ONLY server-side (route handlers / server components). It
// holds the API base URL and the auth tokens — the browser never sees either
// (Fundi env policy: no NEXT_PUBLIC_, tokens live in httpOnly cookies). It is
// the single home for cookie shaping + the single-flight silent-refresh
// wrapper so both never drift.

import { cookies } from 'next/headers';
import { AppClient } from '@fundi/types';

/**
 * This app's client identity (creator PWA). Carried as the `app` field on every
 * auth call so refresh rotation + logout stay scoped to this origin — creator
 * and learner are separate cookie jars (plan A.4 per-app scoping).
 */
export const APP: AppClient = AppClient.CREATOR;

// Cookie hardening is an explicit, server-side flag (Fundi env policy: no
// NEXT_PUBLIC_). FULL hardening = the `__Host-` prefix + Secure, which the
// browser only honours with Secure + Path=/ + no Domain. Driven by
// `COOKIE_HARDENING` so staging/prod can force full hardening independent of
// NODE_ENV; defaults ON in production. Set `COOKIE_HARDENING=dev` to opt out on
// plain-http localhost (where a Secure cookie would never set). Confirmed
// direction: full hardening is the default everywhere except an explicit dev opt-out.
const cookieHardening = process.env.COOKIE_HARDENING; // 'full' | 'dev' | undefined
const fullHardening =
  cookieHardening === 'full' ||
  (cookieHardening !== 'dev' && process.env.NODE_ENV === 'production');

export const AT_COOKIE = fullHardening ? '__Host-fundi_at' : 'fundi_at';
export const RT_COOKIE = fullHardening ? '__Host-fundi_rt' : 'fundi_rt';

// Refresh cookie lifetime mirrors the refresh-token TTL (30d default).
const REFRESH_MAX_AGE_S = 60 * 60 * 24 * 30;

function apiBaseUrl(): string {
  const base = process.env.API_BASE_URL;
  if (!base) {
    throw new Error('API_BASE_URL is not set (server-side env — see .env.example).');
  }
  return base.replace(/\/+$/, '');
}

// The API serves all routes under this versioned prefix (see apps/api main.ts
// setGlobalPrefix). API_BASE_URL is the bare host; the version lives in code so
// it stays consistent across every environment. Bump both together for v2.
const API_PREFIX = '/api/v1';

function apiUrl(path: string): string {
  return `${apiBaseUrl()}${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Server-to-server token pair. The refresh token rides this internal response
 * but is NEVER forwarded to the browser body — the BFF stores it in the
 * httpOnly refresh cookie (plan A.4). Field name is a contract with the API
 * (Agent D); flagged needs-confirm.
 */
interface ApiTokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
}

function cookieOptions(maxAgeS: number): CookieOptions {
  return { httpOnly: true, secure: fullHardening, sameSite: 'lax', path: '/', maxAge: maxAgeS };
}

export async function setAuthCookies(pair: ApiTokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(AT_COOKIE, pair.accessToken, cookieOptions(pair.expiresIn));
  jar.set(RT_COOKIE, pair.refreshToken, cookieOptions(REFRESH_MAX_AGE_S));
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  // maxAge 0 expires immediately; same attributes so the browser matches + drops.
  jar.set(AT_COOKIE, '', cookieOptions(0));
  jar.set(RT_COOKIE, '', cookieOptions(0));
}

async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(AT_COOKIE)?.value;
}

async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(RT_COOKIE)?.value;
}

/** Narrow init — the BFF only ever sends JSON bodies with a method. */
export interface ApiInit {
  method?: string;
  body?: string;
}

/**
 * Unauthenticated server-to-server POST (OTP request/verify, logout). Returns
 * `null` on a transport failure so callers can distinguish network from an API
 * status. Never attaches a bearer.
 */
export async function postPublic(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
}

// ── Single-flight silent refresh (plan A.4 / C.2.4) ──────────────────────────
// Concurrent 401s (two tabs, parallel requests) in this server process share
// ONE /auth/refresh call, keyed by the current refresh token. This keeps a
// benign refresh race from looking like token reuse (which would revoke the
// whole family).

type RefreshOutcome =
  | { status: 'refreshed'; pair: ApiTokenPair }
  | { status: 'invalid_grant' } // genuine expiry / reuse — re-auth
  | { status: 'unavailable' }; // network / 5xx — keep the session, retryable

const refreshInFlight = new Map<string, Promise<RefreshOutcome>>();

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
    const pair = (await res.json().catch(() => null)) as ApiTokenPair | null;
    return pair ? { status: 'refreshed', pair } : { status: 'unavailable' };
  }
  // 401/403 from refresh = the refresh token itself is rejected → re-auth.
  if (res.status === 401 || res.status === 403) return { status: 'invalid_grant' };
  // 5xx / anything else → transient; do not eject the user.
  return { status: 'unavailable' };
}

function refreshOnce(refreshToken: string): Promise<RefreshOutcome> {
  const existing = refreshInFlight.get(refreshToken);
  if (existing) return existing;
  // Set the map entry synchronously (no await between get and set) so a
  // concurrent caller always observes the in-flight promise.
  const p = callRefresh(refreshToken).finally(() => refreshInFlight.delete(refreshToken));
  refreshInFlight.set(refreshToken, p);
  return p;
}

/** Outcome of an authenticated BFF→API call. */
export type AuthFetchResult =
  | { kind: 'ok'; status: number; data: unknown }
  | { kind: 'reauth' } // sign in again — cookies cleared
  | { kind: 'retryable' } // network / 5xx — session preserved, show OfflineBanner
  | { kind: 'error'; status: number; data: unknown }; // API 4xx business error

async function bearerFetch(path: string, accessToken: string, init?: ApiInit): Promise<Response> {
  return fetch(apiUrl(path), {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: init?.body,
    cache: 'no-store',
  });
}

async function classify(res: Response): Promise<AuthFetchResult> {
  const data = await res.json().catch(() => null);
  if (res.ok) return { kind: 'ok', status: res.status, data };
  if (res.status >= 500) return { kind: 'retryable' };
  if (res.status === 401 || res.status === 403) {
    await clearAuthCookies();
    return { kind: 'reauth' };
  }
  return { kind: 'error', status: res.status, data };
}

/**
 * Authenticated BFF→API call with single-flight silent refresh: on a 401, call
 * `/auth/refresh` once, rewrite cookies, retry once. `invalid_grant` clears the
 * session (re-auth); network/5xx keeps it (retryable). Never ejects a
 * logged-in user on a flaky connection.
 */
export async function authFetch(path: string, init?: ApiInit): Promise<AuthFetchResult> {
  const access = await getAccessToken();
  if (!access) return { kind: 'reauth' };

  let res: Response;
  try {
    res = await bearerFetch(path, access, init);
  } catch {
    return { kind: 'retryable' };
  }
  if (res.status !== 401) return classify(res);

  const rt = await getRefreshToken();
  if (!rt) {
    await clearAuthCookies();
    return { kind: 'reauth' };
  }

  const outcome = await refreshOnce(rt);
  if (outcome.status === 'invalid_grant') {
    await clearAuthCookies();
    return { kind: 'reauth' };
  }
  if (outcome.status === 'unavailable') return { kind: 'retryable' };

  await setAuthCookies(outcome.pair);
  try {
    res = await bearerFetch(path, outcome.pair.accessToken, init);
  } catch {
    return { kind: 'retryable' };
  }
  return classify(res);
}

/** Extract a token pair from an API response body ({ tokens: {...} }). */
export function tokensFrom(data: unknown): ApiTokenPair | null {
  const tokens = (data as { tokens?: Partial<ApiTokenPair> } | null)?.tokens;
  if (tokens?.accessToken && tokens.refreshToken && typeof tokens.expiresIn === 'number') {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }
  return null;
}

export async function getRefreshTokenForLogout(): Promise<string | undefined> {
  return getRefreshToken();
}
