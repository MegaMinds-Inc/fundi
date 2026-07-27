import { NextResponse } from 'next/server';
import { APP, pairFromFlat, postPublic, setAuthCookies, setDeviceCookie } from '../../../../lib/bff';

// POST /api/auth/pin/reset — PHONE-based forgot-PIN reset (feature 0010 §4.6/§12.6).
// Device-INDEPENDENT: the client sends { phone, otpCode, pin } (the device may be
// revoked — the whole reason the user is here). The API normalizes the phone,
// consumes the OTP (proof of phone ownership), resolves the account by phone, sets
// the new PIN, revokes every old refresh family, and mints a fresh signed-in
// session on a NEWLY enrolled device — returning a FLAT `IssuedTokens` + the fresh
// `deviceSecret` + memberships. On 200 we set the fresh access/refresh cookies +
// the device cookie and STRIP every secret from the body. A 422 weak/invalid-PIN
// is a form error (code propagated, the OTP is already spent — request a new one);
// a 401 pin_rejected (wrong/expired OTP or unknown phone) is uniform. No enumeration.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    phone?: unknown;
    otpCode?: unknown;
    pin?: unknown;
  } | null;
  if (
    typeof body?.phone !== 'string' ||
    body.phone.length === 0 ||
    typeof body?.otpCode !== 'string' ||
    body.otpCode.length === 0 ||
    typeof body?.pin !== 'string' ||
    body.pin.length === 0
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const res = await postPublic('/auth/pin/reset', {
    phone: body.phone,
    otpCode: body.otpCode,
    pin: body.pin,
    app: APP,
  });
  if (!res) return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (res.status >= 500) return NextResponse.json({ error: 'server_error' }, { status: 502 });
  if (res.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (res.status === 422) {
    // Weak/invalid PIN — a form error, not session death. Propagate the code.
    const detail = (await res.json().catch(() => null)) as { code?: string } | null;
    return NextResponse.json({ error: detail?.code ?? 'pin_invalid' }, { status: 422 });
  }
  if (!res.ok) {
    // 401 pin_rejected (wrong/expired OTP or unknown phone) — uniform, no leak.
    return NextResponse.json({ error: 'pin_rejected' }, { status: 401 });
  }

  const data = (await res.json().catch(() => null)) as { deviceSecret?: string } | null;
  const pair = pairFromFlat(data);
  if (pair) await setAuthCookies(pair);
  if (typeof data?.deviceSecret === 'string') await setDeviceCookie(data.deviceSecret);

  return NextResponse.json({ ok: true });
}
