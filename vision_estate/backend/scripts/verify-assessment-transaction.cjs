const { ApplicationRepository } = require('../dist/src/application.repository');
// Exercises the real assessment service against PostgreSQL, always rolling back.
const { PrismaClient } = require('@prisma/client');
const { PropertiesService } = require('../dist/src/properties/properties.service');
const crypto = require('node:crypto');
const p = new PrismaClient();
const rollback = new Error('VERIFIED_ROLLBACK');
const key = crypto.randomUUID();
async function main() {
  try {
    await p.$transaction(async tx => {
      const db = new Proxy(tx, { get(target, name) { return name === '$transaction' ? async fn => fn(tx) : target[name]; } });
      const service = new PropertiesService(new ApplicationRepository(db));
      const token = crypto.randomBytes(32).toString('hex');
      const dto = { address: { street: 'Synthetic verification 1', postalCode: '80802', city: 'Munich', country: 'DE' }, propertyType: 'HOUSE', sizeSqm: 100, condition: 'GOOD', yearBuilt: 2000, sellerContact: { name: 'Synthetic verification', email: 'verification@example.invalid' }, dataProcessingConsent: true };
      const result = await service.create(dto, '127.0.0.1', key, token);
      const retry = await service.create(dto, '127.0.0.1', key, token);
      if (result.id !== retry.id) throw new Error('Idempotency failed');
      const property = await service.authorize(result.id, token);
      if (property.state !== 'SUBMITTED') throw new Error('Unexpected state');
      if (await tx.lead.count({where:{propertyId:result.id}}) !== 1) throw new Error('Lead missing');
      if (await tx.consent.count({where:{userId:result.id}}) !== 1) throw new Error('Consent missing');
      if (await tx.auditLog.count({where:{entityId:result.id}}) !== 1) throw new Error('Audit missing');
      let forbidden = false;
      try { await service.authorize(result.id, '0'.repeat(64)); } catch (e) { forbidden = e.getStatus?.() === 403; }
      if (!forbidden) throw new Error('Ownership enforcement failed');
      console.log('PASS: assessment creation, idempotent retry, ownership, lead, consent and audit');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) { if (e !== rollback) throw e; }
  if (await p.property.count({ where: { submissionKey: key } })) throw new Error('Rollback failed');
  console.log('PASS: rolled back; no synthetic assessment retained');
}
main().catch(e => { console.error('VERIFICATION_FAILED', e.code || e.errorCode || e.constructor.name); process.exitCode = 1; }).finally(() => p.$disconnect());
