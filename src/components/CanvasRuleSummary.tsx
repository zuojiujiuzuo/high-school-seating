import { ChevronDown, ListChecks, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ruleLabels } from "../domain/rules";
import type { SeatingConstraint, Student } from "../types";

interface CanvasRuleSummaryProps {
  constraints: SeatingConstraint[];
  students: Student[];
  needsRearrange: boolean;
  onDeleteBatch: (batchId: string) => void;
  onRearrange: () => void;
}

export function CanvasRuleSummary({
  constraints,
  students,
  needsRearrange,
  onDeleteBatch,
  onRearrange,
}: CanvasRuleSummaryProps) {
  const [open, setOpen] = useState(false);
  const studentNames = useMemo(
    () => new Map(students.map((student) => [student.id, student.name])),
    [students],
  );
  const batches = useMemo(() => {
    const grouped = new Map<string, SeatingConstraint[]>();
    constraints.forEach((constraint) => {
      grouped.set(constraint.batchId, [...(grouped.get(constraint.batchId) ?? []), constraint]);
    });
    return [...grouped.entries()].map(([batchId, items]) => {
      const studentIds = [...new Set(items.flatMap((item) => [item.pair.a, item.pair.b]))];
      return {
        batchId,
        type: items[0].type,
        count: items.length,
        names: studentIds.map((id) => studentNames.get(id) ?? "未知学生").join("、"),
      };
    }).reverse();
  }, [constraints, studentNames]);

  if (!constraints.length) return null;

  return (
    <div className={`canvas-rule-summary ${open ? "is-open" : ""}`}>
      <button
        className="canvas-rule-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="canvas-rule-list"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="canvas-rule-icon"><ListChecks size={17} /></span>
        <span>
          <small>画布规则</small>
          <strong>{constraints.length} 条自定义规则</strong>
        </span>
        {needsRearrange && <em>待重排</em>}
        <ChevronDown className="canvas-rule-chevron" size={16} />
      </button>

      {open && (
        <section className="canvas-rule-popover" id="canvas-rule-list" aria-label="已添加的自定义规则">
          <header>
            <div><strong>自定义规则</strong><small>{batches.length} 组，共 {constraints.length} 条关系</small></div>
            <button type="button" onClick={onRearrange} title="按现有规则重排座位">
              <RotateCcw size={14} />重排
            </button>
          </header>
          <div className="canvas-rule-batches">
            {batches.map((batch) => (
              <article key={batch.batchId}>
                <span className={`canvas-rule-mark rule-${batch.type}`} />
                <div>
                  <strong>{ruleLabels[batch.type]}</strong>
                  <small>{batch.names}</small>
                  <em>{batch.count} 条关系</em>
                </div>
                <button
                  className="canvas-rule-delete"
                  type="button"
                  aria-label={`删除“${ruleLabels[batch.type]}”规则`}
                  title="删除这组规则"
                  onClick={() => onDeleteBatch(batch.batchId)}
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
          <p>删除规则后，画布上的关系标记会立即同步。</p>
        </section>
      )}
    </div>
  );
}
