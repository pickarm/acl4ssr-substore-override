# GitHub 登录后端

此 Worker 仅处理 Rule Desk 的 GitHub App 用户授权。前端继续由 GitHub Pages 托管。代码不存密码、不记授权码日志、不需要数据库或 GitHub App 私钥。

部署前：在 Cloudflare 创建名为 `pickarm-rule-desk-auth` 的 Module Worker，使用 `worker.mjs`。记录 Worker 的实际公网地址。

在自己的 GitHub 账号下创建 GitHub App：

- Homepage URL：`https://pickarm.github.io/acl4ssr-substore-override/`
- Callback URL：`https://<实际 Worker 域名>/callback`
- Webhook：关闭 Active。
- Repository permissions：Contents Read and write；Metadata Read-only。
- 不需要其他权限或私钥。保持用户令牌过期设置，安装范围只选规则仓库。
- 安装 App 到 `pickarm/acl4ssr-substore-override`。

Cloudflare Worker 变量：`GITHUB_CLIENT_ID`、`GITHUB_APP_ID`。加密 Secret：`GITHUB_CLIENT_SECRET`。不要将 Secret 放进仓库、前端或聊天。访问 `/health` 只能查看是否完成配置。

后端使用 PKCE、加密 state、十分钟授权时限，并在发回用户令牌之前检查 GitHub 数字用户 ID、应用安装 ID、Contents 写权限和指定仓库 ID。成功令牌仅通过 `postMessage` 发给固定的 GitHub Pages Origin；前端必须同时核对消息来源窗口、来源 Origin 和一次性 nonce。令牌不会出现在回跳 URL。

前端配置与实际登录按钮在 Worker 部署和 GitHub App 注册完成后接入。创建应用、安装授权和生成 Client Secret 需要账号所有者确认或操作。
