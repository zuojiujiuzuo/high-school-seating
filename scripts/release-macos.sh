#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "缺少 APPLE_SIGNING_IDENTITY，拒绝生成未签名正式安装包。" >&2
  exit 1
fi

has_api_key=false
if [[ -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_PATH:-}" ]]; then
  has_api_key=true
fi

has_apple_id=false
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  has_apple_id=true
fi

if [[ "$has_api_key" != true && "$has_apple_id" != true ]]; then
  echo "缺少公证凭据。请配置 APPLE_API_ISSUER + APPLE_API_KEY + APPLE_API_KEY_PATH，或 APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID。" >&2
  exit 1
fi

npm run tauri -- build --bundles app,dmg
