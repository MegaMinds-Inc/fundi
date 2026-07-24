import { NextResponse } from 'next/server';
import { APP, postPublic, setAuthCookies, setDeviceCookie, tokensFrom } from '../../../lib/bff';

// POST /api/auth/verify — proxy to the API's OTP verify (plan A.5/A.6 + 0010 §6).
// On success the API returns a token pair (org-less if the creator has no
// membership yet) + `needsOnboarding`, the enrollment `deviceSecret` (trusted-
// device trust for this app), and `needsPinSetup`. We set the httpOnly cookies —
// access + refresh AND the device cookie — and return ONLY the routing signals
// to the browser; the tokens and the device secret never ride the response body.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { phone?: unknown; code?: unknown } | null;
  if (typeof body?.phone !== 'string' || typeof body?.code !== 'string') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const res = await postPublic('/auth/otp/verify', {
    phone: body.phone,
    code: body.code,
    app: APP,
  });
  if (!res || res.status >= 500) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  if (res.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (!res.ok) {
    // Wrong / expired / locked code — a form-level retry, not a network failure.
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const data = (await res.json().catch(() => null)) as {
    needsOnboarding?: boolean;
    needsPinSetup?: boolean;
    deviceSecret?: string;
  } | null;
  const pair = tokensFrom(data);
  if (pair) await setAuthCookies(pair);
  if (typeof data?.deviceSecret === 'string') await setDeviceCookie(data.deviceSecret);

  return NextResponse.json({
    needsOnboarding: !!data?.needsOnboarding,
    needsPinSetup: !!data?.needsPinSetup,
  });
}
