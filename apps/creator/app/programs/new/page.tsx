import { requireCreatorSession } from '../../lib/require-session';
import { NewProgramClient } from './NewProgramClient';

// /programs/new — the create-program flow (feature 0012). Server segment runs the
// auth + PIN-setup gate (same as `app/page.tsx`), then hands off to the client
// form which owns the controlled `ProgramSetup` value and the POST.
export default async function NewProgramPage() {
  await requireCreatorSession();
  return <NewProgramClient />;
}
