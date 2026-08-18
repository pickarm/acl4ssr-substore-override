# ACL4SSR Sub-Store Override

把 ACL4SSR 官方 `ACL4SSR_Online_Full.ini` 自动转换为可直接用于 **Sub-Store / Mihomo** 的 JavaScript 覆写脚本，并持续跟踪上游更新。

> 非 ACL4SSR 官方项目。规则与分组定义来源于 [ACL4SSR/ACL4SSR](https://github.com/ACL4SSR/ACL4SSR)。

## 直接使用

在 Sub-Store 的 **文件 → 操作 → 脚本操作 → 远程链接** 中填写：

```text
https://raw.githubusercontent.com/pickarm/acl4ssr-substore-override/main/dist/acl4ssr-full.js
```

也可以使用 jsDelivr：

```text
https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/dist/acl4ssr-full.js
```

输入应当是包含 `proxies` 的 Mihomo/Clash 配置。脚本会保留原始节点对象，因此 VLESS、Reality、Vision 等节点不会经过旧版 subconverter 重新解析；脚本只重建 `proxy-groups`、`rule-providers` 与 `rules`。

## 同步机制

上游文件：

```text
https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini
```

`.github/workflows/sync-upstream.yml` 每 6 小时运行一次，并支持手动运行。同步流程：

1. 拉取最新 `ACL4SSR_Online_Full.ini`。
2. 解析 `ruleset=` 与 `custom_proxy_group=`。
3. 下载 Full 配置实际引用的所有 ACL4SSR `.list` 文件。
4. 将这些规则文件镜像到本仓库 `rulesets/` 目录，并记录每个文件的上游地址与 SHA-256。
5. 生成 Mihomo `rule-providers`，其 URL 只指向本仓库的 `rulesets/`，运行时不再直接依赖 ACL4SSR Raw。
6. 将 `[]GEOIP,...`、`[]FINAL` 等内联规则转换为 Mihomo 原生规则。
7. 将 ACL4SSR 代理组转换为运行时动态匹配节点的 Sub-Store JS 覆写。
8. 运行内置 smoke test；解析或镜像失败时停止发布，避免静默生成损坏配置。
9. 仅当上游、镜像规则或生成结果实际变化时自动提交。

生成文件：

```text
dist/acl4ssr-full.js
```

上游配置快照：

```text
upstream/ACL4SSR_Online_Full.ini
```

镜像规则：

```text
rulesets/*.list
```

同步清单及 SHA-256：

```text
upstream.json
```

例如 OpenAI / ChatGPT 规则会直接出现在本仓库的 `rulesets/OpenAi_*.list` 中，可以在仓库内搜索 `chatgpt.com`、`openai.com` 等域名进行审计。

## 兼容性说明

当前生成器支持 ACL4SSR Full 配置中使用的：

- `select`
- `url-test`
- `fallback`
- `load-balance`
- `ruleset=<策略>,<远程 URL>`
- `ruleset=<策略>,[]<内联规则>`

地区/正则节点组会在 Sub-Store 执行脚本时根据当前 `config.proxies` 动态枚举节点。若某个纯正则组没有匹配到任何节点，会使用 `REJECT` 作为 fail-closed 兜底，避免意外直连泄漏。

## 安全限制

生成器只允许镜像：

```text
https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/
```

前缀下的规则文件。如果上游 Full 配置突然引用其他域名，Action 会直接失败，而不是盲目抓取未知地址。

## 授权与署名

ACL4SSR 上游仓库标注为 **CC BY-SA 4.0**。本项目中同步得到的上游快照、镜像规则及由其规则/分组定义生成的衍生内容同样按 CC BY-SA 4.0 分享，并保留上游来源与修改说明。详见 `LICENSE`。
