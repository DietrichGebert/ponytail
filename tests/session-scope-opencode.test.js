const {test}=require('node:test');
test('OpenCode V2 session mode isolation and default snapshot', async()=>{
// Exercise the real plugin callbacks with isolated state and native V2 event shapes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ponytail-session-check-'));
process.env.XDG_CONFIG_HOME=tmp;
process.env.PONYTAIL_DEFAULT_MODE='full';
process.env.PONYTAIL_SESSION_SCOPE='1';
try {
 const plugin=(await import(pathToFileURL(path.resolve('.opencode/plugins/ponytail.mjs')))).default;
 async function load() {
  const commands={},hooks={};
  await plugin.setup({skill:{transform:async cb=>cb({add(){}})},command:{transform:async cb=>cb({add(c){commands[c.name]=c;}})},session:{hook:async(k,cb)=>{hooks[k]=cb;},prompt:async()=>{}}});
  return {commands,hooks};
 }
 let {commands,hooks}=await load();
 await commands.ponytail.execute({sessionID:'A',prompt:{text:'off'}});
 const a={sessionID:'A',system:[]},b={sessionID:'B',system:[]};
 await hooks.context(a); await hooks.context(b);
 assert.equal(a.system.length,0);
 assert.ok(b.system.some(p=>p.text.includes('level: full')), 'Session A off leaked into B');
 ({commands,hooks}=await load());
 const resumed={sessionID:'A',system:[]};await hooks.compaction(resumed);assert.equal(resumed.system.length,0);
 await commands.ponytail.execute({sessionID:'B',prompt:{text:'lite'}});
 const compacted={sessionID:'B',system:[]};await hooks.compaction(compacted);
 assert.ok(compacted.system.some(p=>p.text.includes('level: lite')));
 const stillOff={sessionID:'A',system:[]};await hooks.context(stillOff);assert.equal(stillOff.system.length,0);
 delete process.env.PONYTAIL_DEFAULT_MODE;
 const initial={sessionID:'default-A',system:[]};await hooks.context(initial);
 assert.ok(initial.system.some(p=>p.text.includes('level: full')));
 await commands.ponytail.execute({sessionID:'B',prompt:{text:'default lite'}});
 for (const event of ['context','compaction']) {
  const existing={sessionID:'default-A',system:[]};await hooks[event](existing);
  assert.ok(existing.system.some(p=>p.text.includes('level: full')), 'Changed default leaked into existing session');
 }
 ({commands,hooks}=await load());
 const old={sessionID:'default-A',system:[]},fresh={sessionID:'default-C',system:[]};
 await hooks.context(old);await hooks.context(fresh);
 assert.ok(old.system.some(p=>p.text.includes('level: full')), 'Reload lost initial session mode');
 assert.ok(fresh.system.some(p=>p.text.includes('level: lite')), 'New session missed changed default');
 const missingID={system:[]};await hooks.compaction(missingID);
 assert.ok(missingID.system.some(p=>p.text.includes('level: lite')), 'Missing ID did not use legacy fallback');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}

});
