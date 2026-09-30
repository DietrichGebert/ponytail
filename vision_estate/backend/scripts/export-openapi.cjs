// Offline export: never initialize DB connections, workers, or HTTP listeners.
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/src/app.module');
const { PrismaService } = require('../dist/src/prisma.service');
const { createApiDocument } = require('../dist/src/openapi');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const module = await Test.createTestingModule({imports:[AppModule]})
    .overrideProvider(PrismaService).useValue({}).compile();
  const app = module.createNestApplication();
  try {
    const document = createApiDocument(app);
    const content = JSON.stringify(document, null, 2) + '\n';
    const target = path.resolve(__dirname, '../../docs/openapi.json');
    if(process.argv.includes('--check')) {
      if(!fs.existsSync(target) || fs.readFileSync(target,'utf8') !== content)
        throw new Error('OpenAPI is stale. Run npm run contract:generate in backend.');
      console.log('OpenAPI matches current route contract.');
    } else { fs.writeFileSync(target,content); console.log('Exported docs/openapi.json without database access.'); }
  } finally { await app.close(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
