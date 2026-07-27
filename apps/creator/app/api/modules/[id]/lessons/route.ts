import { NextResponse } from 'next/server';
import type { CreateLessonRequest, LessonType } from '@fundi/types';
import { authPost } from '../../../../lib/bff';

const LESSON_TYPES: readonly LessonType[] = [
  'text',
  'video',
  'attachment',
  'live_online',
  'in_person',
  'quiz',
];

// POST /api/modules/[id]/lessons — append a lesson to a module (feature 0012
// slice 2). Creating is a form-level flow whose 400 (invalid_field) / 404
// (module_not_found) are business outcomes — go through `authPost` (raw status).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    type?: unknown;
  } | null;
  if (typeof body?.title !== 'string' || body.title.trim().length === 0) {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }
  if (typeof body?.type !== 'string' || !LESSON_TYPES.includes(body.type as LessonType)) {
    return NextResponse.json({ error: 'invalid_field' }, { status: 400 });
  }

  const payload: CreateLessonRequest = { title: body.title.trim(), type: body.type as LessonType };
  const result = await authPost(`/modules/${encodeURIComponent(id)}/lessons`, payload);
  if (result.kind === 'reauth') return NextResponse.json({ error: 'reauth' }, { status: 401 });
  if (result.kind === 'unreachable')
    return NextResponse.json({ error: 'server_unreachable' }, { status: 503 });
  if (result.kind === 'retryable')
    return NextResponse.json({ error: 'server_error' }, { status: 502 });

  if (result.status === 201) return NextResponse.json(result.data, { status: 201 });
  const code = (result.data as { code?: string } | null)?.code ?? 'create_failed';
  return NextResponse.json({ error: code }, { status: result.status });
}
