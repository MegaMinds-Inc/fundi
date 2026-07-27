// Fundi — Program creation: shape + visibility (BRD: Program & Curriculum
// Builder). First step of "idea to published program in one sitting". Shape
// determines how Enrollment/Scheduling treat the program later; visibility
// controls whether joining requires creator approval.
const SHAPES = [
  { value: 'self_paced', label: 'Self-paced', icon: 'ph-fast-forward', desc: 'Learners move through modules on their own schedule.' },
  { value: 'cohort', label: 'Cohort', icon: 'ph-users-three', desc: 'A group moves through the program together, on a schedule.' },
  { value: 'one_to_one', label: 'One-to-one', icon: 'ph-user-focus', desc: 'A single learner, individually mentored.' },
  { value: 'workshop', label: 'Workshop', icon: 'ph-chalkboard-teacher', desc: 'A short, focused live-taught session or series.' },
  { value: 'hybrid', label: 'Hybrid', icon: 'ph-shuffle', desc: 'Mix of self-paced content and scheduled live sessions.' },
];

const VISIBILITIES = [
  { value: 'public', label: 'Public', icon: 'ph-globe', desc: 'Anyone with the link can join instantly.' },
  { value: 'private', label: 'Private, approval-gated', icon: 'ph-lock-key', desc: 'Learners request to join; you approve each one.' },
];

function ProgramSetup({ value, onChange, onContinue }) {
  const { Button, Input } = window.FundiDesignSystem_1eab67;
  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: 32, fontFamily: 'var(--font-body)' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--color-text-heading)', marginBottom: 8 }}>New program</div>
        <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Structure your craft into a program, then guide every learner through it.</div>
      </div>

      <Input
        label="Program title"
        placeholder="e.g. Copywriting for Creators"
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />

      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>Cover image</div>
        <image-slot id="program-cover" shape="rounded" radius="14" placeholder="Drop a cover image" style={{ width: '100%', aspectRatio: '16 / 9', display: 'block' }}></image-slot>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>Shape</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SHAPES.map((s) => (
            <div
              key={s.value}
              onClick={() => onChange({ ...value, shape: s.value })}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                background: value.shape === s.value ? 'var(--color-accent-primary-soft)' : 'var(--color-bg-surface)',
                boxShadow: value.shape === s.value ? 'inset 0 0 0 1.5px var(--color-accent-primary)' : 'inset 0 0 0 1px var(--color-border-subtle)',
              }}
            >
              <i className={'ph ' + s.icon} style={{ fontSize: 19, color: value.shape === s.value ? 'var(--color-accent-primary)' : 'var(--color-text-faint)', marginTop: 1 }} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-heading)' }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>Visibility</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {VISIBILITIES.map((v) => (
            <div
              key={v.value}
              onClick={() => onChange({ ...value, visibility: v.value })}
              style={{
                display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                background: value.visibility === v.value ? 'var(--color-accent-primary-soft)' : 'var(--color-bg-surface)',
                boxShadow: value.visibility === v.value ? 'inset 0 0 0 1.5px var(--color-accent-primary)' : 'inset 0 0 0 1px var(--color-border-subtle)',
              }}
            >
              <i className={'ph ' + v.icon} style={{ fontSize: 19, color: value.visibility === v.value ? 'var(--color-accent-primary)' : 'var(--color-text-faint)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-text-heading)' }}>{v.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{v.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>Module covers</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)', marginBottom: 12, lineHeight: 1.5 }}>Chosen once for the whole program — every module gets its own look automatically, no per-module effort.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {['gradient', 'geometric'].map((cs) => (
            <div
              key={cs}
              onClick={() => onChange({ ...value, coverStyle: cs })}
              style={{
                borderRadius: 'var(--radius-lg)', cursor: 'pointer', overflow: 'hidden',
                boxShadow: value.coverStyle === cs || (!value.coverStyle && cs === 'gradient') ? 'inset 0 0 0 1.5px var(--color-accent-primary)' : 'inset 0 0 0 1px var(--color-border-subtle)',
              }}
            >
              {window.ModuleCover && <window.ModuleCover coverStyle={cs} seed={0} height={54} />}
              <div style={{ padding: '9px 12px', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--color-text-heading)', textTransform: 'capitalize' }}>{cs}</span>
                {(value.coverStyle === cs || (!value.coverStyle && cs === 'gradient')) && <i className="ph-fill ph-check-circle" style={{ fontSize: 15, color: 'var(--color-accent-primary)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button variant="primary" disabled={!value.title || !value.shape || !value.visibility} onClick={onContinue} style={{ width: '100%', justifyContent: 'center' }}>
        Continue to builder
      </Button>
    </div>
  );
}

if (typeof window !== 'undefined') { window.ProgramSetup = ProgramSetup; }
