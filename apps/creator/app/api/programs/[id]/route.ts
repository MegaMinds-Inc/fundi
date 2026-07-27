import { NextResponse } from 'next/server';
import type { UpdateProgramRequest } from '@fundi/types';
import { authFetch } from '../../../lib/bff';

// GET /api/programs/[id] — proxy the API's full program detail (program +
// ordered modules + lessons) for the builder to load (feature 0012). A missing
// or cross-org program is a 404 (`program_not_found`) — a business outcome, so
// we pass the status through rather than treating it as re-auth.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authFetch(`/programs/${encodeURIComponent(id)}`);
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

// PATCH /api/programs/[id] — autosave a subset of {title,description,shape,
// visibility,coverStyle} from the setup stage (feature 0012). 400 (invalid_field)
// / 404 (program_not_found) are form-level outcomes — go through `authFetch` but
// pass their status/code through, never clearing the session on a 4xx here.
// (`authFetch` only clears on 401/403; a 404/400 stays `{ kind: 'error' }`.)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    description?: unknown;
    shape?: unknown;
    visibility?: unknown;
    coverStyle?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  // Forward only the recognised, correctly-typed fields (any subset).
  const payload: UpdateProgramRequest = {};
  if (typeof body.title === 'string') payload.title = body.title;
  if (typeof body.description === 'string') payload.description = body.description;
  if (typeof body.shape === 'string') payload.shape = body.shape as UpdateProgramRequest['shape'];
  if (typeof body.visibility === 'string')
    payload.visibility = body.visibility as UpdateProgramRequest['visibility'];
  if (typeof body.coverStyle === 'string')
    payload.coverStyle = body.coverStyle as UpdateProgramRequest['coverStyle'];

  const result = await authFetch(`/programs/${encodeURIComponent(id)}`, {
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
