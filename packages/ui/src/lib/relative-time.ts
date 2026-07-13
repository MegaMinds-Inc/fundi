export interface RelativeTimeInput {
  minutesAgo?: number;
  hoursAgo?: number;
}

/**
 * Format an elapsed duration as a short "Xm/h/d ago" label. Pure: it takes an
 * already-computed elapsed amount (the caller owns "now"), so it stays
 * deterministic and unit-testable. `hoursAgo` and `minutesAgo` combine.
 */
export function formatRelativeTime({ minutesAgo = 0, hoursAgo = 0 }: RelativeTimeInput): string {
  const totalMinutes = Math.max(0, Math.round(hoursAgo * 60 + minutesAgo));
  if (totalMinutes < 1) return 'just now';
  if (totalMinutes < 60) return `${totalMinutes}m ago`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours}h ago`;
  return `${Math.floor(totalHours / 24)}d ago`;
}
