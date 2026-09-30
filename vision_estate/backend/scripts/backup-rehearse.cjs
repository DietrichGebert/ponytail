// One-time legacy upgrade preflight. Backups contain private data; keep .temp private.
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const p = new PrismaClient();
const tables = ['Property', 'Valuation', 'Report', 'Lead', 'NewsletterSubscription', 'Consent', 'AuditLog'];
const baseline = fs.readFileSync('prisma/migrations/202609110001_baseline/migration.sql', 'utf8');
const migration = fs.readFileSync('prisma/migrations/202609110002_secure_workflow/migration.sql', 'utf8');
const clone = 've_rehearsal_' + crypto.randomBytes(8).toString('hex');
const rollback = new Error('REHEARSAL_ROLLBACK');
const digest = (rows) => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
async function sql(tx, source) {
  for (const statement of source.split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
}
async function main() {
  let passed = false;
  try {
    await p.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const data = {};
      for (const table of tables) data[table] = (await tx.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM "${table}" t ORDER BY "id"`)).map(r => r.row);
      const dir = path.resolve('.temp', 'pre-upgrade-' + new Date().toISOString().replace(/[:.]/g, '-'));
      fs.mkdirSync(dir, { recursive: true });
      const backup = { createdAt: new Date().toISOString(), format: 'PostgreSQL row_to_json text, original baseline', data };
      const file = path.join(dir, 'backup.json');
      fs.writeFileSync(file, JSON.stringify(backup), { flag: 'wx' });
      fs.writeFileSync(path.join(dir, 'baseline.sql'), baseline, { flag: 'wx' });
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (digest(saved.data) !== digest(data)) throw new Error('Backup verification failed');
      console.log('BACKUP_VERIFIED', dir, 'sha256=' + digest(data));
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${clone}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${clone}"`);
      await sql(tx, baseline);
      for (const table of tables) {
        for (const row of saved.data[table]) await tx.$executeRawUnsafe(`INSERT INTO "${table}" SELECT * FROM json_populate_record(NULL::"${table}", $1::json)`, row);
        const restored = (await tx.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM "${table}" t ORDER BY "id"`)).map(r => r.row);
        if (digest(restored) !== digest(data[table])) throw new Error('Restore mismatch: ' + table);
        console.log('RESTORE_VERIFIED', table, restored.length);
      }
      await sql(tx, migration);
      const result = await tx.$queryRawUnsafe('SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()');
      if (result.length !== 12) throw new Error('Unexpected upgraded table count');
      for (const table of tables) {
        const count = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`);
        if (count[0].n !== data[table].length) throw new Error('Row count changed: ' + table);
      }
      console.log('MIGRATION_REHEARSAL_PASSED; original row counts preserved');
      passed = true;
      throw rollback;
    }, { timeout: 180000, maxWait: 10000 });
  } catch (e) { if (e !== rollback) throw e; }
  if (!passed) throw new Error('Rehearsal incomplete');
  console.log('Temporary clone rolled back; live schema unchanged.');
}
main().catch(e => { console.error('PREFLIGHT_FAILED', e.code || e.errorCode || e.constructor.name); process.exitCode = 1; }).finally(() => p.$disconnect());
