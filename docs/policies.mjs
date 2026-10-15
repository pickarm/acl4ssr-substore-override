// Stable IDs are shared by the editor and generators. Labels are actual client groups.
export const LOON = {
  direct:'DIRECT',proxy:'🌐 国外网站',ai:'🤖 AI平台',reject:'REJECT',
  media:'🎬 流媒体',telegram:'📲 电报消息',finance:'💳 金融平台',auto:'♻️ 全局优选',
};
export const MIHOMO = {
  direct:'DIRECT',proxy:'🚀 节点选择',ai:'💬 Ai平台',reject:'REJECT',
  manual:'🚀 手动切换',auto:'♻️ 自动选择',telegram:'📲 电报消息',
  youtube:'📹 油管视频',netflix:'🎥 奈飞视频',bahamut:'📺 巴哈姆特',bilibili:'📺 哔哩哔哩',
  media:'🌍 国外媒体','china-media':'🌏 国内媒体',fcm:'📢 谷歌FCM',bing:'Ⓜ️ 微软Bing',
  onedrive:'Ⓜ️ 微软云盘',microsoft:'Ⓜ️ 微软服务',apple:'🍎 苹果服务',games:'🎮 游戏平台',
  netease:'🎶 网易音乐','global-direct':'🎯 全球直连',ads:'🛑 广告拦截',purify:'🍃 应用净化',
  fallback:'🐟 漏网之鱼',hk:'🇭🇰 香港节点',jp:'🇯🇵 日本节点',us:'🇺🇲 美国节点',
  tw:'🇨🇳 台湾节点',sg:'🇸🇬 狮城节点',kr:'🇰🇷 韩国节点','netflix-nodes':'🎥 奈飞节点',
};
export const SHADOWROCKET = {direct:'DIRECT',proxy:'PROXY',reject:'REJECT'};
export const CLIENTS={loon:LOON,mihomo:MIHOMO,shadowrocket:SHADOWROCKET};
const definitions = [
  ['direct','直连','基础','direct','direct'],['proxy','代理 / 国外网站','基础','proxy','proxy'],
  ['ai','AI 平台','服务','ai','ai'],['reject','直接拦截','基础','reject','reject'],
  ['youtube','YouTube','影音','media','youtube'],['netflix','Netflix','影音','media','netflix'],
  ['media','国外流媒体','影音','media','media'],['telegram','Telegram 电报','服务','telegram','telegram'],
  ['finance','金融 / 支付','服务','finance','proxy'],
  ['bahamut','巴哈姆特','影音','media','bahamut'],['bilibili','哔哩哔哩','影音','direct','bilibili'],
  ['china-media','国内媒体','影音','direct','china-media'],['netease','网易云音乐','影音','direct','netease'],
  ['microsoft','微软服务','服务','direct','microsoft'],['bing','Bing','服务','direct','bing'],
  ['onedrive','OneDrive 微软云盘','服务','direct','onedrive'],['apple','苹果服务','服务','direct','apple'],
  ['fcm','Google FCM 推送','服务','proxy','fcm'],['games','游戏平台','服务','direct','games'],
  ['ads','广告拦截策略组','基础','reject','ads'],['purify','应用净化策略组','基础','reject','purify'],
  ['global-direct','全球直连策略组','基础','direct','global-direct'],['fallback','漏网之鱼策略组','基础','proxy','fallback'],
  ['auto','自动优选','节点选择','auto','auto'],['manual','手动节点组','节点选择','proxy','manual'],
  ['hk','香港节点组','地区','proxy','hk'],['jp','日本节点组','地区','proxy','jp'],
  ['us','美国节点组','地区','proxy','us'],['tw','台湾节点组','地区','proxy','tw'],
  ['sg','新加坡节点组','地区','proxy','sg'],['kr','韩国节点组','地区','proxy','kr'],
  ['netflix-nodes','Netflix 解锁节点组','节点选择','media','netflix-nodes'],
];
export const CATALOG=Object.fromEntries(definitions.map(([id,label,section,loon,mihomo])=>[id,{label,section,targets:{loon,mihomo,shadowrocket:loon==='direct'?'direct':loon==='reject'?'reject':'proxy'}}]));
export const POLICIES=Object.fromEntries(Object.entries(CATALOG).map(([id,s])=>[id,s.label]));
export function target(rule,client){return rule.targets?.[client] || CATALOG[rule.policy].targets[client];}
export function describe(rule,client){return CLIENTS[client][target(rule,client)];}
export function clientListPath(client,id){return `personal/${client}/${id}.list`;}
