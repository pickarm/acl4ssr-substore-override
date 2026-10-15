import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,files,validate} from '../docs/core.mjs';
test('process names preserve spaces and case and only export to Mihomo',()=>{
const rule=normalize({type:'PROCESS-NAME',value:'ChatGPT (Beta).exe',policy:'ai'});
assert.equal(rule.value,'ChatGPT (Beta).exe');const output=files({version:1,rules:[rule]});
assert.match(output['personal/mihomo/ai.list'],/PROCESS-NAME,ChatGPT \(Beta\).exe/);
for(const [path,body]of Object.entries(output))if(path.endsWith('.list')&&!path.startsWith('personal/mihomo/'))assert.ok(!body.includes('PROCESS-NAME'),path);
assert.throws(()=>normalize({...rule,value:'evil.exe,REJECT'}));assert.throws(()=>normalize({...rule,value:'bad\n.exe'}));assert.throws(()=>normalize({...rule,value:'C:/program.exe'}));
assert.throws(()=>validate({version:1,rules:[rule,{...rule,id:'other',value:'chatgpt (beta).exe'}]}));
});
