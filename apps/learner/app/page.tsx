import { Badge } from '@fundi/ui';
import { LessonType } from '@fundi/types';

export default function LessonViewPage() {
  return (
    <main>
      <h1>Lesson View</h1>
      <p>Placeholder lesson-view route - Sprint 0 scaffold.</p>
      <Badge label={`Type: ${LessonType.VIDEO}`} />
    </main>
  );
}
