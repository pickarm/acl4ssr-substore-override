import {POLICIES,TYPES,RAW,REPO,normalize,validate,importLines,overlaps} from './core.mjs';
import {load,save} from './github.mjs';
import {loginWithGitHub} from './oauth.mjs';
import {CATALOG,CLIENTS,LOON,MIHOMO,describe,target} from './policies.mjs';
const $=id=>document.getElementById(id);
let doc={version:1,rules:[]},base=null,token='',dirty=false,busy=false,editing=null;
const say=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error);};
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function categoryOptions(select,all=false){
  select.replaceChildren();if(all){const o=el('option','所有分类');o.value='';select.append(o);}
  const sections=new Map();
  for(const [id,spec]of Object.entries(CATALOG)){
    if(!sections.has(spec.section)){const group=document.createElement('optgroup');group.label=spec.section;sections.set(spec.section,group);select.append(group);}
    const o=el('option',spec.label);o.value=id;sections.get(spec.section).append(o);
  }
}
function routingDescription(rule,client){return rule.type==='PROCESS-NAME'&&client!=='mihomo'?'不适用（进程规则仅同步 Clash/Mihomo）':describe(rule,client);}
function mappingControls(rule){
  for(const [client,groups]of Object.entries(CLIENTS)){
    const select=$(`target-${client}`);select.replaceChildren();
    const o=el('option',`跟随分类 → ${groups[CATALOG[rule.policy].targets[client]]}`);o.value='';select.append(o);
    for(const [id,label]of Object.entries(groups)){const option=el('option',label);option.value=id;select.append(option);}
    select.value=rule.targets?.[client]||'';
  }
  mappingSummary();
}
function editorRule(){return {type:$('rule-type').value,policy:$('rule-policy').value,targets:Object.fromEntries(Object.keys(CLIENTS).map(c=>[c,$(`target-${c}`).value]).filter(([,id])=>id))};}
function mappingSummary(){
  const rule=editorRule();for(const client of ['loon','shadowrocket'])$(`target-${client}`).disabled=rule.type==='PROCESS-NAME';$('mapping-summary').textContent=`Clash → ${routingDescription(rule,'mihomo')}；Loon → ${routingDescription(rule,'loon')}；小火箭 → ${routingDescription(rule,'shadowrocket')}。`;
  $('region-note').hidden=!['hk','jp','us','tw','sg','kr','netflix-nodes'].includes(target(rule,'mihomo'));
}
function update(){
  document.querySelector('.panel').inert=busy;$('editor').inert=busy;$('bulk').inert=busy;
  $('publish').disabled=!dirty||busy||!base;$('reload').disabled=busy;$('connect').textContent=token?'已连接 · GitHub':'连接 GitHub';
  $('state').textContent=dirty?'有未保存的修改 · 保存后才同步设备':base?`已读取 · ${doc.updatedAt?new Date(doc.updatedAt).toLocaleString():'尚无修改'}`:'尚未读取成功';
  $('count').textContent=String(doc.rules.length);$('stats').replaceChildren();
  const warnings=overlaps(doc);$('warnings').hidden=!warnings.length;$('warnings').textContent=warnings.slice(0,4).join('；')+(warnings.length?'。不同策略的重叠规则在各客户端可能有不同的匹配结果，建议消除重叠。':'');
  for(const [label,count] of [['全部规则',doc.rules.length],['已启用',doc.rules.filter(r=>r.enabled).length],['Clash 可选分组',Object.keys(MIHOMO).length],['Loon 可选策略',Object.keys(LOON).length]]){const s=el('div','','stat');s.append(el('span',label),el('strong',String(count)));$('stats').append(s);}
  $('rows').replaceChildren();const q=$('search').value.trim().toLowerCase(),p=$('filter').value;
  const rows=doc.rules.filter(r=>(!p||r.policy===p)&&`${r.value} ${r.note} ${POLICIES[r.policy]} ${routingDescription(r,'mihomo')} ${routingDescription(r,'loon')}`.toLowerCase().includes(q));
  $('empty').hidden=rows.length>0;$('empty').querySelector('h3').textContent=doc.rules.length?'没有符合条件的规则':'从你的第一条规则开始';
  for(const r of rows){
    const tr=el('tr','',r.enabled?'':'disabled-row');const goal=el('td',r.value,'target');goal.append(el('small',TYPES[r.type]));
    const policy=el('td','');policy.append(el('span',POLICIES[r.policy],`badge ${r.policy}`),el('small',`Clash → ${routingDescription(r,'mihomo')}`,'mapping-line'),el('small',`Loon → ${routingDescription(r,'loon')}`,'mapping-line'));
    const note=el('td',r.note||'—','note');note.title=r.note;const enabled=el('td','');const toggle=el('button',r.enabled?'已启用':'已停用','row-action');toggle.setAttribute('aria-label',`${r.enabled?'停用':'启用'} ${r.value}`);
    toggle.onclick=()=>{try{const next=structuredClone(doc);next.rules.find(x=>x.id===r.id).enabled=!r.enabled;doc=validate(next);changed();}catch(e){say(e.message,true);}};enabled.append(toggle);
    const actions=el('td','');const edit=el('button','编辑','row-action');edit.onclick=()=>openEditor(r);const del=el('button','删除','row-action delete');del.onclick=()=>{doc.rules=doc.rules.filter(x=>x.id!==r.id);changed();say(`已从草稿删除 ${r.value}；保存后同步。误删可重新读取或从修改历史恢复。`);};actions.append(edit,del);tr.append(goal,policy,note,enabled,actions);$('rows').append(tr);
  }
}
function changed(){dirty=true;update();}
function openEditor(r){editing=r?.id||null;$('editor-title').textContent=r?'编辑规则':'添加规则';$('rule-type').value=r?.type||'DOMAIN-SUFFIX';$('rule-value').value=r?.value||'';$('rule-policy').value=r?.policy||'direct';$('rule-note').value=r?.note||'';mappingControls(r||{policy:'direct'});$('editor').showModal();}
async function refresh(){if(dirty&&!confirm('放弃当前未保存草稿，重新读取 GitHub？可先导出备份。'))return;busy=true;update();try{const result=await load(token);base=result;doc=result.doc;dirty=false;say('已读取 GitHub。可以编辑；保存时需连接 GitHub。');}catch(e){say(`读取失败：${e.message}。请检查网络，或连接 GitHub 后重试。`,true);}finally{busy=false;update();}}
$('rule-form').onsubmit=e=>{e.preventDefault();try{const old=doc.rules.find(r=>r.id===editing);const r=normalize({...old,...editorRule(),type:$('rule-type').value,value:$('rule-value').value,note:$('rule-note').value});const next={...doc,rules:editing?doc.rules.map(x=>x.id===editing?r:x):[...doc.rules,r]};doc=validate(next);changed();$('editor').close();say('已加入草稿，点击“保存到 GitHub”同步。');}catch(e){alert(e.message);}};
for(const id of ['add','empty-add'])$(id).onclick=()=>openEditor();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('search').oninput=update;$('filter').onchange=update;$('reload').onclick=refresh;
$('connect').onclick=()=>$('auth').showModal();
$('github-login').onclick=async()=>{
  $('github-login').disabled=true;
  try{const result=await loginWithGitHub();token=result.token;$('token').value='';$('auth').close();say(`已通过 GitHub 登录（${result.user.login}）。现在可以保存规则。`);if(!base)await refresh();else update();}
  catch(e){say(e.message,true);}
  finally{$('github-login').disabled=false;}
};
$('token-link').href='https://github.com/settings/personal-access-tokens/new?name=Rule%20Desk&description=Manage%20personal%20proxy%20rules';
$('authorize').onclick=async()=>{const candidate=$('token').value.trim();if(!candidate)return say('请填写 GitHub 访问令牌。',true);$('authorize').disabled=true;try{const {request}=await import('./github.mjs');const repo=await request('',candidate);if(!repo.permissions?.push)throw Error('该令牌没有此仓库的写权限');token=candidate;$('token').value='';$('auth').close();say('GitHub 已连接，凭据仅在本页面内存中保存。');if(!base)await refresh();else update();}catch(e){alert(e.message);}finally{$('authorize').disabled=false;}};
$('disconnect').onclick=()=>{token='';$('token').value='';$('auth').close();update();say('已清除本页面的连接凭据。');};
$('publish').onclick=async()=>{if(!token)return $('auth').showModal();busy=true;update();say('正在将规则源与订阅文件一起保存到 GitHub…');try{const result=await save(doc,token,base);base=result;doc=result.doc;dirty=false;say('已保存到 GitHub！现在可在各客户端刷新个人远程规则，无需等待定时任务。');}catch(e){say(`保存失败：${e.message}；草稿仍保留，可导出备份。`,true);}finally{busy=false;update();}};
$('import').onclick=()=>$('bulk').showModal();
$('do-import').onclick=()=>{try{const text=$('bulk-text').value.trim();if(!text)throw Error('请粘贴要导入的规则');const incoming=text.startsWith('{')?validate(JSON.parse(text)).rules:importLines(text,$('bulk-policy').value);const next=validate({...doc,rules:[...doc.rules,...incoming]});doc=next;changed();$('bulk').close();$('bulk-text').value='';say(`已导入 ${incoming.length} 条到草稿，请保存到 GitHub。`);}catch(e){alert(e.message);}};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(doc,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`personal-rules-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('已导出当前草稿备份。');};
function linkRow(parent,label,url){const row=el('div','','link-row'),input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label',label);const copy=el('button','复制','outline');copy.onclick=async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='已复制';}catch{input.select();say('请手动复制已选中的地址。');}};row.append(input,copy);$(parent).append(row);}
linkRow('loon-link','Loon 接入片段',`${RAW}/loon-snippet.conf`);linkRow('sr-link','Shadowrocket 接入片段',`${RAW}/shadowrocket-snippet.conf`);
const linkClient=document.createElement('select'),linkGroup=document.createElement('select');linkClient.setAttribute('aria-label','订阅客户端');linkGroup.setAttribute('aria-label','订阅分组');
for(const [id,label]of Object.entries({mihomo:'Clash / Mihomo',loon:'Loon',shadowrocket:'小火箭'})){const o=el('option',label);o.value=id;linkClient.append(o);}
const linkUrl=el('div','');linkUrl.id='selected-rule-link';$('rule-links').append(linkClient,linkGroup,linkUrl);
function showLink(){linkUrl.replaceChildren();linkRow(linkUrl.id,'所选分组订阅地址',`${RAW}/${linkClient.value}/${linkGroup.value}.list`);}
function groupLinks(){linkGroup.replaceChildren();for(const [id,label]of Object.entries(CLIENTS[linkClient.value])){const o=el('option',label);o.value=id;linkGroup.append(o);}showLink();}
linkClient.onchange=groupLinks;linkGroup.onchange=showLink;groupLinks();
$('loon-link').append($('loon-migration').content.cloneNode(true));
for(const id of ['subscriptions','setup'])$(id).onclick=()=>$('links').showModal();
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
// No token is ever stored in localStorage, sessionStorage, a cookie or a URL.
categoryOptions($('rule-policy'));categoryOptions($('bulk-policy'));categoryOptions($('filter'),true);
$('rule-type').onchange=mappingSummary;
$('rule-policy').onchange=()=>mappingControls(editorRule());for(const client of Object.keys(CLIENTS))$(`target-${client}`).onchange=mappingSummary;
refresh();
