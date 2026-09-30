const {PrismaClient}=require('@prisma/client');
const fs=require('node:fs'),path=require('node:path');
const {randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const statements=require('./sql-statements.cjs');
const p=new PrismaClient(),schema='ve_invitation_rehearsal_'+randomBytes(8).toString('hex'),rollback=new Error('ROLLBACK');
async function main(){
 try {await p.$transaction(async tx=>{
  await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
  await tx.$executeRawUnsafe('CREATE TABLE "User" (id TEXT PRIMARY KEY)');
  await tx.$executeRawUnsafe(`INSERT INTO "User" VALUES ('admin'),('broker')`);
  const sql=fs.readFileSync(path.join(__dirname,'../prisma/migrations/202609210002_broker_invitations/migration.sql'),'utf8');
  for(const statement of statements(sql))await tx.$executeRawUnsafe(statement);
  await tx.$executeRawUnsafe(`INSERT INTO "StaffInvitation" (id,"userId","invitedById","tokenHash","expiresAt") VALUES ('invite','broker','admin','hashed',now()+interval '2 days')`);
  const rows=await tx.$queryRawUnsafe('SELECT "acceptedAt","revokedAt" FROM "StaffInvitation"');
  assert.deepEqual(rows,[{acceptedAt:null,revokedAt:null}]);
  throw rollback;
 },{timeout:60000});}catch(e){if(e!==rollback)throw e;}
 console.log('PASS: additive invitation table, foreign keys and pending state; temporary schema rolled back.');
}
main().catch(e=>{console.error('INVITATION_REHEARSAL_FAILED',e.code||e.name);process.exitCode=1;}).finally(()=>p.$disconnect());
