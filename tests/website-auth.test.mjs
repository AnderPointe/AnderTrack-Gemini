import test from 'node:test';
import assert from 'node:assert/strict';
import {signupDetails,emailAuthRequest,authMessage} from '../src/features/live/auth-model.js';
test('signup accepts individual and company profiles without inventing an authorization role',()=>{
  assert.deepEqual(signupDetails({name:' Alex Rivera ',kind:'individual',company:'Ignored'}),{display_name:'Alex Rivera',account_kind:'individual',company_name:null});
  assert.deepEqual(signupDetails({name:'Alex',kind:'company',company:' Example Logistics '}),{display_name:'Alex',account_kind:'company',company_name:'Example Logistics'});
  assert.throws(()=>signupDetails({name:'A',kind:'individual'}));assert.throws(()=>signupDetails({name:'Alex',kind:'company',company:''}));
});
test('registration allows new identities but sign-in never silently creates users',()=>{
  const input={email:' USER@Gmail.com ',origin:'https://example.com',details:{display_name:'Alex',account_kind:'individual'}};
  const registration=emailAuthRequest({...input,signup:true});assert.equal(registration.email,'user@gmail.com');assert.equal(registration.options.shouldCreateUser,true);assert.equal(registration.options.emailRedirectTo,'https://example.com/operations');assert.equal(registration.options.data.role,undefined);
  const signIn=emailAuthRequest({...input,signup:false,driver:true});assert.equal(signIn.options.shouldCreateUser,false);assert.equal(signIn.options.emailRedirectTo,'https://example.com/driver');assert.equal(signIn.options.data,undefined);
});
test('auth errors explain rate limits and disabled registration',()=>{
  assert.match(authMessage({message:'email rate limit exceeded'}),/Wait/);assert.match(authMessage({message:'Signups not allowed'}),/disabled/);assert.equal(authMessage({message:'Network unavailable'}),'Network unavailable');
});
