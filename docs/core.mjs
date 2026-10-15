export const POLICIES = {direct:'直连',proxy:'代理',ai:'AI 平台',reject:'拦截'};
export const TYPES = {'DOMAIN-SUFFIX':'域名及子域名',DOMAIN:'精确域名','DOMAIN-KEYWORD':'域名关键词','IP-CIDR':'IPv4 网段','IP-CIDR6':'IPv6 网段'};
export const REPO = 'pickarm/acl4ssr-substore-override';
export const RAW = `https://raw.githubusercontent.com/${REPO}/main/personal`;
export function normalize(input) {
  const r = {...input};
  if (!Object.hasOwn(POLICIES,r.policy) || !Object.hasOwn(TYPES,r.type)) throw Error('请选择有效的匹配方式和策略');
  r.value = String(r.value ?? '').trim().toLowerCase();
  if (!r.value || /[\s,#\r\n]/.test(r.value)) throw Error('目标不能为空，也不能含空格、逗号或注释');
  if (r.type.startsWith('DOMAIN')) {
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
    const key=`${r.type},${r.value}`;
    if(r.enabled && keys.has(key)) throw Error(`重复或冲突规则：${key}，请编辑已有规则`);
    if(r.enabled) keys.add(key);
  }
  return {...doc,rules};
}
export function ruleLine(r){return `${r.type},${r.value}${r.type.startsWith('IP-')?',no-resolve':''}`;}
export function overlaps(doc){
  const warnings=[];const rules=doc.rules.filter(r=>r.enabled);
  for(let i=0;i<rules.length;i++)for(let j=i+1;j<rules.length;j++){
    const a=rules[i],b=rules[j];if(a.policy===b.policy)continue;
    const covers=(x,y)=>x.type==='DOMAIN-SUFFIX'&&['DOMAIN','DOMAIN-SUFFIX'].includes(y.type)&&(y.value===x.value||y.value.endsWith('.'+x.value));
    if(covers(a,b)||covers(b,a))warnings.push(`${a.value} 与 ${b.value} 的匹配范围重叠，策略不同`);
  }
  return warnings;
}
export function files(doc){
  doc=validate(doc);
  const output={'personal/rules.json':JSON.stringify(doc,null,2)+'\n'};
  for(const p of Object.keys(POLICIES)){
    const rows=doc.rules.filter(r=>r.enabled && r.policy===p);
    // Reserved .invalid placeholder keeps empty lists parseable in all clients.
    output[`personal/${p}.list`]=`# Personal rules: ${p}. Managed by Rule Desk.\n`+(rows.length?rows.map(ruleLine).join('\n'):'# No active rules. Reserved non-public placeholder:\nDOMAIN,empty.personal-rules.invalid')+'\n';
  }
  output['personal/loon-snippet.conf']='# Add these lines BEFORE existing entries in [Remote Rule].\n[Remote Rule]\n'+Object.keys(POLICIES).map(p=>`${RAW}/${p}.list, policy=${({direct:'DIRECT',proxy:'🌐 国外网站',ai:'🤖 AI平台',reject:'REJECT'})[p]}, tag=个人${POLICIES[p]}, enabled=true`).join('\n')+'\n';
  output['personal/shadowrocket-snippet.conf']='# Merge these entries into the TOP of your existing [Rule] section.\n# Replace PROXY with an existing proxy group if needed. This is NOT a full config.\n[Rule]\n'+Object.keys(POLICIES).map(p=>`RULE-SET,${RAW}/${p}.list,${({direct:'DIRECT',proxy:'PROXY',ai:'PROXY',reject:'REJECT'})[p]}`).join('\n')+'\n';
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
