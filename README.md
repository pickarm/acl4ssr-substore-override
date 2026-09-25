# ACL4SSR Sub-Store Override

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

### UDP / QUIC 处理

本项目不会关闭节点本身的 UDP 中继能力。对于 VLESS Vision + REALITY 这类以 TCP 作为代理入口、同时能够代理 UDP 的节点，生成的 Mihomo 规则会固定把下面这条规则放在最前面：

```text
AND,((NETWORK,UDP),(DST-PORT,443)),REJECT
```

这只阻止 QUIC / HTTP/3 的 UDP 443，使应用回落到 TCP 443；Telegram、STUN、语音以及其他非 443 UDP 仍可按节点能力通过代理转发。

VPS 只开放代理入口的 TCP 端口并不意味着要在客户端关闭 UDP 中继；服务端仍需具备正常的出站 UDP 能力。


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
5. 在 Mihomo 规则最前加入 UDP/443 QUIC 拦截规则。
6. 生成 Mihomo `rule-providers` 和 Sub-Store JS 覆写。
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

Mihomo 输出会在 Sub-Store 执行脚本时动态枚举节点名称，并保留 Sub-Store 已解析出的原始节点对象与 UDP 能力。

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
