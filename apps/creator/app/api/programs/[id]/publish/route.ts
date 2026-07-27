import { NextResponse } from 'next/server';
import { authPost } from '../../../../lib/bff';

// POST /api/programs/[id]/publish — take a program live (feature 0012 slice 3).
// Publishing is a form-level flow whose 400 (`program_not_publishable` — empty /
// no visible module with a lesson) and 404 (`program_not_found`) are business
// outcomes, not session death — so we go through `authPost` (raw status) rather
// than `authFetch` (which clears the session on a 403), and pass the API's
// business `code` through so the client can show the returned message.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authPost(`/programs/${encodeURIComponent(id)}/publish`, {});
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'unreachable')
    return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'server_error' }, { status: 502 });

  // 200 → the fresh ProgramDetail. Any 4xx → pass the business code + message
  // through untouched (esp. 400 `program_not_publishable`).
  if (result.status === 200) return NextResponse.json(result.data);
  const body = result.data as { code?: string; message?: string } | null;
  return NextResponse.json(
    { error: body?.code ?? 'publish_failed', message: body?.message },
    { status: result.status },
  );
}
