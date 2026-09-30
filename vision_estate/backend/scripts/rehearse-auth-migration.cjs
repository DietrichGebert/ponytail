// Read/backup live session records; test additive DDL in a rollback-only schema.
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const p = new PrismaClient();
const clone = 've_auth_rehearsal_' + randomBytes(8).toString('hex');
const rollback = new Error('EXPECTED_ROLLBACK');
const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/202609200001_rotating_sessions/migration.sql'), 'utf8');
async function main() {
  let passed = false;
  try {
    await p.$transaction(async tx => {
      const rows = await tx.$queryRawUnsafe('SELECT row_to_json(s)::text AS row FROM "Session" s ORDER BY id');
      const dir = path.join(__dirname, '../.temp/auth-upgrade-' + Date.now());
      fs.mkdirSync(dir, { recursive: true });
      const content = JSON.stringify({ createdAt: new Date().toISOString(), rows });
      const file = path.join(dir, 'sessions.json');
      fs.writeFileSync(file, content, { flag: 'wx' });
      assert.equal(fs.readFileSync(file, 'utf8'), content);
      fs.writeFileSync(path.join(dir, 'migration.sql'), migration);
      console.log('Private session backup verified; SHA256 ' + createHash('sha256').update(content).digest('hex'));
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${clone}"`);
      await tx.$executeRawUnsafe(`CREATE TABLE "${clone}"."Session" (LIKE "public"."Session" INCLUDING ALL)`);
      await tx.$executeRawUnsafe(`INSERT INTO "${clone}"."Session" SELECT * FROM "public"."Session"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${clone}"`);
      for (const statement of migration.split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      const restored = await tx.$queryRawUnsafe('SELECT (to_jsonb(s) - ARRAY[\'familyId\',\'consumedAt\',\'revokedAt\'])::text AS row FROM "Session" s ORDER BY id');
      assert.deepEqual(restored.map(r => JSON.parse(r.row)), rows.map(r => JSON.parse(r.row)));
      const columns = await tx.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${clone}' AND table_name = 'Session'`);
      assert.ok(['familyId','consumedAt','revokedAt'].every(c => columns.some(v => v.column_name === c)));
      passed = true;
      throw rollback;
    }, { timeout: 90000 });
  } catch (e) { if (e !== rollback) throw e; }
  assert.ok(passed);
  console.log('PASS: additive auth migration, existing sessions preserved, isolated schema rolled back.');
}
main().catch(e => { console.error('AUTH_REHEARSAL_FAILED', e.code || e.name); process.exitCode=1; }).finally(() => p.$disconnect());
