interface StyledTooltipProps {
  label?: string;
  description: string;
  side?: "bottom" | "right";
}

export function StyledTooltip({
  label,
  description,
  side = "bottom",
}: StyledTooltipProps) {
  return (
    <span className={`styled-tooltip styled-tooltip-${side}`} aria-hidden="true">
      {label && <strong>{label}</strong>}
      <span>{description}</span>
    </span>
  );
}
