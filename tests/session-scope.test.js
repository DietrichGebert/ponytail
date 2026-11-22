const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

function fixture(host, enabled='1') {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ponytail-optin-'));
 const env={...process.env,CLAUDE_CONFIG_DIR:dir,CLAUDE_PROJECT_DIR:dir,XDG_CONFIG_HOME:dir,PONYTAIL_DEFAULT_MODE:'full',PONYTAIL_MAP:'0',PONYTAIL_SESSION_SCOPE:enabled};
 for(const key of ['PLUGIN_DATA','COPILOT_PLUGIN_DATA','QODER_SESSION_ID','CODEBUDDY_PLUGIN_ROOT','CURSOR_VERSION','CLAUDECODE','GROK_HOOK_EVENT','CLAUDE_PLUGIN_ROOT'])delete env[key];
 if(host==='codex')env.PLUGIN_DATA=dir;
 if(host==='claude')env.CLAUDECODE='1';
 if(host==='grok'){env.GROK_HOOK_EVENT='session_start';env.PLUGIN_DATA=dir;}
 if(host==='qoder')env.QODER_SESSION_ID='qoder';
 function hook(name,sid,extra={}) {
  const result=spawnSync(process.execPath,[path.join(ROOT,'hooks/ponytail-'+name+'.js')],{env,input:JSON.stringify({session_id:sid,...extra}),encoding:'utf8',timeout:4000,cwd:dir});
  assert.equal(result.status,0,result.stderr);return result.stdout;
 }
 return {dir,env,hook,close(){fs.rmSync(dir,{recursive:true,force:true});}};
}
for(const host of ['codex','claude','grok'])test(host+': opt-in sessions keep their modes through lifecycle events',()=>{
 const f=fixture(host);try{
  f.hook('activate','A',{source:'startup'});
  f.hook('mode-tracker','A',{prompt:'stop ponytail'});
  f.hook('activate','B',{source:'startup'});
  for(const source of ['resume','clear','compact'])assert.equal(f.hook('activate','A',{source}), '', 'off was reset by '+source);
  assert.equal(f.hook('subagent','A',{agent_type:'general'}),'');
  assert.match(f.hook('subagent','B',{agent_type:'general'}),/PONYTAIL/);
  assert.equal(fs.existsSync(path.join(f.dir,'.ponytail-active')),false,'session path changed legacy flag');
 }finally{f.close();}
});
for(const [host,enabled,sid] of [['codex','0','A'],['unknown','1','A'],['codex','1',undefined],['qoder','1','A']])test(`legacy fallback ${host}/${enabled}/${sid}`,()=>{
 const f=fixture(host,enabled);try{
  const before=f.hook('activate',sid,{source:'startup'});
  assert.match(before,/PONYTAIL/);
  assert.equal(fs.existsSync(path.join(f.dir,'.ponytail-sessions')),false);
 }finally{f.close();}
});

test('default changes do not replace a session snapshot, including the command session',()=>{
 const f=fixture('codex');delete f.env.PONYTAIL_DEFAULT_MODE;
 try {
  f.hook('activate','A',{source:'startup'});
  f.hook('mode-tracker','B',{prompt:'/ponytail default lite'});
  assert.match(f.hook('activate','B',{source:'resume'}),/level: full/);
  assert.match(f.hook('activate','A',{source:'resume'}),/level: full/);
  assert.match(f.hook('activate','C',{source:'startup'}),/level: lite/);
  for(const level of ['lite','full','ultra']) {
   f.hook('mode-tracker','A',{prompt:'/ponytail '+level});
   f.hook('mode-tracker','A',{prompt:'/ponytail-review'});
   f.hook('mode-tracker','A',{prompt:'/ponytail nonsense'});
   assert.match(f.hook('activate','A',{source:'compact'}),new RegExp('level: '+level));
  }
 }finally{f.close();}
});

test('unknown host keeps the stdin-independent subagent fast path',async()=>{
 const f=fixture('unknown');const {spawn}=require('node:child_process');
 try {
  f.hook('activate','A',{source:'startup'});
  const p=spawn(process.execPath,[path.join(ROOT,'hooks/ponytail-subagent.js')],{env:f.env,cwd:f.dir,stdio:['pipe','pipe','pipe']});
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;p.kill();},500);
  await new Promise(resolve=>p.once('exit',resolve));clearTimeout(timer);p.stdin.destroy();
  assert.equal(timedOut,false,'unknown host now waits for stdin');
 }finally{f.close();}
});

test('separate session files preserve legacy data, recover corrupt data and survive opt-out',()=>{
 const f=fixture('codex');try{
  const shared=path.join(f.dir,'.ponytail-active');fs.writeFileSync(shared,'ultra');
  f.hook('activate','A',{source:'startup'});
  const dir=path.join(f.dir,'.ponytail-sessions');const files=fs.readdirSync(dir);
  assert.equal(files.length,1);assert.match(files[0],/^[a-f0-9]{64}$/);
  fs.writeFileSync(path.join(dir,files[0]),'broken');
  assert.match(f.hook('activate','A',{source:'resume'}),/level: full/);
  assert.equal(fs.readFileSync(shared,'utf8'),'ultra');
  f.hook('mode-tracker','A',{prompt:'stop ponytail'});
  f.env.PONYTAIL_SESSION_SCOPE='0';f.hook('activate','A',{source:'startup'});
  f.env.PONYTAIL_SESSION_SCOPE='1';assert.equal(f.hook('activate','A',{source:'resume'}),'');
 }finally{f.close();}
});

test('I/O failure reports degraded isolation and uses legacy mode',()=>{
 const f=fixture('codex');try{
  fs.writeFileSync(path.join(f.dir,'.ponytail-sessions'),'cannot create directory');
  const p=spawnSync(process.execPath,[path.join(ROOT,'hooks/ponytail-activate.js')],{env:f.env,cwd:f.dir,input:JSON.stringify({session_id:'A',source:'startup'}),encoding:'utf8',timeout:4000});
  assert.equal(p.status,0);assert.match(p.stderr,/session state unavailable/);assert.match(p.stdout,/PONYTAIL/);
  assert.equal(fs.readFileSync(path.join(f.dir,'.ponytail-active'),'utf8'),'full');
 }finally{f.close();}
});

test('the same ID in another project does not change the first project',()=>{
 const f=fixture('codex');try{
  f.hook('mode-tracker','A',{prompt:'stop ponytail'});
  f.env.CLAUDE_PROJECT_DIR=path.join(f.dir,'other');
  assert.match(f.hook('activate','A',{source:'startup'}),/level: full/);
  f.env.CLAUDE_PROJECT_DIR=f.dir;
  assert.equal(f.hook('activate','A',{source:'resume'}),'');
 }finally{f.close();}
});

test('concurrent initialization cannot replace an explicit mode',async()=>{
 const f=fixture('codex');const {spawn}=require('node:child_process');
 try {
  const script=`const {sessionMode}=require(process.argv[1]); const s=sessionMode(process.argv[2],'codex','race','project'); if(process.argv[3]==='write')s.write('ultra'); else s.read('full');`;
  const workers=Array.from({length:12},(_,i)=>new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['-e',script,path.join(ROOT,'hooks/ponytail-session.js'),path.join(f.dir,'.ponytail-active'),i===5?'write':'read'],{env:f.env,stdio:'ignore'});
   child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('worker exit '+code)));
  }));
  await Promise.all(workers);
  const files=fs.readdirSync(path.join(f.dir,'.ponytail-sessions'));
  assert.equal(files.length,1);assert.equal(fs.readFileSync(path.join(f.dir,'.ponytail-sessions',files[0]),'utf8'),'ultra');
 }finally{f.close();}
});


test('opt-in subagents without usable stdin retain the legacy fallback', async () => {
 const {spawn} = require('node:child_process');
 for (const legacy of [null, 'ultra']) {
  const f = fixture('codex');
  delete f.env.PONYTAIL_SUBAGENT_MATCHER;
  try {
   if (legacy) {
    f.env.PONYTAIL_SESSION_SCOPE = '0';
    f.hook('mode-tracker', 'A', {prompt: '/ponytail ' + legacy});
    f.env.PONYTAIL_SESSION_SCOPE = '1';
   }
   const child = spawn(process.execPath, [path.join(ROOT, 'hooks/ponytail-subagent.js')], {env:f.env, cwd:f.dir, stdio:['pipe','pipe','pipe']});
   let output = '';
   child.stdout.on('data', chunk => { output += chunk; });
   const timer = setTimeout(() => child.kill(), 4000);
   const code = await new Promise(resolve => child.once('close', resolve));
   clearTimeout(timer);child.stdin.destroy();
   assert.equal(code, 0, 'stdin timeout did not exit cleanly');
   if (legacy) assert.match(output, /level: ultra/);
   else assert.equal(output, '');
   const malformed = spawnSync(process.execPath, [path.join(ROOT, 'hooks/ponytail-subagent.js')], {env:f.env, cwd:f.dir, input:'{broken', encoding:'utf8', timeout:4000});
   assert.equal(malformed.status, 0);
   if (legacy) assert.match(malformed.stdout, /level: ultra/);
   else assert.equal(malformed.stdout, '');
  } finally { f.close(); }
 }
});
