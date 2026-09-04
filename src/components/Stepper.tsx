import type { WizardStep } from "../types";

export const steps: { id: WizardStep; label: string; hint: string }[] = [
  { id: "roster", label: "名单", hint: "导入并检查学生信息" },
  { id: "layout", label: "布局", hint: "选择教室结构" },
  { id: "rules", label: "规则", hint: "安排关系与限制" },
  { id: "generate", label: "生成", hint: "比较三个排座方案" },
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
          className={`step ${current === step.id ? "is-current" : ""} ${index < currentIndex ? "is-done" : ""}`}
          key={step.id}
          type="button"
          onClick={() => onChange(step.id)}
          title={step.hint}
          aria-current={current === step.id ? "step" : undefined}
        >
          <span className="step-number">{index + 1}</span>
          <span>{step.label}</span>
        </button>
      ))}
    </nav>
  );
}
