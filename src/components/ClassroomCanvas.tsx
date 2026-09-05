import { BadgeCheck, Eye, Maximize2, Minus, MousePointer2, Plus, Undo2, UsersRound } from "lucide-react";
import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Point,
  Rectangle,
  Text,
  TextStyle,
} from "pixi.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { allPairs, constraintsForSelectedStudents, plannedPairCount, ruleLabels } from "../domain/rules";
import type {
  AssignmentMap,
  AppTheme,
  CanvasPoint,
  ConstraintType,
  DoorPlacement,
  SeatDefinition,
  SeatingConstraint,
  Student,
  StudentPair,
} from "../types";
import { StyledTooltip } from "./StyledTooltip";
import { StudentQuickTags } from "./StudentQuickTags";
import { toolDetails, type ToolMode } from "./ToolRail";

const LOGICAL_WIDTH = 1120;
const LOGICAL_HEIGHT = 720;
const STANDARD_SEAT_WIDTH = 110;
const MAX_GRID_GROUP_WIDTH = STANDARD_SEAT_WIDTH * 2 + 14;
const LAYOUT_HORIZONTAL_GUTTER = 20;
const TOOL_HINT_DURATION_MS = 10_000;
const COLORS = {
  ink: 0x242521,
  paper: 0xfffdf8,
  paperMuted: 0xf4f0e7,
  blue: 0x2f6fed,
  blueSoft: 0xeaf1ff,
  green: 0x4d9c6b,
  coral: 0xef6a5b,
  line: 0xaaa79f,
  faint: 0xd8d4ca,
};

const CUTE_COLORS: typeof COLORS = {
  ink: 0x3b3034,
  paper: 0xfffbfc,
  paperMuted: 0xfff0f4,
  blue: 0xe95783,
  blueSoft: 0xffe8ef,
  green: 0x58a979,
  coral: 0xe85d6a,
  line: 0xd8aeba,
  faint: 0xecd6dd,
};

interface SeatPosition {
  seat: SeatDefinition;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  studentId: string;
  seatId: string;
  node: Container;
  startPointer: Point;
  startPosition: Point;
  moved: boolean;
}

interface GroupDragMember {
  studentId: string;
  seatId: string;
  node: Container;
  startPosition: Point;
  width: number;
  height: number;
}

interface GroupDragState {
  members: GroupDragMember[];
  startPointer: Point;
  offset: Point;
  bounds: Rectangle;
  frame: Graphics;
  moved: boolean;
}

interface LassoState {
  start: Point;
  current: Point;
  graphic: Graphics;
}

interface SeatDragState {
  seatId: string;
  width: number;
  height: number;
  startPointer: Point;
  pointerOffset: Point;
  startPosition: Point;
  currentPosition: Point;
  graphic: Graphics;
  moved: boolean;
}

interface AisleDragState {
  startPointerX: number;
  startWidth: number;
  width: number;
  graphic: Graphics;
  label: Text;
}

interface PodiumDragState {
  startPointer: Point;
  pointerOffset: Point;
  startPosition: Point;
  node: Container;
  moved: boolean;
}

interface StatusTooltipState {
  x: number;
  y: number;
  title: string;
  items: string[];
  hiddenCount: number;
  itemDisplay: "text" | "tag";
}

interface StudentContextMenuState {
  x: number;
  y: number;
  studentId: string;
  studentName: string;
  seatId: string;
}

interface ClassroomCanvasProps {
  students: Student[];
  seats: SeatDefinition[];
  assignments: AssignmentMap;
  selectedStudentIds: string[];
  constraints: SeatingConstraint[];
  previewRuleType?: ConstraintType;
  tool: ToolMode;
  reducedMotion: boolean;
  generationPulse: number;
  printMode: boolean;
  doorPlacements: DoorPlacement[];
  theme: AppTheme;
  aisleWidth: number;
  podiumPosition: CanvasPoint;
  onSelectionChange: (studentIds: string[]) => void;
  onSwap: (fromSeatId: string, toSeatId: string) => void;
  onMoveStudentGroup: (sourceSeatIds: string[], targetSeatIds: string[]) => void;
  onSeatStudent: (studentId: string, seatId: string) => void;
  onAddSeat: (position: CanvasPoint) => void;
  onMoveSeat: (seatId: string, position: CanvasPoint) => void;
  onClearSeat: (seatId: string) => void;
  onAisleWidthChange: (width: number) => void;
  onMovePodium: (position: CanvasPoint) => void;
  onToolFeedback: (message: string) => void;
  onToggleSeatDisabled: (seatId: string) => void;
  onToggleClassRepresentative: (studentId: string) => void;
  onAddStudentTag: (studentId: string, tag: string) => void;
  onToggleGuardianSeat: (side: "left" | "right") => void;
}

function drawDashedRect(graphic: Graphics, x: number, y: number, width: number, height: number, color: number, alpha = 1) {
  const dash = 8;
  const gap = 6;
  const line = (x1: number, y1: number, x2: number, y2: number) => drawDashedLine(graphic, x1, y1, x2, y2, dash, gap);

  line(x, y, x + width, y);
  line(x + width, y, x + width, y + height);
  line(x + width, y + height, x, y + height);
  line(x, y + height, x, y);
  graphic.stroke({ width: 1.2, color, alpha });
}

function drawDashedLine(
  graphic: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash = 9,
  gap = 6,
) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  if (distance === 0) return;
  const dx = (x2 - x1) / distance;
  const dy = (y2 - y1) / distance;
  for (let cursor = 0; cursor < distance; cursor += dash + gap) {
    const end = Math.min(cursor + dash, distance);
    graphic.moveTo(x1 + dx * cursor, y1 + dy * cursor);
    graphic.lineTo(x1 + dx * end, y1 + dy * end);
  }
}

const relationshipStyles: Record<ConstraintType, { tone: "blue" | "coral" | "green"; dashed: boolean; marker: string }> = {
  desk_mate: { tone: "blue", dashed: false, marker: "同" },
  not_desk_mate: { tone: "coral", dashed: true, marker: "非" },
  adjacent: { tone: "green", dashed: false, marker: "邻" },
  not_adjacent: { tone: "coral", dashed: true, marker: "离" },
};

function previewPairs(type: ConstraintType, studentIds: string[]): StudentPair[] {
  if (type === "not_desk_mate" || type === "not_adjacent") return allPairs(studentIds);
  const unique = [...new Set(studentIds)];
  const pairs: StudentPair[] = [];
  for (let index = 0; index + 1 < unique.length; index += 2) {
    pairs.push({ a: unique[index], b: unique[index + 1] });
  }
  return pairs;
}

function makeLabel(text: string, size: number, color = COLORS.ink, weight: "400" | "500" | "600" = "500") {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: size,
      fontWeight: weight,
      fill: color,
    }),
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, interval = 12) {
  return Math.round(value / interval) * interval;
}

export function ClassroomCanvas({
  students,
  seats,
  assignments,
  selectedStudentIds,
  constraints,
  previewRuleType,
  tool,
  reducedMotion,
  generationPulse,
  printMode,
  doorPlacements,
  theme,
  aisleWidth,
  podiumPosition,
  onSelectionChange,
  onSwap,
  onMoveStudentGroup,
  onSeatStudent,
  onAddSeat,
  onMoveSeat,
  onClearSeat,
  onAisleWidthChange,
  onMovePodium,
  onToolFeedback,
  onToggleSeatDisabled,
  onToggleClassRepresentative,
  onAddStudentTag,
  onToggleGuardianSeat,
}: ClassroomCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const appRef = useRef<Application | null>(null);
  const rootRef = useRef<Container | null>(null);
  const seatPositionsRef = useRef<Map<string, SeatPosition>>(new Map());
  const tokenNodesRef = useRef<Map<string, Container>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const groupDragRef = useRef<GroupDragState | null>(null);
  const lassoRef = useRef<LassoState | null>(null);
  const seatDragRef = useRef<SeatDragState | null>(null);
  const aisleDragRef = useRef<AisleDragState | null>(null);
  const podiumDragRef = useRef<PodiumDragState | null>(null);
  const groupCountRef = useRef(0);
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const editingCameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const previousPrintModeRef = useRef(printMode);
  const panRef = useRef<{ start: Point; origin: Point } | null>(null);
  const redrawRef = useRef<() => void>(() => undefined);
  const finishDragRef = useRef<(event: FederatedPointerEvent) => void>(() => undefined);
  const finishGroupDragRef = useRef<() => void>(() => undefined);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef({
    aisleWidth,
    assignments,
    onAddSeat,
    onAisleWidthChange,
    onMovePodium,
    onMoveSeat,
    onSelectionChange,
    onToolFeedback,
    hasLeftGuardian: seats.some((seat) => seat.guardian === "left"),
    hasRightGuardian: seats.some((seat) => seat.guardian === "right"),
    podiumPosition,
    printMode,
    theme,
    tool,
  });
  const [zoom, setZoom] = useState(100);
  const [statusTooltip, setStatusTooltip] = useState<StatusTooltipState>();
  const [studentContextMenu, setStudentContextMenu] = useState<StudentContextMenuState>();
  const [toolHintVisible, setToolHintVisible] = useState(false);
  const [toolHintCountdown, setToolHintCountdown] = useState(10);

  latestRef.current = {
    aisleWidth,
    assignments,
    onAddSeat,
    onAisleWidthChange,
    onMovePodium,
    onMoveSeat,
    onSelectionChange,
    onToolFeedback,
    hasLeftGuardian: seats.some((seat) => seat.guardian === "left"),
    hasRightGuardian: seats.some((seat) => seat.guardian === "right"),
    podiumPosition,
    printMode,
    theme,
    tool,
  };

  useEffect(() => {
    if (tool === "select" || printMode) {
      setToolHintVisible(false);
      return;
    }

    const startedAt = Date.now();
    setToolHintCountdown(10);
    setToolHintVisible(true);
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((TOOL_HINT_DURATION_MS - (Date.now() - startedAt)) / 1000));
      setToolHintCountdown(remaining);
      if (remaining === 0) {
        setToolHintVisible(false);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [printMode, tool]);

  const openStudentContextMenu = useCallback((
    studentId: string,
    studentName: string,
    seatId: string,
    x: number,
    y: number,
  ) => {
    const app = appRef.current;
    if (!app) return;
    setStatusTooltip(undefined);
    setStudentContextMenu({
      studentId,
      studentName,
      seatId,
      x: clamp(x + 12, 12, Math.max(12, app.screen.width - 256)),
      y: clamp(y + 8, 12, Math.max(12, app.screen.height - 420)),
    });
  }, []);

  useEffect(() => {
    if (!studentContextMenu) return;

    const focusFrame = requestAnimationFrame(() => {
      contextMenuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    });
    const closeFromOutside = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setStudentContextMenu(undefined);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStudentContextMenu(undefined);
        requestAnimationFrame(() => stageRef.current?.focus());
      }
    };
    const closeMenu = () => setStudentContextMenu(undefined);
    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("keydown", closeFromKeyboard);
    window.addEventListener("resize", closeMenu);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("keydown", closeFromKeyboard);
      window.removeEventListener("resize", closeMenu);
    };
  }, [studentContextMenu]);

  const fitCanvas = useCallback(() => {
    const app = appRef.current;
    const root = rootRef.current;
    if (!app || !root) return;
    const scale = Math.min(app.screen.width / LOGICAL_WIDTH, app.screen.height / LOGICAL_HEIGHT) * 0.96;
    const x = (app.screen.width - LOGICAL_WIDTH * scale) / 2;
    const y = (app.screen.height - LOGICAL_HEIGHT * scale) / 2;
    cameraRef.current = { x, y, scale };
    root.position.set(x, y);
    root.scale.set(scale);
    setZoom(Math.round(scale * 100));
  }, []);

  const applyZoom = useCallback((factor: number, screenPoint?: Point) => {
    const root = rootRef.current;
    if (!root) return;
    const before = screenPoint ? root.toLocal(screenPoint) : new Point(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    const nextScale = clamp(cameraRef.current.scale * factor, 0.65, 1.5);
    root.scale.set(nextScale);
    if (screenPoint) {
      const after = root.toGlobal(before);
      root.position.x += screenPoint.x - after.x;
      root.position.y += screenPoint.y - after.y;
    }
    cameraRef.current = { x: root.position.x, y: root.position.y, scale: nextScale };
    setZoom(Math.round(nextScale * 100));
  }, []);

  const animateNode = useCallback((node: Container, from: Point, to: Point, delay: number, arcHeight: number, done?: () => void) => {
    const app = appRef.current;
    if (!app) return;
    const duration = reducedMotion ? 1 : 260;
    const startedAt = performance.now() + delay;
    const control = new Point((from.x + to.x) / 2, Math.min(from.y, to.y) - arcHeight);

    const tick = () => {
      if (node.destroyed) {
        app.ticker.remove(tick);
        return;
      }
      const elapsed = performance.now() - startedAt;
      if (elapsed < 0) return;
      const raw = clamp(elapsed / duration, 0, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      const inverse = 1 - eased;
      node.position.set(
        inverse * inverse * from.x + 2 * inverse * eased * control.x + eased * eased * to.x,
        inverse * inverse * from.y + 2 * inverse * eased * control.y + eased * eased * to.y,
      );
      node.scale.set(1 + Math.sin(Math.PI * raw) * 0.045);
      if (raw >= 1) {
        node.scale.set(1);
        app.ticker.remove(tick);
        done?.();
      }
    };
    app.ticker.add(tick);
  }, [reducedMotion]);

  const finishDrag = useCallback((event: FederatedPointerEvent) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    if (!drag || !root) return;
    dragRef.current = null;

    if (!drag.moved) {
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      if (additive) {
        onSelectionChange(
          selectedStudentIds.includes(drag.studentId)
            ? selectedStudentIds.filter((id) => id !== drag.studentId)
            : [...selectedStudentIds, drag.studentId],
        );
      } else {
        onSelectionChange([drag.studentId]);
      }
      drag.node.position.copyFrom(drag.startPosition);
      drag.node.zIndex = 10;
      return;
    }

    const pointer = root.toLocal(event.global);
    let nearest: SeatPosition | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    seatPositionsRef.current.forEach((position) => {
      if (position.seat.disabled) return;
      const distance = Math.hypot(
        pointer.x - (position.x + position.width / 2),
        pointer.y - (position.y + position.height / 2),
      );
      if (distance < nearestDistance) {
        nearest = position;
        nearestDistance = distance;
      }
    });

    const target = nearest;
    if (!target || target.seat.id === drag.seatId || nearestDistance > 88) {
      animateNode(drag.node, new Point(drag.node.x, drag.node.y), drag.startPosition, 0, 28, redrawRef.current);
      return;
    }

    const destination = new Point(target.x, target.y);
    const targetStudentId = assignments[target.seat.id];
    const targetNode = targetStudentId ? tokenNodesRef.current.get(targetStudentId) : undefined;
    const complete = () => onSwap(drag.seatId, target.seat.id);

    animateNode(drag.node, new Point(drag.node.x, drag.node.y), destination, 0, 54, complete);
    if (targetNode) {
      animateNode(targetNode, new Point(targetNode.x, targetNode.y), drag.startPosition, 0, 54);
    }
  }, [animateNode, assignments, onSelectionChange, onSwap, selectedStudentIds]);

  finishDragRef.current = finishDrag;

  const finishGroupDrag = useCallback(() => {
    const drag = groupDragRef.current;
    if (!drag) return;
    groupDragRef.current = null;

    const restore = () => {
      drag.frame.position.set(0, 0);
      drag.frame.zIndex = 5;
      drag.frame.cursor = "move";
      drag.members.forEach((member, index) => {
        animateNode(
          member.node,
          new Point(member.node.x, member.node.y),
          member.startPosition,
          0,
          28,
          index === drag.members.length - 1 ? redrawRef.current : undefined,
        );
      });
    };

    if (!drag.moved) {
      drag.frame.cursor = "move";
      return;
    }

    const availableSeats = [...seatPositionsRef.current.values()].filter((position) => !position.seat.disabled);
    const usedTargetSeatIds = new Set<string>();
    const targets: SeatPosition[] = [];

    for (const member of drag.members) {
      const desiredCenterX = member.startPosition.x + drag.offset.x + member.width / 2;
      const desiredCenterY = member.startPosition.y + drag.offset.y + member.height / 2;
      let nearest: SeatPosition | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;
      availableSeats.forEach((position) => {
        if (usedTargetSeatIds.has(position.seat.id)) return;
        const distance = Math.hypot(
          desiredCenterX - (position.x + position.width / 2),
          desiredCenterY - (position.y + position.height / 2),
        );
        if (distance < nearestDistance) {
          nearest = position;
          nearestDistance = distance;
        }
      });
      if (!nearest || nearestDistance > 88) {
        onToolFeedback("目标区域没有足够座位，已保留原位置");
        restore();
        return;
      }
      targets.push(nearest);
      usedTargetSeatIds.add(nearest.seat.id);
    }

    const sourceSeatIds = drag.members.map((member) => member.seatId);
    const targetSeatIds = targets.map((position) => position.seat.id);
    if (targetSeatIds.every((seatId, index) => seatId === sourceSeatIds[index])) {
      restore();
      return;
    }

    const sourceSet = new Set(sourceSeatIds);
    const targetSet = new Set(targetSeatIds);
    const sourceOnlyMembers = drag.members.filter((member) => !targetSet.has(member.seatId));
    const targetOnlyPositions = targets.filter((position) => !sourceSet.has(position.seat.id));

    drag.frame.eventMode = "none";
    drag.frame.removeFromParent();
    drag.frame.destroy();

    targetOnlyPositions.forEach((position, index) => {
      const displacedStudentId = assignments[position.seat.id];
      const displacedNode = displacedStudentId ? tokenNodesRef.current.get(displacedStudentId) : undefined;
      const destination = sourceOnlyMembers[index]?.startPosition;
      if (displacedNode && destination) {
        animateNode(displacedNode, new Point(displacedNode.x, displacedNode.y), destination, 0, 54);
      }
    });

    drag.members.forEach((member, index) => {
      const target = targets[index];
      animateNode(
        member.node,
        new Point(member.node.x, member.node.y),
        new Point(target.x, target.y),
        0,
        54,
        index === drag.members.length - 1
          ? () => onMoveStudentGroup(sourceSeatIds, targetSeatIds)
          : undefined,
      );
    });
  }, [animateNode, assignments, onMoveStudentGroup, onToolFeedback]);

  finishGroupDragRef.current = finishGroupDrag;

  const drawScene = useCallback(() => {
    const app = appRef.current;
    const root = rootRef.current;
    if (!app || !root) return;

    const removed = root.removeChildren();
    removed.forEach((child) => child.destroy({ children: true }));
    seatPositionsRef.current.clear();
    tokenNodesRef.current.clear();
    root.sortableChildren = true;
    const palette = theme === "cute" ? CUTE_COLORS : COLORS;

    const background = new Graphics();
    background.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).fill({ color: palette.paper, alpha: 0.18 });
    root.addChild(background);

    const frontGuide = makeLabel("教室前方 · BLACKBOARD", 14, 0x77756f, "500");
    frontGuide.position.set(24, 22);
    frontGuide.alpha = 0.72;
    root.addChild(frontGuide);

    const hasLeftGuardian = seats.some((seat) => seat.guardian === "left");
    const hasRightGuardian = seats.some((seat) => seat.guardian === "right");
    const podiumMinX = hasLeftGuardian ? 140 : 54;
    const podiumMaxX = hasRightGuardian ? 832 : LOGICAL_WIDTH - 200;
    const resolvedPodiumX = clamp(podiumPosition.x, podiumMinX, podiumMaxX);
    const podium = new Container();
    const podiumBody = new Graphics();
    podiumBody.roundRect(0, 0, 146, 62, 7).fill({ color: palette.paper }).stroke({ width: 1.5, color: palette.ink });
    if (theme === "cute") {
      podiumBody.moveTo(13, 1).lineTo(24, -12).lineTo(39, 1)
        .moveTo(107, 1).lineTo(122, -12).lineTo(133, 1)
        .stroke({ width: 1.5, color: palette.ink, alpha: 0.82 });
    }
    podiumBody.moveTo(12, 50).lineTo(134, 50).stroke({ width: 1, color: palette.line });
    podiumBody.moveTo(18, 62).lineTo(24, 72).lineTo(122, 72).lineTo(128, 62).stroke({ width: 1.4, color: palette.ink });
    const podiumText = makeLabel("讲台", 17, palette.ink, "600");
    podiumText.anchor.set(0.5);
    podiumText.position.set(73, 28);
    podium.addChild(podiumBody, podiumText);
    podium.position.set(resolvedPodiumX, podiumPosition.y);
    podium.eventMode = !printMode && tool === "podium" ? "static" : "none";
    podium.cursor = !printMode && tool === "podium" ? "grab" : "default";
    podium.hitArea = new Rectangle(0, 0, 146, 74);
    if (!printMode && tool === "podium") {
      podiumBody.tint = palette.blueSoft;
      podium.on("pointerdown", (event: FederatedPointerEvent) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const pointer = root.toLocal(event.global);
        podiumDragRef.current = {
          startPointer: pointer,
          pointerOffset: new Point(pointer.x - podium.x, pointer.y - podium.y),
          startPosition: new Point(podium.x, podium.y),
          node: podium,
          moved: false,
        };
        podium.cursor = "grabbing";
      });
    }
    root.addChild(podium);

    if (!printMode) {
      (["left", "right"] as const).forEach((side) => {
        if (side === "left" ? hasLeftGuardian : hasRightGuardian) return;
        const addButton = new Container();
        addButton.position.set(
          side === "left" ? resolvedPodiumX - 54 : resolvedPodiumX + 166,
          podiumPosition.y + 12,
        );
        addButton.zIndex = 50;
        addButton.eventMode = "static";
        addButton.cursor = "pointer";
        addButton.hitArea = new Rectangle(-5, -5, 44, 58);

        const buttonSurface = new Graphics();
        const drawSurface = (active = false) => {
          buttonSurface.clear();
          buttonSurface.circle(17, 17, 16)
            .fill({ color: active ? palette.blueSoft : palette.paper, alpha: 0.98 })
            .stroke({ width: 1.5, color: palette.blue, alpha: active ? 1 : 0.72 });
          buttonSurface.moveTo(11, 17).lineTo(23, 17).moveTo(17, 11).lineTo(17, 23)
            .stroke({ width: 2, color: palette.blue });
        };
        drawSurface();
        const buttonLabel = makeLabel(side === "left" ? "左护法" : "右护法", 9, palette.blue, "600");
        buttonLabel.anchor.set(0.5);
        buttonLabel.position.set(17, 43);
        addButton.addChild(buttonSurface, buttonLabel);
        addButton.on("pointerover", () => drawSurface(true));
        addButton.on("pointerout", () => drawSurface(false));
        addButton.on("pointerdown", (event: FederatedPointerEvent) => event.stopPropagation());
        addButton.on("pointertap", (event: FederatedPointerEvent) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          onToggleGuardianSeat(side);
        });
        root.addChild(addButton);
      });
    }

    doorPlacements.forEach((placement) => {
      const door = new Container();
      const doorGraphic = new Graphics();
      doorGraphic.moveTo(0, 0).lineTo(40, 0).stroke({ width: 4, color: palette.ink, alpha: 0.76 });
      doorGraphic.moveTo(0, 0).lineTo(28, 22).stroke({ width: 2, color: palette.ink, alpha: 0.76 });
      doorGraphic.arc(0, 0, 28, 0, Math.PI / 4).stroke({ width: 1, color: palette.line, alpha: 0.9 });
      const doorAtLeft = placement.includes("left");
      const doorAtFront = placement.includes("front");
      const doorLabel = makeLabel(doorAtFront ? "前门" : "后门", 13, palette.coral, "600");
      doorLabel.position.set(5, 25);
      door.addChild(doorGraphic, doorLabel);
      door.position.set(doorAtLeft ? 28 : LOGICAL_WIDTH - 68, doorAtFront ? 112 : LOGICAL_HEIGHT - 54);
      if (!doorAtLeft) {
        door.scale.x = -1;
        doorLabel.scale.x = -1;
        doorLabel.position.x = -35;
      }
      root.addChild(door);
    });

    const classroomSeats = seats.filter((seat) => !seat.guardian);
    const guardianSeats = seats.filter((seat) => seat.guardian);
    const groupCount = classroomSeats.length ? Math.max(...classroomSeats.map((seat) => seat.group)) + 1 : 0;
    groupCountRef.current = groupCount;
    const gridSeats = classroomSeats.filter((seat) => seat.canvasX === undefined);
    const columnCount = gridSeats.length ? Math.max(...gridSeats.map((seat) => seat.column)) + 1 : 2;
    const rowCount = gridSeats.length ? Math.max(...gridSeats.map((seat) => seat.row)) + 1 : 0;
    const groupWidth = groupCount
      ? Math.min(
        MAX_GRID_GROUP_WIDTH,
        (LOGICAL_WIDTH - LAYOUT_HORIZONTAL_GUTTER - Math.max(0, groupCount - 1) * aisleWidth) / groupCount,
      )
      : MAX_GRID_GROUP_WIDTH;
    const layoutWidth = groupCount * groupWidth + Math.max(0, groupCount - 1) * aisleWidth;
    const layoutLeft = (LOGICAL_WIDTH - layoutWidth) / 2;
    const groupPlacements = Array.from({ length: groupCount }, (_, group) => ({
      group,
      x: layoutLeft + group * (groupWidth + aisleWidth),
      width: groupWidth,
    }));
    const guardianSeatWidth = STANDARD_SEAT_WIDTH;
    const guardianPlacements = guardianSeats.map((seat) => ({
      group: seat.group,
      x: seat.guardian === "left"
        ? resolvedPodiumX - guardianSeatWidth - 18
        : resolvedPodiumX + 146 + 18,
      width: guardianSeatWidth,
    }));
    const seatPlacements = [...groupPlacements, ...guardianPlacements];
    const gridSeatWidth = (groupWidth - 12 - Math.max(0, columnCount - 1) * 2) / columnCount;
    const rowGap = rowCount > 7 ? 7 : 14;
    const gridSeatHeight = rowCount
      ? Math.min(54, (450 - Math.max(0, rowCount - 1) * rowGap) / rowCount)
      : 54;
    const groupTop = rowCount > 7 ? 158 : 184;
    const studentMap = new Map(students.map((student) => [student.id, student]));
    const studentRuleCounts = new Map<string, number>();
    constraints.forEach((constraint) => {
      studentRuleCounts.set(constraint.pair.a, (studentRuleCounts.get(constraint.pair.a) ?? 0) + 1);
      studentRuleCounts.set(constraint.pair.b, (studentRuleCounts.get(constraint.pair.b) ?? 0) + 1);
    });
    const studentPositions = new Map<string, Point>();

    if (!seats.length) {
      const emptyTitle = makeLabel("空白自定义画布", 24, palette.ink, "600");
      emptyTitle.anchor.set(0.5);
      emptyTitle.position.set(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 10);
      const emptyNote = makeLabel("使用左侧“座位”工具开始添加座位", 13, 0x77756f, "500");
      emptyNote.anchor.set(0.5);
      emptyNote.position.set(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 24);
      root.addChild(emptyTitle, emptyNote);
    }

    if (tool === "aisle" && groupPlacements.length > 1) {
      groupPlacements.slice(0, -1).forEach((placement, index) => {
        const nextPlacement = groupPlacements[index + 1];
        const gapX = placement.x + placement.width;
        const guide = new Graphics();
        guide.roundRect(gapX + 3, groupTop - 20, Math.max(8, nextPlacement.x - gapX - 6), 500, 8)
          .fill({ color: palette.blue, alpha: 0.055 })
          .stroke({ width: 1.2, color: palette.blue, alpha: 0.34 });
        root.addChild(guide);

        const widthLabel = makeLabel(`${Math.round(aisleWidth)} px`, 13, palette.blue, "600");
        widthLabel.anchor.set(0.5);
        widthLabel.position.set((gapX + nextPlacement.x) / 2, groupTop - 31);
        root.addChild(widthLabel);
      });
    }

    seatPlacements.forEach((placement) => {
      const groupSeats = seats.filter((seat) => seat.group === placement.group);
      const gridGroupSeats = groupSeats.filter((seat) => seat.canvasX === undefined && !seat.guardian);
      if (gridGroupSeats.length) {
        const groupRows = Math.max(...gridGroupSeats.map((seat) => seat.row)) + 1;
        const groupFrame = new Graphics();
        drawDashedRect(
          groupFrame,
          placement.x,
          groupTop - 18,
          placement.width,
          groupRows * gridSeatHeight + Math.max(0, groupRows - 1) * rowGap + 28,
          palette.line,
          0.8,
        );
        root.addChild(groupFrame);

        const groupLabel = makeLabel(`第 ${placement.group + 1} 大组`, 14, 0x7b7972, "500");
        groupLabel.position.set(placement.x + 8, groupTop - 37);
        root.addChild(groupLabel);
      }

      groupSeats.forEach((seat) => {
        const seatWidth = seat.guardian || seat.canvasX !== undefined ? STANDARD_SEAT_WIDTH : gridSeatWidth;
        const seatHeight = seat.guardian || seat.canvasY !== undefined ? 54 : gridSeatHeight;
        const x = seat.guardian ? placement.x : seat.canvasX ?? placement.x + 6 + seat.column * (seatWidth + 2);
        const y = seat.guardian ? podiumPosition.y + 5 : seat.canvasY ?? groupTop + seat.row * (gridSeatHeight + rowGap);
        const seatPosition = { seat, x, y, width: seatWidth, height: seatHeight };
        seatPositionsRef.current.set(seat.id, seatPosition);

        const beginSeatDrag = (event: FederatedPointerEvent) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          if (seat.guardian) {
            onToolFeedback("护法座固定在讲台两侧，可点击座位外侧的减号移除");
            return;
          }
          if (seat.disabled) {
            onToggleSeatDisabled(seat.id);
            return;
          }
          const pointer = root.toLocal(event.global);
          const ghost = new Graphics();
          ghost.roundRect(0, 0, seatWidth, seatHeight, 8)
            .fill({ color: palette.blue, alpha: 0.1 })
            .stroke({ width: 2, color: palette.blue, alpha: 0.9 });
          ghost.position.set(x, y);
          ghost.zIndex = 600;
          root.addChild(ghost);
          seatDragRef.current = {
            seatId: seat.id,
            width: seatWidth,
            height: seatHeight,
            startPointer: pointer,
            pointerOffset: new Point(pointer.x - x, pointer.y - y),
            startPosition: new Point(x, y),
            currentPosition: new Point(x, y),
            graphic: ghost,
            moved: false,
          };
        };

        const base = new Graphics();
        const disabledFill = theme === "cute" ? 0xece7e9 : 0xe6e5e1;
        const disabledStroke = theme === "cute" ? 0xc9c0c3 : 0xbdbbb5;
        const disabledInk = theme === "cute" ? 0x82777b : 0x777670;
        base.roundRect(x, y, seatWidth, seatHeight, 7)
          .fill({ color: seat.disabled ? disabledFill : seat.guardian ? palette.blueSoft : palette.paperMuted, alpha: seat.disabled ? 0.94 : seat.guardian ? 0.92 : 0.72 })
          .stroke({ width: seat.guardian ? 1.4 : 1, color: seat.disabled ? disabledStroke : seat.guardian ? palette.blue : palette.faint });
        const seatEditing = !printMode && (tool === "seat" || tool === "empty" || tool === "disabled");
        base.eventMode = seatEditing ? "static" : "none";
        base.cursor = tool === "seat" ? seat.guardian ? "not-allowed" : "move" : seatEditing ? "pointer" : "default";
        if (tool === "seat") {
          base.on("pointerdown", beginSeatDrag);
        } else if (tool === "empty") {
          base.on("pointerdown", (event: FederatedPointerEvent) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            if (!seat.disabled) onClearSeat(seat.id);
          });
        } else if (tool === "disabled") {
          base.on("pointerdown", (event: FederatedPointerEvent) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            onToggleSeatDisabled(seat.id);
          });
        }
        root.addChild(base);

        if (seat.guardian) {
          const guardianLabel = makeLabel(seat.guardian === "left" ? "左护法" : "右护法", 13, palette.blue, "600");
          guardianLabel.anchor.set(0.5);
          guardianLabel.position.set(x + seatWidth / 2, y - 9);
          root.addChild(guardianLabel);

          if (!printMode) {
            const removeButton = new Container();
            removeButton.position.set(
              seat.guardian === "left" ? x - 12 : x + seatWidth + 12,
              y + seatHeight / 2,
            );
            removeButton.zIndex = 50;
            removeButton.eventMode = "static";
            removeButton.cursor = "pointer";
            removeButton.hitArea = new Rectangle(-14, -14, 28, 28);
            const removeSurface = new Graphics();
            removeSurface.circle(0, 0, 10)
              .fill({ color: palette.paper, alpha: 0.98 })
              .stroke({ width: 1.3, color: palette.coral, alpha: 0.76 });
            removeSurface.moveTo(-4, 0).lineTo(4, 0).stroke({ width: 1.8, color: palette.coral });
            removeButton.addChild(removeSurface);
            removeButton.on("pointerdown", (event: FederatedPointerEvent) => event.stopPropagation());
            removeButton.on("pointertap", (event: FederatedPointerEvent) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              onToggleGuardianSeat(seat.guardian!);
            });
            root.addChild(removeButton);
          }
        }

        if (seat.disabled) {
          const disabledMark = makeLabel("×", Math.max(11, Math.min(14, seatWidth / 7)), disabledInk, "600");
          disabledMark.anchor.set(0.5);
          disabledMark.alpha = 0.72;
          disabledMark.position.set(x + seatWidth / 2, y + seatHeight / 2 - 1);
          root.addChild(disabledMark);
          return;
        }

        const studentId = assignments[seat.id];
        if (!studentId) {
          const empty = new Graphics();
          drawDashedRect(empty, x + 4, y + 4, seatWidth - 8, seatHeight - 8, palette.line, 0.72);
          root.addChild(empty);
          return;
        }

        const student = studentMap.get(studentId);
        if (!student) return;
        studentPositions.set(studentId, new Point(x + seatWidth / 2, y + seatHeight / 2));
        const selectedIndex = selectedStudentIds.indexOf(studentId);
        const selected = selectedIndex >= 0;
        const token = new Container();
        token.zIndex = selected ? 20 : 10;
        token.position.set(x, y);
        token.eventMode = printMode ? "none" : "static";
        token.cursor = printMode ? "default" : tool === "select" ? "grab" : tool === "seat" ? seat.guardian ? "not-allowed" : "move" : tool === "empty" || tool === "disabled" ? "pointer" : "default";
        token.hitArea = new Rectangle(0, 0, seatWidth, seatHeight);

        if (selected) {
          const halo = new Graphics();
          halo.roundRect(-5, -5, seatWidth + 10, seatHeight + 10, 10)
            .stroke({ width: 2, color: palette.blue, alpha: 0.18 });
          token.addChild(halo);
        }

        const card = new Graphics();
        card.roundRect(0, 0, seatWidth, seatHeight, 7)
          .fill({ color: selected ? palette.blueSoft : palette.paper })
          .stroke({ width: selected ? 2 : 1.15, color: selected ? palette.blue : palette.ink });
        token.addChild(card);

        const ruleCount = studentRuleCounts.get(studentId) ?? 0;
        const compactSeat = seatHeight < 42 || seatWidth < 78;
        const statusKinds: Array<"representative" | "rule" | "tag"> = [];
        if (student.isClassRepresentative) statusKinds.push("representative");
        if (ruleCount > 0) statusKinds.push("rule");
        if (student.tags?.length) statusKinds.push("tag");
        const visibleStatusCount = Math.max(1, statusKinds.length);
        const statusGap = compactSeat ? 1 : 2;
        const maxStatusRadius = compactSeat ? 5.5 : 8;
        const statusRadius = Math.min(
          maxStatusRadius,
          (seatHeight - 8 - statusGap * (visibleStatusCount - 1)) / (visibleStatusCount * 2),
        );
        const statusDiameter = statusRadius * 2;
        const statusStackHeight = visibleStatusCount * statusDiameter + (visibleStatusCount - 1) * statusGap;
        const statusStartY = (seatHeight - statusStackHeight) / 2 + statusRadius;
        const statusX = compactSeat ? 8 : 12;
        const statusY = (kind: "representative" | "rule" | "tag") => (
          statusStartY + statusKinds.indexOf(kind) * (statusDiameter + statusGap)
        );
        const addStatusMarker = (kind: "representative" | "rule" | "tag", label: string, color: number) => {
          const marker = new Container();
          marker.position.set(statusX, statusY(kind));
          const markerBall = new Graphics();
          markerBall.circle(0, 0, statusRadius)
            .fill({ color })
            .stroke({ width: compactSeat ? 1 : 1.5, color: palette.paper });
          const markerText = makeLabel(label, Math.max(6, Math.min(9, statusRadius + 1)), 0xffffff, "600");
          markerText.anchor.set(0.5);
          markerText.position.set(0, -0.5);
          marker.addChild(markerBall, markerText);
          token.addChild(marker);
          return marker;
        };
        const attachStatusTooltip = (
          marker: Container,
          title: string,
          items: string[],
          hiddenCount = 0,
          itemDisplay: StatusTooltipState["itemDisplay"] = "text",
        ) => {
          if (printMode) return;
          marker.eventMode = "static";
          marker.cursor = "help";
          const hitHalfHeight = statusRadius + statusGap / 2;
          marker.hitArea = new Rectangle(
            -statusX,
            -hitHalfHeight,
            compactSeat ? 20 : 25,
            hitHalfHeight * 2,
          );
          const updateTooltip = (event: FederatedPointerEvent) => {
            const screenWidth = app.screen.width;
            const screenHeight = app.screen.height;
            setStatusTooltip({
              x: clamp(event.global.x + 16, 12, Math.max(12, screenWidth - 224)),
              y: clamp(event.global.y, 34, Math.max(34, screenHeight - 82)),
              title,
              items,
              hiddenCount,
              itemDisplay,
            });
          };
          marker.on("pointerover", updateTooltip);
          marker.on("pointermove", updateTooltip);
          marker.on("pointerout", () => setStatusTooltip(undefined));
        };

        const placeholderColor = student.gender === "女"
          ? 0xc95f78
          : student.gender === "男"
            ? 0x4e77a9
            : 0x8b8c86;
        if (statusKinds.length === 0) {
          const placeholder = new Graphics();
          placeholder.circle(statusX, seatHeight / 2, compactSeat ? 2.2 : 3.5)
            .stroke({ width: compactSeat ? 1 : 1.25, color: placeholderColor, alpha: 0.7 });
          token.addChild(placeholder);
        }

        if (student.isClassRepresentative) {
          const representativeMarker = addStatusMarker("representative", "课", theme === "cute" ? 0xe28a45 : 0xc98118);
          attachStatusTooltip(representativeMarker, `${student.name} · 课代表`, ["已标记为课代表"]);
        }

        if (ruleCount > 0) {
          const relatedRules = constraints.filter((constraint) => (
            constraint.pair.a === studentId || constraint.pair.b === studentId
          ));
          const tooltipItems = relatedRules.slice(0, 3).map((constraint) => {
            const peerId = constraint.pair.a === studentId ? constraint.pair.b : constraint.pair.a;
            return `${ruleLabels[constraint.type]} · ${studentMap.get(peerId)?.name ?? "未知学生"}`;
          });
          const ruleMarker = addStatusMarker("rule", "规", palette.blue);
          attachStatusTooltip(
            ruleMarker,
            `${student.name} · ${relatedRules.length} 条规则`,
            tooltipItems,
            Math.max(0, relatedRules.length - tooltipItems.length),
          );
        }

        if (student.tags?.length) {
          const tagItems = student.tags.slice(0, 3);
          const tagMarker = addStatusMarker("tag", "标", palette.green);
          attachStatusTooltip(
            tagMarker,
            `${student.name} · ${student.tags.length} 个标签`,
            tagItems,
            Math.max(0, student.tags.length - tagItems.length),
            "tag",
          );
        }

        const contentLeft = compactSeat ? 20 : 25;
        const contentRight = seatWidth - (compactSeat ? 7 : 9);
        const contentWidth = Math.max(30, contentRight - contentLeft);
        const contentCenterX = contentLeft + contentWidth / 2;
        const nameColor = student.gender === "男"
          ? 0x4e77a9
          : student.gender === "女"
            ? 0xd15f7a
            : palette.ink;
        const nameLabel = makeLabel(student.name, compactSeat ? 13 : 18, nameColor, selected ? "600" : "500");
        const nameNaturalWidth = nameLabel.width;
        const nameScale = nameNaturalWidth > contentWidth ? contentWidth / nameNaturalWidth : 1;
        const nameY = seatHeight / 2 - (compactSeat ? 5 : 7);
        nameLabel.anchor.set(0.5);
        nameLabel.scale.set(nameScale);
        nameLabel.position.set(contentCenterX, nameY);
        token.addChild(nameLabel);

        const studentNoLabel = makeLabel(
          student.studentNo || "未填写",
          compactSeat ? 8 : 10,
          palette.ink,
          "500",
        );
        studentNoLabel.anchor.set(0.5);
        studentNoLabel.alpha = student.studentNo ? 0.58 : 0.42;
        if (studentNoLabel.width > contentWidth) studentNoLabel.scale.set(contentWidth / studentNoLabel.width);
        studentNoLabel.position.set(contentCenterX, seatHeight / 2 + (compactSeat ? 7 : 11));
        token.addChild(studentNoLabel);

        if (selected) {
          const badge = new Graphics();
          badge.circle(seatWidth - 4, 4, 12).fill({ color: palette.blue }).stroke({ width: 2, color: 0xffffff });
          const badgeText = makeLabel(String(selectedIndex + 1), 12, 0xffffff, "600");
          badgeText.anchor.set(0.5);
          badgeText.position.set(seatWidth - 4, 3.5);
          token.addChild(badge, badgeText);
        }

        token.on("pointerdown", (event: FederatedPointerEvent) => {
          if (event.button !== 0) return;
          if (tool === "seat") {
            beginSeatDrag(event);
            return;
          }
          if (tool === "empty") {
            event.stopPropagation();
            onClearSeat(seat.id);
            return;
          }
          if (tool === "disabled") {
            event.stopPropagation();
            onToggleSeatDisabled(seat.id);
            return;
          }
          if (tool !== "select") return;
          event.stopPropagation();
          dragRef.current = {
            studentId,
            seatId: seat.id,
            node: token,
            startPointer: event.global.clone(),
            startPosition: new Point(token.x, token.y),
            moved: false,
          };
          token.cursor = "grabbing";
        });
        token.on("rightclick", (event: FederatedPointerEvent) => {
          if (printMode) return;
          event.stopPropagation();
          openStudentContextMenu(studentId, student.name, seat.id, event.global.x, event.global.y);
        });

        tokenNodesRef.current.set(studentId, token);
        root.addChild(token);
      });
    });

    const addRelationship = (
      pair: StudentPair,
      type: ConstraintType,
      preview: boolean,
      index: number,
    ) => {
      const from = studentPositions.get(pair.a);
      const to = studentPositions.get(pair.b);
      if (!from || !to) return;
      const style = relationshipStyles[type];
      const styleColor = palette[style.tone];
      const line = new Graphics();
      if (style.dashed) {
        drawDashedLine(line, from.x, from.y, to.x, to.y, preview ? 11 : 7, preview ? 6 : 7);
      } else {
        line.moveTo(from.x, from.y).lineTo(to.x, to.y);
      }
      line.stroke({
        width: preview ? 2.5 : 1.35,
        color: styleColor,
        alpha: preview ? 0.92 : 0.38,
      });
      line.zIndex = preview ? 7 : 4;
      root.addChild(line);

      if (!preview) return;
      const marker = new Container();
      const markerX = (from.x + to.x) / 2;
      const markerY = (from.y + to.y) / 2 + (index % 3 - 1) * 4;
      const markerBackground = new Graphics();
      markerBackground.circle(0, 0, 10).fill({ color: palette.paper }).stroke({ width: 2, color: styleColor });
      const markerText = makeLabel(style.marker, 12, styleColor, "600");
      markerText.anchor.set(0.5);
      markerText.position.set(0, -0.5);
      marker.addChild(markerBackground, markerText);
      marker.position.set(markerX, markerY);
      marker.zIndex = 30;
      root.addChild(marker);
    };

    constraintsForSelectedStudents(constraints, selectedStudentIds).forEach((constraint, index) => {
      addRelationship(constraint.pair, constraint.type, false, index);
    });
    if (previewRuleType && selectedStudentIds.length >= 2) {
      previewPairs(previewRuleType, selectedStudentIds).forEach((pair, index) => {
        addRelationship(pair, previewRuleType, true, index);
      });
    }

    const selectedPositions = [...seatPositionsRef.current.values()].filter((position) => {
      const studentId = assignments[position.seat.id];
      return studentId ? selectedStudentIds.includes(studentId) : false;
    });
    if (selectedPositions.length > 1) {
      const minX = Math.min(...selectedPositions.map((position) => position.x)) - 12;
      const minY = Math.min(...selectedPositions.map((position) => position.y)) - 12;
      const maxX = Math.max(...selectedPositions.map((position) => position.x + position.width)) + 12;
      const maxY = Math.max(...selectedPositions.map((position) => position.y + position.height)) + 12;
      const selectionFrame = new Graphics();
      drawDashedRect(selectionFrame, minX, minY, maxX - minX, maxY - minY, palette.blue, 0.9);
      selectionFrame.zIndex = 5;
      if (!printMode && tool === "select") {
        selectionFrame.eventMode = "static";
        selectionFrame.cursor = "move";
        selectionFrame.hitArea = new Rectangle(minX, minY, maxX - minX, maxY - minY);
        selectionFrame.on("pointerdown", (event: FederatedPointerEvent) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          const members = selectedPositions.flatMap<GroupDragMember>((position) => {
            const studentId = assignments[position.seat.id];
            const node = studentId ? tokenNodesRef.current.get(studentId) : undefined;
            if (!studentId || !node) return [];
            return [{
              studentId,
              seatId: position.seat.id,
              node,
              startPosition: new Point(node.x, node.y),
              width: position.width,
              height: position.height,
            }];
          });
          if (members.length < 2) return;
          selectionFrame.cursor = "grabbing";
          groupDragRef.current = {
            members,
            startPointer: root.toLocal(event.global),
            offset: new Point(0, 0),
            bounds: new Rectangle(minX, minY, maxX - minX, maxY - minY),
            frame: selectionFrame,
            moved: false,
          };
        });
      }
      root.addChild(selectionFrame);
    }

    root.position.set(cameraRef.current.x, cameraRef.current.y);
    root.scale.set(cameraRef.current.scale);
  }, [
    aisleWidth,
    assignments,
    constraints,
    doorPlacements,
    onClearSeat,
    openStudentContextMenu,
    onToggleGuardianSeat,
    onToggleSeatDisabled,
    podiumPosition,
    previewRuleType,
    printMode,
    selectedStudentIds,
    seats,
    students,
    theme,
    tool,
  ]);

  redrawRef.current = drawScene;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let initialized = false;
    const app = new Application();

    void app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      preserveDrawingBuffer: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    }).then(() => {
      initialized = true;
      if (disposed) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      const root = new Container();
      rootRef.current = root;
      app.stage.addChild(root);
      host.appendChild(app.canvas);
      fitCanvas();
      redrawRef.current();

      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        if (latestRef.current.printMode) return;
        const groupDrag = groupDragRef.current;
        if (groupDrag && rootRef.current) {
          const pointer = rootRef.current.toLocal(event.global);
          const rawOffsetX = pointer.x - groupDrag.startPointer.x;
          const rawOffsetY = pointer.y - groupDrag.startPointer.y;
          if (Math.hypot(rawOffsetX, rawOffsetY) > 5) groupDrag.moved = true;
          if (groupDrag.moved) {
            const offsetX = clamp(
              rawOffsetX,
              16 - groupDrag.bounds.x,
              LOGICAL_WIDTH - 16 - groupDrag.bounds.x - groupDrag.bounds.width,
            );
            const offsetY = clamp(
              rawOffsetY,
              16 - groupDrag.bounds.y,
              LOGICAL_HEIGHT - 20 - groupDrag.bounds.y - groupDrag.bounds.height,
            );
            groupDrag.offset.set(offsetX, offsetY);
            groupDrag.frame.position.set(offsetX, offsetY);
            groupDrag.frame.zIndex = 90;
            groupDrag.members.forEach((member, index) => {
              member.node.position.set(member.startPosition.x + offsetX, member.startPosition.y + offsetY);
              member.node.zIndex = 100 + index;
            });
          }
          return;
        }

        const drag = dragRef.current;
        if (drag) {
          const distance = Math.hypot(event.global.x - drag.startPointer.x, event.global.y - drag.startPointer.y);
          if (distance > 5) drag.moved = true;
          if (drag.moved && rootRef.current) {
            const point = rootRef.current.toLocal(event.global);
            drag.node.position.set(point.x - 49, point.y - 27);
            drag.node.zIndex = 100;
          }
          return;
        }

        const seatDrag = seatDragRef.current;
        if (seatDrag && rootRef.current) {
          const pointer = rootRef.current.toLocal(event.global);
          const distance = Math.hypot(pointer.x - seatDrag.startPointer.x, pointer.y - seatDrag.startPointer.y);
          if (distance > 4) seatDrag.moved = true;
          if (seatDrag.moved) {
            const x = clamp(snap(pointer.x - seatDrag.pointerOffset.x), 16, LOGICAL_WIDTH - seatDrag.width - 16);
            const y = clamp(snap(pointer.y - seatDrag.pointerOffset.y), 126, LOGICAL_HEIGHT - seatDrag.height - 20);
            seatDrag.currentPosition.set(x, y);
            seatDrag.graphic.position.set(x, y);
          }
          return;
        }

        const podiumDrag = podiumDragRef.current;
        if (podiumDrag && rootRef.current) {
          const pointer = rootRef.current.toLocal(event.global);
          const distance = Math.hypot(pointer.x - podiumDrag.startPointer.x, pointer.y - podiumDrag.startPointer.y);
          if (distance > 4) podiumDrag.moved = true;
          if (podiumDrag.moved) {
            const minimumX = latestRef.current.hasLeftGuardian ? 140 : 54;
            const maximumX = latestRef.current.hasRightGuardian ? 832 : LOGICAL_WIDTH - 200;
            podiumDrag.node.position.set(
              clamp(snap(pointer.x - podiumDrag.pointerOffset.x), minimumX, maximumX),
              clamp(snap(pointer.y - podiumDrag.pointerOffset.y), 18, 112),
            );
          }
          return;
        }

        const aisleDrag = aisleDragRef.current;
        if (aisleDrag && rootRef.current) {
          const interactionColor = latestRef.current.theme === "cute" ? CUTE_COLORS.blue : COLORS.blue;
          const pointer = rootRef.current.toLocal(event.global);
          aisleDrag.width = clamp(snap(aisleDrag.startWidth + (pointer.x - aisleDrag.startPointerX) * 0.5, 2), 24, 120);
          aisleDrag.graphic.clear();
          aisleDrag.graphic.roundRect((LOGICAL_WIDTH - aisleDrag.width) / 2, 142, aisleDrag.width, 510, 8)
            .fill({ color: interactionColor, alpha: 0.12 })
            .stroke({ width: 2, color: interactionColor, alpha: 0.78 });
          aisleDrag.label.text = `${Math.round(aisleDrag.width)} px`;
          aisleDrag.label.position.x = LOGICAL_WIDTH / 2;
          return;
        }

        const pan = panRef.current;
        if (pan && rootRef.current) {
          rootRef.current.position.set(
            pan.origin.x + event.global.x - pan.start.x,
            pan.origin.y + event.global.y - pan.start.y,
          );
          cameraRef.current.x = rootRef.current.position.x;
          cameraRef.current.y = rootRef.current.position.y;
          return;
        }

        const lasso = lassoRef.current;
        if (lasso && rootRef.current) {
          const interactionColor = latestRef.current.theme === "cute" ? CUTE_COLORS.blue : COLORS.blue;
          lasso.current = rootRef.current.toLocal(event.global);
          const x = Math.min(lasso.start.x, lasso.current.x);
          const y = Math.min(lasso.start.y, lasso.current.y);
          const width = Math.abs(lasso.current.x - lasso.start.x);
          const height = Math.abs(lasso.current.y - lasso.start.y);
          lasso.graphic.clear();
          lasso.graphic.rect(x, y, width, height).fill({ color: interactionColor, alpha: 0.06 });
          drawDashedRect(lasso.graphic, x, y, width, height, interactionColor, 0.95);
        }
      });

      app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
        if (latestRef.current.printMode) return;
        if (!rootRef.current) return;
        const activeTool = latestRef.current.tool;
        if ((activeTool === "move" && event.button === 0) || event.button === 1) {
          panRef.current = {
            start: event.global.clone(),
            origin: new Point(rootRef.current.position.x, rootRef.current.position.y),
          };
          return;
        }
        if (event.button !== 0) return;
        const point = rootRef.current.toLocal(event.global);

        if (activeTool === "seat") {
          const sample = [...seatPositionsRef.current.values()][0];
          const width = sample?.width ?? STANDARD_SEAT_WIDTH;
          const height = sample?.height ?? 54;
          const x = clamp(snap(point.x - width / 2), 16, LOGICAL_WIDTH - width - 16);
          const y = clamp(snap(point.y - height / 2), 126, LOGICAL_HEIGHT - height - 20);
          const overlaps = [...seatPositionsRef.current.values()].some((position) => (
            x < position.x + position.width + 6
            && x + width + 6 > position.x
            && y < position.y + position.height + 6
            && y + height + 6 > position.y
          ));
          if (point.y < 118) {
            latestRef.current.onToolFeedback("座位需要放在讲台下方");
          } else if (overlaps) {
            latestRef.current.onToolFeedback("这里已有座位，请换一个空白位置");
          } else {
            latestRef.current.onAddSeat({ x, y });
          }
          return;
        }

        if (activeTool === "aisle") {
          const interactionColor = latestRef.current.theme === "cute" ? CUTE_COLORS.blue : COLORS.blue;
          if (groupCountRef.current < 2) {
            latestRef.current.onToolFeedback("至少需要两个大组才能调整过道");
            return;
          }
          const graphic = new Graphics();
          graphic.zIndex = 650;
          graphic.roundRect((LOGICAL_WIDTH - latestRef.current.aisleWidth) / 2, 142, latestRef.current.aisleWidth, 510, 8)
            .fill({ color: interactionColor, alpha: 0.12 })
            .stroke({ width: 2, color: interactionColor, alpha: 0.78 });
          const label = makeLabel(`${Math.round(latestRef.current.aisleWidth)} px`, 13, interactionColor, "600");
          label.anchor.set(0.5);
          label.position.set(LOGICAL_WIDTH / 2, 132);
          label.zIndex = 651;
          rootRef.current.addChild(graphic, label);
          aisleDragRef.current = {
            startPointerX: point.x,
            startWidth: latestRef.current.aisleWidth,
            width: latestRef.current.aisleWidth,
            graphic,
            label,
          };
          return;
        }

        if (activeTool === "podium") {
          const minimumX = latestRef.current.hasLeftGuardian ? 140 : 54;
          const maximumX = latestRef.current.hasRightGuardian ? 832 : LOGICAL_WIDTH - 200;
          latestRef.current.onMovePodium({
            x: clamp(snap(point.x - 73), minimumX, maximumX),
            y: clamp(snap(point.y - 31), 18, 112),
          });
          return;
        }

        if (activeTool !== "select") {
          if (activeTool === "empty") latestRef.current.onToolFeedback("请点击一个已有座位将其清空");
          if (activeTool === "disabled") latestRef.current.onToolFeedback("请点击一个已有座位切换禁用状态");
          return;
        }
        const graphic = new Graphics();
        graphic.zIndex = 500;
        rootRef.current.addChild(graphic);
        lassoRef.current = { start: point, current: point.clone(), graphic };
      });

      const completePointer = (event: FederatedPointerEvent) => {
        if (latestRef.current.printMode) return;
        if (event.button === 2) return;
        if (groupDragRef.current) {
          finishGroupDragRef.current();
          return;
        }
        if (dragRef.current) {
          finishDragRef.current(event);
          return;
        }
        const seatDrag = seatDragRef.current;
        if (seatDrag) {
          seatDragRef.current = null;
          seatDrag.graphic.destroy();
          if (!seatDrag.moved) return;
          const { x, y } = seatDrag.currentPosition;
          const overlaps = [...seatPositionsRef.current.values()].some((position) => (
            position.seat.id !== seatDrag.seatId
            && x < position.x + position.width + 6
            && x + seatDrag.width + 6 > position.x
            && y < position.y + position.height + 6
            && y + seatDrag.height + 6 > position.y
          ));
          if (overlaps) {
            latestRef.current.onToolFeedback("目标位置已有座位，已保留原位置");
          } else {
            latestRef.current.onMoveSeat(seatDrag.seatId, { x, y });
          }
          return;
        }
        const podiumDrag = podiumDragRef.current;
        if (podiumDrag) {
          podiumDragRef.current = null;
          podiumDrag.node.cursor = "grab";
          if (podiumDrag.moved) {
            latestRef.current.onMovePodium({ x: podiumDrag.node.x, y: podiumDrag.node.y });
          }
          return;
        }
        const aisleDrag = aisleDragRef.current;
        if (aisleDrag) {
          aisleDragRef.current = null;
          aisleDrag.graphic.destroy();
          aisleDrag.label.destroy();
          if (Math.abs(aisleDrag.width - aisleDrag.startWidth) >= 2) {
            latestRef.current.onAisleWidthChange(aisleDrag.width);
          }
          return;
        }
        if (panRef.current) {
          panRef.current = null;
          return;
        }
        const lasso = lassoRef.current;
        if (!lasso) return;
        lassoRef.current = null;
        const x = Math.min(lasso.start.x, lasso.current.x);
        const y = Math.min(lasso.start.y, lasso.current.y);
        const width = Math.abs(lasso.current.x - lasso.start.x);
        const height = Math.abs(lasso.current.y - lasso.start.y);
        lasso.graphic.destroy();
        if (width < 6 && height < 6) {
          latestRef.current.onSelectionChange([]);
          return;
        }
        const selected = [...seatPositionsRef.current.values()]
          .filter((position) => {
            const centerX = position.x + position.width / 2;
            const centerY = position.y + position.height / 2;
            return centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height;
          })
          .map((position) => latestRef.current.assignments[position.seat.id])
          .filter((studentId): studentId is string => Boolean(studentId));
        latestRef.current.onSelectionChange(selected);
      };
      app.stage.on("pointerup", completePointer);
      app.stage.on("pointerupoutside", completePointer);

      const handleWheel = (event: WheelEvent) => {
        if (latestRef.current.printMode) return;
        event.preventDefault();
        const bounds = app.canvas.getBoundingClientRect();
        applyZoom(event.deltaY < 0 ? 1.08 : 0.92, new Point(event.clientX - bounds.left, event.clientY - bounds.top));
      };
      app.canvas.addEventListener("wheel", handleWheel, { passive: false });
      (app.canvas as HTMLCanvasElement & { __banzhenWheel?: (event: WheelEvent) => void }).__banzhenWheel = handleWheel;
    });

    return () => {
      disposed = true;
      if (initialized) {
        const canvas = app.canvas as HTMLCanvasElement & { __banzhenWheel?: (event: WheelEvent) => void };
        if (canvas.__banzhenWheel) canvas.removeEventListener("wheel", canvas.__banzhenWheel);
        app.destroy(true, { children: true });
      }
      appRef.current = null;
      rootRef.current = null;
    };
  }, [applyZoom, fitCanvas]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  useEffect(() => {
    const wasPrintMode = previousPrintModeRef.current;
    previousPrintModeRef.current = printMode;
    if (wasPrintMode === printMode) return;

    const app = appRef.current;
    const root = rootRef.current;
    const host = hostRef.current;
    if (!app || !root || !host) return;

    if (printMode) editingCameraRef.current = { ...cameraRef.current };

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const currentApp = appRef.current;
        const currentRoot = rootRef.current;
        const currentHost = hostRef.current;
        if (!currentApp || !currentRoot || !currentHost) return;

        currentApp.renderer.resize(
          Math.max(1, currentHost.clientWidth),
          Math.max(1, currentHost.clientHeight),
        );
        currentApp.stage.hitArea = currentApp.screen;

        if (printMode) {
          fitCanvas();
        } else {
          const camera = editingCameraRef.current;
          cameraRef.current = { ...camera };
          currentRoot.position.set(camera.x, camera.y);
          currentRoot.scale.set(camera.scale);
          setZoom(Math.round(camera.scale * 100));
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [fitCanvas, printMode]);

  useEffect(() => {
    if (generationPulse <= 0 || !appRef.current) return;
    const positions = [...seatPositionsRef.current.values()];
    positions.forEach((position, index) => {
      const studentId = assignments[position.seat.id];
      const node = studentId ? tokenNodesRef.current.get(studentId) : undefined;
      if (!node) return;
      const origin = new Point(node.x, node.y);
      const delay = reducedMotion ? 0 : Math.max(0, position.seat.group) * 55 + position.seat.row * 18 + index * 2;
      animateNode(node, origin, origin, delay, 12);
    });
  }, [animateNode, assignments, generationPulse, reducedMotion]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (printMode) return;
    event.preventDefault();
    const studentId = event.dataTransfer.getData("application/x-banzhen-student");
    const root = rootRef.current;
    const app = appRef.current;
    if (!studentId || !root || !app) return;
    const bounds = app.canvas.getBoundingClientRect();
    const local = root.toLocal(new Point(event.clientX - bounds.left, event.clientY - bounds.top));
    const emptySeats = [...seatPositionsRef.current.values()].filter((position) => (
      !position.seat.disabled && !assignments[position.seat.id]
    ));
    const target = emptySeats.sort((left, right) => {
      const leftDistance = Math.hypot(local.x - (left.x + left.width / 2), local.y - (left.y + left.height / 2));
      const rightDistance = Math.hypot(local.x - (right.x + right.width / 2), local.y - (right.y + right.height / 2));
      return leftDistance - rightDistance;
    })[0];
    if (target) onSeatStudent(studentId, target.seat.id);
  };

  const openSelectedStudentMenuFromKeyboard = () => {
    const studentId = selectedStudentIds[0];
    const root = rootRef.current;
    if (!studentId || !root) {
      onToolFeedback("请先选中一名学生，再按 Shift + F10 打开操作菜单");
      return;
    }
    const position = [...seatPositionsRef.current.values()].find((item) => assignments[item.seat.id] === studentId);
    const student = students.find((item) => item.id === studentId);
    if (!position || !student) return;
    const point = root.toGlobal(new Point(position.x + position.width / 2, position.y + position.height / 2));
    openStudentContextMenu(studentId, student.name, position.seat.id, point.x, point.y);
  };

  const handleContextMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)")];
      if (!items.length) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex].focus();
    }
  };

  const contextMenuStudent = studentContextMenu
    ? students.find((student) => student.id === studentContextMenu.studentId)
    : undefined;

  return (
    <section
      ref={stageRef}
      className={`classroom-stage tool-${tool} ${tool === "move" ? "is-pannable" : ""} ${printMode ? "is-printing" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
          event.preventDefault();
          openSelectedStudentMenuFromKeyboard();
        }
      }}
      onDragOver={(event) => {
        if (!printMode) event.preventDefault();
      }}
      onDrop={handleDrop}
      aria-label="教室座位画布"
      aria-describedby="canvas-student-actions-help"
      tabIndex={printMode ? undefined : 0}
    >
      <span className="visually-hidden" id="canvas-student-actions-help">讲台两侧的加号可添加左右护法座位；多选学生后可拖动选区框内空白处整体移动；右键学生可打开操作菜单；键盘用户先选择学生，再按 Shift 加 F10。</span>
      <div className="canvas-grid" />
      <div className="pixi-host" ref={hostRef} />
      {!printMode && studentContextMenu && (
        <div
          className="student-context-menu"
          ref={contextMenuRef}
          role="menu"
          aria-label={`${studentContextMenu.studentName}的操作`}
          style={{ left: studentContextMenu.x, top: studentContextMenu.y }}
          onKeyDown={handleContextMenuKeyDown}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStudentContextMenu(undefined);
          }}
        >
          <div className="student-context-menu-header">
            <span aria-hidden="true">{studentContextMenu.studentName.slice(0, 1)}</span>
            <div>
              <strong>{studentContextMenu.studentName}</strong>
              <small>{contextMenuStudent?.isClassRepresentative ? "课代表 · " : ""}当前已选 {selectedStudentIds.length} 人</small>
            </div>
          </div>
          {contextMenuStudent && (
            <StudentQuickTags
              key={contextMenuStudent.id}
              studentName={contextMenuStudent.name}
              tags={contextMenuStudent.tags}
              onToggleTag={(tag) => onAddStudentTag(contextMenuStudent.id, tag)}
            />
          )}
          <button
            className={`student-context-menu-representative ${contextMenuStudent?.isClassRepresentative ? "is-active" : ""}`}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onToggleClassRepresentative(studentContextMenu.studentId);
              setStudentContextMenu(undefined);
            }}
          >
            <BadgeCheck size={16} />
            <span>
              <strong>{contextMenuStudent?.isClassRepresentative ? "取消课代表" : "设为课代表"}</strong>
              <small>{contextMenuStudent?.isClassRepresentative ? "移除座位上的专属标记" : "在座位上显示专属标记"}</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onSelectionChange([studentContextMenu.studentId]);
              setStudentContextMenu(undefined);
            }}
          >
            <MousePointer2 size={16} />
            <span><strong>单独选中</strong><small>仅保留这名学生</small></span>
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onSelectionChange(
                selectedStudentIds.includes(studentContextMenu.studentId)
                  ? selectedStudentIds.filter((id) => id !== studentContextMenu.studentId)
                  : [...selectedStudentIds, studentContextMenu.studentId],
              );
              setStudentContextMenu(undefined);
            }}
          >
            <UsersRound size={16} />
            <span>
              <strong>{selectedStudentIds.includes(studentContextMenu.studentId) ? "从多选中移除" : "加入多选"}</strong>
              <small>无需按住 Ctrl</small>
            </span>
          </button>
          <button
            className="student-context-menu-danger"
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onSelectionChange(selectedStudentIds.filter((id) => id !== studentContextMenu.studentId));
              onClearSeat(studentContextMenu.seatId);
              setStudentContextMenu(undefined);
            }}
          >
            <Undo2 size={16} />
            <span><strong>返回待入座</strong><small>清空当前座位</small></span>
          </button>
        </div>
      )}
      {!printMode && statusTooltip && !studentContextMenu && (
        <div
          className="student-status-tooltip"
          role="tooltip"
          style={{ left: statusTooltip.x, top: statusTooltip.y }}
        >
          <strong>{statusTooltip.title}</strong>
          {statusTooltip.items.map((item, index) => (
            <span
              className={statusTooltip.itemDisplay === "tag" ? "tag" : undefined}
              key={`${item}-${index}`}
            >
              {item}
            </span>
          ))}
          {statusTooltip.hiddenCount > 0 && <small>另有 {statusTooltip.hiddenCount} 项</small>}
        </div>
      )}
      {!printMode && (
        <>
          {tool !== "select" && toolHintVisible && (
            <div className={`canvas-tool-hint ${previewRuleType && selectedStudentIds.length >= 2 ? "has-rule-preview" : ""}`} role="status">
              <strong>{toolDetails[tool].label}</strong>
              <span>{toolDetails[tool].description}</span>
              <span className="canvas-tool-countdown" aria-hidden="true">{toolHintCountdown}s</span>
            </div>
          )}
          {previewRuleType && selectedStudentIds.length >= 2 && (
            <div className={`rule-preview-hint rule-${previewRuleType}`} role="status">
              <Eye size={17} />
              <span><small>画布联动预览</small><strong>{ruleLabels[previewRuleType]}</strong></span>
              <em>{plannedPairCount(previewRuleType, selectedStudentIds.length)} 条关系</em>
            </div>
          )}
          <div className="zoom-controls" aria-label="画布缩放">
            <button className="has-styled-tooltip" type="button" onClick={() => applyZoom(0.9)} aria-label="缩小画布，每次缩小 10%">
              <Minus size={15} />
              <StyledTooltip label="缩小画布" description="每次缩小 10%；也可以向下滚动鼠标滚轮。" side="top" />
            </button>
            <output>{zoom}%</output>
            <button className="has-styled-tooltip" type="button" onClick={() => applyZoom(1.1)} aria-label="放大画布，每次放大 10%">
              <Plus size={15} />
              <StyledTooltip label="放大画布" description="每次放大 10%；也可以向上滚动鼠标滚轮。" side="top" />
            </button>
            <button className="has-styled-tooltip" type="button" onClick={fitCanvas} aria-label="让全部座位适应窗口">
              <Maximize2 size={15} />
              <StyledTooltip label="适应窗口" description="自动调整缩放和位置，让全部座位回到可视区域。" side="top" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
