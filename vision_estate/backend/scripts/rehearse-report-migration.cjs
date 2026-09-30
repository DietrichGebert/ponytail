const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const statements = require('./sql-statements.cjs');
const p = new PrismaClient();
const clone = 've_report_rehearsal_' + randomBytes(8).toString('hex');
const tables = ['User', 'Property', 'Valuation', 'Lead', 'Report', 'Consent', 'AuditLog'];
const rollback = new Error('EXPECTED_ROLLBACK');
const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/202609210001_report_invariants/migration.sql'), 'utf8');
async function main() {
  let passed = false;
  try {
    await p.$transaction(async tx => {
      const data = {};
      for (const table of tables) data[table] = await tx.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM "${table}" t ORDER BY id`);
      const dir = path.join(__dirname, '../.temp/report-upgrade-' + Date.now());
      fs.mkdirSync(dir, { recursive: true });
      const content = JSON.stringify({ createdAt: new Date().toISOString(), data });
      fs.writeFileSync(path.join(dir, 'backup.json'), content, { flag: 'wx' });
      assert.equal(fs.readFileSync(path.join(dir, 'backup.json'), 'utf8'), content);
      fs.writeFileSync(path.join(dir, 'migration.sql'), migration);
      console.log('Private backup verified; SHA256 ' + createHash('sha256').update(content).digest('hex'));
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${clone}"`);
      for (const table of tables) {
        await tx.$executeRawUnsafe(`CREATE TABLE "${clone}"."${table}" (LIKE "public"."${table}" INCLUDING ALL)`);
        for (const {row} of data[table]) await tx.$executeRawUnsafe(`INSERT INTO "${clone}"."${table}" SELECT * FROM json_populate_record(NULL::"${clone}"."${table}", $1::json)`, row);
        const restored = await tx.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM "${clone}"."${table}" t ORDER BY id`);
        assert.deepEqual(restored, data[table]);
      }
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${clone}", public`);
      for (const statement of statements(migration)) await tx.$executeRawUnsafe(statement);
      for (const table of tables) {
        const count = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${clone}"."${table}"`);
        assert.equal(count[0].n, data[table].length);
      }
      // All fixtures exist only in the isolated rollback schema, never the live tables.
      await tx.$executeRawUnsafe(`INSERT INTO "User" (id,email,name,"passwordHash",role) VALUES ('qa-broker','qa@example.invalid','Test','unused','BROKER')`);
      await tx.$executeRawUnsafe(`INSERT INTO "Property" (id,address,"propertyType","sizeSqm",condition,"yearBuilt","sellerContact",state,"updatedAt") VALUES ('qa-property','{}','HOUSE',100,'GOOD',2000,'{}','REPORT_READY',now())`);
      await tx.$executeRawUnsafe(`INSERT INTO "Lead" (id,"propertyId","assignedToId","updatedAt") VALUES ('qa-lead','qa-property','qa-broker',now())`);
      await tx.$executeRawUnsafe(`INSERT INTO "Report" (id,"propertyId",tier,payload,"updatedAt") VALUES ('qa-report','qa-property','FULL','{}',now())`);
      async function denied(sql) {
        await tx.$executeRawUnsafe('SAVEPOINT denied_change');
        let rejected = false;
        try { await tx.$executeRawUnsafe(sql); } catch(e) { rejected = e.meta?.code === '23514' || e.code === 'P2004'; }
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT denied_change');
        assert.ok(rejected, 'Expected invariant rejection');
      }
      await denied(`UPDATE "Report" SET "releaseState"='RELEASED',"releasedAt"=now(),"releasedByUserId"='qa-broker' WHERE id='qa-report'`);
      await denied(`UPDATE "Report" SET "releaseState"='SELLER_VISIBLE' WHERE id='qa-report'`);
      await denied(`UPDATE "Report" SET "reviewedAt"=now(),"reviewedByUserId"='qa-broker' WHERE id='qa-report'`);
      await tx.$executeRawUnsafe(`UPDATE "Lead" SET "reviewedAt"=now(),"reviewedByUserId"='qa-broker' WHERE id='qa-lead'`);
      await tx.$executeRawUnsafe(`UPDATE "Report" SET "reviewedAt"=now(),"reviewedByUserId"='qa-broker' WHERE id='qa-report'`);
      await denied(`UPDATE "Report" SET payload='{"changed":true}' WHERE id='qa-report'`);
      await tx.$executeRawUnsafe(`UPDATE "Report" SET "releaseState"='RELEASED',"releasedAt"=now(),"releasedByUserId"='qa-broker' WHERE id='qa-report'`);
      await denied(`UPDATE "Report" SET "releaseState"='DRAFT_INTERNAL' WHERE id='qa-report'`);
      await denied(`DELETE FROM "Report" WHERE id='qa-report'`);
      await denied(`UPDATE "Consent" SET source='tamper'`);
      await denied(`DELETE FROM "AuditLog"`);
      await denied(`TRUNCATE "Consent"`);
      passed = true;
      throw rollback;
    }, { timeout: 180000, isolationLevel: 'RepeatableRead' });
  } catch(e) { if (e !== rollback) throw e; }
  assert.ok(passed);
  console.log('PASS: restored backup, report review/release enforcement, immutable content, append-only evidence; all test DDL/data rolled back.');
}
main().catch(e => { console.error('REPORT_REHEARSAL_FAILED', e.code || e.name, e.message?.startsWith('Expected') ? e.message : ''); process.exitCode=1; }).finally(() => p.$disconnect());
