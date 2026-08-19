# ACL4SSR Sub-Store Override

把 ACL4SSR 官方 `ACL4SSR_Online_Full.ini` 自动转换为可用于 **Sub-Store / Mihomo** 与 **Loon** 的双输出配置，并持续跟踪上游更新。

> 非 ACL4SSR / Sub-Store 官方项目。规则与分组定义来源于 ACL4SSR，上游节点转换能力依赖 Sub-Store。

## 相关项目

- ACL4SSR：<https://github.com/ACL4SSR/ACL4SSR>
- Sub-Store：<https://github.com/sub-store-org/Sub-Store>
- 本项目：<https://github.com/pickarm/acl4ssr-substore-override>

## 输出文件

```text
dist/
├── acl4ssr-full.js      # Sub-Store / Mihomo JavaScript 覆写
└── acl4ssr-loon.conf    # Loon 配置模板
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

## Loon 使用方法

Loon 不能直接把 Mihomo YAML 当作节点订阅解析，因此本项目额外生成：

```text
https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/dist/acl4ssr-loon.conf
```

这个文件是 **Loon 配置模板，不是节点订阅链接**。

### 1. 先准备 Sub-Store 的 Loon 节点订阅

Sub-Store 官方支持 `target=Loon`。例如你的组合订阅叫 `all`，链接形态可以是：

```text
https://你的-Sub-Store-地址/download/collection/all?target=Loon&includeUnsupportedProxy=true
```

`includeUnsupportedProxy=true` 可用于让 Sub-Store 输出包含 VLESS REALITY 等 Loon 支持但可能被兼容性检查过滤的节点。

### 2. 下载 Loon 配置模板

下载：

```text
https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/dist/acl4ssr-loon.conf
```

找到：

```text
[Remote Proxy]
Subs = __SUB_STORE_LOON_SUBSCRIPTION_URL__
```

把：

```text
__SUB_STORE_LOON_SUBSCRIPTION_URL__
```

替换成你自己的 Sub-Store Loon 订阅地址。

例如：

```text
[Remote Proxy]
Subs = https://example.com/download/collection/all?target=Loon&includeUnsupportedProxy=true
```

### 3. 导入 Loon

可以把修改后的 `acl4ssr-loon.conf` 作为 Loon 配置模板使用，或者把以下几个 section 合并到你已有的 Loon 配置中：

```text
[Remote Proxy]
[Remote Filter]
[Proxy Group]
[Rule]
[Remote Rule]
```

其中：

- `[Remote Proxy]`：读取 Sub-Store 输出的 Loon 节点。
- `[Remote Filter]`：按 ACL4SSR 的地区/关键词正则筛选节点。
- `[Proxy Group]`：生成 ACL4SSR 的节点选择、AI、Telegram、YouTube、Netflix 等策略组。
- `[Remote Rule]`：引用本仓库镜像后的 ACL4SSR 规则集。
- `[Rule]`：保存 `GEOIP`、`FINAL` 等内联规则。

> 不要把 `acl4ssr-loon.conf` 填到 Loon 的“添加订阅”节点输入框里；节点订阅应该使用 Sub-Store 的 `target=Loon` 链接。

## 自动同步机制

上游配置：

```text
https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini
```

`.github/workflows/sync-upstream.yml` 每 6 小时运行一次，也支持手动运行。

同步流程：

1. 拉取最新 `ACL4SSR_Online_Full.ini`。
2. 解析 `ruleset=` 与 `custom_proxy_group=`。
3. 下载 Full 配置实际引用的全部 ACL4SSR `.list` 文件。
4. 镜像到本仓库 `rulesets/`，并记录来源、SHA-256 与大小。
5. 生成 Mihomo `rule-providers` 和 Sub-Store JS 覆写。
6. 生成 Loon `[Remote Filter]`、`[Proxy Group]`、`[Rule]`、`[Remote Rule]` 配置。
7. 运行 smoke test；解析、镜像或生成失败时停止发布。
8. 只有内容实际变化时才由 `github-actions[bot]` 自动提交。

## 仓库结构

```text
.github/workflows/
└── sync-upstream.yml
scripts/
├── generate.mjs
└── loon.mjs
dist/
├── acl4ssr-full.js
└── acl4ssr-loon.conf
rulesets/
└── *.list
upstream/
└── ACL4SSR_Online_Full.ini
upstream.json
```

`upstream.json` 会记录：

- ACL4SSR Full 配置 SHA-256
- rules / groups / providers 数量
- 两种输出文件路径
- 每个镜像规则的上游地址、镜像地址、SHA-256 和文件大小

例如 OpenAI / ChatGPT 规则会直接同步到本仓库的 `rulesets/OpenAi_*.list`，可以在仓库内搜索 `chatgpt.com`、`openai.com` 等域名审计规则。

## 兼容性

当前转换器处理 ACL4SSR Full 中使用的：

- `select`
- `url-test`
- `fallback`
- `load-balance`
- `ruleset=<策略>,<远程 URL>`
- `ruleset=<策略>,[]<内联规则>`

Mihomo 输出会在 Sub-Store 执行脚本时动态枚举节点名称；Loon 输出则使用 `[Remote Filter]` 的 `NameRegex` 对 Sub-Store Loon 订阅进行动态筛选。

## 安全限制

生成器只允许镜像以下前缀的规则：

```text
https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/
```

如果 ACL4SSR Full 突然引用其他域名，Action 会直接失败，避免盲目抓取未知地址。

## 授权与署名

ACL4SSR 上游仓库标注为 **CC BY-SA 4.0**。本项目中同步得到的上游快照、镜像规则及由其规则/分组定义生成的衍生内容同样按 CC BY-SA 4.0 分享，并保留上游来源与修改说明。详见 `LICENSE`。
