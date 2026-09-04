import type { WizardStep } from "../types";
import { StyledTooltip } from "./StyledTooltip";

export const steps: { id: WizardStep; label: string; hint: string }[] = [
  { id: "roster", label: "名单", hint: "导入并检查学生信息" },
  { id: "layout", label: "布局", hint: "选择教室结构" },
  { id: "seating", label: "排座", hint: "设置规则并生成排座方案" },
  { id: "export", label: "导出", hint: "设置打印与文件" },
];

interface StepperProps {
  current: WizardStep;
  onChange: (step: WizardStep) => void;
}

export function Stepper({ current, onChange }: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <nav className="stepper" aria-label="排座步骤">
      {steps.map((step, index) => (
        <button
          className={`step has-styled-tooltip ${current === step.id ? "is-current" : ""} ${index < currentIndex ? "is-done" : ""}`}
          key={step.id}
          type="button"
          onClick={() => onChange(step.id)}
          aria-label={`第 ${index + 1} 步：${step.label}。${step.hint}`}
          aria-current={current === step.id ? "step" : undefined}
        >
          <span className="step-number">{index + 1}</span>
          <span>{step.label}</span>
          <StyledTooltip description={step.hint} />
        </button>
      ))}
    </nav>
  );
}
