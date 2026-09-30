import openapiTS, { astToString } from 'openapi-typescript';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const input = new URL('../../docs/openapi.json', import.meta.url);
const output = new URL('../src/lib/generated/api-types.ts', import.meta.url);
const generated = '// Generated from docs/openapi.json. Do not edit by hand.\n' + astToString(await openapiTS(input));
if(process.argv.includes('--check')) {
  if(!existsSync(output) || readFileSync(output,'utf8') !== generated) throw new Error('API types are stale. Run npm run api:generate in frontend.');
  console.log('Frontend API types match OpenAPI.');
} else {
  mkdirSync(new URL('../src/lib/generated/', import.meta.url), {recursive:true});
  writeFileSync(output,generated);
  console.log('Generated frontend/src/lib/generated/api-types.ts');
}
