param(
  [string]$CertificateThumbprint = $env:BANZHEN_WINDOWS_CERTIFICATE_THUMBPRINT
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CertificateThumbprint)) {
  throw "缺少 BANZHEN_WINDOWS_CERTIFICATE_THUMBPRINT，拒绝生成未签名正式安装包。"
}

$releaseConfig = @{
  bundle = @{
    windows = @{
      certificateThumbprint = $CertificateThumbprint
      digestAlgorithm = "sha256"
      timestampUrl = "http://timestamp.digicert.com"
    }
  }
} | ConvertTo-Json -Depth 6 -Compress

npm run tauri -- build --bundles msi,nsis --config $releaseConfig
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
