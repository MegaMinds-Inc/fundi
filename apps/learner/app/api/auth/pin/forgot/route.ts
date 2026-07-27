import { NextResponse } from 'next/server';
import { APP, postWithDeviceCookies } from '../../../../lib/bff';

// POST /api/auth/pin/forgot — server-driven PIN-reset OTP send (feature 0010
// §4.6/§6). The client holds NO phone: the API resolves the account from the
// forwarded device cookie, enforces the global SMS-budget breaker, and sends the
// reset OTP. Enumeration-safe (always 204 on the happy path); a budget/throttle
// block surfaces as 503/429 so the client can back off.
export async function POST(): Promise<NextResponse | Response> {
  const res = await postWithDeviceCookies('/auth/pin/forgot', { app: APP });
  if (!res) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  if (res.status === 503) return NextResponse.json({ error: 'sms_budget' }, { status: 503 });
  if (res.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (res.status >= 500) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  return new NextResponse(null, { status: 204 });
}
