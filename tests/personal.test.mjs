import {test} from 'node:test';
import assert from 'node:assert/strict';
import {files,normalize,validate,importLines} from '../docs/core.mjs';
import {save} from '../docs/github.mjs';
import {CATALOG,LOON,MIHOMO,target} from '../docs/policies.mjs';
test('portable lists preserve policy, disabled status and CIDR no-resolve',()=>{
  const out=files({version:1,rules:[{type:'DOMAIN',value:'API.Example.com',policy:'ai'},{type:'IP-CIDR',value:'192.168.1.0/24',policy:'direct'},{type:'DOMAIN-SUFFIX',value:'disabled.example.com',policy:'proxy',enabled:false}]});
  assert.match(out['personal/ai.list'],/DOMAIN,api.example.com/);
  assert.match(out['personal/direct.list'],/IP-CIDR,192.168.1.0\/24,no-resolve/);
  assert.doesNotMatch(out['personal/proxy.list'],/disabled\.example/);
  assert.match(out['personal/shadowrocket-snippet.conf'],/RULE-SET,https:.*shadowrocket\/proxy\.list,PROXY/);
});
test('reject duplicate conflicting policies and injection / malformed IP',()=>{
  assert.throws(()=>validate({version:1,rules:[{type:'DOMAIN',value:'a.example.com',policy:'direct'},{type:'DOMAIN',value:'A.example.com',policy:'proxy'}]}),/冲突/);
  for(const value of ['https://example.com/path','example.com,DIRECT','foo\nbar.com','a@b.com']) assert.throws(()=>normalize({type:'DOMAIN',value,policy:'direct'}));
  for(const value of ['999.1.1.1/24','1.2.3.4/99','1.2.3.4','1.2.3.4/24/3']) assert.throws(()=>normalize({type:'IP-CIDR',value,policy:'proxy'}));
  assert.throws(()=>normalize({type:'IP-CIDR6',value:'bad::bad::1/64',policy:'proxy'}));
  assert.equal(normalize({type:'IP-CIDR6',value:'2001:db8::/32',policy:'direct'}).value,'2001:db8::/32');
});
test('bulk imports reject unsupported policy columns without partially importing',()=>{
  assert.equal(importLines('example.com\nDOMAIN,api.example.net\n# comment','ai').length,2);
  assert.throws(()=>importLines('DOMAIN,a.com,DIRECT','ai'),/未知字段/);
});
function mockRemote({conflict=false,race=false}={}){
  const calls=[];let read=0;
  globalThis.fetch=async(url,opts)=>{
    const path=new URL(url).pathname;const body=opts.body?JSON.parse(opts.body):null;calls.push({path,body,method:opts.method});
    let data={};let status=200;
    if(path.endsWith('/git/ref/heads/main')) data={object:{sha:race&&read++?'other':'latest'}};
    else if(path.endsWith('/git/commits/latest')) data={tree:{sha:'base-tree'}};
    else if(path.endsWith('/contents/personal/rules.json')) data={sha:conflict?'changed':'original',content:Buffer.from('{"version":1,"rules":[]}').toString('base64')};
    else if(path.endsWith('/git/trees')) data={sha:'new-tree'};
    else if(path.endsWith('/git/commits')) data={sha:'new-commit'};
    else if(path.endsWith('/git/refs/heads/main')){if(race){status=422;data={message:'Not a fast forward'};}}
    return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  };
  return calls;
}
test('a save writes JSON and every subscription in one non-force commit',async()=>{
  const original=globalThis.fetch;try{const calls=mockRemote();await save({version:1,rules:[]},'test-token',{blob:'original'});const tree=calls.find(c=>c.path.endsWith('/git/trees'));assert.equal(tree.body.tree.length,Object.keys(files({version:1,rules:[]})).length);assert.equal(tree.body.base_tree,'base-tree');const ref=calls.find(c=>c.path.endsWith('/git/refs/heads/main'));assert.equal(ref.body.force,false);}finally{globalThis.fetch=original;}
});
test('changed rule source stops before any write',async()=>{
  const original=globalThis.fetch;try{const calls=mockRemote({conflict:true});await assert.rejects(save({version:1,rules:[]},'test-token',{blob:'original'}),/另一个设备/);assert.ok(calls.every(c=>c.method==='GET'));}finally{globalThis.fetch=original;}
});
test('branch race rejects rather than overwriting concurrent work',async()=>{
  const original=globalThis.fetch;try{mockRemote({race:true});await assert.rejects(save({version:1,rules:[]},'test-token',{blob:'original'}),/远程数据已变化/);}finally{globalThis.fetch=original;}
});
test('all recommended categories reference real groups for each client',()=>{
  assert.equal(Object.keys(MIHOMO).length,31);assert.equal(Object.keys(LOON).length,8);
  for(const [policy,spec]of Object.entries(CATALOG)){
    assert.ok(Object.hasOwn(LOON,spec.targets.loon),policy);
    assert.ok(Object.hasOwn(MIHOMO,spec.targets.mihomo),policy);
  }
});
test('one domain can independently select different client groups',()=>{
  const r=normalize({type:'DOMAIN-SUFFIX',value:'stream.example.com',policy:'netflix',targets:{loon:'finance',mihomo:'us',shadowrocket:'direct'}});
  const out=files({version:1,rules:[r]});
  assert.match(out['personal/loon/finance.list'],/DOMAIN-SUFFIX,stream.example.com/);
  assert.match(out['personal/mihomo/us.list'],/DOMAIN-SUFFIX,stream.example.com/);
  assert.match(out['personal/shadowrocket/direct.list'],/DOMAIN-SUFFIX,stream.example.com/);
  assert.doesNotMatch(out['personal/loon/media.list'],/stream.example.com/);
  assert.doesNotMatch(out['personal/mihomo/netflix.list'],/stream.example.com/);
  const restored=validate(JSON.parse(out['personal/rules.json']));assert.equal(target(restored.rules[0],'loon'),'finance');
});
test('default YouTube routes to Loon media and Clash YouTube, not a copied group name',()=>{
  const out=files({version:1,rules:[{type:'DOMAIN',value:'video.example.com',policy:'youtube'}]});
  assert.match(out['personal/loon/media.list'],/video.example.com/);assert.match(out['personal/mihomo/youtube.list'],/video.example.com/);
  assert.match(out['personal/loon-snippet.conf'],/loon\/media.list, policy=🎬 流媒体/);
});
test('reject nonexistent or cross-client group IDs',()=>{
  assert.throws(()=>normalize({type:'DOMAIN',value:'a.example.com',policy:'ai',targets:{loon:'youtube'}}),/未知客户端分组/);
  assert.throws(()=>normalize({type:'DOMAIN',value:'a.example.com',policy:'ai',targets:{mihomo:'typo'}}),/未知客户端分组/);
});
