import { NextResponse } from 'next/server';
import type { MoveRequest } from '@fundi/types';
import { authFetch } from '../../../../lib/bff';

// POST /api/lessons/[id]/move — swap a lesson with its adjacent sibling within
// its module (feature 0012 slice 2). The API answers 204. 400 (invalid_field) /
// 404 (lesson_not_found) pass through.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { direction?: unknown } | null;
  if (body?.direction !== 'up' && body?.direction !== 'down') {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  const payload: MoveRequest = { direction: body.direction };
  const result = await authFetch(`/lessons/${encodeURIComponent(id)}/move`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'unreachable')
    return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'server_error' }, { status: 502 });
  if (result.kind === 'error') {
    const code = (result.data as { code?: string } | null)?.code ?? 'upstream';
    return NextResponse.json({ error: code }, { status: result.status });
  }
  return new NextResponse(null, { status: 204 });
}
