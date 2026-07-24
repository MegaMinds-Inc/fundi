import { NextResponse } from 'next/server';
import { authFetch } from '../../lib/bff';

// GET /api/programs — proxy to the API's org-scoped program list, for the
// creator dashboard's program picker (Sprint 2).
export async function GET(): Promise<NextResponse> {
  const result = await authFetch('/programs');
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'retryable' }, { status: 503 });
  if (result.kind === 'error')
    return NextResponse.json({ error: 'upstream' }, { status: result.status });
  return NextResponse.json(result.data);
}
