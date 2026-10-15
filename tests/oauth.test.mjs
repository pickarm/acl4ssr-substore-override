import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AUTH_ORIGIN,validAuthMessage} from '../docs/oauth.mjs';
test('login message must match origin, popup, nonce and owner',()=>{
  const source={},expected={origin:AUTH_ORIGIN,source,nonce:'client-nonce'};
  const event={origin:AUTH_ORIGIN,source,data:{type:'rule-desk-github-auth',nonce:'client-nonce',user:{id:76402568},token:'ghu_'+'x'.repeat(36)}};
  assert.ok(validAuthMessage(event,expected));
  assert.ok(!validAuthMessage({...event,origin:'https://other.example.com'},expected));
  assert.ok(!validAuthMessage({...event,source:{}},expected));
  assert.ok(!validAuthMessage({...event,data:{...event.data,nonce:'another-nonce'}},expected));
  assert.ok(!validAuthMessage({...event,data:{...event.data,user:{id:1}}},expected));
  assert.ok(!validAuthMessage({...event,data:{...event.data,token:'bad-token'}},expected));
});
