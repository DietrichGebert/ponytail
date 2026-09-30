// Real PostgreSQL verification; all synthetic writes are rolled back, no providers called.
const { PrismaClient } = require('@prisma/client');
const { randomUUID, randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const { ApplicationRepository } = require('../dist/src/application.repository');
const { AuthService } = require('../dist/src/auth-service');
const { AuthGuard } = require('../dist/src/auth');
const { passwordHash, hashToken } = require('../dist/src/auth-crypto');
const p = new PrismaClient(), marker = randomUUID(), rollback = new Error('EXPECTED_ROLLBACK');
process.env.AUTH_JWT_SECRET = randomBytes(48).toString('hex');
async function main() {
  try {
    await p.$transaction(async tx => {
      const db = new Proxy(tx, {get(target,key) {return key === '$transaction' ? fn => fn(tx) : target[key];}});
      const repo = new ApplicationRepository(db), auth = new AuthService(repo), guard = new AuthGuard(repo);
      const email = marker + '@example.invalid', password = randomBytes(24).toString('hex');
      await tx.user.create({ data: { email, name: 'Rollback auth test', passwordHash: passwordHash(password), role: 'BROKER' } });
      const check = token => guard.canActivate({switchToHttp: () => ({ getRequest: () => ({ headers: {authorization: 'Bearer ' + token} }) })});
      const initial = await auth.login({email,password});
      assert.equal(await check(initial.accessToken), true);
      const next = await auth.refresh(initial.token);
      assert.notEqual(initial.token, next.token);
      await assert.rejects(() => check(initial.accessToken));
      assert.equal(await check(next.accessToken), true);
      assert.equal((await tx.session.findUnique({where:{tokenHash:hashToken(next.token)}})).tokenHash.includes(next.token), false);
      await assert.rejects(() => auth.refresh(initial.token));
      await assert.rejects(() => check(next.accessToken));
      await assert.rejects(() => auth.refresh(next.token));
      const fresh = await auth.login({email,password});
      await auth.logout(fresh.token);
      await assert.rejects(() => check(fresh.accessToken));
      console.log('PASS: real JWT authorization, rotation, replay-family revocation and logout.');
      throw rollback;
    }, {timeout:90000});
  } catch(e) {if(e !== rollback) throw e;}
  assert.equal(await p.user.count({where:{email:marker+'@example.invalid'}}),0);
  console.log('PASS: synthetic account/sessions/audit rolled back.');
}
main().catch(e => {console.error('AUTH_VERIFICATION_FAILED',e.code || e.name);process.exitCode=1;}).finally(() => p.$disconnect());
