// Cloudflare Worker: GitHub App user authorization, no database or private key.
// Never log request URLs, authorization codes, client secrets, or tokens.
const OWNER_ID=76402568;
const REPO_ID=1338627461;
const FRONTEND='https://pickarm.github.io/acl4ssr-substore-override/';
const ORIGIN=new URL(FRONTEND).origin;
const encoder=new TextEncoder();
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),x=>x.charCodeAt(0));
const random=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
async function key(secret){const digest=await crypto.subtle.digest('SHA-256',encoder.encode('rule-desk-oauth-state-v1:'+secret));return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(data,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const body=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),encoder.encode(JSON.stringify(data)));return `${base64url(iv)}.${base64url(body)}`;}
export async function unseal(state,secret,now=Date.now()){
  if(typeof state!=='string'||state.length>3000||state.split('.').length!==2)throw Error('授权状态无效，请重新点击登录');
  try{
    const [iv,body]=state.split('.');const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await key(secret),decode(body));
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(data.version!==1||!Number.isFinite(data.expires)||data.expires<now||data.expires>now+601000||!/^[A-Za-z0-9_-]{32,100}$/.test(data.nonce)||!/^[A-Za-z0-9_-]{43}$/.test(data.verifier))throw Error();
    return data;
  }catch{throw Error('授权已过期或状态校验失败，请重新点击登录');}
}
function reply(body,status=200){return new Response(body,{status,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});}
async function github(path,token){
  const res=await fetch('https://api.github.com'+path,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'pickarm-rule-desk'}});
  if(!res.ok)throw Error('GitHub 权限检查失败，请确认已将应用安装到规则仓库');return res.json();
}
export async function authorizeAccount(token,appId){
  const user=await github('/user',token);
  if(user.id!==OWNER_ID)throw Error('仅允许仓库所有者 pickarm 登录');
  const installations=await github('/user/installations?per_page=100',token);
  const installation=installations.installations?.find(i=>String(i.app_id)===String(appId)&&i.permissions?.contents==='write');
  if(!installation)throw Error('请先安装 Rule Desk GitHub App，并授权规则仓库的 Contents 读写权限');
  const accessible=await github(`/user/installations/${installation.id}/repositories?per_page=100`,token);
  if(!accessible.repositories?.some(r=>r.id===REPO_ID))throw Error('该应用尚未获准访问 acl4ssr-substore-override 仓库');
  return user;
}
function finish(payload){
  const nonce=random();const safe=JSON.stringify(payload).replaceAll('<','\\u003c');
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>GitHub 登录成功</title><h2>GitHub 登录成功</h2><p>正在返回规则管理网页。若窗口没有关闭，请返回原来的网页。</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${safe},${JSON.stringify(ORIGIN)});window.close();}</script></html>`;
  return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`}});
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method!=='GET')return reply('Method not allowed',405);
  if(url.pathname==='/health')return reply(JSON.stringify({service:'rule-desk-github-login',configured:!!(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.GITHUB_APP_ID)}));
  if(!['/start','/callback'].includes(url.pathname))return reply('Rule Desk GitHub login service');
  if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.GITHUB_APP_ID)return reply('尚未配置 GitHub App。请配置 GITHUB_CLIENT_ID、GITHUB_APP_ID 和加密 Secret GITHUB_CLIENT_SECRET。',503);
  try{
    const callback=url.origin+'/callback';
    if(url.pathname==='/start'){
      const nonce=url.searchParams.get('nonce');if(!/^[A-Za-z0-9_-]{32,100}$/.test(nonce||''))return reply('请从规则管理网页点击 GitHub 登录',400);
      const verifier=random();const challenge=base64url(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
      const state=await seal({version:1,expires:Date.now()+600000,nonce,verifier,callback},env.GITHUB_CLIENT_SECRET);
      const target=new URL('https://github.com/login/oauth/authorize');
      for(const [name,value]of Object.entries({client_id:env.GITHUB_CLIENT_ID,redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:'S256',login:'pickarm'}))target.searchParams.set(name,value);
      return new Response(null,{status:302,headers:{...headers,Location:target.href}});
    }
    const state=await unseal(url.searchParams.get('state'),env.GITHUB_CLIENT_SECRET);
    if(state.callback!==callback)throw Error('授权回调地址不匹配，请重新登录');
    if(url.searchParams.get('error'))throw Error('GitHub 授权已取消，请返回网页重试');
    const code=url.searchParams.get('code');if(!code||code.length>512)throw Error('GitHub 没有返回有效授权码');
    const res=await fetch('https://github.com/login/oauth/access_token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','User-Agent':'pickarm-rule-desk'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:callback,code_verifier:state.verifier})});
    const result=await res.json();if(!res.ok||!result.access_token)throw Error('GitHub 授权码交换失败，请重新登录');
    const user=await authorizeAccount(result.access_token,env.GITHUB_APP_ID);
    return finish({type:'rule-desk-github-auth',nonce:state.nonce,token:result.access_token,user:{id:user.id,login:user.login},expiresIn:result.expires_in||null});
  }catch(error){
    // Errors are deliberately small, fixed messages without external response bodies.
    const safe=error instanceof Error&&/^(授权|请|仅允许|GitHub|该应用)/.test(error.message)?error.message:'登录处理失败，请返回规则管理页重新登录';
    return reply(safe,400);
  }
}};
