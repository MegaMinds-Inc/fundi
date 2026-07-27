import { requireCreatorSession } from '../../../lib/require-session';
import { PreviewClient } from './PreviewClient';

// /programs/[id]/preview — the read-only learner-facing preview (feature 0012
// slice 3). Opened in its own tab from the builder's PublishBar "Preview" — a
// bigger context switch than the in-context per-lesson preview, so it gets a
// real tab rather than an in-place swap that hides the builder underneath.
// Server segment runs the auth + PIN-setup gate, then hands the id to the
// client loader (same GET-the-BFF pattern as the builder).
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCreatorSession();
  const { id } = await params;
  return <PreviewClient id={id} />;
}
