import { describe, expect, it } from "vitest";
import { verifyLicenseContent } from "./license";

function encodeBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function issueTestLicense() {
  const { privateKey, publicKey } = await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  const license = {
    schemaVersion: 1,
    product: "班阵",
    productId: "cn.banzhen.seating",
    licenseId: "TEST-PORTABLE-PERPETUAL",
    licensee: "测试用户",
    edition: "个人永久版",
    issuedAt: new Date().toISOString().slice(0, 10),
    expiresAt: null,
  };
  const canonical = new TextEncoder().encode(JSON.stringify(license));
  const signature = encodeBase64(new Uint8Array(await globalThis.crypto.subtle.sign("Ed25519", privateKey, canonical)));
  const content = JSON.stringify({ license, algorithm: "Ed25519", signature });
  const publicKeyDer = new Uint8Array(await globalThis.crypto.subtle.exportKey("spki", publicKey));
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${encodeBase64(publicKeyDer)}\n-----END PUBLIC KEY-----\n`;
  return { content, publicKeyPem };
}

describe("browser offline license verification", () => {
  it("accepts a permanent portable license without Web Crypto", async () => {
    const { content, publicKeyPem } = await issueTestLicense();

    const first = await verifyLicenseContent(content, publicKeyPem);
    const second = await verifyLicenseContent(content, publicKeyPem);

    expect(first).toMatchObject({
      state: "licensed",
      licenseId: "TEST-PORTABLE-PERPETUAL",
      expiresAt: undefined,
    });
    expect(second).toEqual(first);
  });

  it("rejects a modified license", async () => {
    const { content, publicKeyPem } = await issueTestLicense();
    const modified = content.replace("测试用户", "其他用户");

    await expect(verifyLicenseContent(modified, publicKeyPem)).resolves.toMatchObject({
      state: "invalid",
    });
  });
});
