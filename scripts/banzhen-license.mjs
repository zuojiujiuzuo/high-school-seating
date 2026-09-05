#!/usr/bin/env node

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const PRODUCT = "班阵";
const PRODUCT_ID = "cn.banzhen.seating";
const ALGORITHM = "Ed25519";

function usage() {
  return `班阵离线授权签发工具

用法：
  node scripts/banzhen-license.mjs keygen --private-key <私钥路径> --public-key <公钥路径> [--replace-public]
  node scripts/banzhen-license.mjs issue --private-key <私钥路径> --license-id <编号> --licensee <授权对象> --output <文件> [--edition <版本>] [--issued-at YYYY-MM-DD] [--expires-at YYYY-MM-DD]
  node scripts/banzhen-license.mjs verify --public-key <公钥路径> --license <授权文件>

私钥只能保存在发布者控制的机器或密钥系统中，不能提交到代码仓库。`;
}

function parseArgs(values) {
  const [command, ...rest] = values;
  const options = new Map();
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (!flag.startsWith("--")) throw new Error(`无法识别参数：${flag}`);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options.set(flag.slice(2), true);
    } else {
      options.set(flag.slice(2), next);
      index += 1;
    }
  }
  return { command, options };
}

function required(options, name) {
  const value = options.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`缺少 --${name}`);
  return value.trim();
}

function optional(options, name, fallback) {
  const value = options.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function validateDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label}必须使用 YYYY-MM-DD 格式`);
  }
  return value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeOutput(path, content, options = {}) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, {
    encoding: "utf8",
    mode: options.mode ?? 0o644,
    flag: options.replace ? "w" : "wx",
  });
}

function publicKeyFingerprint(publicKey) {
  const normalizedKey = publicKey.type === "public" ? publicKey : createPublicKey(publicKey);
  const der = normalizedKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex").toUpperCase().match(/.{1,4}/g).slice(0, 4).join("-");
}

async function keygen(options) {
  const privatePath = resolve(required(options, "private-key"));
  const publicPath = resolve(required(options, "public-key"));
  if (await pathExists(privatePath)) throw new Error(`私钥已存在，已拒绝覆盖：${privatePath}`);
  if (await pathExists(publicPath) && !options.has("replace-public")) {
    throw new Error(`公钥已存在；确认替换时请添加 --replace-public：${publicPath}`);
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  await writeOutput(privatePath, privatePem, { mode: 0o600 });
  await writeOutput(publicPath, publicPem, { replace: options.has("replace-public") });
  console.log(`已生成签发私钥：${privatePath}`);
  console.log(`已写入验证公钥：${publicPath}`);
  console.log(`公钥指纹：${publicKeyFingerprint(publicKey)}`);
}

async function issue(options) {
  const privatePath = resolve(required(options, "private-key"));
  const outputPath = resolve(required(options, "output"));
  if (!outputPath.toLowerCase().endsWith(".zj-license")) {
    throw new Error("授权文件必须使用 .zj-license 扩展名");
  }
  const issuedAt = validateDate(optional(options, "issued-at", today()), "签发日期");
  const expiresAtValue = optional(options, "expires-at", "");
  const expiresAt = expiresAtValue ? validateDate(expiresAtValue, "到期日期") : null;
  if (expiresAt && expiresAt < issuedAt) throw new Error("到期日期不能早于签发日期");

  const claims = {
    schemaVersion: 1,
    product: PRODUCT,
    productId: PRODUCT_ID,
    licenseId: required(options, "license-id"),
    licensee: required(options, "licensee"),
    edition: optional(options, "edition", "正式版"),
    issuedAt,
    expiresAt,
  };
  const canonical = JSON.stringify(claims);
  const privateKey = createPrivateKey(await readFile(privatePath, "utf8"));
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("私钥不是 Ed25519 私钥");
  const signature = sign(null, Buffer.from(canonical, "utf8"), privateKey).toString("base64");
  const envelope = `${JSON.stringify({ license: claims, algorithm: ALGORITHM, signature }, null, 2)}\n`;
  await writeOutput(outputPath, envelope, { mode: 0o600 });
  console.log(`已签发授权文件：${outputPath}`);
  console.log(`授权编号：${claims.licenseId}`);
  console.log(`授权对象：${claims.licensee}`);
}

async function verifyLicense(options) {
  const publicPath = resolve(required(options, "public-key"));
  const licensePath = resolve(required(options, "license"));
  const publicKey = createPublicKey(await readFile(publicPath, "utf8"));
  if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("公钥不是 Ed25519 公钥");
  const envelope = JSON.parse(await readFile(licensePath, "utf8"));
  const canonical = JSON.stringify(envelope.license);
  const valid = envelope.algorithm === ALGORITHM
    && verify(null, Buffer.from(canonical, "utf8"), publicKey, Buffer.from(envelope.signature, "base64"));
  if (!valid) throw new Error("授权文件签名无效或文件已被修改");
  if (envelope.license?.productId !== PRODUCT_ID || envelope.license?.product !== PRODUCT) {
    throw new Error("授权文件不适用于班阵");
  }
  console.log(`签名有效：${licensePath}`);
  console.log(`授权编号：${envelope.license.licenseId}`);
  console.log(`授权对象：${envelope.license.licensee}`);
  console.log(`公钥指纹：${publicKeyFingerprint(publicKey)}`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === "help" || options.has("help")) {
    console.log(usage());
    return;
  }
  if (command === "keygen") return keygen(options);
  if (command === "issue") return issue(options);
  if (command === "verify") return verifyLicense(options);
  throw new Error(`未知命令：${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
