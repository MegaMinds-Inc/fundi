import { NextResponse } from 'next/server';
import { authFetch } from '../../../lib/bff';

// GET /api/enrollment/roster?programId= — proxy to the API's roster query
// (Sprint 2). Feeds the creator dashboard's CohortRoster + InviteApprove.
export async function GET(req: Request): Promise<NextResponse> {
  const programId = new URL(req.url).searchParams.get('programId');
  if (!programId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const result = await authFetch(`/enrollment/roster?programId=${encodeURIComponent(programId)}`);
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'unreachable' || result.kind === 'retryable')
    return NextResponse.json({ error: 'retryable' }, { status: 503 });
  if (result.kind === 'error')
    return NextResponse.json({ error: 'upstream' }, { status: result.status });
  return NextResponse.json(result.data);
}
