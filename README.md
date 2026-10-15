# ACL4SSR · Sub-Store 覆写与个人规则

把 [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) 的规则转换为 **Mihomo / Clash.Meta** 可用的 Sub-Store JS 覆写，同时为 **Loon、小火箭、sing-box** 提供跨设备个人规则。个人节点不上传到本仓库。

- **个人规则网页：** https://pickarm.github.io/acl4ssr-substore-override/
- **Mihomo 覆写 JS（推荐 GitHub Raw，无 jsDelivr）：**
  `https://raw.githubusercontent.com/pickarm/acl4ssr-substore-override/main/dist/acl4ssr-full.js`
- **更新规则：** 编辑网页并保存；节点或分组结构变化时，重新运行 Sub-Store 文件生成，再刷新 Mihomo 配置订阅。

> GitHub Raw 地址不是“永不缓存”，但不经过 jsDelivr 的分支 CDN 缓存。若 GitHub Raw 在所在网络无法访问，请先检查代理/网络连通性。

## 1. 首次使用 Mihomo / Clash.Meta

1. 在 **Sub-Store** 创建 Mihomo 配置文件，来源选已有的节点订阅或组合订阅。
2. 打开 **文件 → 操作 → 脚本操作 → 远程链接**，填入上面的 **GitHub Raw 覆写 JS**。
3. 保存并**重新生成文件**，再把 Sub-Store 的文件分享链接添加至 Clash Verge Rev / Mihomo Party 等客户端。
4. 日后只更新远程规则时，可直接刷新客户端规则资源；**改动覆写脚本、节点或策略组时，必须先在 Sub-Store 重新生成整个 Mihomo 文件**。

覆写脚本保留订阅里的节点对象，只对 VLESS 节点补充 `udp: true`、`packet-encoding: xudp`；重建 `proxy-groups`、`rule-providers` 和 `rules`。不会重新把 VLESS Reality / Vision 交给旧式 subconverter 解析。

### 策略组与个人规则

- 普通业务 `select` 组（如 `💬 Ai平台`、Telegram、YouTube）可**直接选择实际节点**，不必再进入“手动切换”。
- 地区测速组只在当前订阅有对应节点时生成。**没有日本节点就没有日本组**；`personal-jp` 等规则将自动回退到现有的 `🚀 节点选择`，不会引用不存在的地区组。
- 有日本节点时，对应个人规则会使用 `🇯🇵 日本节点`；不强行生成空组。构建测试覆盖有/无日本节点等情况。
- 广告拦截、应用净化等辅助组维持 `REJECT / DIRECT` 用途，不被塞入全部节点。

VLESS / TCP / REALITY 的 **UDP-over-TCP** 路径：应用 UDP → Mihomo → VLESS/XUDP → TCP+REALITY → VPS → 目标 UDP。VPS 不必开放 UDP **入站**，但需要正常的 UDP **出站**。没有全局 `UDP/443 REJECT`。

## 2. 个人规则管理网页

访问 **https://pickarm.github.io/acl4ssr-substore-override/**，添加、修改、停用或批量导入自定义规则。一个规则可分别指定 Mihomo、Loon 和小火箭的策略，不会直接复制不兼容的策略组名称。

首次编辑：在网页“连接 GitHub”处提供**仅授权本仓库 Contents: Read and write** 的 GitHub fine-grained token。令牌不保存到浏览器本地持久存储、URL 或仓库；刷新网页需要重新连接。公开阅读无需令牌。

点击 **“保存到 GitHub”** 会在同一提交中更新 `personal/rules.json` 和各端规则文件。若另一个设备已修改同一份规则，网页会阻止覆盖。网页“设备接入”包含具体操作说明。

| 客户端 | 首次接入方式 | 以后如何更新 |
|---|---|---|
| **Mihomo / Clash.Meta** | 使用上面的远程 JS，重新生成 Sub-Store 文件 | 网页个人规则自动以独立 provider 引用；更改脚本/分组需重生成 |
| **Loon** | 把 [loon-snippet.conf](https://raw.githubusercontent.com/pickarm/acl4ssr-substore-override/main/personal/loon-snippet.conf) 里的 Remote Rule 条目合并到现有主配置前部 | 刷新 Remote Rule；**不要重新导入整个 Loon Profile**，避免丢私人节点订阅 |
| **小火箭** | 把 [shadowrocket-snippet.conf](https://raw.githubusercontent.com/pickarm/acl4ssr-substore-override/main/personal/shadowrocket-snippet.conf) 的 RULE-SET 条目合并到现有规则顶部 | 刷新规则；把 `PROXY` 替换为本机实际策略名 |

第一次升级旧版个人规则时，Loon 用新片段替换原先 4 条旧个人订阅（不要重复保留）；小火箭也要替换旧个人 RULE-SET。现有业务规则和私人节点订阅不需要删除。

规则支持 `DOMAIN`、`DOMAIN-SUFFIX`、`DOMAIN-KEYWORD`、`IP-CIDR`、`IP-CIDR6`；Mihomo 额外支持 `PROCESS-NAME`。同一域名冲突或策略映射错误会提示。旧版 `personal/direct.list` 等兼容链接仍保留。

## 3. 更新与错误排查

**推荐脚本链接始终用 Raw：**

```text
https://raw.githubusercontent.com/pickarm/acl4ssr-substore-override/main/dist/acl4ssr-full.js
```

如果客户端还报 `RULE-SET,personal-jp,🇯🇵 日本节点` / `proxy not found`：

1. 确认 Sub-Store “脚本操作”的地址已从 `cdn.jsdelivr.net` 换成 Raw，并保存。
2. **在 Sub-Store 重新生成配置文件**，不是只点客户端“更新节点”。
3. 回到 Mihomo 客户端，更新 Sub-Store **文件分享订阅**。
4. 若仍报错，查看最终 YAML 的 `rules` 和 `proxy-groups`：可能还有另一个覆写脚本、旧配置文件或缓存参与生成。

> Raw 网址可能仍受 HTTP 缓存影响；需要排除版本因素时，可以将 `main` 临时替换为 GitHub 最新提交 SHA 来固定版本。GitHub Actions 的生成通过后，才算发布文件更新完成。

## 4. sing-box AI 规则集

从 ACL4SSR AI 规则生成独立的 sing-box Headless Rule，可按需要单独接入。

| 文件 | GitHub Raw |
|---|---|
| JSON 源规则 | [ai.json](https://raw.githubusercontent.com/pickarm/acl4ssr-substore-override/main/dist/sing-box/ai.json) |
| 二进制规则 | [ai.srs](https://raw.githubusercontent.com/pickarm/acl4ssr-substore-override/main/dist/sing-box/ai.srs) |

推荐二进制 `ai.srs`，在 sing-box 中作为 `format: binary` 的 remote rule-set 使用，`url` 指向上面的 Raw 地址。支持转换 `DOMAIN`、`DOMAIN-SUFFIX`、`DOMAIN-KEYWORD`、`DOMAIN-REGEX`；上游出现不支持的 AI 规则类型则停止构建，避免静默漏规则。

## 5. 目录与自动构建

```text
docs/                 GitHub Pages 规则管理网页
personal/rules.json    个人规则唯一数据源
personal/loon/         Loon 分类规则和接入片段
personal/mihomo/       Mihomo 分类规则
personal/shadowrocket/ 小火箭分类规则和接入片段
scripts/generate.mjs   ACL4SSR → Mihomo 覆写生成器
scripts/personal.mjs   个人规则生成器
scripts/sing-box.mjs   sing-box AI 规则生成器
dist/acl4ssr-full.js   Sub-Store / Mihomo 覆写脚本
dist/sing-box/         AI JSON / SRS
rulesets/              已镜像的 ACL4SSR 规则文件
upstream/              ACL4SSR 上游快照
```

GitHub Actions **每 6 小时**同步 ACL4SSR 上游，也支持手动运行。构建会校验规则来源、真实分组、无空地区组悬空引用、VLESS XUDP、sing-box 编译等；成功且内容变化时更新生成文件。仓库默认将 Mihomo rule-provider URL 指向 **GitHub Raw**，避免 generated JS 中继续引用 jsDelivr。

本地测试：`node --test tests/*.test.mjs`。个人规则生成：`node scripts/personal.mjs`。

## 授权与来源

上游：[ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) · [Sub-Store](https://github.com/sub-store-org/Sub-Store) · [sing-box](https://github.com/SagerNet/sing-box)。

非官方项目。ACL4SSR 规则及其衍生内容按上游 **CC BY-SA 4.0** 条件使用并保留署名，详见 [LICENSE](LICENSE)。个人节点、认证口令和订阅密钥不应提交到公开仓库。
