'use client';

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, Input, Modal, Tabs, Tag } from '@fundi/ui';
import { ProgramShape } from '@fundi/types';
import { CreatorOnlyBuilderPanel } from './components/CreatorOnlyBuilderPanel';
import { SignOutButton } from './components/SignOutButton';

const FILTERS = ['self_paced', 'cohort', 'workshop'] as const;

export function DashboardClient() {
  const [tab, setTab] = useState('programs');
  const [selected, setSelected] = useState<string>('cohort');
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 16px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: 'var(--text-eyebrow)',
              letterSpacing: 'var(--tracking-eyebrow)',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Creator
          </span>
          <h1
            style={{
              font: 'var(--text-display-lg)',
              letterSpacing: 'var(--tracking-tight)',
              margin: 0,
              color: 'var(--color-text-heading)',
            }}
          >
            Your programs
          </h1>
        </div>
        <SignOutButton />
      </header>

      <Tabs
        variant="pill"
        defaultValue="programs"
        onChange={setTab}
        tabs={[
          { label: 'Programs', value: 'programs' },
          { label: 'Cohorts', value: 'cohorts' },
          { label: 'Needs you', value: 'needs-you' },
        ]}
      />

      {tab === 'needs-you' ? (
        <Card>
          <EmptyState
            icon="ph-check-circle"
            title="No one needs you right now"
            body="When a learner goes quiet or falls behind, they'll surface here. Go create."
          />
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => (
              <Tag key={f} color="teal" selected={selected === f} onClick={() => setSelected(f)}>
                {f.replace('_', ' ')}
              </Tag>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            <Card
              interactive
              title="Build the offer"
              meta="6 modules"
              footer={
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Badge tone="live">Live</Badge>
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </div>
              }
            >
              <p
                style={{ font: 'var(--text-body-md)', color: 'var(--color-text-muted)', margin: 0 }}
              >
                Shape:{' '}
                <span style={{ font: 'var(--text-mono-sm)', color: 'var(--color-text-body)' }}>
                  {ProgramShape.COHORT}
                </span>
              </p>
            </Card>

            <Card
              interactive
              title="Find your first 100 fans"
              meta="4 modules"
              footer={
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Badge tone="draft">Draft</Badge>
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </div>
              }
            >
              <p
                style={{ font: 'var(--text-body-md)', color: 'var(--color-text-muted)', margin: 0 }}
              >
                Shape:{' '}
                <span style={{ font: 'var(--text-mono-sm)', color: 'var(--color-text-body)' }}>
                  {ProgramShape.SELF_PACED}
                </span>
              </p>
            </Card>
          </div>

          <Card title="Invite a learner">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input
                label="Phone number"
                type="tel"
                inputMode="tel"
                placeholder="+233 …"
                helperText="They'll get a WhatsApp invite to join this cohort."
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <Button onClick={() => setInviteOpen(true)}>Send invite</Button>
                <Button variant="secondary">Save draft</Button>
              </div>
            </div>
          </Card>
        </>
      )}

      <CreatorOnlyBuilderPanel />

      <Modal
        open={inviteOpen}
        title="Invite sent"
        onClose={() => setInviteOpen(false)}
        footer={<Button onClick={() => setInviteOpen(false)}>Done</Button>}
      >
        <p style={{ font: 'var(--text-body-md)', color: 'var(--color-text-muted)', margin: 0 }}>
          We&apos;ll message them on WhatsApp and add them to the cohort once they accept.
        </p>
      </Modal>
    </main>
  );
}
