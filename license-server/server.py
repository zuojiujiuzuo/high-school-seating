#!/usr/bin/env python3
"""Password-protected, mobile-friendly issuer for Ban Zhen licenses."""

import base64
import hmac
import json
import os
import re
import secrets
import time
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from cryptography.hazmat.primitives.serialization import load_pem_private_key


PRODUCT = "班阵"
PRODUCT_ID = "cn.banzhen.seating"
ALGORITHM = "Ed25519"
MAX_BODY_BYTES = 16 * 1024
RATE_LIMIT = 12
RATE_WINDOW_SECONDS = 60
ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,64}$")

PRIVATE_KEY_PATH = Path(os.environ.get("LICENSE_PRIVATE_KEY", "/etc/banzhen-license/issuer-private.pem"))
ADMIN_PASSWORD = os.environ.get("LICENSE_ADMIN_PASSWORD", "")
PORT = int(os.environ.get("PORT", "8090"))

if not ADMIN_PASSWORD:
    raise SystemExit("LICENSE_ADMIN_PASSWORD is required")

PRIVATE_KEY = load_pem_private_key(PRIVATE_KEY_PATH.read_bytes(), password=None)
RATE_BUCKETS = {}
LOGIN_RATE_BUCKETS = {}
SESSIONS = {}
SESSION_TTL_SECONDS = 12 * 60 * 60

LOGIN_HTML = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light">
  <title>班阵 · 授权签发台登录</title>
  <style>
    :root { font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; color: #3c3337; background: #f7f1f3; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: radial-gradient(circle at 85% 8%, #ffe1eb 0, transparent 30rem), #f7f1f3; }
    main { width: min(430px, calc(100% - 28px)); padding: 30px; border: 1px solid #ead0d9; border-radius: 22px; background: rgba(255,255,255,.92); box-shadow: 0 20px 60px rgba(80,43,58,.12); }
    .eyebrow { color: #cc3f70; font: 800 12px/1.2 ui-monospace, monospace; letter-spacing: .14em; }
    h1 { margin: 10px 0 8px; font-size: 30px; letter-spacing: -.04em; }
    p { margin: 0 0 22px; color: #7e6e74; line-height: 1.65; }
    input { width: 100%; min-height: 50px; padding: 0 14px; border: 1px solid #dec6cf; border-radius: 12px; color: #3c3337; background: #fff; font: inherit; }
    input:focus { border-color: #e64e83; outline: 3px solid rgba(230,78,131,.13); }
    button { width: 100%; min-height: 50px; margin-top: 14px; border: 0; border-radius: 12px; color: #fff; background: linear-gradient(135deg, #e64e83, #c93468); font: 800 16px/1 system-ui, sans-serif; cursor: pointer; }
    button:disabled { cursor: wait; opacity: .65; }
    #status { min-height: 22px; margin: 14px 0 0; color: #c52f47; font-size: 13px; text-align: center; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">PRIVATE LICENSE ISSUER</div>
    <h1>进入授权签发台</h1>
    <p>输入签发密码后即可生成永久授权文件，无需账号。</p>
    <form id="login">
      <input id="password" type="password" required autofocus autocomplete="current-password" placeholder="签发密码" aria-label="签发密码">
      <button id="submit" type="submit">登录</button>
      <div id="status" aria-live="polite"></div>
    </form>
  </main>
  <script>
    const form = document.querySelector('#login');
    const submit = document.querySelector('#submit');
    const status = document.querySelector('#status');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      status.textContent = '正在验证…';
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-License-Admin': '1' },
          body: JSON.stringify({ password: document.querySelector('#password').value })
        });
        const result = await response.json().catch(() => ({ error: '登录失败' }));
        if (!response.ok) throw new Error(result.error || '登录失败');
        location.reload();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : '登录失败';
        submit.disabled = false;
      }
    });
  </script>
</body>
</html>
"""

INDEX_HTML = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light">
  <title>班阵 · 授权签发台</title>
  <style>
    :root { font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; color: #3c3337; background: #f7f1f3; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; background: radial-gradient(circle at 85% 8%, #ffe1eb 0, transparent 30rem), #f7f1f3; }
    main { width: min(620px, calc(100% - 28px)); margin: 0 auto; padding: max(28px, env(safe-area-inset-top)) 0 42px; }
    .eyebrow { color: #cc3f70; font: 800 12px/1.2 ui-monospace, monospace; letter-spacing: .14em; }
    h1 { margin: 10px 0 8px; font-size: clamp(30px, 8vw, 46px); letter-spacing: -.045em; }
    .intro { margin: 0 0 22px; color: #7e6e74; line-height: 1.7; }
    .card { padding: clamp(20px, 5vw, 32px); border: 1px solid #ead0d9; border-radius: 22px; background: rgba(255,255,255,.9); box-shadow: 0 20px 60px rgba(80,43,58,.1); }
    label { display: grid; gap: 8px; margin-bottom: 18px; font-size: 14px; font-weight: 750; }
    input { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #dec6cf; border-radius: 12px; color: #3c3337; background: #fff; font: inherit; }
    input:focus { border-color: #e64e83; outline: 3px solid rgba(230,78,131,.13); }
    small { color: #927f86; font-weight: 500; line-height: 1.55; }
    .permanent { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: 0 0 18px; padding: 0 13px; border-radius: 12px; background: #fff3f7; color: #bd3566; font-weight: 750; }
    .permanent::before { content: "✓"; display: grid; place-items: center; width: 23px; height: 23px; border-radius: 50%; color: #fff; background: #e64e83; }
    button { width: 100%; min-height: 52px; border: 0; border-radius: 13px; color: #fff; background: linear-gradient(135deg, #e64e83, #c93468); box-shadow: 0 10px 24px rgba(201,52,104,.24); font: 800 16px/1 system-ui, sans-serif; cursor: pointer; }
    button:disabled { cursor: wait; opacity: .65; }
    #status { min-height: 24px; margin: 16px 0 0; color: #7e6e74; font-size: 13px; line-height: 1.6; text-align: center; }
    #status.ok { color: #16835d; }
    #status.error { color: #c52f47; }
    .notice { margin-top: 16px; padding: 14px 16px; border: 1px solid #ead0d9; border-radius: 14px; color: #7e6e74; background: rgba(255,255,255,.62); font-size: 12px; line-height: 1.65; }
    a { color: #bd3566; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">ZUOJIU LICENSE ISSUER</div>
    <h1>班阵授权签发台</h1>
    <p class="intro">生成可在不同电脑、手机浏览器和桌面客户端重复导入的永久离线授权。</p>
    <form class="card" id="form">
      <label>授权对象
        <input id="licensee" maxlength="80" value="佐玖本人" required autocomplete="organization">
        <small>会显示在班阵的授权信息中。</small>
      </label>
      <label>授权编号
        <input id="licenseId" maxlength="64" placeholder="留空自动生成">
        <small>仅支持字母、数字、点、横线和下划线。</small>
      </label>
      <label>授权版本
        <input id="edition" maxlength="40" value="个人永久版" required>
      </label>
      <div class="permanent">永久有效 · 不绑定设备</div>
      <button id="submit" type="submit">生成并下载授权文件</button>
      <p id="status" aria-live="polite"></p>
    </form>
    <div class="notice">签发私钥只保存在服务器中，不会发送到浏览器。请勿把本后台的登录信息交给他人。生成后，在班阵授权页面选择下载的 <code>.zj-license</code> 文件即可。</div>
  </main>
  <script>
    const form = document.querySelector('#form');
    const submit = document.querySelector('#submit');
    const status = document.querySelector('#status');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      status.className = '';
      status.textContent = '正在安全签发…';
      try {
        const response = await fetch('/api/licenses', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-License-Admin': '1' },
          body: JSON.stringify({
            licensee: document.querySelector('#licensee').value.trim(),
            licenseId: document.querySelector('#licenseId').value.trim(),
            edition: document.querySelector('#edition').value.trim()
          })
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({ error: '签发失败' }));
          throw new Error(result.error || '签发失败');
        }
        const blob = await response.blob();
        const licenseId = response.headers.get('X-License-Id') || 'banzhen-license';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${licenseId}.zj-license`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        status.className = 'ok';
        status.textContent = `已生成永久授权：${licenseId}`;
      } catch (error) {
        status.className = 'error';
        status.textContent = error instanceof Error ? error.message : '签发失败';
      } finally {
        submit.disabled = false;
      }
    });
  </script>
</body>
</html>
"""


def constant_time_equal(left, right):
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def client_address(handler):
    forwarded = handler.headers.get("X-Forwarded-For", "")
    return (forwarded.split(",", 1)[0].strip() or handler.client_address[0])[:80]


def rate_limited(remote, buckets=RATE_BUCKETS, limit=RATE_LIMIT, window=RATE_WINDOW_SECONDS):
    now = time.monotonic()
    recent = [timestamp for timestamp in buckets.get(remote, []) if now - timestamp < window]
    if len(recent) >= limit:
        buckets[remote] = recent
        return True
    recent.append(now)
    buckets[remote] = recent
    return False


class LicenseHandler(BaseHTTPRequestHandler):
    server_version = "BanzhenLicenseAdmin/1.0"

    def security_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:",
        )

    def authenticated(self):
        cookie_header = self.headers.get("Cookie", "")
        cookies = {}
        for item in cookie_header.split(";"):
            if "=" in item:
                key, value = item.strip().split("=", 1)
                cookies[key] = value
        token = cookies.get("banzhen_license_session", "")
        expires_at = SESSIONS.get(token, 0)
        if expires_at <= time.time():
            if token:
                SESSIONS.pop(token, None)
            return False
        return True

    def send_json(self, status, payload, headers=None):
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.security_headers()
        self.end_headers()
        self.wfile.write(content)

    def send_html(self, content_text):
        content = content_text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.security_headers()
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok"})
            return
        if self.path != "/":
            self.send_json(404, {"error": "页面不存在"})
            return
        self.send_html(INDEX_HTML if self.authenticated() else LOGIN_HTML)

    def do_POST(self):
        if self.path == "/api/login":
            self.login()
            return
        if self.path != "/api/licenses":
            self.send_json(404, {"error": "接口不存在"})
            return
        if not self.authenticated():
            self.send_json(401, {"error": "登录已失效，请重新进入"})
            return
        remote = client_address(self)
        if rate_limited(remote):
            self.send_json(429, {"error": "操作过于频繁，请稍后再试"})
            return
        if self.headers.get("X-License-Admin") != "1":
            self.send_json(403, {"error": "请求校验失败"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(400, {"error": "请求内容大小不正确"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "请求格式不正确"})
            return

        licensee = str(payload.get("licensee", "")).strip()
        edition = str(payload.get("edition", "")).strip()
        license_id = str(payload.get("licenseId", "")).strip()
        if not license_id:
            license_id = "BZ-{}-{}".format(date.today().strftime("%Y%m%d"), secrets.token_hex(3).upper())
        if not (1 <= len(licensee) <= 80):
            self.send_json(400, {"error": "授权对象长度应为 1–80 个字符"})
            return
        if not (1 <= len(edition) <= 40):
            self.send_json(400, {"error": "授权版本长度应为 1–40 个字符"})
            return
        if not ID_PATTERN.fullmatch(license_id):
            self.send_json(400, {"error": "授权编号格式不正确"})
            return

        claims = {
            "schemaVersion": 1,
            "product": PRODUCT,
            "productId": PRODUCT_ID,
            "licenseId": license_id,
            "licensee": licensee,
            "edition": edition,
            "issuedAt": date.today().isoformat(),
            "expiresAt": None,
        }
        canonical = json.dumps(claims, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        signature = base64.b64encode(PRIVATE_KEY.sign(canonical)).decode("ascii")
        envelope = {"license": claims, "algorithm": ALGORITHM, "signature": signature}
        content = (json.dumps(envelope, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="{}.zj-license"'.format(license_id))
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-License-Id", license_id)
        self.security_headers()
        self.end_headers()
        self.wfile.write(content)
        print("issued {} to {}".format(license_id, remote), flush=True)

    def login(self):
        remote = client_address(self)
        if rate_limited(remote, LOGIN_RATE_BUCKETS, limit=8, window=5 * 60):
            self.send_json(429, {"error": "密码尝试次数过多，请稍后再试"})
            return
        if self.headers.get("X-License-Admin") != "1":
            self.send_json(403, {"error": "请求校验失败"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(400, {"error": "请求内容大小不正确"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "请求格式不正确"})
            return
        password = str(payload.get("password", ""))
        if not constant_time_equal(password, ADMIN_PASSWORD):
            self.send_json(401, {"error": "密码不正确"})
            return
        token = secrets.token_urlsafe(32)
        SESSIONS[token] = time.time() + SESSION_TTL_SECONDS
        self.send_json(
            200,
            {"ok": True},
            {"Set-Cookie": "banzhen_license_session={}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age={}".format(token, SESSION_TTL_SECONDS)},
        )

    def log_message(self, format_string, *args):
        print("{} - {}".format(client_address(self), format_string % args), flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), LicenseHandler)
    print("Ban Zhen license admin listening on 127.0.0.1:{}".format(PORT), flush=True)
    server.serve_forever()
