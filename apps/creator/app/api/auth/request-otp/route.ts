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
  if (!res) return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (res.status >= 500) return NextResponse.json({ error: 'server_error' }, { status: 502 });
  if (res.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (!res.ok) {
    // Any other non-2xx is a real upstream rejection — an unparseable phone (400)
    // or a routing/config mistake (404). Mirrors `verify`: surface it as a
    // form-level 400 rather than a false success, and log the status so a
    // misconfigured API_BASE_URL is visible instead of silently reading as 204.
    // Enumeration-safe: the API's otp/request never varies its status on whether
    // the account exists, so nothing leaks.
    console.error(`[request-otp] API rejected the send: HTTP ${res.status}`);
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
