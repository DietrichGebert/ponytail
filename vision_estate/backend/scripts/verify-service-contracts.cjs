// End-to-end service/persistence regression. No HTTP/provider calls; always rollback.
const { PrismaClient } = require('@prisma/client');
const { randomUUID, randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { ApplicationRepository } = require('../dist/src/application.repository');
const { AdminService } = require('../dist/src/admin-service');
const { AuthService } = require('../dist/src/auth-service');
const { BookingService } = require('../dist/src/booking-service');
const { PropertiesService } = require('../dist/src/properties/properties.service');
const { schemas } = require('../dist/src/openapi');
const p = new PrismaClient();
process.env.AUTH_JWT_SECRET = randomBytes(48).toString('hex');
const marker = randomUUID();
const rollback = new Error('VERIFIED_ROLLBACK');
const ajv = new Ajv({strict:false}); addFormats(ajv);
function contract(name, value) {
  const validate = ajv.compile({$ref:'#/components/schemas/'+name,components:{schemas}});
  assert.equal(validate(JSON.parse(JSON.stringify(value))), true, 'Response contract: '+name);
}
async function main() {
  try {
    await p.$transaction(async tx=>{
      const db = new Proxy(tx,{get(target,key){return key==='$transaction'?fn=>fn(tx):target[key];}});
      const repository=new ApplicationRepository(db);
      const admin=new AdminService(repository);
      const actor={id:randomUUID(),role:'ADMIN'};
      const email=marker+'@example.invalid';
      const created=await admin.create({name:'Contract test',email,password:'test-'+marker,role:'BROKER'},actor);
      const auth=new AuthService(repository);
      const signedIn=await auth.login({email,password:'test-'+marker});
      contract('Identity',signedIn.identity);
      assert.equal((await tx.auditLog.findFirst({where:{entityId:created.id,action:'USER_CREATED'}})).actorId,actor.id);
      const properties=new PropertiesService(repository);
      const token=randomBytes(32).toString('hex');
      const assessment=await properties.create({address:{street:'Contract test 1',postalCode:'80802',city:'Munich'},propertyType:'HOUSE',sizeSqm:100,condition:'GOOD',yearBuilt:2000,sellerContact:{name:'Contract test',email},dataProcessingConsent:true},'127.0.0.1',marker,token);
      contract('AssessmentCreated',assessment);
      const lead=await tx.lead.findUnique({where:{propertyId:assessment.id}});
      contract('LeadRecord',await admin.assign(lead.id,{brokerId:created.id},actor));
      const bookings=new BookingService(repository,properties);
      const start=new Date(Date.now()+86400000),end=new Date(start.getTime()+1800000);
      const slot=await bookings.slot({startsAt:start.toISOString(),endsAt:end.toISOString()},signedIn.identity);
      contract('Slot',slot);
      // Presence enables reservation only. This script never runs delivery workers.
      process.env.CALENDAR_GATEWAY_URL='https://example.invalid/disabled-test-gateway';
      process.env.CALENDAR_GATEWAY_KEY='synthetic-test-key-no-provider-calls';
      const booking=await bookings.book(assessment.id,{slotId:slot.id},token);
      contract('Booking',booking);
      assert.equal(booking.status,'PENDING_CALENDAR');
      assert.equal((await bookings.book(assessment.id,{slotId:slot.id},token)).id,booking.id);
      contract('SellerBooking',(await bookings.sellerBookings(assessment.id,token))[0]);
      contract('BrokerBooking',(await bookings.list(signedIn.identity))[0]);
      await admin.active(created.id,{active:false},actor);
      assert.equal(await tx.session.count({where:{userId:created.id}}),0);
      console.log('PASS: real repository account/intake/assignment/booking contracts, pending confirmation, retry and session revocation');
      throw rollback;
    },{timeout:90000});
  } catch(e) {if(e!==rollback)throw e;}
  assert.equal(await p.property.count({where:{submissionKey:marker}}),0);
  assert.equal(await p.user.count({where:{email:marker+'@example.invalid'}}),0);
  console.log('PASS: all synthetic records rolled back; no provider calls or messages sent');
}
main().catch(e=>{console.error('REGRESSION_FAILED',e.code||e.constructor.name,e.message?.startsWith('Response contract:')?e.message:'');process.exitCode=1;}).finally(()=>p.$disconnect());
