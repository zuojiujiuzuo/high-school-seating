import { PROJECT_STORAGE_KEY, SAVED_AT_STORAGE_KEY } from "./projectState";

const BACKUP_FORMAT = "banzhen-zj";
const BACKUP_SCHEMA = "banzhen-data-backup";
const BACKUP_VERSION = 1;
const BACKUP_ALGORITHM = "AES-GCM";
const BACKUP_AAD = "banzhen-zj-v1";
const BACKUP_KEY_MATERIAL = "banzhen.local-backup.2026.v1::zj";
const WORKSPACE_CATALOG_STORAGE_KEY = "banzhen-workspace-catalog-v1";

const APP_STORAGE_KEYS = [
  PROJECT_STORAGE_KEY,
  SAVED_AT_STORAGE_KEY,
  "banzhen-preferences-v1",
  "banzhen-legal-notice-v1",
  WORKSPACE_CATALOG_STORAGE_KEY,
  "banzhen-onboarding-v1",
  "banzhen-initial-layout-v1",
  "banzhen-pending-initial-layout-v1",
  "banzhen-first-import-auto-seated-v1",
  "banzhen-custom-layout-templates-v1",
  "banzhen-current-class",
  "banzhen-current-version",
  "banzhen-theme",
] as const;

export interface DataBackupSummary {
  classCount: number;
  versionCount: number;
  studentRecordCount: number;
}

export interface DataBackupPayload {
  schema: typeof BACKUP_SCHEMA;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  entries: Record<string, string>;
}

interface EncryptedBackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  algorithm: typeof BACKUP_ALGORITHM;
  iv: string;
  ciphertext: string;
}

interface WorkspaceCatalogBackup {
  classes: string[];
  versionsByClass: Record<string, string[]>;
}

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppStorageKey(key: string) {
  return APP_STORAGE_KEYS.some((prefix) => key === prefix || key.startsWith(`${prefix}:`));
}

function listAppStorageKeys(storage: StorageLike) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isAppStorageKey(key)) keys.push(key);
  }
  return keys;
}

function parseWorkspaceCatalog(entries: Record<string, string>): WorkspaceCatalogBackup {
  const rawCatalog = entries[WORKSPACE_CATALOG_STORAGE_KEY];
  if (!rawCatalog) throw new Error("备份中缺少班级目录，无法恢复");

  let value: unknown;
  try {
    value = JSON.parse(rawCatalog);
  } catch {
    throw new Error("备份中的班级目录已损坏");
  }
  if (!isObject(value) || !Array.isArray(value.classes) || !isObject(value.versionsByClass)) {
    throw new Error("备份中的班级目录格式不正确");
  }

  const classes = value.classes.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  if (!classes.length || classes.length !== value.classes.length) {
    throw new Error("备份中没有可恢复的班级");
  }

  const versionsByClass: Record<string, string[]> = {};
  for (const className of classes) {
    const versions = value.versionsByClass[className];
    if (!Array.isArray(versions) || !versions.length || versions.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error(`“${className}”的座位版本信息不完整`);
    }
    versionsByClass[className] = versions as string[];
  }
  return { classes, versionsByClass };
}

function assertProjectEntries(entries: Record<string, string>, catalog: WorkspaceCatalogBackup) {
  for (const className of catalog.classes) {
    for (const versionName of catalog.versionsByClass[className]) {
      const key = `${PROJECT_STORAGE_KEY}:${encodeURIComponent(className)}:${encodeURIComponent(versionName)}`;
      const rawProject = entries[key];
      if (!rawProject) throw new Error(`备份缺少“${className} · ${versionName}”的数据`);
      try {
        const project = JSON.parse(rawProject) as unknown;
        if (!isObject(project) || !Array.isArray(project.students)) throw new Error();
      } catch {
        throw new Error(`“${className} · ${versionName}”的数据已损坏`);
      }
    }
  }
}

function assertBackupPayload(value: unknown): asserts value is DataBackupPayload {
  if (!isObject(value)
    || value.schema !== BACKUP_SCHEMA
    || value.version !== BACKUP_VERSION
    || typeof value.exportedAt !== "string"
    || Number.isNaN(Date.parse(value.exportedAt))
    || !isObject(value.entries)) {
    throw new Error("这不是有效的班阵数据备份");
  }

  const entries = value.entries;
  for (const [key, entryValue] of Object.entries(entries)) {
    if (!isAppStorageKey(key) || typeof entryValue !== "string") {
      throw new Error("备份包含无法识别的数据，已停止恢复");
    }
  }
  const catalog = parseWorkspaceCatalog(entries as Record<string, string>);
  assertProjectEntries(entries as Record<string, string>, catalog);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("备份文件编码不正确");
  }
}

async function getBackupKey() {
  if (!globalThis.crypto?.subtle) throw new Error("当前环境不支持加密备份");
  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(BACKUP_KEY_MATERIAL));
  return globalThis.crypto.subtle.importKey("raw", digest, { name: BACKUP_ALGORITHM }, false, ["encrypt", "decrypt"]);
}

export function collectDataBackup(storage: StorageLike, exportedAt = new Date().toISOString()): DataBackupPayload {
  const entries = Object.fromEntries(listAppStorageKeys(storage).flatMap((key) => {
    const value = storage.getItem(key);
    return value === null ? [] : [[key, value]];
  }));
  const payload: DataBackupPayload = {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt,
    entries,
  };
  assertBackupPayload(payload);
  return payload;
}

export function summarizeDataBackup(payload: DataBackupPayload): DataBackupSummary {
  assertBackupPayload(payload);
  const catalog = parseWorkspaceCatalog(payload.entries);
  let studentRecordCount = 0;
  for (const className of catalog.classes) {
    for (const versionName of catalog.versionsByClass[className]) {
      const key = `${PROJECT_STORAGE_KEY}:${encodeURIComponent(className)}:${encodeURIComponent(versionName)}`;
      const project = JSON.parse(payload.entries[key]) as { students: unknown[] };
      studentRecordCount += project.students.length;
    }
  }
  return {
    classCount: catalog.classes.length,
    versionCount: Object.values(catalog.versionsByClass).reduce((total, versions) => total + versions.length, 0),
    studentRecordCount,
  };
}

export async function encryptDataBackup(payload: DataBackupPayload) {
  assertBackupPayload(payload);
  const encoder = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: BACKUP_ALGORITHM, iv, additionalData: encoder.encode(BACKUP_AAD), tagLength: 128 },
    await getBackupKey(),
    encoder.encode(JSON.stringify(payload)),
  );
  const envelope: EncryptedBackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    algorithm: BACKUP_ALGORITHM,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
}

export async function decryptDataBackup(content: string): Promise<DataBackupPayload> {
  let envelope: unknown;
  try {
    envelope = JSON.parse(content);
  } catch {
    throw new Error("无法读取该 .zj 文件");
  }
  if (!isObject(envelope)
    || envelope.format !== BACKUP_FORMAT
    || envelope.version !== BACKUP_VERSION
    || envelope.algorithm !== BACKUP_ALGORITHM
    || typeof envelope.iv !== "string"
    || typeof envelope.ciphertext !== "string") {
    throw new Error("这不是有效的班阵 .zj 备份");
  }

  try {
    const encoder = new TextEncoder();
    const decrypted = await globalThis.crypto.subtle.decrypt(
      {
        name: BACKUP_ALGORITHM,
        iv: base64ToBytes(envelope.iv),
        additionalData: encoder.encode(BACKUP_AAD),
        tagLength: 128,
      },
      await getBackupKey(),
      base64ToBytes(envelope.ciphertext),
    );
    const payload = JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
    assertBackupPayload(payload);
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("备份")) throw error;
    if (error instanceof Error && error.message.startsWith("“")) throw error;
    if (error instanceof Error && error.message.startsWith("这不是")) throw error;
    throw new Error("备份无法解密或文件已损坏");
  }
}

export function restoreDataBackup(payload: DataBackupPayload, storage: StorageLike) {
  assertBackupPayload(payload);
  const previousEntries = Object.fromEntries(listAppStorageKeys(storage).flatMap((key) => {
    const value = storage.getItem(key);
    return value === null ? [] : [[key, value]];
  }));

  try {
    listAppStorageKeys(storage).forEach((key) => storage.removeItem(key));
    Object.entries(payload.entries).forEach(([key, value]) => storage.setItem(key, value));
  } catch (error) {
    listAppStorageKeys(storage).forEach((key) => storage.removeItem(key));
    Object.entries(previousEntries).forEach(([key, value]) => storage.setItem(key, value));
    throw error;
  }
}

export function downloadDataBackup(content: string, exportedAt = new Date()) {
  const stamp = exportedAt.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
  const blob = new Blob([content], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `班阵数据备份_${stamp}.zj`;
  anchor.click();
  URL.revokeObjectURL(url);
}
