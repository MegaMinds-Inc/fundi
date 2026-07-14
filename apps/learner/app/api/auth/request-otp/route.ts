import { NextResponse } from 'next/server';
import { postPublic } from '../../../lib/bff';

// POST /api/auth/request-otp — proxy to the API's OTP request (plan A.5).
// The API always answers 204 (no account enumeration); we mirror that. A rate
// limit surfaces as 429 so the client can show the throttle notice.
export async function POST(req: Request): Promise<NextResponse | Response> {
  const body = (await req.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = body?.phone;
  if (typeof phone !== 'string' || phone.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const res = await postPublic('/auth/otp/request', { phone });
  if (!res || res.status >= 500) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  if (res.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  return new NextResponse(null, { status: 204 });
}
