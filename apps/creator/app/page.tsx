import { Badge } from '@fundi/ui';
import { ProgramShape } from '@fundi/types';
import { CreatorOnlyBuilderPanel } from './components/CreatorOnlyBuilderPanel';

export default function DashboardPage() {
  return (
    <main>
      <h1>Creator Dashboard</h1>
      <p>Placeholder dashboard route - Sprint 0 scaffold.</p>
      <Badge label={`Shape: ${ProgramShape.COHORT}`} />
      <CreatorOnlyBuilderPanel />
    </main>
  );
}
