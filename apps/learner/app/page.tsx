'use client';

import { useState } from 'react';
import { Badge, Button, Card } from '@fundi/ui';
import { LessonType } from '@fundi/types';

export default function LessonViewPage() {
  const [done, setDone] = useState(false);

  return (
    <main
      style={{
        minHeight: '100vh',
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            font: 'var(--text-eyebrow)',
            letterSpacing: 'var(--tracking-eyebrow)',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Module 2 · Lesson 3
        </span>
        <h1
          style={{
            font: 'var(--text-display-md)',
            letterSpacing: 'var(--tracking-tight)',
            margin: 0,
            color: 'var(--color-text-heading)',
          }}
        >
          Build the offer
        </h1>
      </header>

      <Card
        title="Watch: framing the promise"
        meta={LessonType.VIDEO}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge tone={done ? 'live' : 'warn'}>{done ? 'Completed' : 'Due tomorrow'}</Badge>
            <Button size="sm" onClick={() => setDone((d) => !d)}>
              {done ? 'Marked done' : 'Mark done'}
            </Button>
          </div>
        }
      >
        <p style={{ font: 'var(--text-body-lg)', color: 'var(--color-text-body)', margin: 0 }}>
          A short walkthrough of how to name the transformation your learners are paying for — then
          reply <strong>DONE</strong> on WhatsApp when you finish.
        </p>
      </Card>

      <p
        style={{
          font: 'var(--text-body-sm)',
          color: 'var(--color-text-faint)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        — Fundi
      </p>
    </main>
  );
}
