import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTH_COOLDOWN_STORAGE_KEY,AUTH_SEND_COOLDOWN_MS,AUTH_RATE_LIMIT_BACKOFF_MS,
  rateLimitReached,remainingCooldownSeconds,formatCooldownSeconds,readCooldownUntil,
  saveCooldownUntil} from '../src/auth-feedback.js';

test('Supabase email rate limits are recognized without masking unrelated auth errors',()=>{
  assert.equal(rateLimitReached({status:429,code:'over_email_send_rate_limit'}),true);
  assert.equal(rateLimitReached({message:'email rate limit exceeded'}),true);
  assert.equal(rateLimitReached({code:'over_request_rate_limit'}),true);
  assert.equal(rateLimitReached({status:401,message:'Invalid login credentials'}),false);
});
test('cooldowns protect against repeated magic link requests',()=>{
  assert.equal(AUTH_SEND_COOLDOWN_MS,60000);
  assert.equal(AUTH_RATE_LIMIT_BACKOFF_MS,3600000);
  assert.equal(remainingCooldownSeconds(61_000,1_000),60);
  assert.equal(remainingCooldownSeconds(1_000,61_000),0);
  assert.equal(formatCooldownSeconds(60),'1m');
  assert.equal(formatCooldownSeconds(61),'2m');
  assert.equal(formatCooldownSeconds(15),'15s');
});
test('retry timestamps survive reload and invalid values are rejected',()=>{
  const memory=new Map();
  const store={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)};
  assert.ok(saveCooldownUntil(90000,store));
  assert.equal(memory.has(AUTH_COOLDOWN_STORAGE_KEY),true);
  assert.equal(readCooldownUntil(store,30000),90000);
  assert.equal(readCooldownUntil(store,100000),0);
  memory.set(AUTH_COOLDOWN_STORAGE_KEY,'garbage');
  assert.equal(readCooldownUntil(store,30000),0);
  memory.set(AUTH_COOLDOWN_STORAGE_KEY,String(30000+3600001));
  assert.equal(readCooldownUntil(store,30000),0);
});
test('restricted storage access does not crash login UI',()=>{
  const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.equal(readCooldownUntil(storage,1000),0);
  assert.equal(saveCooldownUntil(2000,storage),false);
});
