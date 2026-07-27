import { NextResponse } from 'next/server';
import type { CreateModuleRequest } from '@fundi/types';
import { authPost } from '../../../../lib/bff';

// POST /api/programs/[id]/modules — append a module to a program (feature 0012
// slice 2). Creating is a form-level flow whose 400 (invalid_field) / 404
// (program_not_found) are business outcomes, not session death — so we go
// through `authPost` (raw status) rather than `authFetch` (which clears the
// session on a 403).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
  if (typeof body?.title !== 'string' || body.title.trim().length === 0) {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  const payload: CreateModuleRequest = { title: body.title.trim() };
  const result = await authPost(`/programs/${encodeURIComponent(id)}/modules`, payload);
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'unreachable')
    return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'server_error' }, { status: 502 });

  if (result.status === 201) return NextResponse.json(result.data, { status: 201 });
  const code = (result.data as { code?: string } | null)?.code ?? 'create_failed';
  return NextResponse.json({ error: code }, { status: result.status });
}
