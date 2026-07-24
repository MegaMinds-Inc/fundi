import { NextResponse } from 'next/server';
import {
  APP,
  pairFromFlat,
  postWithDeviceCookies,
  setAuthCookies,
  setDeviceCookie,
} from '../../../../lib/bff';

// POST /api/auth/pin/reset — forgot-PIN reset (feature 0010 §4.6/§12.6). The
// client holds NO phone: the reset OTP (proof of phone ownership) and the new
// PIN are submitted together. The API resolves the account from the forwarded
// device cookie, consumes the OTP, sets the new PIN, revokes every old refresh
// family, and mints a fresh signed-in session returning a FLAT `IssuedTokens` +
// the ROTATED `deviceSecret` + memberships. On 200 we set the fresh access/
// refresh cookies + the rotated device cookie and STRIP every secret from the
// body. A 422 weak/invalid-PIN is a form error (code propagated, the reset OTP
// is already spent — request a new one); a 401 pin_rejected (bad device / wrong
// or expired OTP) is uniform. No enumeration.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { otpCode?: unknown; pin?: unknown }
    | null;
  if (
    typeof body?.otpCode !== 'string' ||
    body.otpCode.length === 0 ||
    typeof body?.pin !== 'string' ||
    body.pin.length === 0
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const res = await postWithDeviceCookies('/auth/pin/reset', {
    otpCode: body.otpCode,
    pin: body.pin,
    app: APP,
  });
  if (!res || res.status >= 500) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  if (res.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (res.status === 422) {
    // Weak/invalid PIN — a form error, not session death. Propagate the code.
    const detail = (await res.json().catch(() => null)) as { code?: string } | null;
    return NextResponse.json({ error: detail?.code ?? 'pin_invalid' }, { status: 422 });
  }
  if (!res.ok) {
    // 401 pin_rejected (bad device / wrong or expired OTP) — uniform, no leak.
    return NextResponse.json({ error: 'pin_rejected' }, { status: 401 });
  }

  const data = (await res.json().catch(() => null)) as { deviceSecret?: string } | null;
  const pair = pairFromFlat(data);
  if (pair) await setAuthCookies(pair);
  if (typeof data?.deviceSecret === 'string') await setDeviceCookie(data.deviceSecret);

  return NextResponse.json({ ok: true });
}
