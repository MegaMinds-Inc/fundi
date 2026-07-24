// Backend-for-Frontend (BFF) server-side helpers (plan A.4/A.7 + feature 0010 §6).
//
// This module runs ONLY in a Node server context (route handlers / server
// components) — it uses `next/headers`, which the Edge middleware cannot. The
// runtime-agnostic transport (cookie names, API URL, refresh single-flight)
// lives in `auth-core.ts` and is shared with the middleware; this file adds the
// httpOnly cookie IO on top. It is the single home for cookie shaping so the
// browser never sees the API URL or a token/secret (Fundi env policy: no
// NEXT_PUBLIC_).

import { cookies } from 'next/headers';
import type { MeResult } from '@fundi/types';
import {
  APP,
  AT_COOKIE,
  RT_COOKIE,
  DT_COOKIE,
  REFRESH_MAX_AGE_S,
  DEVICE_MAX_AGE_S,
  fullHardening,
  apiUrl,
  refreshOnce,
  pairFromFlat,
  type ApiTokenPair,
} from './auth-core';

export {
  APP,
  AT_COOKIE,
  RT_COOKIE,
  DT_COOKIE,
  apiUrl,
  refreshOnce,
  pairFromFlat,
  type ApiTokenPair,
};

interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  // `SameSite=Strict` on every auth cookie (feature 0010 §7.6). The apps are a
  // single origin each, so same-site top-level navigation (the middleware
  // redirect, a PWA launch) still carries the cookie; a forged cross-site POST
  // does not — the CSRF backstop paired with the API's `Sec-Fetch-Site` reject.
  sameSite: 'strict';
  path: '/';
  maxAge: number;
}

function cookieOptions(maxAgeS: number): CookieOptions {
  return { httpOnly: true, secure: fullHardening, sameSite: 'strict', path: '/', maxAge: maxAgeS };
}

export async function setAuthCookies(pair: ApiTokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(AT_COOKIE, pair.accessToken, cookieOptions(pair.expiresIn));
  jar.set(RT_COOKIE, pair.refreshToken, cookieOptions(REFRESH_MAX_AGE_S));
}

/** Write the browser-facing trusted-device cookie from the secret the API
 * returned in the JSON body (feature 0010 §6). Rotated on every step-up. */
export async function setDeviceCookie(secret: string): Promise<void> {
  const jar = await cookies();
  jar.set(DT_COOKIE, secret, cookieOptions(DEVICE_MAX_AGE_S));
}

export async function clearDeviceCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(DT_COOKIE, '', cookieOptions(0));
}

/** Full clear — session cookies AND device trust (AT+RT+DT). Used when the whole
 * enrollment must drop: `device/forget` ("Not you?") and a hard session-death
 * re-auth. An explicit logout does NOT use this (see {@link clearSessionCookies}). */
export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  // maxAge 0 expires immediately; same attributes so the browser matches + drops.
  jar.set(AT_COOKIE, '', cookieOptions(0));
  jar.set(RT_COOKIE, '', cookieOptions(0));
  jar.set(DT_COOKIE, '', cookieOptions(0));
}

/** Clear ONLY the session cookies (access + refresh), KEEPING device trust
 * (feature 0010 §13.3 / CHANGE 2). Used by logout: the session ends but the
 * device stays enrolled, so the next entry is a free PIN step-up — not a paid
 * SMS-OTP. Full un-trust is the explicit "Not you?"/device-forget action. */
export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.set(AT_COOKIE, '', cookieOptions(0));
  jar.set(RT_COOKIE, '', cookieOptions(0));
}

async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(AT_COOKIE)?.value;
}

async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(RT_COOKIE)?.value;
}

async function getDeviceSecret(): Promise<string | undefined> {
  return (await cookies()).get(DT_COOKIE)?.value;
}

/** Read the refresh token for the server-side `/login` resolver. */
export async function getRefreshTokenValue(): Promise<string | undefined> {
  return getRefreshToken();
}

/** Whether a trusted-device cookie is present (drives the resolver's
 * pin-entry-vs-phone decision, feature 0010 §12.1). */
export async function hasDeviceCookie(): Promise<boolean> {
  return !!(await getDeviceSecret());
}

/**
 * Server-side `GET /auth/me` for the mandatory PIN-setup gate (feature 0010
 * CHANGE 1). Reads the access cookie and calls the API with a bearer — it makes
 * NO cookie writes, so it is safe to call during a Server Component render (which
 * cannot set cookies). The middleware has already proactively refreshed a lapsed
 * access token before the page renders, so a present access cookie is a live one;
 * a missing/invalid one returns `null` and the gate redirects to `/login`.
 */
export async function getMe(): Promise<MeResult | null> {
  const access = await getAccessToken();
  if (!access) return null;
  let res: Response;
  try {
    res = await fetch(apiUrl('/auth/me'), {
      headers: { authorization: `Bearer ${access}` },
      cache: 'no-store',
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as MeResult | null;
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

/**
 * Server-to-server POST that forwards the browser's httpOnly device (and,
 * optionally, refresh) cookie to the API as a `Cookie` header (feature 0010 §6:
 * `pin/verify`, `pin/forgot`, `device/forget` read the device cookie
 * server-side). No browser `Sec-Fetch-Site` is forwarded (§7.6), so the API's
 * cross-site reject never fires on these calls. The cookie NAMES match what the
 * API's cookie-parser accepts (`fundi_dt`/`__Host-fundi_dt`, `fundi_rt`/…).
 */
export async function postWithDeviceCookies(path: string, body: unknown): Promise<Response | null> {
  const device = await getDeviceSecret();
  const refresh = await getRefreshToken();
  const parts: string[] = [];
  if (refresh) parts.push(`${RT_COOKIE}=${refresh}`);
  if (device) parts.push(`${DT_COOKIE}=${device}`);
  try {
    return await fetch(apiUrl(path), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(parts.length ? { cookie: parts.join('; ') } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
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
 * `/auth/refresh` once, rewrite cookies, retry once. A refresh rejection clears
 * the session (re-auth); network/5xx keeps it (retryable). Never ejects a
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
  if (outcome.status === 'rejected') {
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

/**
 * Refresh-aware authenticated POST that returns the RAW status + body without
 * treating a business 4xx as a re-auth (unlike {@link authFetch}, which clears
 * the session on any 403). Needed by `pin/set`, whose 403 `pin_change_requires_
 * proof` / 422 `weak_pin` are form-level outcomes, NOT session death. Only a
 * refresh REJECTION clears cookies.
 */
export type AuthPostResult =
  { kind: 'response'; status: number; data: unknown } | { kind: 'reauth' } | { kind: 'retryable' };

export async function authPost(path: string, body: unknown): Promise<AuthPostResult> {
  let access = await getAccessToken();
  if (!access) {
    // No access token — try to mint one from the refresh cookie before failing.
    const rt = await getRefreshToken();
    if (!rt) return { kind: 'reauth' };
    const outcome = await refreshOnce(rt);
    if (outcome.status === 'rejected') {
      await clearAuthCookies();
      return { kind: 'reauth' };
    }
    if (outcome.status === 'unavailable') return { kind: 'retryable' };
    await setAuthCookies(outcome.pair);
    access = outcome.pair.accessToken;
  }

  const init: ApiInit = { method: 'POST', body: JSON.stringify(body) };
  let res: Response;
  try {
    res = await bearerFetch(path, access, init);
  } catch {
    return { kind: 'retryable' };
  }
  if (res.status === 401) {
    const rt = await getRefreshToken();
    if (!rt) {
      await clearAuthCookies();
      return { kind: 'reauth' };
    }
    const outcome = await refreshOnce(rt);
    if (outcome.status === 'rejected') {
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
  }
  if (res.status >= 500) return { kind: 'retryable' };
  const data = await res.json().catch(() => null);
  return { kind: 'response', status: res.status, data };
}

/** Extract a token pair from a NESTED API response body (`{ tokens: {...} }` —
 * otp/verify, onboarding). Flat bodies (refresh, pin/verify) use `pairFromFlat`. */
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
