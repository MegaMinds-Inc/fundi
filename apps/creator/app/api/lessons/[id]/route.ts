import { NextResponse } from 'next/server';
import type { LessonType, UpdateLessonRequest } from '@fundi/types';
import { authFetch } from '../../../lib/bff';

const LESSON_TYPES: readonly LessonType[] = [
  'text',
  'video',
  'attachment',
  'live_online',
  'in_person',
  'quiz',
];

// PATCH /api/lessons/[id] — autosave a subset of {title,type,content} from the
// lesson editor (feature 0012 slice 2). `content` is opaque JSONB stored
// verbatim by the API. 400 (invalid_field) / 404 (lesson_not_found) are
// form-level outcomes passed through (`authFetch` only clears on 401/403).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    type?: unknown;
    content?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  const payload: UpdateLessonRequest = {};
  if (typeof body.title === 'string') payload.title = body.title;
  if (typeof body.type === 'string' && LESSON_TYPES.includes(body.type as LessonType))
    payload.type = body.type as LessonType;
  // `content` is stored verbatim — forward whatever JSON shape was sent (incl.
  // an explicit null) when the key is present.
  if ('content' in body) payload.content = body.content;

  const result = await authFetch(`/lessons/${encodeURIComponent(id)}`, {
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

// DELETE /api/lessons/[id] — remove a lesson. The API answers 204; we forward
// that with an empty body. 404 (lesson_not_found) passes through.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authFetch(`/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
