import { Check, Plus, Tags } from "lucide-react";
import { useState, type FormEvent } from "react";

const QUICK_TAGS = ["视力关注", "组长候选", "重点关注", "需要鼓励"] as const;

interface StudentQuickTagsProps {
  studentName: string;
  tags?: string[];
  onAddTag: (tag: string) => void;
}

export function StudentQuickTags({ studentName, tags = [], onAddTag }: StudentQuickTagsProps) {
  const [customTag, setCustomTag] = useState("");
  const normalizedTags = new Set(tags.map((tag) => tag.trim()).filter(Boolean));

  const addCustomTag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tag = customTag.trim();
    if (!tag || normalizedTags.has(tag)) return;
    onAddTag(tag);
    setCustomTag("");
  };

  return (
    <section className="student-context-tag-section" aria-label={`为${studentName}快速添加标签`}>
      <div className="student-context-tag-heading">
        <Tags size={15} />
        <strong>快速添加标签</strong>
        <small>{tags.length ? `已有 ${tags.length} 个` : "可多选"}</small>
      </div>
      <div className="student-context-tag-options">
        {QUICK_TAGS.map((tag) => {
          const added = normalizedTags.has(tag);
          return (
            <button
              className={added ? "is-added" : ""}
              type="button"
              role="menuitem"
              aria-label={added ? `${tag}，已添加` : `添加标签${tag}`}
              disabled={added}
              key={tag}
              onClick={() => onAddTag(tag)}
            >
              {added && <Check size={11} />}
              {tag}
            </button>
          );
        })}
      </div>
      <form className="student-context-custom-tag" onSubmit={addCustomTag}>
        <input
          value={customTag}
          maxLength={12}
          aria-label={`为${studentName}输入自定义标签`}
          placeholder="输入自定义标签"
          onChange={(event) => setCustomTag(event.target.value)}
        />
        <button
          type="submit"
          aria-label="添加自定义标签"
          disabled={!customTag.trim() || normalizedTags.has(customTag.trim())}
        >
          <Plus size={14} />
        </button>
      </form>
    </section>
  );
}
