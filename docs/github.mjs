import {files,REPO,validate} from './core.mjs';
const BASE=`https://api.github.com/repos/${REPO}`;
export async function request(path,token,body,method){
  const res=await fetch(BASE+path,{signal:AbortSignal.timeout(20000),method:method||(body?'POST':'GET'),cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok){const e=await res.json().catch(()=>({})); throw Error(`${res.status}：${res.status===401?'凭据无效或已过期':res.status===403?'没有写入权限，或 API 请求超过限额':res.status===409||res.status===422?'远程数据已变化，请先备份草稿、重新读取后再保存':e.message||'GitHub 请求失败'}`);}
  return res.json();
}
export async function load(token){
  const head=await request('/git/ref/heads/main',token);
  const commit=await request(`/git/commits/${head.object.sha}`,token);
  const data=await request(`/contents/personal/rules.json?ref=${head.object.sha}`,token);
  const bytes=Uint8Array.from(atob(data.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  return {doc:validate(JSON.parse(new TextDecoder().decode(bytes))),head:head.object.sha,tree:commit.tree.sha,blob:data.sha};
}
export async function save(doc,token,base){
  const latest=await load(token);
  if(latest.blob!==base.blob) throw Error('另一个设备已修改规则。请先导出草稿，再重新读取合并，避免覆盖。');
  const output=files({...doc,updatedAt:new Date().toISOString()});
  const tree=await request('/git/trees',token,{base_tree:latest.tree,tree:Object.entries(output).map(([path,content])=>({path,mode:'100644',type:'blob',content}))});
  const commit=await request('/git/commits',token,{message:`rules: update personal rules (${doc.rules.length})`,tree:tree.sha,parents:[latest.head]});
  // Non-force update rejects any intervening commit; source and lists stay atomic.
  await request('/git/refs/heads/main',token,{sha:commit.sha,force:false},'PATCH');
  return load(token);
}
