import {
  Bot,
  Check,
  Database,
  Scale,
  ShieldAlert,
  UserRoundCheck,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";

interface LegalNoticeDialogProps {
  onClose: () => void;
}

const noticeSections = [
  {
    icon: Database,
    title: "本地数据与设备安全",
    content: (
      <>
        <p>
          学生名单、座位、小组、规则和导出文件默认仅在使用者设备上处理与保存；本软件不会主动向开发者或其他网络服务上传学生名单、座位信息。
        </p>
        <p>
          使用者应妥善管理设备权限、登录凭据、备份和磁盘安全。如因病毒、恶意软件、设备遗失、系统或第三方软件漏洞、账号或密钥泄露、误操作造成数据泄露、丢失或损坏，且并非由本软件的故意或重大过失直接导致，开发者在法律允许范围内不承担责任。
        </p>
      </>
    ),
  },
  {
    icon: Bot,
    title: "AI 功能与第三方服务",
    content: (
      <>
        <p>
          AI 功能默认关闭。只有使用者填写第三方模型地址与密钥，并主动发起排座请求时才会联网。发送前将移除姓名、学号、班级等直接标识，以随机编号替代，仅提交使用者选定且排座所需的属性、约束和编号。
        </p>
        <p>
          AI 服务由使用者选择的第三方提供，其日志保存、数据使用、训练政策、服务地区和安全能力不受本软件控制。启用前请核验服务商条款、隐私政策及合规资格；不得向 AI 提交无关个人信息、学校秘密或其他无权处理的内容。
        </p>
      </>
    ),
  },
  {
    icon: UserRoundCheck,
    title: "个人信息与未成年人保护",
    content: (
      <p>
        使用者应确保有权录入、处理、导出或向第三方传输相关数据，并依据适用法律、学校制度取得必要的授权、同意或单独同意。处理未成年人、敏感个人信息或不满十四周岁未成年人的信息时，应采取更严格的最小必要、访问控制和告知措施。
      </p>
    ),
  },
  {
    icon: Scale,
    title: "公平使用与人工复核",
    content: (
      <>
        <p className="legal-emphasis">AI 座位方案仅供参考，最终座位由老师人工确认。</p>
        <p>
          自动排座和 AI 输出仅供辅助参考，可能存在错误、偏差或不可满足的建议，不能替代教师的专业判断。使用者应在应用方案前检查规则冲突、学生实际情况及潜在影响。
        </p>
        <p>
          不得利用本软件实施侮辱、歧视、不当画像或其他损害学生人格尊严和合法权益的行为；尤其不得公开传播或排名“颜值”等主观字段，不应仅依据性别、成绩、身高、健康状况等属性作出对学生权益有重大影响的决定。
        </p>
      </>
    ),
  },
  {
    icon: Wrench,
    title: "维护、缺陷与责任边界",
    content: (
      <>
        <p>
          本软件按现状提供，开发者将视实际情况不定期维护，但不保证软件完全无缺陷、持续不中断、兼容所有设备或第三方服务，也不承诺修复全部问题或在特定日期发布更新；维护通知方式将在后续版本中补充。
        </p>
        <p>
          最终座位安排、数据合法性、备份及使用后果由使用者负责。第三方 AI、操作系统和外部文件格式的可用性不在本软件控制范围内。本说明不排除依法不能排除的责任，也不影响使用者依法享有的强制性权利。
        </p>
      </>
    ),
  },
];

export function LegalNoticeDialog({ onClose }: LegalNoticeDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const confirm = () => {
    window.localStorage.setItem("banzhen-legal-notice-v1", new Date().toISOString());
    onClose();
  };

  return (
    <div className="modal-backdrop legal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal legal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="legal-header">
          <div className="legal-shield" aria-hidden="true"><ShieldAlert size={28} /></div>
          <div>
            <span className="eyebrow">DATA &amp; RESPONSIBILITY · V1.0</span>
            <h2 id="legal-title">数据处理与使用免责声明</h2>
            <p>请在录入真实学生信息或启用 AI 功能前阅读</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭免责声明"><X size={20} /></button>
        </header>

        <div className="legal-summary">
          <strong><Database size={17} />默认仅在本机处理</strong>
          <span />
          <strong><Bot size={17} />AI 仅在主动启用时联网</strong>
        </div>

        <div className="legal-content">
          {noticeSections.map(({ icon: Icon, title, content }, index) => (
            <section className="legal-section" key={title}>
              <div className="legal-section-index">{String(index + 1).padStart(2, "0")}</div>
              <Icon size={20} strokeWidth={1.6} />
              <div><h3>{title}</h3>{content}</div>
            </section>
          ))}
          <p className="legal-caveat">
            本说明用于解释软件的数据流与责任边界，不构成针对特定学校或使用场景的法律意见；如适用法律、监管要求或学校制度另有规定，以其规定为准。
          </p>
        </div>

        <footer className="legal-footer">
          <label className="legal-acknowledgement">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span><Check size={14} /></span>
            我已阅读并理解上述数据、AI 与责任说明
          </label>
          <div>
            <button className="secondary-button" type="button" onClick={onClose}>稍后再看</button>
            <button className="primary-button" type="button" disabled={!acknowledged} onClick={confirm}>确认并关闭</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
