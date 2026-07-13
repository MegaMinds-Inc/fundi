import type { CSSProperties } from 'react';
import { formatRelativeTime, type RelativeTimeInput } from '../lib/relative-time';

export interface RelativeTimeProps extends RelativeTimeInput {
  style?: CSSProperties;
}

/** Mono, faint "3h ago" timestamp. Formatting logic lives in `lib/relative-time`. */
export function RelativeTime({ minutesAgo, hoursAgo, style }: RelativeTimeProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--color-text-faint)',
        ...style,
      }}
    >
      {formatRelativeTime({ minutesAgo, hoursAgo })}
    </span>
  );
}
