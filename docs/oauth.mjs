export const AUTH_ORIGIN='https://pickarm-rule-desk-auth.lclxy1231.workers.dev';
export function validAuthMessage(event,expected){
  const data=event.data;
  return event.origin===expected.origin&&event.source===expected.source&&data?.type==='rule-desk-github-auth'&&data.nonce===expected.nonce&&data.user?.id===76402568&&typeof data.token==='string'&&/^[A-Za-z0-9_]{20,255}$/.test(data.token);
}
let pending=false;
export function loginWithGitHub(){
  if(pending)return Promise.reject(Error('已有 GitHub 登录窗口，请在该窗口完成登录'));
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  const popup=window.open(`${AUTH_ORIGIN}/start?nonce=${nonce}`,'rule-desk-github-login','popup,width=580,height=760');
  if(!popup)return Promise.reject(Error('浏览器阻止了登录弹窗，请允许本网站弹窗后重试'));
  pending=true;
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{pending=false;window.removeEventListener('message',onMessage);clearInterval(closed);clearTimeout(timeout);};
    const onMessage=event=>{if(!validAuthMessage(event,{origin:AUTH_ORIGIN,source:popup,nonce}))return;cleanup();resolve(event.data);};
    window.addEventListener('message',onMessage);
    const closed=setInterval(()=>{if(popup.closed){cleanup();reject(Error('GitHub 登录窗口已关闭；如果尚未完成，请重新点击登录'));}},700);
    const timeout=setTimeout(()=>{cleanup();popup.close();reject(Error('GitHub 登录超时，请重新登录'));},610000);
  });
}
