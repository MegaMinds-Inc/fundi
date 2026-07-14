import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runWithOrgContext, CrossTenantWriteError, MissingOrgContextError } from './org-context';
import { applyOrgScope, TENANT_SCOPED_MODELS } from './org-scope';
import { scopeOperation } from './scope-operation';

const ORG = 'org_a';

describe('applyOrgScope — where injection', () => {
  for (const operation of [
    'findFirst',
    'findMany',
    'findUnique',
    'count',
    'update',
    'updateMany',
    'delete',
    'deleteMany',
  ]) {
    it(`injects organisationId into where for ${operation}`, () => {
      const scoped = applyOrgScope({
        model: 'Program',
        operation,
        args: { where: { title: 'x' } },
        organisationId: ORG,
      });
      assert.deepEqual(scoped?.where, { title: 'x', organisationId: ORG });
    });
  }

  it('adds a where even when the caller passed none', () => {
    const scoped = applyOrgScope({
      model: 'Program',
      operation: 'findMany',
      args: {},
      organisationId: ORG,
    });
    assert.deepEqual(scoped?.where, { organisationId: ORG });
  });
});

describe('applyOrgScope — create data stamping', () => {
  it('stamps organisationId onto a single create', () => {
    const scoped = applyOrgScope({
      model: 'Program',
      operation: 'create',
      args: { data: { title: 'x' } },
      organisationId: ORG,
    });
    assert.deepEqual(scoped?.data, { organisationId: ORG, title: 'x' });
  });

  it('stamps organisationId onto every row of a createMany', () => {
    const scoped = applyOrgScope({
      model: 'Program',
      operation: 'createMany',
      args: { data: [{ title: 'a' }, { title: 'b' }] },
      organisationId: ORG,
    });
    assert.deepEqual(scoped?.data, [
      { organisationId: ORG, title: 'a' },
      { organisationId: ORG, title: 'b' },
    ]);
  });

  it('stamps organisationId onto a create that supplied none (context wins)', () => {
    const scoped = applyOrgScope({
      model: 'Program',
      operation: 'create',
      args: { data: { title: 'x' } },
      organisationId: ORG,
    });
    assert.equal((scoped?.data as Record<string, unknown>).organisationId, ORG);
  });

  it('allows a create that supplied the matching organisationId (idempotent)', () => {
    const scoped = applyOrgScope({
      model: 'Program',
      operation: 'create',
      args: { data: { title: 'x', organisationId: ORG } },
      organisationId: ORG,
    });
    assert.deepEqual(scoped?.data, { title: 'x', organisationId: ORG });
  });

  it('THROWS CrossTenantWriteError when a create supplies a conflicting organisationId', () => {
    assert.throws(
      () =>
        applyOrgScope({
          model: 'Program',
          operation: 'create',
          args: { data: { title: 'x', organisationId: 'org_evil' } },
          organisationId: ORG,
        }),
      (err: unknown) => err instanceof CrossTenantWriteError,
    );
  });

  it('THROWS CrossTenantWriteError when any createMany row supplies a conflicting organisationId', () => {
    assert.throws(
      () =>
        applyOrgScope({
          model: 'Program',
          operation: 'createMany',
          args: { data: [{ title: 'a' }, { title: 'b', organisationId: 'org_evil' }] },
          organisationId: ORG,
        }),
      (err: unknown) => err instanceof CrossTenantWriteError,
    );
  });

  it('scopes both where and create for upsert', () => {
    const scoped = applyOrgScope({
      model: 'Program',
      operation: 'upsert',
      args: { where: { id: '1' }, create: { title: 'x' }, update: { title: 'y' } },
      organisationId: ORG,
    });
    assert.deepEqual(scoped?.where, { id: '1', organisationId: ORG });
    assert.deepEqual(scoped?.create, { organisationId: ORG, title: 'x' });
  });
});

describe('scopeOperation — the enforced guard (ADR-008)', () => {
  it('passes non-tenant models (Organisation) through untouched', () => {
    const args = { where: { id: '1' } };
    // No org context bound on purpose — Organisation is the tenant root.
    assert.equal(scopeOperation('Organisation', 'findUnique', args), args);
  });

  it('THROWS on a tenant model when no org context is bound', () => {
    assert.throws(
      () => scopeOperation('Program', 'findMany', {}),
      (err: unknown) => err instanceof MissingOrgContextError,
    );
  });

  it('scopes a tenant model when an org context is bound', () => {
    runWithOrgContext({ organisationId: ORG }, () => {
      const scoped = scopeOperation('Learner', 'findMany', { where: { phone: '+233...' } });
      assert.deepEqual(scoped?.where, { phone: '+233...', organisationId: ORG });
    });
  });

  it('binds distinct orgs on nested contexts without leaking', () => {
    runWithOrgContext({ organisationId: 'org_a' }, () => {
      runWithOrgContext({ organisationId: 'org_b' }, () => {
        const scoped = scopeOperation('Learner', 'findMany', {});
        assert.deepEqual(scoped?.where, { organisationId: 'org_b' });
      });
      const outer = scopeOperation('Learner', 'findMany', {});
      assert.deepEqual(outer?.where, { organisationId: 'org_a' });
    });
  });
});

describe('TENANT_SCOPED_MODELS stays in sync with the schema', () => {
  // Non-tenant identity/authz tables (A.2). They live outside the tenant
  // boundary and must be readable before an org context exists. `Membership`
  // carries organisation_id as a plain bridging FK (@@id([accountId,
  // organisationId])) yet is deliberately NOT tenant-scoped, so it is excluded
  // here rather than being wrongly demanded in TENANT_SCOPED_MODELS.
  const IDENTITY_MODELS = new Set(['Account', 'Membership', 'OtpChallenge', 'RefreshToken']);

  it('lists exactly the models declaring organisation_id (excluding Organisation)', () => {
    const schema = readFileSync(join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');

    // Collect model blocks and whether each declares an organisation_id column.
    const modelsWithOrgId = new Set<string>();
    const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = modelRegex.exec(schema)) !== null) {
      const [, name, body] = match;
      if (name === 'Organisation' || IDENTITY_MODELS.has(name)) continue;
      if (/organisation_id/.test(body)) {
        modelsWithOrgId.add(name);
      }
    }

    assert.deepEqual(
      [...TENANT_SCOPED_MODELS].sort(),
      [...modelsWithOrgId].sort(),
      'TENANT_SCOPED_MODELS must match the tenant-scoped tables in schema.prisma',
    );
  });

  // Inverse guardrail (A.2): the identity/authz tables live OUTSIDE the tenant
  // boundary and must be readable before an org context exists. Scoping any of
  // them would deadlock login — so they must neither declare organisation_id
  // nor appear in TENANT_SCOPED_MODELS. Membership carries organisation_id as a
  // plain FK (it bridges INTO an org) but is still not tenant-scoped: it is
  // read pre-context to discover which orgs an account belongs to.
  it('keeps the identity tables non-tenant-scoped (scoping them deadlocks login)', () => {
    const schema = readFileSync(join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
    const bodyOf = (name: string): string => {
      const m = new RegExp(`model\\s+${name}\\s*\\{([^}]*)\\}`).exec(schema);
      assert.ok(m, `expected model ${name} to exist in schema.prisma`);
      return m![1];
    };

    for (const name of ['Account', 'OtpChallenge', 'RefreshToken']) {
      assert.ok(
        !/organisation_id/.test(bodyOf(name)),
        `${name} must NOT declare organisation_id — it is read before org context exists`,
      );
      assert.ok(
        !TENANT_SCOPED_MODELS.has(name),
        `${name} must NOT be in TENANT_SCOPED_MODELS — scoping it would deadlock login`,
      );
    }

    // Membership does carry organisation_id (it maps an account into an org) but
    // is deliberately not tenant-scoped: it must be queryable pre-context.
    assert.ok(
      !TENANT_SCOPED_MODELS.has('Membership'),
      'Membership must NOT be in TENANT_SCOPED_MODELS — it is read before org context exists',
    );
  });
});
