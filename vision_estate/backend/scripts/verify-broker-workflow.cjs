// Actual database/service paths with synthetic data; every write is rolled back.
const {PrismaClient}=require('@prisma/client');
const {randomUUID,randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const {ApplicationRepository}=require('../dist/src/application.repository');
const {StaffInvitationsService,invitationToken}=require('../dist/src/staff-invitations');
const {AdminService}=require('../dist/src/admin-service');
const {PropertiesService}=require('../dist/src/properties/properties.service');
const {PropertyWorkflowService}=require('../dist/src/properties/property-workflow-service');
const {RecordsService}=require('../dist/src/records');
const {AuthService}=require('../dist/src/auth-service');
const {passwordHash}=require('../dist/src/auth-crypto');
const p=new PrismaClient(),marker=randomUUID(),rollback=new Error('EXPECTED_ROLLBACK');
process.env.AUTH_JWT_SECRET=randomBytes(48).toString('hex');
async function main(){
 try {await p.$transaction(async tx=>{
  const db=new Proxy(tx,{get(target,key){return key==='$transaction'?fn=>fn(tx):target[key];}});
  const repo=new ApplicationRepository(db), invites=new StaffInvitationsService(repo),admin=new AdminService(repo),auth=new AuthService(repo);
  const actor=await tx.user.create({data:{name:'Synthetic administrator',email:'admin-'+marker+'@example.invalid',passwordHash:passwordHash(randomBytes(24).toString('hex')),role:'ADMIN'}});
  const email=marker+'@example.invalid';
  const invited=await invites.invite({name:'Synthetic broker',email,locale:'en'},actor);
  let invitation=await tx.staffInvitation.findUnique({where:{id:invited.invitationId}});
  assert.equal((await tx.user.findUnique({where:{id:invitation.userId}})).active,false);
  await assert.rejects(()=>admin.active(invitation.userId,{active:true},actor));
  const oldToken=invitationToken(invitation.id,invitation.expiresAt.getTime());
  await invites.resend(invitation.id,actor);
  await assert.rejects(()=>invites.inspect(oldToken));
  invitation=await tx.staffInvitation.findUnique({where:{id:invited.invitationId}});
  const token=invitationToken(invitation.id,invitation.expiresAt.getTime());
  assert.equal((await invites.inspect(token)).email,email);
  await invites.accept({token,password:'synthetic-password-'+marker});
  await assert.rejects(()=>invites.accept({token,password:'synthetic-password-'+marker}));
  const login=await auth.login({email,password:'synthetic-password-'+marker});
  const broker=await tx.user.findUnique({where:{id:login.identity.id}});
  const properties=new PropertiesService(repo),workflow=new PropertyWorkflowService(properties,repo,{});
  const owner=randomBytes(32).toString('hex');
  const created=await properties.create({address:{street:'Synthetic verification 1',postalCode:'80331',city:'Munich'},propertyType:'HOUSE',sizeSqm:100,condition:'GOOD',yearBuilt:2000,sellerContact:{name:'Synthetic seller',email:'seller-'+email},dataProcessingConsent:true},'',marker,owner);
  const lead=await tx.lead.findUnique({where:{propertyId:created.id}});
  await admin.assign(lead.id,{brokerId:broker.id},actor);
  await tx.property.update({where:{id:created.id},data:{state:'REPORT_READY'}});
  const report=await tx.report.create({data:{propertyId:created.id,tier:'FULL',payload:{strategy:['Synthetic test only']}}});
  await assert.rejects(()=>workflow.release(report.id,broker));
  await assert.rejects(()=>workflow.full(created.id,owner));
  await workflow.review(lead.id,broker);
  const reviewed=await tx.report.findUnique({where:{id:report.id}});assert.equal(reviewed.reviewedByUserId,broker.id);
  await workflow.release(report.id,broker);
  await workflow.release(report.id,broker);
  assert.equal((await workflow.full(created.id,owner)).reportId,report.id);
  assert.equal(await tx.auditLog.count({where:{entityId:report.id,action:'FULL_REPORT_RELEASED'}}),1);
  assert.equal(await tx.notification.count({where:{kind:'FULL_REPORT_RELEASED',payload:{path:['reportId'],equals:report.id}}}),1);
  const consent=await new RecordsService(repo).consents(created.id,{limit:25},broker);
  assert.equal(consent.data.length,1);
  assert.equal(consent.data[0].consentType,'DATA_PROCESSING');
  await assert.rejects(()=>properties.authorize(created.id,'',{id:'another-broker',role:'BROKER'}));
  // Database rejection is verified against the migrated live schema; savepoint keeps fixture transaction usable.
  await tx.$executeRawUnsafe('SAVEPOINT invariant_test');
  let rejected=false;
  try{await tx.report.update({where:{id:report.id},data:{payload:{tampered:true}}});}catch{rejected=true;}
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invariant_test');assert.ok(rejected);
  console.log('PASS: invitation verification/password/login, approval bypass denied, report review/release, duplicate notification prevention, scoped consent and immutable report.');
  throw rollback;
 },{timeout:180000});}catch(e){if(e!==rollback)throw e;}
 assert.equal(await p.user.count({where:{email:marker+'@example.invalid'}}),0);
 assert.equal(await p.property.count({where:{submissionKey:marker}}),0);
 console.log('PASS: all synthetic data rolled back; no emails or external provider calls.');
}
main().catch(e=>{console.error('BROKER_WORKFLOW_FAILED',e.code||e.name,e instanceof assert.AssertionError?e.message:'');process.exitCode=1;}).finally(()=>p.$disconnect());
