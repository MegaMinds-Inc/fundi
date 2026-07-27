import { NextResponse } from 'next/server';
import type { UpdateModuleRequest } from '@fundi/types';
import { authFetch } from '../../../lib/bff';

// PATCH /api/modules/[id] — autosave a subset of {title,description,unlockMode,
// unlockDays} from the module settings panel (feature 0012 slice 2). 400
// (invalid_field) / 404 (module_not_found) are form-level outcomes — go through
// `authFetch` but pass their status/code through (it only clears on 401/403).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    description?: unknown;
    unlockMode?: unknown;
    unlockDays?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  // Forward only the recognised, correctly-typed fields (any subset). `unlockDays`
  // accepts a number or an explicit null (clears the value); `description` may be
  // null to clear it too.
  const payload: UpdateModuleRequest = {};
  if (typeof body.title === 'string') payload.title = body.title;
  if (typeof body.description === 'string' || body.description === null)
    payload.description = body.description as string | null;
  if (typeof body.unlockMode === 'string')
    payload.unlockMode = body.unlockMode as UpdateModuleRequest['unlockMode'];
  if (typeof body.unlockDays === 'number' || body.unlockDays === null)
    payload.unlockDays = body.unlockDays as number | null;

  const result = await authFetch(`/modules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
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
  return NextResponse.json(result.data);
}

// DELETE /api/modules/[id] — remove a module (cascades to its lessons). The API
// answers 204; we forward that with an empty body. 404 (module_not_found) is a
// business outcome passed through.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authFetch(`/modules/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
