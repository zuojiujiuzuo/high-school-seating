import {
  Armchair,
  CircleOff,
  Columns3,
  MousePointer2,
  Move,
  Presentation,
  SquareDashed,
} from "lucide-react";

export type ToolMode = "select" | "move" | "seat" | "aisle" | "podium" | "empty" | "disabled";

export const toolDetails: Record<ToolMode, { label: string; description: string }> = {
  select: { label: "选择", description: "点击或框选学生；拖动学生即可换座。" },
  move: { label: "移动", description: "按住画布拖动视野，滚轮可以缩放。" },
  seat: { label: "座位", description: "点击空白处添加座位；拖动已有座位调整位置。" },
  aisle: { label: "过道", description: "在画布上左右拖动，统一调整大组之间的过道宽度。" },
  podium: { label: "讲台", description: "拖动讲台，或点击教室前方区域快速移动。" },
  empty: { label: "空位", description: "点击已入座学生，将该座位清空并把学生退回名单。" },
  disabled: { label: "禁用", description: "点击座位切换禁用状态；禁用座位不会参与排座。" },
};

const tools: { id: ToolMode; icon: typeof MousePointer2 }[] = [
  { id: "select", icon: MousePointer2 },
  { id: "move", icon: Move },
  { id: "seat", icon: Armchair },
  { id: "aisle", icon: Columns3 },
  { id: "podium", icon: Presentation },
  { id: "empty", icon: SquareDashed },
  { id: "disabled", icon: CircleOff },
];

interface ToolRailProps {
  active: ToolMode;
  onChange: (tool: ToolMode) => void;
}

export function ToolRail({ active, onChange }: ToolRailProps) {
  return (
    <aside className="tool-rail" aria-label="画布工具">
      {tools.map(({ id, icon: Icon }, index) => (
        <button
          className={`tool-button ${active === id ? "is-active" : ""} ${index === 2 || index === 4 ? "tool-separator" : ""}`}
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          aria-label={`${toolDetails[id].label}：${toolDetails[id].description}`}
          title={toolDetails[id].description}
        >
          <Icon size={20} strokeWidth={1.65} />
          <span>{toolDetails[id].label}</span>
        </button>
      ))}
    </aside>
  );
}
