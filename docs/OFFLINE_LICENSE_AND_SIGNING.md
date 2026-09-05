# 离线授权与安装包签名

班阵使用两套彼此独立的签名：

- 离线授权签名：确认授权文件由软件发布方签发。应用只保存公钥，验证全程在本机完成，不发网络请求。
- 安装包代码签名：由 Apple 或 Windows 信任链确认安装包的发布者，并检测安装包是否被篡改。

## 安全边界

仓库只允许包含 `src-tauri/license_public_key.pem`。Ed25519 私钥必须放在仓库外，不能发给用户、打进安装包或提交 Git。

离线授权能阻止伪造授权文件，但无法让已交付到用户电脑上的客户端代码变得不可复制。拥有源码的人仍可能删除本地校验；因此源码权限、私有仓库、构建流水线权限和平台代码签名同样重要。

## 初始化密钥

仅执行一次。若公钥已经随正式版本发布，除非准备让旧授权全部失效，否则不要更换密钥。

```bash
npm run license -- keygen \
  --private-key /安全的仓库外目录/issuer-private.pem \
  --public-key src-tauri/license_public_key.pem \
  --replace-public
```

工具拒绝覆盖已有私钥。建议再把私钥加密备份到离线介质或密钥管理系统，并严格限制读取权限。

## 签发授权

永久授权：

```bash
npm run license -- issue \
  --private-key /安全的仓库外目录/issuer-private.pem \
  --license-id BZ-2026-0001 \
  --licensee "示例学校" \
  --edition "正式版" \
  --output /安全的交付目录/BZ-2026-0001.zj-license
```

限时授权可增加 `--expires-at 2027-09-01`。签发日期默认为当天，也可通过 `--issued-at YYYY-MM-DD` 指定。

交付前可独立验证：

```bash
npm run license -- verify \
  --public-key src-tauri/license_public_key.pem \
  --license /安全的交付目录/BZ-2026-0001.zj-license
```

用户首次启动桌面版时选择该文件。应用会验证 Ed25519 签名、产品标识、签发日期和有效期；验证通过后保存在系统应用数据目录。后续启动直接本机校验，不访问服务器。设置页会显示授权对象、编号、版本、有效期和短校验码。

## macOS 正式签名与公证

构建机的钥匙串中需要有效的 Developer ID Application 证书。配置以下环境变量之一的公证方案后执行 `npm run release:macos`：

- `APPLE_SIGNING_IDENTITY`，以及 `APPLE_API_ISSUER`、`APPLE_API_KEY`、`APPLE_API_KEY_PATH`；或
- `APPLE_SIGNING_IDENTITY`，以及 `APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`。

脚本缺少签名或公证凭据时会直接失败，避免误发未签名的正式包。产物位于 `src-tauri/target/release/bundle/`。

## Windows 正式签名

把代码签名证书安装到构建用户的证书存储，然后设置：

```powershell
$env:BANZHEN_WINDOWS_CERTIFICATE_THUMBPRINT="证书指纹"
npm run release:windows
```

脚本使用 SHA-256 和时间戳服务构建 MSI/NSIS 安装包；缺少证书指纹时会失败。`src-tauri/tauri.windows.release.conf.json.example` 是对应的静态配置示例。

## 发布前检查

1. 用签发工具验证交付给用户的 `.zj-license`。该扩展名供佐玖系列产品共用，文件内的 `productId` 决定授权适用的具体产品。
2. 在全新系统账户中启动应用，确认未授权时被拦截、有效授权能导入、篡改一个字符后会失败。
3. macOS 使用 `codesign --verify --deep --strict` 与 `spctl --assess` 检查；Windows 在文件属性的“数字签名”页或 `Get-AuthenticodeSignature` 检查。
4. 对外记录安装包哈希值、公钥指纹、版本号和签发时间。

注意：Tauri 更新器的更新包签名是第三套独立密钥，不能与本离线授权私钥或平台代码签名证书混用。
