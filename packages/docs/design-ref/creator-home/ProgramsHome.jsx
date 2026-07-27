// Fundi — Creator home: first screen after login. One primary action only —
// Create program — since Cohorts/Enrollment need a program to exist first;
// surfacing "invite learners" here would point at nothing to enroll into.
function ProgramCard({ program }) {
  const { Badge } = window.FundiDesignSystem_1eab67;
  return (
    <div
      onClick={() => { window.location.href = '../program-builder/index.html?open=' + program.id; }}
      style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--color-bg-surface)', boxShadow: 'var(--shadow-card)', cursor: 'pointer' }}
    >
      <div style={{ position: 'relative' }}>
        {window.ModuleCover && <window.ModuleCover coverStyle={program.coverStyle || 'gradient'} seed={program.seed || 0} height={104} />}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Badge tone={program.status === 'published' ? 'live' : 'draft'}>{program.status === 'published' ? 'Published' : 'Draft'}</Badge>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5, color: 'var(--color-text-heading)' }}>{program.title}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-text-faint)', marginTop: 5 }}>
          {program.moduleCount} module{program.moduleCount === 1 ? '' : 's'} · {program.learnerCount} learner{program.learnerCount === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  );
}

function ProgramsHome({ programs = [] }) {
  const { Button, Tabs, EmptyState } = window.FundiDesignSystem_1eab67;
  const [tab, setTab] = React.useState('programs');
  const hasPrograms = programs.length > 0;

  function newProgram() { window.location.href = '../program-builder/index.html'; }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-canvas)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 90px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26, gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Creator</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--color-text-heading)' }}>Your programs</div>
          </div>
          <button
            onClick={() => {}}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--color-accent-primary)', padding: '8px 0', flex: 'none' }}
          >
            Sign out
          </button>
        </div>

        {Tabs ? (
          <div style={{ marginBottom: 24 }}>
            <Tabs
              variant="pill"
              tabs={[{ value: 'programs', label: 'Programs' }, { value: 'cohorts', label: 'Cohorts' }, { value: 'needs_you', label: 'Needs you' }]}
              defaultValue="programs"
              onChange={setTab}
            />
          </div>
        ) : null}

        {tab === 'programs' && (
          hasPrograms ? (
            <React.Fragment>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
                <Button variant="primary" size="md" onClick={newProgram} icon={<i className="ph ph-plus" />}>New program</Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
                {programs.map((p) => <ProgramCard key={p.id} program={p} />)}
              </div>
            </React.Fragment>
          ) : (
            <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', padding: '72px 30px' }}>
              {EmptyState ? (
                <EmptyState
                  icon={<i className="ph ph-stack" />}
                  title="Nothing built yet"
                  body="Turn what you teach into a structured program learners move through, delivered mostly over WhatsApp. Start with your first one."
                  action={<Button variant="primary" size="lg" onClick={newProgram} icon={<i className="ph ph-plus" />}>Create your first program</Button>}
                />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--color-text-heading)', marginBottom: 8 }}>Nothing built yet</div>
                  <Button variant="primary" size="lg" onClick={newProgram} icon={<i className="ph ph-plus" />}>Create your first program</Button>
                </div>
              )}
            </div>
          )
        )}

        {tab === 'cohorts' && (
          hasPrograms ? (
            <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', padding: '72px 30px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: 12.5 }}>
              Cohort scheduling &amp; roster — next up in the build queue.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', padding: '72px 30px' }}>
              {EmptyState ? (
                <EmptyState
                  icon={<i className="ph ph-users-three" />}
                  title="No cohorts yet"
                  body="Cohorts live inside a program — create a program first, then invite learners into it."
                  action={<Button variant="secondary" size="md" onClick={newProgram} icon={<i className="ph ph-plus" />}>Create a program</Button>}
                />
              ) : null}
            </div>
          )
        )}

        {tab === 'needs_you' && (
          <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', padding: '72px 30px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: 12.5 }}>
            Nothing needs you right now — the full triage queue lives at <a href="../creator-triage-queue/index.html">Needs You</a>.
          </div>
        )}
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') { window.ProgramsHome = ProgramsHome; }
