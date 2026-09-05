import { describe, expect, it } from "vitest";
import {
  collectDataBackup,
  decryptDataBackup,
  encryptDataBackup,
  restoreDataBackup,
  summarizeDataBackup,
  type StorageLike,
} from "./dataBackup";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const className = "高二7班";
const versionName = "初始座位 · 第1版";
const projectKey = `banzhen-project-v2:${encodeURIComponent(className)}:${encodeURIComponent(versionName)}`;

function createSourceStorage() {
  const storage = new MemoryStorage();
  storage.setItem("banzhen-workspace-catalog-v1", JSON.stringify({
    classes: [className],
    versionsByClass: { [className]: [versionName] },
  }));
  storage.setItem(projectKey, JSON.stringify({ students: [{ id: "1", name: "林涵熙" }], constraints: [] }));
  storage.setItem("banzhen-current-class", className);
  storage.setItem("banzhen-current-version", versionName);
  storage.setItem("banzhen-theme", "cute");
  storage.setItem("unrelated-site-key", "keep-me");
  return storage;
}

describe("data backup", () => {
  it("collects only app-owned data and summarizes its contents", () => {
    const payload = collectDataBackup(createSourceStorage(), "2026-09-05T10:30:00.000Z");

    expect(payload.entries["unrelated-site-key"]).toBeUndefined();
    expect(payload.entries[projectKey]).toContain("林涵熙");
    expect(summarizeDataBackup(payload)).toEqual({ classCount: 1, versionCount: 1, studentRecordCount: 1 });
  });

  it("encrypts and decrypts a versioned .zj payload", async () => {
    const payload = collectDataBackup(createSourceStorage(), "2026-09-05T10:30:00.000Z");
    const encrypted = await encryptDataBackup(payload);

    expect(encrypted).not.toContain("林涵熙");
    expect(await decryptDataBackup(encrypted)).toEqual(payload);
  });

  it("rejects a modified encrypted backup", async () => {
    const payload = collectDataBackup(createSourceStorage());
    const envelope = JSON.parse(await encryptDataBackup(payload)) as { ciphertext: string };
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -4)}AAAA`;

    await expect(decryptDataBackup(JSON.stringify(envelope))).rejects.toThrow("备份无法解密或文件已损坏");
  });

  it("replaces existing app data while preserving unrelated browser data", () => {
    const payload = collectDataBackup(createSourceStorage());
    const target = new MemoryStorage();
    target.setItem("banzhen-theme", "minimal");
    target.setItem("banzhen-current-class", "旧班级");
    target.setItem("unrelated-site-key", "still-here");

    restoreDataBackup(payload, target);

    expect(target.getItem("banzhen-current-class")).toBe(className);
    expect(target.getItem("banzhen-theme")).toBe("cute");
    expect(target.getItem("unrelated-site-key")).toBe("still-here");
  });
});
