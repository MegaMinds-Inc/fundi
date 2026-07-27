import { NextResponse } from 'next/server';
import { authPost } from '../../../../lib/bff';

// POST /api/programs/[id]/unpublish — return a published program to draft
// (feature 0012 slice 3). Surfaced from program settings, not the PublishBar.
// A 404 (`program_not_found`) is a business outcome, not session death — so we
// go through `authPost` (raw status) and pass the code through.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authPost(`/programs/${encodeURIComponent(id)}/unpublish`, {});
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'unreachable')
    return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'server_error' }, { status: 502 });

  if (result.status === 200) return NextResponse.json(result.data);
  const body = result.data as { code?: string; message?: string } | null;
  return NextResponse.json(
    { error: body?.code ?? 'unpublish_failed', message: body?.message },
    { status: result.status },
  );
}
