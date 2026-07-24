import { NextResponse } from 'next/server';
import { authPost } from '../../../../lib/bff';

// POST /api/auth/pin/set — persist a PIN (feature 0010 §7.1). Authenticated with
// the current access token (refresh-aware via `authPost`). First-time set (no
// existing PIN) needs no proof; a replace needs `currentPin`/`otpCode` and the
// API answers 403 `pin_change_requires_proof`. `authPost` returns the raw status
// so a 403/422 stays a form-level outcome and does NOT clear the session (unlike
// `authFetch`, which treats any 403 as re-auth). No cookies to set — `pin/set`
// returns only `{ ok: true }`; it issues no tokens.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    pin?: unknown;
    currentPin?: unknown;
    otpCode?: unknown;
  } | null;
  if (typeof body?.pin !== 'string' || body.pin.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const payload: { pin: string; currentPin?: string; otpCode?: string } = { pin: body.pin };
  if (typeof body.currentPin === 'string') payload.currentPin = body.currentPin;
  if (typeof body.otpCode === 'string') payload.otpCode = body.otpCode;

  const result = await authPost('/auth/pin/set', payload);
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'retryable' }, { status: 503 });

  if (result.status === 200) return NextResponse.json({ ok: true });
  // Propagate the API's business `code` (pin_change_requires_proof / weak_pin /
  // pin_invalid) so the client can branch.
  const code = (result.data as { code?: string } | null)?.code ?? 'pin_set_failed';
  return NextResponse.json({ error: code }, { status: result.status });
}
