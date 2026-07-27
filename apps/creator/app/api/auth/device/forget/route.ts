import { NextResponse } from 'next/server';
import { APP, clearDeviceCookie, postWithDeviceCookies } from '../../../../lib/bff';

// POST /api/auth/device/forget — "Not you?" (feature 0010 §4/§12.4). Revokes the
// trusted-device row server-side (the API clears its own device cookie) and
// clears the BROWSER device cookie here (JS cannot delete an httpOnly cookie).
// Next entry on this device is therefore a full OTP. Best-effort upstream; we
// clear the local cookie regardless so the device is de-trusted here.
export async function POST(): Promise<NextResponse | Response> {
  await postWithDeviceCookies('/auth/device/forget', { app: APP });
  await clearDeviceCookie();
  return new NextResponse(null, { status: 204 });
}
