// Synthetic real-database verification. Every write rolls back; no worker or provider runs.
const {PrismaClient}=require('@prisma/client');
const {randomUUID,randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const {ApplicationRepository}=require('../dist/src/application.repository');
const {PropertiesService}=require('../dist/src/properties/properties.service');
const {PropertyWorkflowService}=require('../dist/src/properties/property-workflow-service');
const {NewsletterService,newsletterToken}=require('../dist/src/newsletter');
const {hashToken}=require('../dist/src/auth-crypto');
const p=new PrismaClient(),marker=randomUUID(),rollback=new Error('INTENTIONAL_ROLLBACK');
process.env.NEWSLETTER_TOKEN_SECRET=randomBytes(48).toString('hex');
async function main(){
  try{await p.$transaction(async tx=>{
    const db=new Proxy(tx,{get(target,key){return key==='$transaction'?fn=>fn(tx):target[key];}});
    const repo=new ApplicationRepository(db),properties=new PropertiesService(repo),news=new NewsletterService(repo);
    const email=marker+'@example.invalid',access=randomBytes(32).toString('hex');
    const dto={address:{street:'Blueprint test 1',postalCode:'80331',city:'München'},propertyType:'HOUSE',sizeSqm:100,condition:'GOOD',yearBuilt:2000,sellerContact:{name:'Synthetic blueprint test',email},dataProcessingConsent:true,newsletterOptIn:true};
    const created=await properties.create(dto,'127.0.0.1',marker,access);
    assert.equal((await tx.property.findUnique({where:{id:created.id}})).locale,'de-DE');
    const sub=await tx.newsletterSubscription.findUnique({where:{email}});assert.equal(sub.state,'PENDING');assert.equal(sub.confirmTokenHash,null);
    const job=await tx.notification.findFirst({where:{recipient:email,kind:'NEWSLETTER_CONFIRM'}});assert.ok(job);assert.equal(JSON.stringify(job.payload).includes('token'),false);
    await properties.create(dto,'127.0.0.1',marker,access);
    assert.equal(await tx.notification.count({where:{recipient:email,kind:'NEWSLETTER_CONFIRM'}}),1);
    const token=newsletterToken(sub.id,'confirm',sub.confirmTokenExpiresAt.getTime());
    await tx.newsletterSubscription.update({where:{id:sub.id},data:{confirmTokenHash:hashToken(token)}});
    await news.confirm(token,'127.0.0.1');await assert.rejects(()=>news.confirm(token,'127.0.0.1'));
    await news.unsubscribe(newsletterToken(sub.id,'withdraw',0),'127.0.0.1');
    assert.equal((await tx.newsletterSubscription.findUnique({where:{id:sub.id}})).state,'WITHDRAWN');
    assert.equal(await tx.consent.count({where:{userId:sub.id,consentType:'NEWSLETTER'}}),3);
    const plainEmail='plain-'+email;
    await properties.create({...dto,newsletterOptIn:false,sellerContact:{name:'No newsletter test',email:plainEmail}},'',marker+'-plain',randomBytes(32).toString('hex'));
    assert.equal(await tx.newsletterSubscription.count({where:{email:plainEmail}}),0);
    const workflow=new PropertyWorkflowService(properties,repo,{});
    const status=await workflow.status(created.id,access);assert.equal(status.reviewedAt,null);assert.equal(status.locale,'de-DE');
    // A legacy payload may contain strategic fields. Seller projection must remove them.
    await tx.report.create({data:{propertyId:created.id,tier:'VALUE_SIGNAL',releaseState:'SELLER_VISIBLE',payload:{provider:'PriceHubble',recommendation:'PRIVATE',strategy:['PRIVATE']}}});
    const signal=await workflow.signal(created.id,access);assert.equal(signal.recommendation,undefined);assert.equal(signal.strategy,undefined);
    await assert.rejects(()=>workflow.full(created.id,access));
    console.log('PASS: German default, optional newsletter, queued consent, hash-only token, confirmation/replay/withdrawal, private strategy projection');
    throw rollback;
  },{timeout:90000});}catch(e){if(e!==rollback)throw e;}
  assert.equal(await p.property.count({where:{submissionKey:{startsWith:marker}}}),0);
  assert.equal(await p.newsletterSubscription.count({where:{email:marker+'@example.invalid'}}),0);
  assert.equal(await p.notification.count({where:{recipient:marker+'@example.invalid'}}),0);
  console.log('PASS: rollback verified; no retained synthetic records, provider calls or messages');
}
main().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1;}).finally(()=>p.$disconnect());
