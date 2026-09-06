# 班阵授权签发后台

该服务使用服务器上的 Ed25519 私钥签发永久或按月限时、非设备绑定的 `.zj-license` 文件。服务只监听本机 `8090`，由 Nginx 的 HTTPS 入口代理，并使用密码登录和短期会话 Cookie 保护签发接口。预设有效期包括永久、1 年、1 个月和 3 个月，也可自定义 1–120 个月。

生产环境配置位于 `/etc/banzhen-license/`，不得提交私钥或后台密码。systemd 与 Nginx 配置模板分别位于 `deploy/systemd/` 和 `deploy/nginx/`。
