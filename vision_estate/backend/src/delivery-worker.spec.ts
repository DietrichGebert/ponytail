import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DeliveryWorker} from './delivery-worker';
import {hashToken} from './auth-crypto';
describe('Newsletter delivery boundaries',()=>{
  beforeEach(()=>{vi.stubEnv('CALENDAR_GATEWAY_URL','');vi.stubEnv('EMAIL_GATEWAY_URL','');vi.stubEnv('NEWSLETTER_EMAIL_GATEWAY_URL','https://mail.example.invalid');vi.stubEnv('NEWSLETTER_EMAIL_GATEWAY_KEY','test-mail-key');vi.stubEnv('PUBLIC_APP_URL','https://portal.example.invalid');vi.stubEnv('NEWSLETTER_TOKEN_SECRET','test-only-token-secret-'.repeat(3));});
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  function fixture(state='PENDING',kind='NEWSLETTER_CONFIRM'){
    const expires=new Date(Date.now()+3600000);
    const repo:any={updateManyNewsletterSubscription:vi.fn().mockResolvedValue({count:1}),findManyNotification:vi.fn().mockResolvedValue([{id:'job',kind,recipient:'demo@example.invalid',attempts:0,payload:{subscriptionId:'sub',locale:'de-DE',expiresAt:expires.toISOString()}}]),findUniqueNewsletterSubscription:vi.fn().mockResolvedValue({id:'sub',state,email:'demo@example.invalid',confirmTokenExpiresAt:expires}),updateNotification:vi.fn()};
    const send=vi.fn().mockResolvedValue({ok:true,json:async()=>({accepted:true})});vi.stubGlobal('fetch',send);
    return {repo,send,worker:new DeliveryWorker(repo)};
  }
  it('uses the isolated sender and stores only the confirmation hash',async()=>{
    const {repo,send,worker}=fixture();await worker.tick();expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('https://mail.example.invalid');
    const body=JSON.parse(send.mock.calls[0][1].body);const token=new URLSearchParams(new URL(body.payload.confirmUrl).hash.slice(1)).get('token');
    expect(body.payload.subject).toContain('Bestätigen');expect(token).toBeTruthy();
    expect(repo.updateManyNewsletterSubscription).toHaveBeenCalledWith(expect.objectContaining({data:{confirmTokenHash:hashToken(token!)}}));
    expect(repo.updateNotification).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({state:'SENT'})}));
  });
  it('cancels confirmation delivery after withdrawal',async()=>{const {repo,send,worker}=fixture('WITHDRAWN');await worker.tick();expect(send).not.toHaveBeenCalled();expect(repo.updateNotification).toHaveBeenCalledWith({where:{id:'job'},data:{state:'CANCELLED'}});});
  it('never sends a newsletter to an unconfirmed subscription',async()=>{const {send,worker}=fixture('PENDING','NEWSLETTER');await worker.tick();expect(send).not.toHaveBeenCalled();});
  it('adds an unsubscribe capability to eligible newsletter deliveries',async()=>{const {send,worker}=fixture('CONFIRMED','NEWSLETTER');await worker.tick();const payload=JSON.parse(send.mock.calls[0][1].body).payload;expect(payload.unsubscribeUrl).toContain('/newsletter/unsubscribe#token=');});
  it('does not claim a successful send when the provider rejects delivery',async()=>{const {repo,send,worker}=fixture();send.mockResolvedValue({ok:false});await worker.tick();expect(repo.updateNotification).toHaveBeenCalledWith({where:{id:'job'},data:expect.objectContaining({state:'PENDING',attempts:{increment:1},lastError:'Email provider unavailable'})});});
});
