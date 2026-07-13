'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../components/Button';

export interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  placeholder?: string;
  sendLabel?: string;
  /** Optional icon on the send button, e.g. a WhatsApp glyph. */
  sendIcon?: ReactNode;
  disabled?: boolean;
  /** Optional content above the textarea (e.g. template-variable chips). */
  header?: ReactNode;
  rows?: number;
  style?: CSSProperties;
}

/**
 * Textarea + primary send button — the edit-then-send pattern shared by
 * `ActionSheet`, `DraftEditor`, and `HelpCapture`. Send is disabled until the
 * (trimmed) value is non-empty.
 */
export function MessageComposer({
  value,
  onChange,
  onSend,
  placeholder = 'Write a message…',
  sendLabel = 'Send',
  sendIcon,
  disabled = false,
  header,
  rows = 4,
  style,
}: MessageComposerProps) {
  const [focused, setFocused] = useState(false);
  const canSend = !disabled && value.trim().length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {header}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'var(--font-body)',
          fontSize: 13.5,
          lineHeight: 1.5,
          color: 'var(--color-text-heading)',
          background: 'var(--color-bg-elevated)',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 14px',
          outline: 'none',
          boxShadow: focused ? 'var(--shadow-focus)' : 'inset 0 0 0 1px var(--color-border-strong)',
          transition: 'box-shadow 180ms ease',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={sendIcon} disabled={!canSend} onClick={() => canSend && onSend(value)}>
          {sendLabel}
        </Button>
      </div>
    </div>
  );
}
