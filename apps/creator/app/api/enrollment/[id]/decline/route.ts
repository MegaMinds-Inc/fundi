import { NextResponse } from 'next/server';
import { authPost } from '../../../../lib/bff';

// POST /api/enrollment/[id]/decline — proxy to the API's decline endpoint
// (Sprint 2). Decline hard-deletes the enrollment row API-side; the API
// answers 204, so there's no `data` to forward.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authPost(`/enrollment/${encodeURIComponent(id)}/decline`, {});
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'retryable' }, { status: 503 });

  if (result.status === 204) return new NextResponse(null, { status: 204 });
  const code = (result.data as { code?: string } | null)?.code ?? 'decline_failed';
  return NextResponse.json({ error: code }, { status: result.status });
}
