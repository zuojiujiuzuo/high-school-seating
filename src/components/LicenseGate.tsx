import { BadgeCheck, FileKey2, ShieldCheck, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LicenseStatus } from "../data/license";
import { licenseStateLabel } from "../data/license";
import { BrandIcon } from "./BrandIcon";

interface LicenseGateProps {
  status: LicenseStatus;
  onImport: (file: File) => Promise<LicenseStatus>;
}

function LicenseImportButton({ disabled, dropzone = false, onImport }: {
  disabled?: boolean;
  dropzone?: boolean;
  onImport: (file: File) => Promise<LicenseStatus>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const importFile = async (file: File) => {
    if (disabled || importing) return;
    setImporting(true);
    try {
      await onImport(file);
    } finally {
      setImporting(false);
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      className="visually-hidden"
      type="file"
      accept=".zj-license,application/json"
      tabIndex={-1}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void importFile(file);
      }}
    />
  );

  if (!dropzone) {
    return (
      <>
        {fileInput}
      <button
        className="primary-button license-import-button"
        type="button"
        disabled={disabled || importing}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud size={18} aria-hidden="true" />
        {importing ? "正在验证授权" : "选择离线授权文件"}
      </button>
      </>
    );
  }

  return (
    <>
      {fileInput}
      <button
        className={`license-dropzone ${dragging ? "is-dragging" : ""}`}
        type="button"
        disabled={disabled || importing}
        aria-busy={importing}
        aria-label="点击选择或拖放佐玖离线授权文件"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          dragDepthRef.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepthRef.current = 0;
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void importFile(file);
        }}
      >
        <UploadCloud size={25} aria-hidden="true" />
        <span className="license-dropzone-copy" aria-live="polite">
          <strong>{importing ? "正在验证授权" : dragging ? "松开即可导入" : "点击选择或拖放到这里"}</strong>
          <small>支持佐玖 `.zj-license` 文件</small>
        </span>
      </button>
    </>
  );
}

function usePreventWindowFileDrop() {
  useEffect(() => {
    const prevent = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);
}

export function LicenseGate({ status, onImport }: LicenseGateProps) {
  const dialogRef = useRef<HTMLElement>(null);
  usePreventWindowFileDrop();

  useEffect(() => {
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
  }, [status.state]);

  return (
    <div className="license-gate-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="license-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-gate-title"
        aria-describedby="license-gate-description"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled):not([tabindex='-1'])")];
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement as HTMLElement);
          const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
          if (nextIndex >= 0 && nextIndex < items.length) return;
          event.preventDefault();
          items[event.shiftKey ? items.length - 1 : 0].focus();
        }}
      >
        <header className="license-gate-brand">
          <BrandIcon className="license-gate-brand-icon" />
          <span><strong>班阵</strong><small>OFFLINE LICENSE</small></span>
        </header>
        <div className="license-gate-seal" aria-hidden="true"><ShieldCheck size={34} strokeWidth={1.8} /></div>
        <div className="license-gate-copy">
          <span className={`license-state-pill is-${status.state}`}><FileKey2 size={14} />{licenseStateLabel(status.state)}</span>
          <h1 id="license-gate-title">导入正版离线授权</h1>
          <p id="license-gate-description">授权验证完全在本机完成，不会向任何服务器发送请求。导入一次后即可离线使用。</p>
        </div>
        {status.state !== "checking" && (
          <div className="license-gate-message" role={status.state === "missing" ? "status" : "alert"}>
            <BadgeCheck size={17} aria-hidden="true" />
            <span><strong>{status.message}</strong><small>请选择由佐玖官方签发的 `.zj-license` 文件。</small></span>
          </div>
        )}
        <LicenseImportButton disabled={status.state === "checking"} dropzone onImport={onImport} />
        <small className="license-gate-footnote">授权文件包含授权对象、授权编号和数字签名，不包含账号密码或学生数据。</small>
      </section>
    </div>
  );
}

export function LicenseSettingsCard({ status, onImport }: LicenseGateProps) {
  return (
    <section className={`license-settings-card is-${status.state}`} aria-labelledby="license-settings-title">
      <div className="license-settings-heading">
        <span><ShieldCheck size={19} aria-hidden="true" /></span>
        <div><strong id="license-settings-title">正版授权</strong><small>{status.message}</small></div>
        <b>{licenseStateLabel(status.state)}</b>
      </div>
      {status.state === "licensed" && (
        <dl className="license-details">
          <div><dt>授权对象</dt><dd>{status.licensee}</dd></div>
          <div><dt>授权编号</dt><dd>{status.licenseId}</dd></div>
          <div><dt>授权版本</dt><dd>{status.edition}</dd></div>
          <div><dt>校验码</dt><dd>{status.verificationCode}</dd></div>
          <div><dt>签发日期</dt><dd>{status.issuedAt}</dd></div>
          <div><dt>有效期限</dt><dd>{status.expiresAt ?? "永久"}</dd></div>
        </dl>
      )}
      <div className="license-settings-actions">
        <LicenseImportButton disabled={status.state === "checking"} onImport={onImport} />
        <small>重新导入有效文件会替换本机现有授权。</small>
      </div>
    </section>
  );
}
