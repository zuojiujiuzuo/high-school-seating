import { invoke, isTauri } from "@tauri-apps/api/core";
import LICENSE_PUBLIC_KEY_PEM from "../../src-tauri/license_public_key.pem?raw";

export type LicenseState = "checking" | "licensed" | "missing" | "invalid" | "expired" | "misconfigured";

export interface LicenseStatus {
  state: LicenseState;
  product: string;
  appVersion: string;
  licenseId?: string;
  licensee?: string;
  edition?: string;
  issuedAt?: string;
  expiresAt?: string;
  verificationCode?: string;
  message: string;
}

export function initialLicenseStatus(): LicenseStatus {
  return {
    state: "checking",
    product: "班阵",
    appVersion: "0.1.0",
    message: "正在验证本机授权",
  };
}

export function licenseFailure(message: string): LicenseStatus {
  return {
    state: "misconfigured",
    product: "班阵",
    appVersion: "0.1.0",
    message,
  };
}

export async function readLicenseStatus(): Promise<LicenseStatus> {
  if (isTauri()) return invoke<LicenseStatus>("get_license_status");
  const content = window.localStorage.getItem("banzhen-offline-license-v1");
  if (!content) return basicStatus("missing", "尚未导入班阵离线授权文件");
  return verifyBrowserLicense(content);
}

export async function importLicenseFile(file: File): Promise<LicenseStatus> {
  if (!file.name.toLowerCase().endsWith(".zj-license")) {
    return basicStatus("invalid", "请选择 `.zj-license` 授权文件");
  }
  if (file.size > 64 * 1024) {
    return {
      ...licenseFailure("授权文件超过 64 KB，无法导入"),
      state: "invalid",
    };
  }
  const content = await file.text();
  if (isTauri()) return invoke<LicenseStatus>("install_license", { content });
  const status = await verifyBrowserLicense(content);
  if (status.state === "licensed") {
    window.localStorage.setItem("banzhen-offline-license-v1", content);
  }
  return status;
}

export function licenseStateLabel(state: LicenseState) {
  return {
    checking: "验证中",
    licensed: "正版授权",
    missing: "未授权",
    invalid: "授权无效",
    expired: "授权已到期",
    misconfigured: "授权配置异常",
  }[state];
}

interface BrowserLicenseClaims {
  schemaVersion: number;
  product: string;
  productId: string;
  licenseId: string;
  licensee: string;
  edition: string;
  issuedAt: string;
  expiresAt: string | null;
}

interface BrowserLicenseEnvelope {
  license: BrowserLicenseClaims;
  algorithm: string;
  signature: string;
}

function basicStatus(state: LicenseState, message: string): LicenseStatus {
  return { state, product: "班阵", appVersion: "0.1.0", message };
}

function hasExactKeys(value: object, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseEnvelope(content: string): BrowserLicenseEnvelope | undefined {
  try {
    const envelope = JSON.parse(content) as unknown;
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return undefined;
    if (!hasExactKeys(envelope, ["license", "algorithm", "signature"])) return undefined;
    const candidate = envelope as Partial<BrowserLicenseEnvelope>;
    if (!candidate.license || typeof candidate.license !== "object" || Array.isArray(candidate.license)) return undefined;
    if (!hasExactKeys(candidate.license, ["schemaVersion", "product", "productId", "licenseId", "licensee", "edition", "issuedAt", "expiresAt"])) return undefined;
    const claims = candidate.license as BrowserLicenseClaims;
    if (
      typeof candidate.algorithm !== "string"
      || typeof candidate.signature !== "string"
      || typeof claims.schemaVersion !== "number"
      || typeof claims.product !== "string"
      || typeof claims.productId !== "string"
      || typeof claims.licenseId !== "string"
      || typeof claims.licensee !== "string"
      || typeof claims.edition !== "string"
      || typeof claims.issuedAt !== "string"
      || (claims.expiresAt !== null && typeof claims.expiresAt !== "string")
    ) return undefined;
    return candidate as BrowserLicenseEnvelope;
  } catch {
    return undefined;
  }
}

function canonicalLicense(claims: BrowserLicenseClaims) {
  return JSON.stringify({
    schemaVersion: claims.schemaVersion,
    product: claims.product,
    productId: claims.productId,
    licenseId: claims.licenseId,
    licensee: claims.licensee,
    edition: claims.edition,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  });
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const decoded = window.atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

function publicKeyBytes() {
  const base64 = LICENSE_PUBLIC_KEY_PEM.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
  return decodeBase64(base64);
}

function validIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function licensedStatus(claims: BrowserLicenseClaims, verificationCode: string, state: LicenseState, message: string): LicenseStatus {
  return {
    state,
    product: claims.product,
    appVersion: "0.1.0",
    licenseId: claims.licenseId,
    licensee: claims.licensee,
    edition: claims.edition,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt ?? undefined,
    verificationCode,
    message,
  };
}

async function shortVerificationCode(canonical: Uint8Array, signature: Uint8Array) {
  const joined = new Uint8Array(canonical.length + signature.length);
  joined.set(canonical);
  joined.set(signature, canonical.length);
  const digest = new Uint8Array(await window.crypto.subtle.digest("SHA-256", joined));
  return [...digest.slice(0, 6)]
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join("")
    .match(/.{1,4}/g)?.join("-") ?? "";
}

async function verifyBrowserLicense(content: string): Promise<LicenseStatus> {
  if (content.length > 64 * 1024) return basicStatus("invalid", "授权文件过大，无法验证");
  const envelope = parseEnvelope(content);
  if (!envelope) return basicStatus("invalid", "授权文件格式不正确");
  if (envelope.algorithm !== "Ed25519") return basicStatus("invalid", "授权文件使用了不支持的签名算法");

  const canonical = new TextEncoder().encode(canonicalLicense(envelope.license));
  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = decodeBase64(envelope.signature);
  } catch {
    return basicStatus("invalid", "授权签名格式不正确");
  }
  if (signature.length !== 64) return basicStatus("invalid", "授权签名长度不正确");

  let publicKey: CryptoKey;
  try {
    publicKey = await window.crypto.subtle.importKey("spki", publicKeyBytes(), { name: "Ed25519" }, false, ["verify"]);
  } catch {
    return basicStatus("misconfigured", "当前环境无法执行 Ed25519 本地验证");
  }

  try {
    const valid = await window.crypto.subtle.verify("Ed25519", publicKey, signature, canonical);
    if (!valid) return basicStatus("invalid", "授权签名验证失败，文件可能已被修改");
    const code = await shortVerificationCode(canonical, signature);
    const claims = envelope.license;
    if (claims.schemaVersion !== 1 || claims.product !== "班阵" || claims.productId !== "cn.banzhen.seating") {
      return licensedStatus(claims, code, "invalid", "该授权文件不适用于当前软件");
    }
    if (!claims.licenseId.trim() || !claims.licensee.trim() || !claims.edition.trim()) {
      return licensedStatus(claims, code, "invalid", "授权编号、授权对象或版本不能为空");
    }
    if (!validIsoDate(claims.issuedAt) || (claims.expiresAt !== null && !validIsoDate(claims.expiresAt))) {
      return licensedStatus(claims, code, "invalid", "授权日期格式不正确");
    }
    const currentDate = new Date();
    const today = currentDate.toISOString().slice(0, 10);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    if (claims.issuedAt > currentDate.toISOString().slice(0, 10)) {
      return licensedStatus(claims, code, "invalid", "授权签发日期晚于本机日期");
    }
    if (claims.expiresAt && claims.expiresAt < claims.issuedAt) {
      return licensedStatus(claims, code, "invalid", "授权到期日期早于签发日期");
    }
    if (claims.expiresAt && claims.expiresAt < today) {
      return licensedStatus(claims, code, "expired", "授权已到期，请导入新的授权文件");
    }
    return licensedStatus(claims, code, "licensed", "数字签名验证通过");
  } catch {
    return basicStatus("invalid", "授权文件无法完成本地验证");
  }
}
