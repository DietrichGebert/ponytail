const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('node:crypto');
async function main(){
 const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
 const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
 if(!email||!password||password.length<12)throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters).');
 const prisma=new PrismaClient();
 try{
  if(await prisma.user.findUnique({where:{email}}))throw new Error('Account already exists; this command never overwrites accounts.');
  const salt=randomBytes(16).toString('hex');
  await prisma.user.create({data:{email,name:process.env.BOOTSTRAP_ADMIN_NAME||'Administrator',role:'ADMIN',passwordHash:salt+':'+scryptSync(password,salt,64).toString('hex')}});
  console.log('Administrator created. Remove bootstrap credentials from the environment after use.');
 }finally{await prisma.$disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

