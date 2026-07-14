import { NextResponse } from 'next/server';
import { authFetch, setAuthCookies, tokensFrom } from '../../../lib/bff';

// POST /api/auth/onboarding — first-run org bootstrap for a creator (plan
// A.6/B.5). Authenticated with the org-less onboarding access token; the API
// creates the Organisation + owner Mentor + Membership, then re-issues a token
// pair carrying the `org` claim which we persist to the cookies.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { orgName?: unknown; name?: unknown } | null;
  const orgName = typeof body?.orgName === 'string' ? body.orgName.trim() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!orgName || !name) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const result = await authFetch('/auth/onboarding', {
    method: 'POST',
    body: JSON.stringify({ orgName, name }),
  });

  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'retryable' }, { status: 503 });
  if (result.kind === 'error') {
    return NextResponse.json({ error: 'onboarding_failed' }, { status: result.status });
  }

  const pair = tokensFrom(result.data);
  if (pair) await setAuthCookies(pair);
  return NextResponse.json({ ok: true });
}
