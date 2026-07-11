export interface BadgeProps {
  label: string;
}

export function Badge({ label }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        background: '#e5e7eb',
        color: '#111827',
      }}
    >
      {label}
    </span>
  );
}
