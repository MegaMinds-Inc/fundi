import { NextResponse } from 'next/server';
import { authPost } from '../../../../lib/bff';

// POST /api/enrollment/[id]/approve — proxy to the API's approve endpoint
// (Sprint 2).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authPost(`/enrollment/${encodeURIComponent(id)}/approve`, {});
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'retryable' }, { status: 503 });

  if (result.status === 200) return NextResponse.json(result.data);
  const code = (result.data as { code?: string } | null)?.code ?? 'approve_failed';
  return NextResponse.json({ error: code }, { status: result.status });
}
