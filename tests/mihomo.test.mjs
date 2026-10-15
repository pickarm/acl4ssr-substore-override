import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
test('function-scoped script entry never references pruned personal policy groups',()=>{
  const source=readFileSync('dist/acl4ssr-full.js','utf8');
  for(const names of [['US private detail node'],['JP 日本01'],['private node without a region']]){
    // Script runners can return the local main declaration, not globalThis.main.
    const entry=vm.runInNewContext(`(function(){${source}\n;return main;})()`,{});
    const proxies=names.map(name=>({name,type:'ss',server:'192.0.2.1',port:443}));
    const output=entry({proxies});
    const policies=new Set(['DIRECT','REJECT',...output['proxy-groups'].map(g=>g.name)]);
    for(const line of output.rules)assert.ok(policies.has(line.split(',').at(-1)),`Missing policy for ${line}`);
    const expected=names[0].includes('日本')?'🇯🇵 日本节点':'🚀 节点选择';
    assert.equal(output.rules.find(r=>r.startsWith('RULE-SET,personal-jp,')),`RULE-SET,personal-jp,${expected}`);
    for(const group of output['proxy-groups']){
      assert.ok(group.proxies.length>0);
      for(const ref of group.proxies)assert.ok(policies.has(ref)||names.includes(ref),`Missing group member ${ref}`);
    }
    assert.equal(output.proxies[0].name,names[0]);
  }
});
test('generated override places personal rules first and retains nodes + VLESS UDP',()=>{
  const sandbox={};vm.runInNewContext(readFileSync('dist/acl4ssr-full.js','utf8'),sandbox);
  const output=sandbox.main({proxies:[{name:'US private detail node',type:'vless',server:'192.0.2.1',port:443,uuid:'test',flow:'xtls-rprx-vision'},{name:'SG detail node',type:'ss',server:'192.0.2.2',port:443}]});
  assert.deepEqual(Array.from(output.rules.slice(0,4)),['RULE-SET,personal-direct,DIRECT','RULE-SET,personal-proxy,🚀 节点选择','RULE-SET,personal-ai,💬 Ai平台','RULE-SET,personal-reject,REJECT']);
  assert.equal(output.proxies[0].uuid,'test');assert.equal(output.proxies[0].flow,'xtls-rprx-vision');assert.equal(output.proxies[0].udp,true);assert.equal(output.proxies[0]['packet-encoding'],'xudp');assert.equal(output.proxies[1].type,'ss');
  const policies=new Set(['DIRECT','REJECT',...output['proxy-groups'].map(g=>g.name)]);
  for(const line of output.rules)assert.ok(policies.has(line.split(',').at(-1)),`Missing policy for ${line}`);
  for(const key of ['direct','proxy','ai','reject'])assert.match(output['rule-providers'][`personal-${key}`].url,new RegExp(`/personal/mihomo/${key}\\.list$`));
  assert.equal(output.rules.find(r=>r.startsWith('RULE-SET,personal-hk,')),'RULE-SET,personal-hk,🚀 节点选择');
  assert.equal(output.rules.find(r=>r.startsWith('RULE-SET,personal-us,')),'RULE-SET,personal-us,🇺🇲 美国节点');
});

