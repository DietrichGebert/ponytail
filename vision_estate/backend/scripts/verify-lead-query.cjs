// Real PostgreSQL query regression check. Synthetic records are always rolled back.
const { PrismaClient } = require('@prisma/client');
const { LeadQueryRepository } = require('../dist/src/properties/lead-query.repository');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const p = new PrismaClient();
const marker = randomUUID();
const actor = randomUUID();
const rollback = new Error('ROLLBACK_CHECK');
async function main() {
  try {
    await p.$transaction(async tx => {
      const properties = Array.from({ length: 52 }, (_, i) => ({
        id: randomUUID(), address: { street: i === 0 ? 'Unique 50%_Home' : 'Other', city: 'Munich', postalCode: '80802' },
        sellerContact: { name: marker, email: 'verification@example.invalid' },
        propertyType: 'HOUSE', sizeSqm: 100, yearBuilt: 2000, condition: 'GOOD',
        createdAt: new Date(1700000000000 + i * 1000),
      }));
      await tx.property.createMany({ data: properties });
      await tx.lead.createMany({ data: properties.map((row, i) => ({ propertyId: row.id, assignedToId: i === 51 ? 'other-' + actor : actor, stage: i === 0 ? 'QUALIFIED' : 'NEW', createdAt: row.createdAt })) });
      const db = new Proxy(tx, { get(target, key) { return key === '$transaction' ? fn => fn(tx) : target[key]; } });
      const repository = new LeadQueryRepository(db);
      const list = query => repository.list(actor, actor, { page: 1, ...query });
      const page1 = await list({});
      assert.equal(page1.total, 51); assert.equal(page1.items.length, 50);
      const page2 = await list({page: 2});
      assert.equal(page2.items.length, 1); assert.equal(page2.items[0].property.id, properties[0].id);
      const match = await list({q: 'unique 50%_home'});
      assert.equal(match.total, 1); assert.equal(match.items[0].property.id, properties[0].id);
      assert.equal((await list({q: "' OR TRUE --"})).total, 0);
      assert.equal((await list({stage: 'NEW'})).total, 50);
      assert.equal((await list({page: 100, stage: 'QUALIFIED'})).page, 1);
      assert.equal((await repository.list(actor, null, {page: 1, q: marker})).total, 52);
      assert.equal('accessTokenHash' in match.items[0].property, false);
      console.log('PASS: cross-page search, case/literal punctuation, broker isolation, stage totals, page clamping, admin scope and private-field exclusion');
      throw rollback;
    }, {timeout: 60000, isolationLevel: 'RepeatableRead'});
  } catch (e) { if (e !== rollback) throw e; }
  assert.equal(await p.lead.count({where:{assignedToId:actor}}),0);
  console.log('PASS: synthetic records and audit writes rolled back');
}
main().catch(e => {console.error('CHECK_FAILED', e.code || e.constructor.name); process.exitCode=1;}).finally(()=>p.$disconnect());
