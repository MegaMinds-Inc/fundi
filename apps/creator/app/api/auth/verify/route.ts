import { NextResponse } from 'next/server';
import { APP, postPublic, setAuthCookies, tokensFrom } from '../../../lib/bff';

// POST /api/auth/verify — proxy to the API's OTP verify (plan A.5/A.6).
// On success the API returns a token pair (org-less if the creator has no
// membership yet) + `needsOnboarding`. We set the httpOnly cookies and return
// ONLY the routing signal to the browser — tokens never ride the response body.
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

  const data = (await res.json().catch(() => null)) as { needsOnboarding?: boolean } | null;
  const pair = tokensFrom(data);
  if (pair) await setAuthCookies(pair);

  return NextResponse.json({ needsOnboarding: !!data?.needsOnboarding });
}
