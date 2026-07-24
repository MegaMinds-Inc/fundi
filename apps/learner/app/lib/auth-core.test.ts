import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rewriteCookieHeader } from './auth-core';

/**
 * Focused unit for the middleware header-propagation mechanism (feature 0010
 * H1). After a proactive silent refresh the middleware must forward the NEW
 * session cookies into the CURRENT request so the RSC render + in-render
 * `bff.ts`/`authPost` never re-present the OLD (already-rotated) refresh token.
 * `rewriteCookieHeader` is the pure core of that forwarding.
 *
 * The creator/learner apps ship a no-op `test` script (no runner wired), so this
 * runs via `node --test` directly (Node strips the TS types natively).
 */
describe('rewriteCookieHeader (H1 middleware cookie propagation)', () => {
  it('overrides the named cookies and preserves all others', () => {
    const out = rewriteCookieHeader('fundi_at=OLD_AT; fundi_rt=OLD_RT; theme=dark', {
      fundi_at: 'NEW_AT',
      fundi_rt: 'NEW_RT',
    });
    const jar = Object.fromEntries(
      out.split('; ').map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i), p.slice(i + 1)];
      }),
    );
    assert.equal(jar.fundi_at, 'NEW_AT', 'access cookie must be forwarded as the new value');
    assert.equal(jar.fundi_rt, 'NEW_RT', 'refresh cookie must be forwarded as the new value');
    assert.equal(jar.theme, 'dark', 'unrelated cookies must be preserved');
    assert.equal(out.includes('OLD_AT'), false, 'the OLD access token must not survive');
    assert.equal(out.includes('OLD_RT'), false, 'the OLD refresh token must not survive');
  });

  it('adds the cookies when the request had none', () => {
    const out = rewriteCookieHeader(null, { fundi_at: 'NEW_AT', fundi_rt: 'NEW_RT' });
    assert.equal(out, 'fundi_at=NEW_AT; fundi_rt=NEW_RT');
  });

  it('adds session cookies alongside an existing device cookie (no session before)', () => {
    // The refresh-from-cold case: only the RT + device cookie were present.
    const out = rewriteCookieHeader('fundi_rt=OLD_RT; fundi_dt=DEVICE', {
      fundi_at: 'NEW_AT',
      fundi_rt: 'NEW_RT',
    });
    const names = out
      .split('; ')
      .map((p) => p.slice(0, p.indexOf('=')))
      .sort();
    assert.deepEqual(names, ['fundi_at', 'fundi_dt', 'fundi_rt']);
    assert.ok(out.includes('fundi_dt=DEVICE'), 'device cookie must be preserved untouched');
    assert.ok(out.includes('fundi_rt=NEW_RT'));
    assert.ok(out.includes('fundi_at=NEW_AT'));
  });

  it('tolerates the __Host- prefixed cookie names used under full hardening', () => {
    const out = rewriteCookieHeader('__Host-fundi_at=OLD; __Host-fundi_rt=OLDR', {
      '__Host-fundi_at': 'NA',
      '__Host-fundi_rt': 'NR',
    });
    assert.ok(out.includes('__Host-fundi_at=NA'));
    assert.ok(out.includes('__Host-fundi_rt=NR'));
    assert.equal(out.includes('OLD'), false);
  });
});
