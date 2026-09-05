import { ArrowLeft, ArrowRight, Check, MousePointer2, PanelsTopLeft, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

interface OnboardingTourProps {
  onFinish: () => void;
}

const tourSteps = [
  {
    target: "workspaces",
    placement: "below" as const,
    icon: PanelsTopLeft,
    eyebrow: "工作区",
    title: "先选班级，再管理座位版本",
    description: "班级和座位版本现在都有独立菜单。除了切换，你还可以直接新建班级、清空当前名单，或从现有方案创建新版本。",
    tip: "选择器右侧的小箭头会打开班阵自己的主题菜单。",
  },
  {
    target: "roster-import",
    placement: "right" as const,
    icon: Upload,
    eyebrow: "快速开始",
    title: "从待入座名单导入学生",
    description: "导入名单后即可在排座工作区拖动换座，并使用右侧面板设置规则、生成方案。",
    tip: "导入窗口内提供标准 Excel 模板下载。",
  },
  {
    target: "seating-canvas",
    placement: "right" as const,
    icon: MousePointer2,
    eyebrow: "排座画布",
    title: "拖动姓名签即可调整座位",
    description: "左侧是待入座名单，中间是座位画布，右侧可以设置规则并生成方案；不满意时再次生成即可。",
    tip: "顶部的撤销和重做可以恢复最近操作。",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function OnboardingTour({ onFinish }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect>();
  const cardRef = useRef<HTMLElement>(null);
  const step = tourSteps[stepIndex];
  const StepIcon = step.icon;

  useEffect(() => {
    const updateTarget = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`);
      if (target) setTargetRect(target.getBoundingClientRect());
    };
    const frame = window.requestAnimationFrame(updateTarget);
    window.addEventListener("resize", updateTarget);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateTarget);
    };
  }, [step.target]);

  useEffect(() => {
    cardRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onFinish();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onFinish, stepIndex]);

  const spotlightStyle = useMemo<CSSProperties>(() => {
    if (!targetRect) return { opacity: 0 };
    const padding = 8;
    return {
      left: targetRect.left - padding,
      top: targetRect.top - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
    };
  }, [targetRect]);

  const cardStyle = useMemo<CSSProperties>(() => {
    const cardWidth = Math.min(390, window.innerWidth - 32);
    if (!targetRect) {
      return {
        left: (window.innerWidth - cardWidth) / 2,
        top: Math.max(16, (window.innerHeight - 330) / 2),
      };
    }
    const gap = 22;
    if (step.placement === "right") {
      return {
        left: clamp(targetRect.right + gap, 16, window.innerWidth - cardWidth - 16),
        top: clamp(targetRect.top + 34, 16, window.innerHeight - 360),
      };
    }
    return {
      left: clamp(targetRect.left + targetRect.width / 2 - cardWidth / 2, 16, window.innerWidth - cardWidth - 16),
      top: clamp(targetRect.bottom + gap, 16, window.innerHeight - 360),
    };
  }, [step.placement, targetRect]);

  const isLast = stepIndex === tourSteps.length - 1;

  return (
    <div className="onboarding-layer" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-description">
      <div className="onboarding-spotlight" style={spotlightStyle} aria-hidden="true" />
      <section className="onboarding-card" style={cardStyle} ref={cardRef} tabIndex={-1}>
        <header className="onboarding-card-header">
          <span className="onboarding-icon" aria-hidden="true"><StepIcon size={22} /></span>
          <div>
            <span className="eyebrow">新手导览 · {step.eyebrow}</span>
            <span className="onboarding-count">{stepIndex + 1} / {tourSteps.length}</span>
          </div>
          <button className="icon-button" type="button" aria-label="跳过新手导览" onClick={onFinish}><X size={18} /></button>
        </header>
        <div className="onboarding-card-body">
          <h2 id="onboarding-title">{step.title}</h2>
          <p id="onboarding-description">{step.description}</p>
          <div className="onboarding-tip"><Check size={16} aria-hidden="true" /><span>{step.tip}</span></div>
        </div>
        <footer className="onboarding-card-footer">
          <button className="text-button onboarding-skip" type="button" onClick={onFinish}>跳过导览</button>
          <div className="onboarding-dots" aria-label={`第 ${stepIndex + 1} 步，共 ${tourSteps.length} 步`}>
            {tourSteps.map((item, index) => <i className={index === stepIndex ? "is-active" : ""} key={item.target} />)}
          </div>
          <div className="onboarding-nav">
            {stepIndex > 0 && <button className="secondary-button" type="button" onClick={() => setStepIndex((current) => current - 1)}><ArrowLeft size={16} />上一步</button>}
            <button className="primary-button" type="button" onClick={() => isLast ? onFinish() : setStepIndex((current) => current + 1)}>
              {isLast ? <><Check size={16} />开始排座</> : <>下一步<ArrowRight size={16} /></>}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
