export interface GroupPlacement {
  group: number;
  x: number;
  width: number;
}

export function computeEqualGroupPlacements(
  count: number,
  canvasWidth: number,
  groupWidth: number,
  outerMargin: number,
): GroupPlacement[] {
  if (count <= 0) return [];
  if (count === 1) {
    return [{ group: 0, x: (canvasWidth - groupWidth) / 2, width: groupWidth }];
  }

  const usableWidth = canvasWidth - outerMargin * 2;
  const gap = (usableWidth - groupWidth * count) / (count - 1);
  return Array.from({ length: count }, (_, group) => ({
    group,
    x: outerMargin + group * (groupWidth + gap),
    width: groupWidth,
  }));
}
