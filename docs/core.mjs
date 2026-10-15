import {POLICIES,CLIENTS,LOON,MIHOMO,SHADOWROCKET,target,clientListPath} from './policies.mjs?v=20261015-process1';
export {POLICIES} from './policies.mjs?v=20261015-process1';
export const TYPES = {'DOMAIN-SUFFIX':'域名及子域名',DOMAIN:'精确域名','DOMAIN-KEYWORD':'域名关键词','IP-CIDR':'IPv4 网段','IP-CIDR6':'IPv6 网段','PROCESS-NAME':'进程名称（Clash / Mihomo）'};
export const REPO = 'pickarm/acl4ssr-substore-override';
export const RAW = `https://raw.githubusercontent.com/${REPO}/main/personal`;
export function normalize(input) {
  const r = {...input};
  if (!Object.hasOwn(POLICIES,r.policy) || !Object.hasOwn(TYPES,r.type)) throw Error('请选择有效的匹配方式和策略');
  const targets={};
  if(r.targets!=null && (typeof r.targets!=='object'||Array.isArray(r.targets))) throw Error('客户端分组映射格式不正确');
  for(const [client,id] of Object.entries(r.targets||{})){
    if(!Object.hasOwn(CLIENTS,client)||!Object.hasOwn(CLIENTS[client],id)) throw Error(`未知客户端分组：${client}/${id}`);
    targets[client]=id;
  }
  if(Object.keys(targets).length)r.targets=targets;else delete r.targets;
  r.value = String(r.value ?? '').trim();
  if(r.type!=='PROCESS-NAME')r.value=r.value.toLowerCase();
  if (!r.value || (r.type==='PROCESS-NAME'?/[\x00-\x1f,\x7f#]/.test(r.value):/[\s,#\r\n]/.test(r.value))) throw Error('目标不能为空，不能含逗号、注释或控制字符；域名不能含空格');
  if(r.type==='PROCESS-NAME'){
    if(r.value.length>255||/[\\/:*?"<>|]/.test(r.value))throw Error('请输入进程文件名，不要包含路径、通配符或逗号');
  } else if (r.type.startsWith('DOMAIN')) {
    if (/[/:?*@]/.test(r.value)) throw Error('请输入域名或关键词，不要包含 https://、路径或通配符');
    try {r.value = new URL(`https://${r.value}`).hostname.replace(/\.$/,'');} catch {throw Error('域名格式不正确');}
    if (r.type !== 'DOMAIN-KEYWORD' && (!r.value.includes('.') || !r.value.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x)))) throw Error('请输入完整域名，例如 example.com');
  } else {
    const [ip,mask,...extra]=r.value.split('/');
    if(extra.length || !/^\d+$/.test(mask ?? '')) throw Error('网段需要带掩码，例如 192.168.1.0/24');
    if(r.type==='IP-CIDR') {
      if(!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || ip.split('.').some(x=>Number(x)>255 || (x.length>1 && x[0]==='0')) || Number(mask)>32) throw Error('IPv4 网段格式不正确');
    } else {
      try {new URL(`https://[${ip}]/`);} catch {throw Error('IPv6 地址格式不正确');}
      if(!ip.includes(':') || Number(mask)>128) throw Error('IPv6 掩码应为 0–128');
    }
  }
  r.id = r.id || crypto.randomUUID(); r.enabled = r.enabled !== false; r.note = String(r.note || '').trim().slice(0,300);
  return r;
}
export function validate(doc) {
  if(doc.version!==1 || !Array.isArray(doc.rules)) throw Error('规则数据版本或格式不正确');
  const keys=new Set(), ids=new Set();
  const rules=doc.rules.map(normalize);
  for(const r of rules){
    if(ids.has(r.id)) throw Error('规则 ID 重复'); ids.add(r.id);
    const key=`${r.type},${r.value.toLowerCase()}`;
    if(r.enabled && keys.has(key)) throw Error(`重复或冲突规则：${key}，请编辑已有规则`);
    if(r.enabled) keys.add(key);
  }
  return {...doc,rules};
}
export function appliesTo(rule,client){return rule.type!=='PROCESS-NAME'||client==='mihomo';}
export function ruleLine(r){return `${r.type},${r.value}${r.type.startsWith('IP-')?',no-resolve':''}`;}
export function overlaps(doc){
  const warnings=[];const rules=doc.rules.filter(r=>r.enabled);
  for(let i=0;i<rules.length;i++)for(let j=i+1;j<rules.length;j++){
    const a=rules[i],b=rules[j];if(Object.keys(CLIENTS).every(c=>target(a,c)===target(b,c)))continue;
    const covers=(x,y)=>x.type==='DOMAIN-SUFFIX'&&['DOMAIN','DOMAIN-SUFFIX'].includes(y.type)&&(y.value===x.value||y.value.endsWith('.'+x.value));
    if(covers(a,b)||covers(b,a))warnings.push(`${a.value} 与 ${b.value} 的匹配范围重叠，策略不同`);
  }
  return warnings;
}
export function files(doc){
  doc=validate(doc);
  const output={'personal/rules.json':JSON.stringify(doc,null,2)+'\n'};
  function list(path,rows,label){output[path]=`# Personal rules: ${label}. Managed by Rule Desk.\n`+(rows.length?rows.map(ruleLine).join('\n'):'# No active rules. Reserved non-public placeholder:\nDOMAIN,empty.personal-rules.invalid')+'\n';}
  for(const [client,groups]of Object.entries(CLIENTS))for(const [id,label]of Object.entries(groups))list(clientListPath(client,id),doc.rules.filter(r=>r.enabled&&appliesTo(r,client)&&target(r,client)===id),`${client}/${label}`);
  // Keep the four v1 URLs usable for previously configured clients. Fine-grained
  // routing requires the one-time v2 subscription migration shown in the editor.
  for(const id of ['direct','proxy','ai','reject'])list(`personal/${id}.list`,doc.rules.filter(r=>r.enabled&&appliesTo(r,'loon')&&(LOON[target(r,'loon')]==='DIRECT'?'direct':target(r,'loon')==='ai'?'ai':target(r,'loon')==='reject'?'reject':'proxy')===id),`legacy/${id}`);
  output['personal/loon-snippet.conf']='# Replace the four old PERSONAL subscriptions with these eight entries.\n# Keep all ordinary subscriptions and private nodes. Add before ordinary Remote Rule entries.\n[Remote Rule]\n'+Object.entries(LOON).map(([id,label])=>`${RAW}/loon/${id}.list, policy=${label}, tag=个人${label}, enabled=true`).join('\n')+'\n';
  output['personal/shadowrocket-snippet.conf']='# Merge these entries into the TOP of your existing [Rule] section.\n# Replace PROXY with an existing proxy group if needed. This is NOT a full config.\n[Rule]\n'+Object.entries(SHADOWROCKET).map(([id,label])=>`RULE-SET,${RAW}/shadowrocket/${id}.list,${label}`).join('\n')+'\n';
  output['personal/loon-geoip.list']='# Loon GeoIP fallback: place AFTER ordinary remote rules.\nGEOIP,CN\n';
  return output;
}
export function importLines(text,policy){
  return text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&!x.startsWith(';')).map((line,i)=>{
    const [type,value,...tail]=line.split(',').map(x=>x.trim());
    if(tail.some(x=>x.toLowerCase()!=='no-resolve')) throw Error(`第 ${i+1} 行含策略或未知字段；请先移除，统一使用所选策略`);
    return normalize(value?{type,value,policy}:{type:'DOMAIN-SUFFIX',value:type,policy});
  });
}
