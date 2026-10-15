# ACL4SSR Sub-Store Override

## 个人规则管理网页

管理地址：**https://pickarm.github.io/acl4ssr-substore-override/**

在网页中添加、编辑、删除、停用规则，支持 32 个分类、批量导入与 JSON 备份。规则源是 `personal/rules.json`。同一条规则可以分别指定各客户端的分组，不复制客户端之间不兼容的策略名。

### 各端独立分组（v2）

- **Clash / Mihomo**：当前仓库全部 29 个策略组，以及内置 DIRECT / REJECT，共 31 个可选策略。
- **Loon**：保持原有 6 个可见组，加内置 DIRECT / REJECT，共 8 个可选策略，不新增国家组或业务组。
- **小火箭**：DIRECT / PROXY / REJECT，接入时将 PROXY 替换为自己的实际代理组名。

| 分类示例 | Clash 默认分组 | Loon 默认分组 |
|---|---|---|
| YouTube | 📹 油管视频 | 🎬 流媒体 |
| Telegram | 📲 电报消息 | 📲 电报消息 |
| 微软服务 | Ⓜ️ 微软服务 | DIRECT |
| 金融 / 支付 | 🚀 节点选择 | 💳 金融平台 |
| 香港节点组 | 🇭🇰 香港节点 | 🌐 国外网站 |

添加或编辑规则时可覆盖以上推荐映射。例如同一域名可以指定 Clash 美国组、Loon 金融组；表格会显示两端实际去向。地区组和 Netflix 筛选组在 Clash 中没有符合节点时回退到节点选择，不生成空组；网页明确提示该行为。生成器会核对策略目录和上游真实组名，未知组名直接停止发布。

订阅输出位于 `personal/mihomo/`、`personal/loon/`、`personal/shadowrocket/`，按客户端实际分组归类。原有四个 `personal/*.list` URL 保留兼容输出；要使用细分分组，请**一次性升级接入**：Mihomo 刷新覆写并重新生成配置，Loon 用新片段的 8 条个人订阅替换旧 4 条，小火箭用新片段替换旧个人 RULE-SET。普通规则与私人节点订阅保留。

首次在网页“连接 GitHub”中，用仅授权本仓库、Contents Read and write 的 fine-grained token 连接。令牌只在页面内存中使用，刷新后重新连接，不写进仓库、URL 或浏览器存储。网站不需要后端或第三方 CDN 脚本。公开查看无需令牌，写入必须有权限。

点击“保存到 GitHub”会将规则源、各客户端规则集和接入片段放在**同一提交**中，保存后直接刷新客户端规则即可。不同设备发生冲突时拒绝覆盖，先导出草稿、重新读取后合并。网页不会上传客户端里临时新增的本地规则。

### Mihomo 空地区组与订阅更新失败

Mihomo 的地区策略组按当前订阅节点动态生成：没有日本节点就不会生成 `🇯🇵 日本节点` 组。个人规则 `personal-jp` 等如果指向已消失的地区组，脚本会在**完成策略组裁剪后**自动回退到 `🚀 节点选择`，而不是输出无效的 RULE-SET 引用。只要日本节点再次出现，这条规则就恢复到 `🇯🇵 日本节点`。

构建测试会实际执行生成的 JS，分别模拟“无日本节点”“有日本节点”“仅美国节点”的订阅，确保所有规则目标都存在，避免 Mihomo 因 `proxy ... not found` 拒绝更新配置。

如果 GitHub 已修复而本地仍报旧错误，先确认 **Sub-Store 远程覆写脚本已更新并重新生成 Mihomo 配置文件**，而不是仅刷新 Mihomo 的节点；`cdn.jsdelivr.net/...@main/` 可能缓存旧脚本。必要时临时使用固定 Git commit SHA 的 `https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@<commit>/dist/acl4ssr-full.js` 以绕过分支版本缓存。更新后重新导出/刷新 Sub-Store 文件分享链接，不要混用旧的本地覆写脚本。

每台设备首次接入方法见网页“设备接入”：

- **Mihomo / Clash.Meta**：刷新 `dist/acl4ssr-full.js` 并通过 Sub-Store 重新生成配置一次。新版本在普通规则之前引用 personal-direct/proxy/ai/reject，默认每小时更新，支持手动刷新。旧版 Clash 内核不在本次兼容范围。
- **Loon**：把 `personal/loon-snippet.conf` 条目合并到已有 `[Remote Rule]` 最前面，保持已有私人节点订阅。不能将片段当成完整配置导入。本地规则和插件规则仍可能优先于远程订阅。
- **小火箭**：把 `personal/shadowrocket-snippet.conf` 条目合并到已有 `[Rule]` 最前面；把片段中的 `PROXY` 改为本机已有的策略组，AI 可单独指定组。

共用规则支持 DOMAIN、DOMAIN-SUFFIX、DOMAIN-KEYWORD、IP-CIDR、IP-CIDR6。跨策略的重叠后缀会提示；不同客户端匹配细节不同，优先消除重叠。空列表只放保留域名 `.invalid` 占位，确保可解析。

若直接使用 GitHub 自带编辑器改 `personal/rules.json`，GitHub Actions 会生成订阅文件（需等待运行完成）。网页保存则不必等待生成。已有上游规则、节点信息和两个仓库的业务组保持各自维护。

本地检查：`node --test tests/personal.test.mjs`；生成个人订阅：`node scripts/personal.mjs`。Pages 使用 `main` 分支的 `/docs` 目录发布。

把 ACL4SSR 官方 `ACL4SSR_Online_Full.ini` 自动转换为可用于 **Sub-Store / Mihomo** 与 **sing-box AI 分流** 的输出配置，并持续跟踪上游更新。

> 非 ACL4SSR / Sub-Store 官方项目。规则与分组定义来源于 ACL4SSR，上游节点转换能力依赖 Sub-Store。

## 相关项目

- ACL4SSR：<https://github.com/ACL4SSR/ACL4SSR>
- Sub-Store：<https://github.com/sub-store-org/Sub-Store>
- sing-box：<https://github.com/SagerNet/sing-box>
- 本项目：<https://github.com/pickarm/acl4ssr-substore-override>

## 输出文件

```text
dist/
├── acl4ssr-full.js      # Sub-Store / Mihomo JavaScript 覆写
└── sing-box/
    ├── ai.json          # sing-box source rule-set
    └── ai.srs           # sing-box binary rule-set
```

规则文件统一镜像到：

```text
rulesets/*.list
```

为了改善中国大陆访问，生成配置中的规则地址默认使用 jsDelivr：

```text
https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/rulesets/...
```

## Mihomo / Clash.Meta 使用方法

在 Sub-Store 中先创建一个 **Mihomo 配置文件**，来源选择你的订阅或组合订阅，然后进入：

**文件 → 操作 → 脚本操作 → 远程链接**

填写：

```text
https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/dist/acl4ssr-full.js
```

脚本会保留 Sub-Store 已解析出的原始 `proxies` 节点对象，只重建：

- `proxy-groups`
- `rule-providers`
- `rules`

因此 VLESS、Reality、Vision 等节点不会再经过旧版 subconverter 二次解析。

生成后，把 Sub-Store 的 **文件分享链接** 添加到 Clash Verge Rev、Mihomo Party 等 Mihomo 客户端即可。

### 业务策略组直接选择明细节点

生成脚本会把当前订阅中的实际节点名称直接追加到普通 `select` 业务组中。以 AI 为例：

```text
💬 Ai平台
├── 🚀 节点选择
├── ♻️ 自动选择
├── 🇭🇰 香港节点
├── 🇺🇲 美国节点
├── DIRECT
├── US 美国01移联优化   ← 实际节点
├── HK 香港三网优化     ← 实际节点
└── ...
```

因此不需要先进入 `🚀 手动切换` 才能手选节点。Telegram、YouTube、Netflix、国外媒体、Microsoft、Apple、游戏平台、漏网之鱼等普通业务 `select` 组同样会直接显示实际节点。

以下辅助组保持原语义，不会无条件塞入全部节点：

- `🚀 手动切换`：本身已经匹配全部节点。
- `🎥 奈飞节点`：只保留 Netflix/解锁节点筛选。
- `🛑 广告拦截` / `🍃 应用净化`：只保留 REJECT / DIRECT 等控制项。

地区 `url-test` 组仍只包含对应地区节点，不会因为这个改动混入其他地区。

### VLESS UDP-over-TCP

本项目现在会对 Sub-Store 输出中的 **VLESS** 节点自动补齐：

```yaml
udp: true
packet-encoding: xudp
```

不再生成任何 `UDP/443 REJECT`。因此语音、STUN、QUIC / HTTP3、游戏等应用 UDP 都可以进入 VLESS 的 UDP relay。

对于当前使用的 Vision + REALITY 节点，外层代理连接仍然是 TCP：

```text
应用 UDP
  ↓
Mihomo
  ↓
XUDP / VLESS UDP relay
  ↓
VLESS + TCP + REALITY
  ↓
VPS
  ↓
目标 UDP
```

脚本不会把 VLESS 的传输层强制改成其他协议；原节点未设置 `network` 时，Mihomo 的 VLESS 默认使用 TCP。VPS 不需要开放额外 UDP 入站端口，但服务端必须可以正常发起 UDP 出站连接。

非 VLESS 节点对象保持原样。


## sing-box AI 规则集

项目会从 ACL4SSR 当前镜像得到的 `AI_*.list` 自动生成 sing-box Headless Rule，并同时发布 source JSON 与编译后的二进制 `.srs`：

```text
https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/dist/sing-box/ai.json
https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/dist/sing-box/ai.srs
```

生成器当前无损转换以下 ACL4SSR AI 规则类型：

- `DOMAIN`
- `DOMAIN-SUFFIX`
- `DOMAIN-KEYWORD`
- `DOMAIN-REGEX`

如果 ACL4SSR 的 AI 规则未来出现未支持的类型，生成任务会直接失败，而不是静默丢规则。

### sing-box 路由示例

下面示例把命中 AI 规则集的连接送到名为 `us-home` 的出站。推荐使用体积更小的二进制 `.srs`：

```json
{
  "route": {
    "rules": [
      {
        "rule_set": "acl4ssr-ai",
        "action": "route",
        "outbound": "us-home"
      }
    ],
    "rule_set": [
      {
        "type": "remote",
        "tag": "acl4ssr-ai",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/dist/sing-box/ai.srs",
        "update_interval": "6h"
      }
    ]
  }
}
```

需要调试或审计域名时，可以把 `format` 改为 `source` 并把 URL 换成 `ai.json`。

## 自动同步机制

上游配置：

```text
https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini
```

`.github/workflows/sync-upstream.yml` 每 6 小时运行一次，也支持手动运行；Pull Request 会执行同样的生成与 sing-box 编译检查，但不会自动提交生成物。

同步流程：

1. 拉取最新 `ACL4SSR_Online_Full.ini`。
2. 解析 `ruleset=` 与 `custom_proxy_group=`。
3. 下载 Full 配置实际引用的全部 ACL4SSR `.list` 文件。
4. 镜像到本仓库 `rulesets/`，并记录来源、SHA-256 与大小。
5. 生成 Mihomo `rule-providers` 和 Sub-Store JS 覆写，并对 VLESS 节点强制启用 `udp: true` + `packet-encoding: xudp`。
6. 校验输出中不存在全局 UDP/443 REJECT，并检查 VLESS UDP normalizer。
7. 从镜像后的 ACL4SSR AI 规则生成 `dist/sing-box/ai.json`。
8. 使用官方 sing-box Docker 镜像编译 `dist/sing-box/ai.srs`。
9. 运行 smoke test；解析、镜像、转换或编译失败时停止发布。
10. 只有内容实际变化时才由 `github-actions[bot]` 自动提交。

## 仓库结构

```text
.github/workflows/
└── sync-upstream.yml
scripts/
├── generate.mjs
└── sing-box.mjs
dist/
├── acl4ssr-full.js
└── sing-box/
    ├── ai.json
    └── ai.srs
rulesets/
└── *.list
upstream/
└── ACL4SSR_Online_Full.ini
upstream.json
```

`upstream.json` 会记录：

- ACL4SSR Full 配置 SHA-256
- rules / groups / providers 数量
- Mihomo 与 sing-box 输出文件路径
- sing-box AI 转换后的规则数量与字段统计
- 每个镜像规则的上游地址、镜像地址、SHA-256 和文件大小

例如 OpenAI / ChatGPT 规则会直接同步到本仓库的 `rulesets/OpenAi_*.list` 与 AI 规则中，可以在仓库内搜索 `chatgpt.com`、`openai.com` 等域名审计规则。

## 兼容性

当前转换器处理 ACL4SSR Full 中使用的：

- `select`
- `url-test`
- `fallback`
- `load-balance`
- `ruleset=<策略>,<远程 URL>`
- `ruleset=<策略>,[]<内联规则>`

Mihomo 输出会在 Sub-Store 执行脚本时动态枚举节点名称。除 VLESS 的 UDP 相关字段外，节点对象保持 Sub-Store 已解析的原始内容；VLESS 会统一写入 `udp: true` 与 `packet-encoding: xudp`。

sing-box source rule-set 使用 version `3`，兼顾当前 sing-box 与较新的稳定版本；二进制规则由 GitHub Actions 中的官方 sing-box 镜像编译。

## 安全限制

生成器只允许镜像以下前缀的规则：

```text
https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/
```

如果 ACL4SSR Full 突然引用其他域名，Action 会直接失败，避免盲目抓取未知地址。

sing-box AI 转换同样采用 fail-closed：遇到无法识别的规则类型会停止生成，避免产生“看起来成功但实际缺规则”的不完整策略集。

## 授权与署名

ACL4SSR 上游仓库标注为 **CC BY-SA 4.0**。本项目中同步得到的上游快照、镜像规则及由其规则/分组定义生成的衍生内容同样按 CC BY-SA 4.0 分享，并保留上游来源与修改说明。详见 `LICENSE`。

