import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runWithOrgContext, MissingOrgContextError } from './org-context';
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
  it('lists exactly the models declaring organisation_id (excluding Organisation)', () => {
    const schema = readFileSync(join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');

    // Collect model blocks and whether each declares an organisation_id column.
    const modelsWithOrgId = new Set<string>();
    const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = modelRegex.exec(schema)) !== null) {
      const [, name, body] = match;
      if (name === 'Organisation') continue;
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
});
