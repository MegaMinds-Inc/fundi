import { NextResponse } from 'next/server';
import type { CreateProgramRequest } from '@fundi/types';
import { authFetch, authPost } from '../../lib/bff';

// GET /api/programs — proxy the API's org-scoped program list for the creator
// home grid (feature 0012). Returns ProgramSummary[] enriched with
// status/coverStyle/moduleCount/learnerCount.
export async function GET(): Promise<NextResponse> {
  const result = await authFetch('/programs');
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  // Distinguish API-unreachable (fetch threw → 503) from an API 5xx (→ 502),
  // mirroring the public auth routes' server_unreachable / server_error split.
  if (result.kind === 'unreachable')
    return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'server_error' }, { status: 502 });
  if (result.kind === 'error')
    return NextResponse.json({ error: 'upstream' }, { status: result.status });
  return NextResponse.json(result.data);
}

// POST /api/programs — create a draft program (feature 0012). Creating is a
// form-level flow whose 400 (invalid_field) / 403 (not_a_creator) are business
// outcomes, not session death — so we go through `authPost` (raw status) rather
// than `authFetch` (which would clear the session on a 403).
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    shape?: unknown;
    visibility?: unknown;
    description?: unknown;
    coverStyle?: unknown;
  } | null;

  if (typeof body?.title !== 'string' || body.title.trim().length === 0) {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }
  if (typeof body?.shape !== 'string' || body.shape.length === 0) {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }
  if (typeof body?.visibility !== 'string' || body.visibility.length === 0) {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  const payload: CreateProgramRequest = {
    title: body.title.trim(),
    shape: body.shape as CreateProgramRequest['shape'],
    visibility: body.visibility as CreateProgramRequest['visibility'],
  };
  if (typeof body.description === 'string' && body.description.length > 0) {
    payload.description = body.description;
  }
  if (typeof body.coverStyle === 'string' && body.coverStyle.length > 0) {
    payload.coverStyle = body.coverStyle as CreateProgramRequest['coverStyle'];
  }

  const result = await authPost('/programs', payload);
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'unreachable')
    return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'server_error' }, { status: 502 });

  // 201 → pass the created draft body through unchanged; 400/403 → propagate the
  // API's business `code` so the client can branch (invalid_field / not_a_creator).
  if (result.status === 201) return NextResponse.json(result.data, { status: 201 });
  const code = (result.data as { code?: string } | null)?.code ?? 'create_failed';
  return NextResponse.json({ error: code }, { status: result.status });
}
