import { NextResponse } from 'next/server';
import { authPost } from '../../../lib/bff';

// POST /api/enrollment/invite — proxy to the API's invite-by-phone endpoint
// (Sprint 2). Business conflicts (e.g. "already enrolled", "invalid cohort")
// are 4xx form-level outcomes, not session death — mirrors pin/set's use of
// authPost over authFetch for exactly that reason.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    programId?: unknown;
    cohortId?: unknown;
    phone?: unknown;
    name?: unknown;
  } | null;
  if (typeof body?.programId !== 'string' || body.programId.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (typeof body?.phone !== 'string' || body.phone.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const payload: { programId: string; cohortId: string | null; phone: string; name?: string } = {
    programId: body.programId,
    cohortId: typeof body.cohortId === 'string' ? body.cohortId : null,
    phone: body.phone,
  };
  if (typeof body.name === 'string' && body.name.length > 0) payload.name = body.name;

  const result = await authPost('/enrollment/invite', payload);
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'retryable' }, { status: 503 });

  if (result.status === 200) return NextResponse.json(result.data);
  const code = (result.data as { code?: string } | null)?.code ?? 'invite_failed';
  return NextResponse.json({ error: code }, { status: result.status });
}
