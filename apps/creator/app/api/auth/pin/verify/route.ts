import { NextResponse } from 'next/server';
import {
  APP,
  pairFromFlat,
  postWithDeviceCookies,
  setAuthCookies,
  setDeviceCookie,
} from '../../../../lib/bff';

// POST /api/auth/pin/verify — device + PIN step-up re-auth (feature 0010 §4.3/§6).
// Forwards the browser's httpOnly device (and lapsed refresh) cookie to the API,
// which derives `app`/`accountId` from the trusted-device row. On success the
// API returns a FLAT `IssuedTokens` + the ROTATED `deviceSecret` + memberships;
// we set the fresh access/refresh cookies and the rotated device cookie, and
// strip every secret from the body. A miss is a UNIFORM 401 `pin_rejected` (no
// invalid-vs-locked oracle) → the client shows AuthFlow's generic error. No SMS.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  if (typeof body?.pin !== 'string' || body.pin.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const res = await postWithDeviceCookies('/auth/pin/verify', { pin: body.pin, app: APP });
  if (!res || res.status >= 500) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  if (res.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (!res.ok) {
    // 401 pin_rejected (wrong/locked/no-device) — uniform, no detail leaked.
    return NextResponse.json({ error: 'pin_rejected' }, { status: 401 });
  }

  const data = (await res.json().catch(() => null)) as { deviceSecret?: string } | null;
  const pair = pairFromFlat(data);
  if (pair) await setAuthCookies(pair);
  if (typeof data?.deviceSecret === 'string') await setDeviceCookie(data.deviceSecret);

  return NextResponse.json({ ok: true });
}
