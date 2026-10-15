import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{seal,unseal,authorizeAccount} from '../worker/worker.mjs';
const secret='unit-test-client-secret-not-a-real-credential';
test('encrypted OAuth state rejects expiry, tampering and incorrect keys',async()=>{
  const value={version:1,expires:Date.now()+60000,nonce:'x'.repeat(43),verifier:'v'.repeat(43),callback:'https://example.com/callback'};
  const state=await seal(value,secret);assert.deepEqual(await unseal(state,secret),value);assert.ok(!state.includes(value.nonce));
  await assert.rejects(unseal(state,'another-secret'));await assert.rejects(unseal(state,secret,Date.now()+120000));
  await assert.rejects(unseal(state.slice(0,-6)+'abcdef',secret));
});
test('unconfigured Worker cannot initiate authorization',async()=>{
  assert.equal((await worker.fetch(new Request('https://example.com/start?nonce='+'n'.repeat(43)),{})).status,503);
});
test('authorization starts with PKCE and an encrypted state, never a client secret',async()=>{
  const response=await worker.fetch(new Request('https://example.com/start?nonce='+'n'.repeat(43)),{GITHUB_CLIENT_ID:'public-client-id',GITHUB_APP_ID:'42',GITHUB_CLIENT_SECRET:secret});
  assert.equal(response.status,302);const target=new URL(response.headers.get('Location'));assert.equal(target.origin,'https://github.com');assert.equal(target.searchParams.get('code_challenge_method'),'S256');assert.equal(target.searchParams.get('redirect_uri'),'https://example.com/callback');assert.ok(!target.href.includes(secret));
});
test('invalid state cannot reach the token exchange',async()=>{
  const original=globalThis.fetch;try{globalThis.fetch=()=>{throw Error('Network must not be called');};const r=await worker.fetch(new Request('https://example.com/callback?state=invalid&code=x'),{GITHUB_CLIENT_ID:'id',GITHUB_APP_ID:'42',GITHUB_CLIENT_SECRET:secret});assert.equal(r.status,400);}finally{globalThis.fetch=original;}
});
test('login enforces owner, installed app write permission and selected repository',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>Response.json({id:1,login:'other-user'});await assert.rejects(authorizeAccount('fake-token','42'),/仅允许/);
    globalThis.fetch=async url=>Response.json(url.endsWith('/user')?{id:76402568,login:'pickarm'}:url.includes('/user/installations?')?{installations:[{id:7,app_id:42,permissions:{contents:'write'}}]}:{repositories:[{id:1338627461}]});
    assert.equal((await authorizeAccount('fake-token','42')).login,'pickarm');
    globalThis.fetch=async url=>Response.json(url.endsWith('/user')?{id:76402568}:url.includes('/user/installations?')?{installations:[{id:7,app_id:42,permissions:{contents:'read'}}]}:{repositories:[{id:1338627461}]});
    await assert.rejects(authorizeAccount('fake-token','42'),/请先安装/);
  }finally{globalThis.fetch=original;}
});
