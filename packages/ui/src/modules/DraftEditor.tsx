'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Drawer } from '../components/Drawer';
import { MessageComposer } from './MessageComposer';
import { VariableChip } from './VariableChip';

export interface EditableDraft {
  id: string;
  kind: string;
  recipient: string;
  templateName: string;
  text: string;
  variables: Record<string, string>;
}

export interface DraftEditorProps {
  open: boolean;
  draft: EditableDraft | null;
  onClose: () => void;
  onApprove: (id: string, editedText: string) => void;
  onReject: (id: string) => void;
}

/**
 * Drawer for editing an AI draft before it sends — the human-approval act.
 * Template variables render as locked `VariableChip`s (ADR-005). Approve & send
 * is the shared `MessageComposer`'s send; reject sits in the Drawer footer.
 * Safely renders closed when `draft` is null.
 */
export function DraftEditor({ open, draft, onClose, onApprove, onReject }: DraftEditorProps) {
  const [text, setText] = useState(draft?.text ?? '');

  // Re-seed the editable text whenever a different draft is shown.
  useEffect(() => {
    setText(draft?.text ?? '');
  }, [draft]);

  const variables = draft ? Object.entries(draft.variables) : [];

  return (
    <Drawer
      open={open && draft !== null}
      title={draft?.recipient}
      subtitle={draft ? `Template: ${draft.templateName}` : undefined}
      signalSlot={draft ? <Badge tone="draft">{draft.kind}</Badge> : undefined}
      onClose={onClose}
      footer={
        draft ? (
          <Button variant="secondary" style={{ width: '100%' }} onClick={() => onReject(draft.id)}>
            Reject / discard
          </Button>
        ) : undefined
      }
    >
      {draft && (
        <MessageComposer
          value={text}
          onChange={setText}
          onSend={(t) => onApprove(draft.id, t)}
          sendLabel="Approve & send"
          sendIcon={<i className="ph ph-whatsapp-logo" />}
          placeholder="Edit the draft before approving…"
          header={
            variables.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {variables.map(([name, value]) => (
                  <VariableChip key={name} name={name} value={value} />
                ))}
              </div>
            ) : undefined
          }
        />
      )}
    </Drawer>
  );
}
