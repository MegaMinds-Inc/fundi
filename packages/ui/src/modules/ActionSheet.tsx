'use client';

import { useEffect, useState } from 'react';
import type { SignalType } from '@fundi/types';
import { Button } from '../components/Button';
import { Drawer } from '../components/Drawer';
import { MessageComposer } from './MessageComposer';
import { SignalBadge } from './SignalBadge';
import { SnoozePicker } from './SnoozePicker';

export interface ActionSheetProps {
  open: boolean;
  learner: string;
  cohort: string;
  signal: SignalType;
  /** AI-suggested reply text, editable before send. */
  draft: string;
  onClose: () => void;
  onSend: (text: string) => void;
  onResolve: () => void;
  onSnooze: (days: 1 | 3 | 7) => void;
}

/**
 * The take-action drawer opened from an `ExceptionCard`/`ExceptionTableRow`:
 * edit + send the AI-drafted reply (`MessageComposer`), snooze (`SnoozePicker`),
 * or mark resolved. Wraps `Drawer`. Local state resets when the sheet closes.
 */
export function ActionSheet({
  open,
  learner,
  cohort,
  signal,
  draft,
  onClose,
  onSend,
  onResolve,
  onSnooze,
}: ActionSheetProps) {
  const [text, setText] = useState(draft);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  // Re-seed the editable text whenever a different item/draft is shown.
  useEffect(() => {
    setText(draft);
  }, [draft, learner]);

  // Clear transient state when the sheet closes.
  useEffect(() => {
    if (!open) {
      setText(draft);
      setSnoozeOpen(false);
    }
  }, [open]);

  return (
    <Drawer
      open={open}
      title={learner}
      subtitle={cohort}
      signalSlot={<SignalBadge signal={signal} />}
      onClose={onClose}
      footer={
        <>
          {snoozeOpen && (
            <SnoozePicker
              onSnooze={(d) => {
                onSnooze(d);
                setSnoozeOpen(false);
              }}
            />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => setSnoozeOpen((s) => !s)}
            >
              Snooze
            </Button>
            <Button variant="ghost" style={{ flex: 1 }} onClick={onResolve}>
              Mark resolved
            </Button>
          </div>
        </>
      }
    >
      <MessageComposer
        value={text}
        onChange={setText}
        onSend={onSend}
        sendLabel="Send on WhatsApp"
        sendIcon={<i className="ph ph-whatsapp-logo" />}
        placeholder="Edit the AI-suggested reply…"
      />
    </Drawer>
  );
}
