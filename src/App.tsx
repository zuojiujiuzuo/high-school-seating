import {
  ArrowRight,
  Check,
  ChevronRight,
  FileSpreadsheet,
  Info,
  Keyboard,
  LockKeyhole,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdvancedLayoutDialog,
  ApplyCandidateDialog,
  CandidateInfoDialog,
  ClearClassDialog,
  CreateClassDialog,
  CreateVersionDialog,
  DeleteWorkspaceDialog,
  LockScreen,
  StudentBatchDialog,
  StudentEditorDialog,
  type StudentBulkPatch,
  type VersionCopyMode,
} from "./components/AppDialogs";
import { CanvasRuleSummary } from "./components/CanvasRuleSummary";
import { ClassroomCanvas } from "./components/ClassroomCanvas";
import { ExportPreview } from "./components/ExportPreview";
import { LegalNoticeDialog } from "./components/LegalNoticeDialog";
import { OnboardingTour } from "./components/OnboardingTour";
import { RosterSidebar } from "./components/RosterSidebar";
import {
  ExportPanel,
  LayoutPanel,
  RosterPanel,
  SeatingPanel,
  type ExportFormat,
} from "./components/SidePanels";
import { Stepper, steps } from "./components/Stepper";
import { StudentRosterBoard } from "./components/StudentRosterBoard";
import { ToolRail, type ToolMode } from "./components/ToolRail";
import { TopBar } from "./components/TopBar";
import {
  initiallySelectedStudentIds,
  students as initialStudents,
} from "./data/mockData";
import {
  createEmptyProjectState,
  deleteProjectState,
  LEGAL_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  loadSavedAt,
  loadPreferences,
  loadProjectState,
  saveProjectState,
  type Preferences,
} from "./data/projectState";
import { createCandidates } from "./domain/candidates";
import { exportSeatingPlan } from "./domain/export";
import { createGridSeats, createGuardianSeats, createPresetSeats, getLayoutPreset } from "./domain/layoutPresets";
import { buildConstraints, findRuleConflicts } from "./domain/rules";
import { useHistory } from "./hooks/useHistory";
import type {
  AssignmentMap,
  AppTheme,
  ConstraintType,
  DoorPlacement,
  GenerationStrategy,
  GenerationWeights,
  GuardianSide,
  LayoutConfig,
  LayoutPresetId,
  ProjectState,
  SeatDefinition,
  SeatingCandidate,
  Student,
  WizardStep,
} from "./types";

const EMPTY_LAYOUT_ASSIGNMENTS: AssignmentMap = {};
const DOOR_PLACEMENT_ORDER: DoorPlacement[] = ["front-left", "front-right", "back-left", "back-right"];
const DEFAULT_CLASSES = ["高二（3）班"];
const DEFAULT_VERSIONS = ["日常换位 · 第4期"];
const WORKSPACE_CATALOG_STORAGE_KEY = "banzhen-workspace-catalog-v1";
const ONBOARDING_STORAGE_KEY = "banzhen-onboarding-v1";

interface WorkspaceCatalog {
  classes: string[];
  versionsByClass: Record<string, string[]>;
}

function loadWorkspaceCatalog(): WorkspaceCatalog {
  const fallback = {
    classes: [...DEFAULT_CLASSES],
    versionsByClass: Object.fromEntries(DEFAULT_CLASSES.map((className) => [className, [...DEFAULT_VERSIONS]])),
  };
  try {
    const stored = JSON.parse(window.localStorage.getItem(WORKSPACE_CATALOG_STORAGE_KEY) ?? "{}") as Partial<WorkspaceCatalog>;
    const classes = Array.isArray(stored.classes) && stored.classes.length
      ? stored.classes.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      : fallback.classes;
    return {
      classes,
      versionsByClass: Object.fromEntries(classes.map((className) => {
        const versions = stored.versionsByClass?.[className];
        return [className, Array.isArray(versions) && versions.length ? versions : [...DEFAULT_VERSIONS]];
      })),
    };
  } catch {
    return fallback;
  }
}

function loadInitialWorkspace() {
  const catalog = loadWorkspaceCatalog();
  const savedClass = window.localStorage.getItem("banzhen-current-class");
  const currentClass = savedClass && catalog.classes.includes(savedClass) ? savedClass : catalog.classes[0];
  const versions = catalog.versionsByClass[currentClass] ?? DEFAULT_VERSIONS;
  const savedVersion = window.localStorage.getItem("banzhen-current-version");
  const currentVersion = savedVersion && versions.includes(savedVersion) ? savedVersion : versions[0];
  return { catalog, currentClass, currentVersion };
}

function remapAssignments(
  current: AssignmentMap,
  nextSeats: SeatDefinition[],
  disabledSeatIds: string[],
  students: Student[],
) {
  const disabled = new Set(disabledSeatIds);
  const currentlySeated = Object.values(current).filter((id): id is string => Boolean(id));
  const seatedSet = new Set(currentlySeated);
  const orderedStudentIds = [...currentlySeated, ...students.filter((student) => !seatedSet.has(student.id)).map((student) => student.id)];
  return nextSeats
    .filter((seat) => !disabled.has(seat.id))
    .reduce<AssignmentMap>((result, seat, index) => {
      if (orderedStudentIds[index]) result[seat.id] = orderedStudentIds[index];
      return result;
    }, {});
}

function App() {
  const initialWorkspace = useMemo(loadInitialWorkspace, []);
  const [workspaceCatalog, setWorkspaceCatalog] = useState(initialWorkspace.catalog);
  const [currentClass, setCurrentClass] = useState(initialWorkspace.currentClass);
  const [currentVersion, setCurrentVersion] = useState(initialWorkspace.currentVersion);
  const classOptions = workspaceCatalog.classes;
  const versionOptions = workspaceCatalog.versionsByClass[currentClass] ?? [];
  const initialProject = useMemo(() => loadProjectState(currentClass, currentVersion), []);
  const history = useHistory<ProjectState>(initialProject);
  const students = history.value.students;
  const [currentStep, setCurrentStep] = useState<WizardStep>("roster");
  const [theme, setTheme] = useState<AppTheme>(() => window.localStorage.getItem("banzhen-theme") === "minimal" ? "minimal" : "cute");
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [tool, setTool] = useState<ToolMode>("select");
  const [selectedIds, setSelectedIds] = useState(initiallySelectedStudentIds);
  const [selectedRule, setSelectedRule] = useState<ConstraintType>("not_adjacent");
  const [ruleConflicts, setRuleConflicts] = useState<ReturnType<typeof findRuleConflicts>>([]);
  const [algorithms, setAlgorithms] = useState<GenerationStrategy[]>(["group_balanced"]);
  const [separateGenders, setSeparateGenders] = useState(false);
  const [generationWeights, setGenerationWeights] = useState<GenerationWeights>({ score: 72, height: 58, appearance: 25 });
  const [candidates, setCandidates] = useState<SeatingCandidate[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string>();
  const [generationPulse, setGenerationPulse] = useState(0);
  const [printMode, setPrintMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(() => !window.localStorage.getItem(LEGAL_STORAGE_KEY));
  const [legalAcknowledged, setLegalAcknowledged] = useState(() => Boolean(window.localStorage.getItem(LEGAL_STORAGE_KEY)));
  const [importReady, setImportReady] = useState(false);
  const [toast, setToast] = useState<string>();
  const [studentEditor, setStudentEditor] = useState<{ mode: "create" } | { mode: "edit"; student: Student }>();
  const [bulkEditIds, setBulkEditIds] = useState<string[]>();
  const [advancedLayoutOpen, setAdvancedLayoutOpen] = useState(false);
  const [candidateInfoOpen, setCandidateInfoOpen] = useState(false);
  const [applyCandidateConfirmOpen, setApplyCandidateConfirmOpen] = useState(false);
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [createVersionOpen, setCreateVersionOpen] = useState(false);
  const [clearClassOpen, setClearClassOpen] = useState(false);
  const [deleteWorkspaceTarget, setDeleteWorkspaceTarget] = useState<"class" | "version">();
  const [locked, setLocked] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => Boolean(window.localStorage.getItem(LEGAL_STORAGE_KEY)) && !window.localStorage.getItem(ONBOARDING_STORAGE_KEY));
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState(() => (loadSavedAt(currentClass, currentVersion) ?? new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [showGender, setShowGender] = useState(true);
  const [showStudentNo, setShowStudentNo] = useState(false);
  const [showGroupBoundaries, setShowGroupBoundaries] = useState(true);
  const [exportFileName, setExportFileName] = useState("高二3班_座次表_第4期");
  const [exportTheme, setExportTheme] = useState<"paper" | "ink">("paper");
  const toastTimer = useRef<number | undefined>(undefined);
  const generationSequence = useRef(0);
  const customSeatSequence = useRef(0);
  const printReturnStep = useRef<WizardStep>("seating");
  const layoutPreset = history.value.layoutPreset;
  const doorPlacements = DOOR_PLACEMENT_ORDER.filter((placement) => history.value.doorPlacements.includes(placement));
  const reducedMotion = preferences.reducedMotion;

  const layoutSeats = useMemo(() => {
    const disabledIds = new Set(history.value.disabledSeatIds);
    return [
      ...createGridSeats(history.value.layoutConfig),
      ...history.value.customSeats,
      ...createGuardianSeats(history.value.guardianSides),
    ].map((seat) => {
      const position = history.value.seatPositions[seat.id];
      return {
        ...seat,
        disabled: disabledIds.has(seat.id),
        canvasX: position?.x,
        canvasY: position?.y,
      };
    });
  }, [history.value.customSeats, history.value.disabledSeatIds, history.value.guardianSides, history.value.layoutConfig, history.value.seatPositions]);
  const activeCandidate = candidates.find((candidate) => candidate.id === activeCandidateId);
  const displayAssignments = activeCandidate?.assignments ?? history.value.assignments;

  useEffect(() => {
    if (!activeCandidate) setApplyCandidateConfirmOpen(false);
  }, [activeCandidate]);

  const seatedIds = useMemo(() => {
    const visibleSeatIds = new Set(layoutSeats.map((seat) => seat.id));
    return new Set(
      Object.entries(displayAssignments)
        .filter(([seatId]) => visibleSeatIds.has(seatId))
        .map(([, studentId]) => studentId)
        .filter((studentId): studentId is string => Boolean(studentId)),
    );
  }, [displayAssignments, layoutSeats]);
  const unseatedStudents = students.filter((student) => !seatedIds.has(student.id));
  const selectedStudents = selectedIds
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is Student => Boolean(student));
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(undefined), 2800);
  };

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        const savedDate = new Date(saveProjectState(currentClass, currentVersion, history.value));
        window.localStorage.setItem("banzhen-current-class", currentClass);
        window.localStorage.setItem("banzhen-current-version", currentVersion);
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
        setSavedAt(savedDate.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [currentClass, currentVersion, history.value, preferences]);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_CATALOG_STORAGE_KEY, JSON.stringify(workspaceCatalog));
  }, [workspaceCatalog]);

  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>("link[data-banzhen-favicon]");
    const themeColor = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (favicon) favicon.href = theme === "cute" ? "/favicon-cute.svg" : "/favicon-minimal.svg";
    if (themeColor) themeColor.content = theme === "cute" ? "#fff8fa" : "#f8f5ed";
  }, [theme]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && preferences.autoLock) setLocked(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [preferences.autoLock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "Escape") setTool("select");
      if (isEditing || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      setCandidates([]);
      setActiveCandidateId(undefined);
      if (event.shiftKey) history.redo();
      else history.undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history.redo, history.undo]);

  const goToNextStep = () => {
    const currentIndex = steps.findIndex((step) => step.id === currentStep);
    handleStepChange(steps[Math.min(currentIndex + 1, steps.length - 1)].id);
  };

  const toggleStudent = (studentId: string, additive: boolean) => {
    setSelectedIds((current) => {
      if (!additive) return [studentId];
      return current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId];
    });
    setRuleConflicts([]);
  };

  const handleUndo = () => {
    setCandidates([]);
    setActiveCandidateId(undefined);
    history.undo();
  };

  const handleRedo = () => {
    setCandidates([]);
    setActiveCandidateId(undefined);
    history.redo();
  };

  const switchWorkspace = (nextClass: string, nextVersion: string) => {
    try {
      saveProjectState(currentClass, currentVersion, history.value);
      const nextProject = loadProjectState(nextClass, nextVersion);
      history.reset(nextProject);
      setCurrentClass(nextClass);
      setCurrentVersion(nextVersion);
      setSavedAt((loadSavedAt(nextClass, nextVersion) ?? new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      setSaveStatus("saved");
      setSelectedIds([]);
      setRuleConflicts([]);
      setCandidates([]);
      setActiveCandidateId(undefined);
      setPrintMode(false);
      showToast(`已切换到${nextClass} · ${nextVersion}`);
    } catch {
      setSaveStatus("error");
      showToast("切换前保存失败，请检查浏览器存储权限");
    }
  };

  const createClass = (name: string) => {
    const initialVersion = "初始座位 · 第1版";
    const nextProject = createEmptyProjectState(name);
    try {
      saveProjectState(currentClass, currentVersion, history.value);
      saveProjectState(name, initialVersion, nextProject);
      setWorkspaceCatalog((current) => ({
        classes: [...current.classes, name],
        versionsByClass: { ...current.versionsByClass, [name]: [initialVersion] },
      }));
      history.reset(nextProject);
      setCurrentClass(name);
      setCurrentVersion(initialVersion);
      setCurrentStep("roster");
      setSelectedIds([]);
      setCandidates([]);
      setActiveCandidateId(undefined);
      setCreateClassOpen(false);
      setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      showToast(`已创建${name}，先导入或添加学生`);
    } catch {
      setSaveStatus("error");
      showToast("创建班级失败，请检查浏览器存储权限");
    }
  };

  const createVersion = (name: string, mode: VersionCopyMode) => {
    const nextProject: ProjectState = mode === "current"
      ? structuredClone(history.value)
      : {
        ...structuredClone(history.value),
        solutionConfirmed: false,
        assignments: {},
        constraints: [],
      };
    try {
      saveProjectState(currentClass, currentVersion, history.value);
      saveProjectState(currentClass, name, nextProject);
      setWorkspaceCatalog((current) => ({
        ...current,
        versionsByClass: {
          ...current.versionsByClass,
          [currentClass]: [...(current.versionsByClass[currentClass] ?? []), name],
        },
      }));
      history.reset(nextProject);
      setCurrentVersion(name);
      setCandidates([]);
      setActiveCandidateId(undefined);
      setCreateVersionOpen(false);
      setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      showToast(`已创建并切换到${name}`);
    } catch {
      setSaveStatus("error");
      showToast("创建座位版本失败，请检查浏览器存储权限");
    }
  };

  const clearCurrentClass = () => {
    history.commit((current) => ({
      ...current,
      students: [],
      assignments: {},
      constraints: [],
      solutionConfirmed: false,
    }));
    setSelectedIds([]);
    setRuleConflicts([]);
    setCandidates([]);
    setActiveCandidateId(undefined);
    setCurrentStep("roster");
    setClearClassOpen(false);
    showToast(`${currentClass}名单已清空，可使用撤销恢复`);
  };

  const deleteCurrentClass = () => {
    if (classOptions.length <= 1) {
      setDeleteWorkspaceTarget(undefined);
      showToast("至少需要保留一个班级");
      return;
    }
    try {
      const deletedClass = currentClass;
      const deletedIndex = classOptions.indexOf(deletedClass);
      const deletedVersions = workspaceCatalog.versionsByClass[deletedClass] ?? [];
      deletedVersions.forEach((versionName) => deleteProjectState(deletedClass, versionName));
      const remainingClasses = classOptions.filter((className) => className !== deletedClass);
      const nextClass = remainingClasses[Math.min(Math.max(deletedIndex, 0), remainingClasses.length - 1)];
      const nextVersions = workspaceCatalog.versionsByClass[nextClass] ?? DEFAULT_VERSIONS;
      const nextVersion = nextVersions[0];
      const nextProject = loadProjectState(nextClass, nextVersion);
      setWorkspaceCatalog((current) => {
        const versionsByClass = { ...current.versionsByClass };
        delete versionsByClass[deletedClass];
        return { classes: current.classes.filter((className) => className !== deletedClass), versionsByClass };
      });
      history.reset(nextProject);
      setCurrentClass(nextClass);
      setCurrentVersion(nextVersion);
      setCurrentStep("roster");
      setTool("select");
      setSelectedIds([]);
      setRuleConflicts([]);
      setCandidates([]);
      setActiveCandidateId(undefined);
      setPrintMode(false);
      setDeleteWorkspaceTarget(undefined);
      setSavedAt((loadSavedAt(nextClass, nextVersion) ?? new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      setSaveStatus("saved");
      showToast(`已删除班级${deletedClass}`);
    } catch {
      setSaveStatus("error");
      showToast("删除班级失败，请检查浏览器存储权限");
    }
  };

  const deleteCurrentVersion = () => {
    if (versionOptions.length <= 1) {
      setDeleteWorkspaceTarget(undefined);
      showToast("每个班级至少需要保留一个座位版本");
      return;
    }
    try {
      const deletedVersion = currentVersion;
      const deletedIndex = versionOptions.indexOf(deletedVersion);
      deleteProjectState(currentClass, deletedVersion);
      const remainingVersions = versionOptions.filter((versionName) => versionName !== deletedVersion);
      const nextVersion = remainingVersions[Math.min(Math.max(deletedIndex, 0), remainingVersions.length - 1)];
      const nextProject = loadProjectState(currentClass, nextVersion);
      setWorkspaceCatalog((current) => ({
        ...current,
        versionsByClass: { ...current.versionsByClass, [currentClass]: remainingVersions },
      }));
      history.reset(nextProject);
      setCurrentVersion(nextVersion);
      setCurrentStep("roster");
      setTool("select");
      setSelectedIds([]);
      setRuleConflicts([]);
      setCandidates([]);
      setActiveCandidateId(undefined);
      setPrintMode(false);
      setDeleteWorkspaceTarget(undefined);
      setSavedAt((loadSavedAt(currentClass, nextVersion) ?? new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      setSaveStatus("saved");
      showToast(`已删除座位版本${deletedVersion}`);
    } catch {
      setSaveStatus("error");
      showToast("删除座位版本失败，请检查浏览器存储权限");
    }
  };

  const finishOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, new Date().toISOString());
    setOnboardingOpen(false);
  };

  const saveStudent = (student: Student) => {
    const isEditing = Boolean(student.id);
    const savedStudent = isEditing
      ? student
      : { ...student, id: `student-${Date.now()}` };
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      students: isEditing
        ? current.students.map((item) => item.id === savedStudent.id ? savedStudent : item)
        : [...current.students, savedStudent],
    }));
    setStudentEditor(undefined);
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(isEditing ? `${savedStudent.name}的信息已更新` : `已添加${savedStudent.name}，可从待入座名单拖入座位`);
  };

  const deleteStudent = (student: Student) => {
    if (!window.confirm(`确定从名单中删除“${student.name}”吗？这会同时移除其座位和相关规则。`)) return;
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      students: current.students.filter((item) => item.id !== student.id),
      assignments: Object.fromEntries(Object.entries(current.assignments).filter(([, studentId]) => studentId !== student.id)),
      constraints: current.constraints.filter((constraint) => constraint.pair.a !== student.id && constraint.pair.b !== student.id),
    }));
    setSelectedIds((current) => current.filter((id) => id !== student.id));
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(`${student.name}已删除，可使用撤销恢复`);
  };

  const applyBulkStudentPatch = (patch: StudentBulkPatch) => {
    const selected = new Set(bulkEditIds ?? []);
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      students: current.students.map((student) => selected.has(student.id) ? {
        ...student,
        ...(patch.score !== undefined ? { score: patch.score } : {}),
        ...(patch.height !== undefined ? { height: patch.height } : {}),
        ...(patch.clearTags ? { tags: [] } : patch.tag ? { tags: [patch.tag] } : {}),
      } : student),
    }));
    const count = selected.size;
    setBulkEditIds(undefined);
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(`已更新 ${count} 名学生`);
  };

  const swapSeats = (fromSeatId: string, toSeatId: string) => {
    history.commit((current) => {
      const assignments = { ...(activeCandidate?.assignments ?? current.assignments) };
      const fromStudent = assignments[fromSeatId];
      const toStudent = assignments[toSeatId];
      assignments[toSeatId] = fromStudent;
      assignments[fromSeatId] = toStudent;
      if (!assignments[fromSeatId]) delete assignments[fromSeatId];
      if (!assignments[toSeatId]) delete assignments[toSeatId];
      return { ...current, solutionConfirmed: false, assignments };
    });
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast("换位完成，可随时撤销");
  };

  const seatStudent = (studentId: string, seatId: string) => {
    history.commit((current) => {
      const assignments = Object.fromEntries(
        Object.entries(activeCandidate?.assignments ?? current.assignments).filter(([, assignedStudentId]) => assignedStudentId !== studentId),
      );
      assignments[seatId] = studentId;
      return { ...current, solutionConfirmed: false, assignments };
    });
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast("学生已入座");
  };

  const addCanvasSeat = (position: { x: number; y: number }) => {
    customSeatSequence.current += 1;
    const id = `custom-seat-${Date.now()}-${customSeatSequence.current}`;
    const existingRows = layoutSeats.filter((seat) => seat.group === 0).map((seat) => seat.row);
    const row = existingRows.length ? Math.max(...existingRows) + 1 : 0;
    const seat: SeatDefinition = {
      id,
      group: 0,
      row,
      column: 0,
      deskId: `custom-desk-${id}`,
    };
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      customSeats: [...current.customSeats, seat],
      seatPositions: { ...current.seatPositions, [id]: position },
    }));
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast("已添加座位，可继续点击添加或拖动调整");
  };

  const moveCanvasSeat = (seatId: string, position: { x: number; y: number }) => {
    history.commit((current) => ({
      ...current,
      seatPositions: { ...current.seatPositions, [seatId]: position },
    }));
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast("座位位置已更新");
  };

  const clearCanvasSeat = (seatId: string) => {
    if (!displayAssignments[seatId]) {
      showToast("这个座位已经是空位");
      return;
    }
    history.commit((current) => {
      const assignments = { ...(activeCandidate?.assignments ?? current.assignments) };
      delete assignments[seatId];
      return { ...current, solutionConfirmed: false, assignments };
    });
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast("座位已清空，学生已回到待入座名单");
  };

  const changeAisleWidth = (width: number) => {
    history.commit((current) => ({ ...current, aisleWidth: width }));
    showToast(`过道宽度已调整为 ${Math.round(width)} px`);
  };

  const movePodium = (position: { x: number; y: number }) => {
    history.commit((current) => ({ ...current, podiumPosition: position }));
    showToast("讲台位置已更新");
  };

  const changeLayoutPreset = (nextPreset: LayoutPresetId) => {
    const presetSeats = createPresetSeats(nextPreset);
    const nextSeats = [...presetSeats, ...createGuardianSeats(history.value.guardianSides)];
    const presetDefinition = getLayoutPreset(nextPreset);
    const validSeatIds = new Set(nextSeats.map((seat) => seat.id));
    const preservedDisabled = history.value.disabledSeatIds.filter((seatId) => validSeatIds.has(seatId));
    const nextDisabled = preservedDisabled.length || nextSeats.length === 0
      ? preservedDisabled
      : [presetSeats[Math.floor(presetSeats.length * 0.58)]?.id, presetSeats.at(-2)?.id].filter((id): id is string => Boolean(id));
    const assignments = remapAssignments(history.value.assignments, nextSeats, nextDisabled, students);
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      assignments,
      disabledSeatIds: nextDisabled,
      customSeats: [],
      seatPositions: {},
      aisleWidth: 54,
      podiumPosition: { x: 487, y: 42 },
      layoutPreset: nextPreset,
      layoutConfig: {
        groups: presetDefinition.groups,
        rows: presetDefinition.rows,
        columns: (presetDefinition.columns || 1) as 1 | 2,
      },
    }));
    setCandidates([]);
    setActiveCandidateId(undefined);
    setGenerationPulse((current) => current + 1);
    showToast(`${nextPreset === "blank" ? "空白布局" : `${nextSeats.length} 座布局`}已应用到画布`);
  };

  const changeLayoutConfig = (config: LayoutConfig, aisleWidth = history.value.aisleWidth) => {
    const nextSeats = [...createGridSeats(config), ...createGuardianSeats(history.value.guardianSides)];
    const validSeatIds = new Set(nextSeats.map((seat) => seat.id));
    const nextDisabled = history.value.disabledSeatIds.filter((seatId) => validSeatIds.has(seatId));
    const assignments = remapAssignments(history.value.assignments, nextSeats, nextDisabled, students);
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      assignments,
      disabledSeatIds: nextDisabled,
      customSeats: [],
      seatPositions: {},
      aisleWidth,
      layoutPreset: "blank",
      layoutConfig: config,
    }));
    setCandidates([]);
    setActiveCandidateId(undefined);
    setGenerationPulse((current) => current + 1);
  };

  const toggleGuardianSeat = (side: GuardianSide) => {
    const seatId = `seat-guardian-${side}`;
    const enabled = history.value.guardianSides.includes(side);
    history.commit((current) => {
      const guardianSides = enabled
        ? current.guardianSides.filter((value) => value !== side)
        : (["left", "right"] as const).filter((value) => value === side || current.guardianSides.includes(value));
      const assignments = { ...current.assignments };
      const seatPositions = { ...current.seatPositions };
      if (enabled) {
        delete assignments[seatId];
        delete seatPositions[seatId];
      }
      return {
        ...current,
        solutionConfirmed: false,
        assignments,
        disabledSeatIds: enabled ? current.disabledSeatIds.filter((id) => id !== seatId) : current.disabledSeatIds,
        guardianSides: [...guardianSides],
        seatPositions,
      };
    });
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(`${side === "left" ? "左" : "右"}护法座已${enabled ? "移除" : "添加"}`);
  };

  const toggleDoorPlacement = (placement: DoorPlacement) => {
    const enabled = history.value.doorPlacements.includes(placement);
    history.commit((current) => ({
      ...current,
      doorPlacements: DOOR_PLACEMENT_ORDER.filter((value) => (
        enabled ? current.doorPlacements.includes(value) && value !== placement : current.doorPlacements.includes(value) || value === placement
      )),
    }));
    const label = `${placement.includes("front") ? "前方" : "后方"}${placement.includes("left") ? "左侧" : "右侧"}`;
    showToast(`已${enabled ? "移除" : "添加"}${label}教室门`);
  };

  const toggleSeatDisabled = (seatId: string) => {
    history.commit((current) => {
      const willDisable = !current.disabledSeatIds.includes(seatId);
      const disabledSeatIds = willDisable
        ? [...current.disabledSeatIds, seatId]
        : current.disabledSeatIds.filter((id) => id !== seatId);
      const assignments = { ...current.assignments };
      if (willDisable) delete assignments[seatId];
      return { ...current, solutionConfirmed: false, assignments, disabledSeatIds };
    });
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(history.value.disabledSeatIds.includes(seatId) ? "座位已恢复" : "座位已禁用");
  };

  const addRule = () => {
    const nextConstraints = buildConstraints(selectedRule, selectedIds);
    const combined = [...history.value.constraints, ...nextConstraints];
    const conflicts = findRuleConflicts(combined);
    if (conflicts.length) {
      setRuleConflicts(conflicts);
      showToast("规则存在冲突，请先调整");
      return;
    }
    history.commit((current) => ({ ...current, solutionConfirmed: false, constraints: [...current.constraints, ...nextConstraints] }));
    setRuleConflicts([]);
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(`已添加 ${nextConstraints.length} 条规则，将在生成方案时应用`);
  };

  const deleteConstraintBatch = (batchId: string) => {
    const remainingConstraints = history.value.constraints.filter((constraint) => constraint.batchId !== batchId);
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      constraints: remainingConstraints,
    }));
    setRuleConflicts([]);
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast("规则批次已删除");
  };

  const generateSolutions = () => {
    generationSequence.current += 1;
    const nextCandidates = createCandidates(
      history.value.assignments,
      layoutSeats,
      history.value.constraints,
      students,
      { strategies: algorithms, separateGenders },
      generationWeights,
      generationSequence.current,
    );
    setCandidates(nextCandidates);
    setActiveCandidateId(nextCandidates[0].id);
    setGenerationPulse((current) => current + 1);
    showToast("已生成 3 个候选方案");
  };

  const applyCandidate = () => {
    if (!activeCandidate) return;
    history.commit((current) => ({ ...current, solutionConfirmed: true, assignments: activeCandidate.assignments }));
    setApplyCandidateConfirmOpen(false);
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(`${activeCandidate.label}已应用`);
  };

  const handleExport = async () => {
    try {
      const sourceCanvas = exportFormat === "xlsx"
        ? null
        : document.querySelector<HTMLCanvasElement>(".export-canvas-preview .pixi-host canvas");
      if (exportFormat !== "xlsx" && !sourceCanvas) {
        throw new Error("画布正在准备，请稍后再导出");
      }
      const message = await exportSeatingPlan({
        format: exportFormat,
        fileName: exportFileName,
        className: currentClass,
        versionName: currentVersion,
        students,
        seats: layoutSeats,
        assignments: displayAssignments,
        showGender,
        showStudentNo,
        showGroupBoundaries,
        tableTheme: exportTheme,
        sourceCanvas,
        appTheme: theme,
      });
      showToast(message);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导出失败，请重试");
    }
  };

  function handleStepChange(step: WizardStep) {
    const targetIndex = steps.findIndex((item) => item.id === step);
    const hasIncompleteRequiredFields = students.some((student) => !student.name.trim() || !student.gender || !student.className.trim());
    if (targetIndex > 0 && hasIncompleteRequiredFields) {
      setCurrentStep("roster");
      showToast("请先补全姓名、性别和班级");
      return;
    }
    if (targetIndex > 1 && !layoutSeats.some((seat) => !seat.disabled)) {
      setCurrentStep("layout");
      showToast("请先创建至少一个可用座位");
      return;
    }
    if (step === "export" && activeCandidate) {
      setCurrentStep("seating");
      showToast("请先应用候选方案，再进入导出");
      return;
    }
    if (step === "export" && !history.value.solutionConfirmed) {
      setCurrentStep("seating");
      showToast("请先生成并应用一个候选方案");
      return;
    }
    if (step === "export" && !Object.values(history.value.assignments).some(Boolean)) {
      showToast("当前还没有学生入座，无法导出");
      return;
    }
    setCurrentStep(step);
    setPrintMode(false);
    if (step === "seating") setTool("select");
    if (step !== "seating") {
      setCandidates([]);
      setActiveCandidateId(undefined);
    }
  }

  const renderPrimaryAction = () => {
    if (currentStep === "seating") {
      const unavailableReason = history.value.solutionConfirmed
        ? "当前方案已经应用"
        : "请先在右侧“方案”页生成并选择一个候选方案";
      return (
        <button
          className="workflow-primary"
          type="button"
          disabled={!activeCandidate}
          title={activeCandidate ? "确认应用当前预览的候选方案" : unavailableReason}
          onClick={() => setApplyCandidateConfirmOpen(true)}
        >
          <Check size={17} />应用当前方案
        </button>
      );
    }
    if (currentStep === "export") {
      return <span className="workflow-ready"><Check size={16} />导出设置就绪</span>;
    }
    return <button className="workflow-primary" type="button" onClick={goToNextStep}>下一步 <ArrowRight size={17} /></button>;
  };

  const isCanvasStep = currentStep === "layout"
    || currentStep === "seating"
    || (currentStep === "export" && exportFormat !== "xlsx");

  const enterPrintMode = () => {
    printReturnStep.current = currentStep;
    if (!isCanvasStep) setCurrentStep("seating");
    setPrintMode(true);
  };

  const exitPrintMode = () => {
    setPrintMode(false);
    setCurrentStep(printReturnStep.current);
  };

  return (
    <div className={`app-shell theme-${theme} ${printMode ? "print-mode" : ""} ${reducedMotion ? "reduce-motion" : ""} ${preferences.showShortcutHints ? "" : "hide-shortcuts"}`}>
      {!printMode && (
        <>
          <TopBar
            currentClass={currentClass}
            currentVersion={currentVersion}
            classes={classOptions}
            versions={versionOptions}
            savedAt={savedAt}
            saveStatus={saveStatus}
            legalAcknowledged={legalAcknowledged}
            theme={theme}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            printMode={printMode}
            onClassChange={(value) => {
              const nextVersions = workspaceCatalog.versionsByClass[value] ?? DEFAULT_VERSIONS;
              const nextVersion = nextVersions.includes(currentVersion) ? currentVersion : nextVersions[0];
              switchWorkspace(value, nextVersion);
            }}
            onVersionChange={(value) => switchWorkspace(currentClass, value)}
            onCreateClass={() => setCreateClassOpen(true)}
            onClearClass={() => setClearClassOpen(true)}
            onDeleteClass={() => setDeleteWorkspaceTarget("class")}
            onCreateVersion={() => setCreateVersionOpen(true)}
            onDeleteVersion={() => setDeleteWorkspaceTarget("version")}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onTogglePrint={enterPrintMode}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenOnboarding={() => setOnboardingOpen(true)}
            onOpenLegal={() => setLegalOpen(true)}
            onThemeChange={(nextTheme) => {
              setTheme(nextTheme);
              window.localStorage.setItem("banzhen-theme", nextTheme);
              showToast(nextTheme === "cute" ? "已切换到猫爪可爱主题" : "已切换到简约主题");
            }}
          />
          <div className="workflow-bar" data-tour-target="workflow">
            <Stepper current={currentStep} onChange={handleStepChange} />
            {renderPrimaryAction()}
          </div>
        </>
      )}

      <main className={`workspace-grid step-${currentStep}`}>
        {!printMode && currentStep !== "export" && <ToolRail active={tool} onChange={setTool} />}

        {!printMode && currentStep === "seating" && (
          <RosterSidebar
            students={unseatedStudents}
            selectedIds={selectedIds}
            onToggleStudent={toggleStudent}
            onOpenImport={() => setImportOpen(true)}
            onAddStudent={() => setStudentEditor({ mode: "create" })}
          />
        )}

        {currentStep === "roster" && (
          <>
            <StudentRosterBoard
              students={students}
              selectedIds={selectedIds}
              unseatedStudentIds={unseatedStudents.map((student) => student.id)}
              onSelectionChange={setSelectedIds}
              onOpenImport={() => setImportOpen(true)}
              onAddStudent={() => setStudentEditor({ mode: "create" })}
              onEditStudent={(student) => setStudentEditor({ mode: "edit", student })}
              onDeleteStudent={deleteStudent}
              onBatchEdit={setBulkEditIds}
            />
            <RosterPanel onImport={() => setImportOpen(true)} onAddStudent={() => setStudentEditor({ mode: "create" })} onNext={() => handleStepChange("layout")} />
          </>
        )}

        {isCanvasStep && (
          <div className={`canvas-shell ${currentStep === "export" ? "export-canvas-preview" : ""}`}>
            {!printMode && currentStep === "seating" && candidates.length > 0 && (
              <div className="candidate-bar">
                {candidates.map((candidate) => (
                  <button
                    className={candidate.id === activeCandidateId ? "is-active" : ""}
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setActiveCandidateId(candidate.id);
                      setGenerationPulse((current) => current + 1);
                    }}
                  >
                    <span>{candidate.label}</span><strong>{candidate.score} 分</strong>
                  </button>
                ))}
                <button className="candidate-info" type="button" aria-label="评分说明" onClick={() => setCandidateInfoOpen(true)}><Info size={17} /></button>
              </div>
            )}
            <ClassroomCanvas
              students={students}
              seats={layoutSeats}
              assignments={currentStep === "layout" ? EMPTY_LAYOUT_ASSIGNMENTS : displayAssignments}
              selectedStudentIds={printMode ? [] : selectedIds}
              constraints={history.value.constraints}
              previewRuleType={!printMode && currentStep === "seating" ? selectedRule : undefined}
              tool={currentStep === "export" ? "select" : tool}
              reducedMotion={reducedMotion}
              generationPulse={generationPulse}
              printMode={printMode || currentStep === "export"}
              doorPlacements={doorPlacements}
              theme={theme}
              aisleWidth={history.value.aisleWidth}
              podiumPosition={history.value.podiumPosition}
              onSelectionChange={(ids) => {
                setSelectedIds(ids);
                setRuleConflicts([]);
              }}
              onSwap={swapSeats}
              onSeatStudent={seatStudent}
              onAddSeat={addCanvasSeat}
              onMoveSeat={moveCanvasSeat}
              onClearSeat={clearCanvasSeat}
              onAisleWidthChange={changeAisleWidth}
              onMovePodium={movePodium}
              onToolFeedback={showToast}
              onToggleSeatDisabled={toggleSeatDisabled}
            />
            {!printMode && currentStep !== "export" && (
              <CanvasRuleSummary
                constraints={history.value.constraints}
                students={students}
                onDeleteBatch={deleteConstraintBatch}
              />
            )}
            {currentStep === "export" && <div className="canvas-export-status">当前画布 · 原样导出</div>}
          </div>
        )}

        {!printMode && currentStep === "layout" && (
          <LayoutPanel
            preset={layoutPreset}
            doorPlacements={doorPlacements}
            guardianSides={history.value.guardianSides}
            disabledSeatCount={history.value.disabledSeatIds.length}
            groups={history.value.layoutConfig.groups}
            rows={history.value.layoutConfig.rows}
            seatsPerDesk={history.value.layoutConfig.columns}
            aisleWidth={history.value.aisleWidth}
            onPresetChange={changeLayoutPreset}
            onDoorPlacementToggle={toggleDoorPlacement}
            onGuardianToggle={toggleGuardianSeat}
            onRowsChange={(rows) => {
              changeLayoutConfig({ ...history.value.layoutConfig, rows });
              showToast(`每组排数已调整为 ${rows}`);
            }}
            onSeatsPerDeskChange={(columns) => {
              changeLayoutConfig({ ...history.value.layoutConfig, columns });
              showToast(`已切换为每桌 ${columns} 人`);
            }}
            onOpenAdvanced={() => setAdvancedLayoutOpen(true)}
            onApply={() => {
              history.commit((current) => ({
                ...current,
                seatPositions: {},
                podiumPosition: { x: 487, y: 42 },
              }));
              setGenerationPulse((current) => current + 1);
              showToast("布局已等距居中");
            }}
            onNext={() => handleStepChange("seating")}
          />
        )}

        {!printMode && currentStep === "seating" && (
          <SeatingPanel
            students={students}
            selectedStudents={selectedStudents}
            selectedRule={selectedRule}
            constraints={history.value.constraints}
            conflicts={ruleConflicts}
            onRuleChange={(rule) => {
              setSelectedRule(rule);
              setRuleConflicts([]);
            }}
            onRemoveSelected={(studentId) => setSelectedIds((current) => current.filter((id) => id !== studentId))}
            onClearSelection={() => setSelectedIds([])}
            onAddRule={addRule}
            onDeleteConstraintBatch={deleteConstraintBatch}
            algorithms={algorithms}
            separateGenders={separateGenders}
            weights={generationWeights}
            onAlgorithmToggle={(value) => {
              setAlgorithms((current) => {
                if (value === "random") return ["random"];
                const withoutRandom = current.filter((strategy) => strategy !== "random");
                if (!withoutRandom.includes(value)) return [...withoutRandom, value];
                return withoutRandom.length === 1 ? withoutRandom : withoutRandom.filter((strategy) => strategy !== value);
              });
              setCandidates([]);
              setActiveCandidateId(undefined);
            }}
            onSeparateGendersChange={(value) => {
              setSeparateGenders(value);
              setCandidates([]);
              setActiveCandidateId(undefined);
            }}
            onWeightChange={(key, value) => {
              setGenerationWeights((current) => ({ ...current, [key]: value }));
              setCandidates([]);
              setActiveCandidateId(undefined);
            }}
            onGenerate={generateSolutions}
          />
        )}

        {!printMode && currentStep === "export" && (
          <>
            <ExportPanel
              format={exportFormat}
              showGender={showGender}
              showStudentNo={showStudentNo}
              showGroupBoundaries={showGroupBoundaries}
              fileName={exportFileName}
              theme={exportTheme}
              appTheme={theme}
              onFormatChange={setExportFormat}
              onShowGenderChange={setShowGender}
              onShowStudentNoChange={setShowStudentNo}
              onShowGroupBoundariesChange={setShowGroupBoundaries}
              onFileNameChange={setExportFileName}
              onThemeChange={setExportTheme}
              onExport={handleExport}
            />
            {exportFormat === "xlsx" && (
              <ExportPreview
                students={students}
                seats={layoutSeats}
                assignments={history.value.assignments}
                showGender={showGender}
                showStudentNo={showStudentNo}
                showGroupBoundaries={showGroupBoundaries}
                className={currentClass}
                versionName={currentVersion}
                theme={exportTheme}
              />
            )}
          </>
        )}
      </main>

      {printMode && (
        <button className="exit-print-button" type="button" onClick={exitPrintMode}>
          <X size={17} />退出纯净视图
        </button>
      )}

      {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}

      {importOpen && (
        <ImportDialog
          ready={importReady}
          onReady={() => setImportReady(true)}
          onClose={() => {
            setImportOpen(false);
            setImportReady(false);
          }}
          defaultClassName={currentClass}
          onConfirm={(importedStudents) => {
            const knownByNumber = new Map(history.value.students.filter((student) => student.studentNo).map((student) => [student.studentNo, student]));
            const updatedCount = importedStudents.filter((student) => student.studentNo && knownByNumber.has(student.studentNo)).length;
            const incomingCount = importedStudents.length - updatedCount;
            history.commit((current) => {
              const nextStudents = [...current.students];
              importedStudents.forEach((student) => {
                const existingIndex = student.studentNo
                  ? nextStudents.findIndex((item) => item.studentNo === student.studentNo)
                  : -1;
                if (existingIndex >= 0) {
                  const existing = nextStudents[existingIndex];
                  nextStudents[existingIndex] = {
                    ...existing,
                    name: student.name,
                    gender: student.gender,
                    className: student.className,
                    ...(student.studentNo ? { studentNo: student.studentNo } : {}),
                    ...(student.score !== undefined ? { score: student.score } : {}),
                    ...(student.height !== undefined ? { height: student.height } : {}),
                  };
                } else {
                  nextStudents.push(student);
                }
              });
              return { ...current, solutionConfirmed: false, students: nextStudents };
            });
            setImportOpen(false);
            setImportReady(false);
            setCandidates([]);
            setActiveCandidateId(undefined);
            showToast(`导入完成：新增 ${incomingCount} 人，更新 ${updatedCount} 人`);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          preferences={preferences}
          onSave={(nextPreferences) => {
            setPreferences(nextPreferences);
            setSettingsOpen(false);
            showToast("界面偏好已保存");
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {studentEditor && (
        <StudentEditorDialog
          student={studentEditor.mode === "edit" ? studentEditor.student : undefined}
          defaultClassName={currentClass}
          onClose={() => setStudentEditor(undefined)}
          onSave={saveStudent}
        />
      )}

      {bulkEditIds && (
        <StudentBatchDialog
          count={bulkEditIds.length}
          onClose={() => setBulkEditIds(undefined)}
          onSave={applyBulkStudentPatch}
        />
      )}

      {advancedLayoutOpen && (
        <AdvancedLayoutDialog
          config={history.value.layoutConfig}
          aisleWidth={history.value.aisleWidth}
          onClose={() => setAdvancedLayoutOpen(false)}
          onSave={(config, aisleWidth) => {
            changeLayoutConfig(config, aisleWidth);
            setAdvancedLayoutOpen(false);
            showToast(`高级布局已应用，共 ${config.groups * config.rows * config.columns} 个座位`);
          }}
        />
      )}

      {candidateInfoOpen && (
        <CandidateInfoDialog
          candidates={candidates}
          weights={generationWeights}
          onClose={() => setCandidateInfoOpen(false)}
        />
      )}

      {applyCandidateConfirmOpen && activeCandidate && (
        <ApplyCandidateDialog
          candidate={activeCandidate}
          onClose={() => setApplyCandidateConfirmOpen(false)}
          onConfirm={applyCandidate}
        />
      )}

      {createClassOpen && (
        <CreateClassDialog
          existingNames={classOptions}
          onClose={() => setCreateClassOpen(false)}
          onCreate={createClass}
        />
      )}

      {createVersionOpen && (
        <CreateVersionDialog
          existingNames={versionOptions}
          currentVersion={currentVersion}
          onClose={() => setCreateVersionOpen(false)}
          onCreate={createVersion}
        />
      )}

      {clearClassOpen && (
        <ClearClassDialog
          className={currentClass}
          versionName={currentVersion}
          studentCount={students.length}
          onClose={() => setClearClassOpen(false)}
          onConfirm={clearCurrentClass}
        />
      )}

      {deleteWorkspaceTarget && (
        <DeleteWorkspaceDialog
          kind={deleteWorkspaceTarget}
          name={deleteWorkspaceTarget === "class" ? currentClass : currentVersion}
          versionCount={versionOptions.length}
          onClose={() => setDeleteWorkspaceTarget(undefined)}
          onConfirm={deleteWorkspaceTarget === "class" ? deleteCurrentClass : deleteCurrentVersion}
        />
      )}

      {locked && <LockScreen onUnlock={() => setLocked(false)} />}

      {legalOpen && <LegalNoticeDialog onClose={() => {
        setLegalOpen(false);
        setLegalAcknowledged(Boolean(window.localStorage.getItem(LEGAL_STORAGE_KEY)));
        if (!window.localStorage.getItem(ONBOARDING_STORAGE_KEY)) setOnboardingOpen(true);
      }} />}

      {onboardingOpen && !legalOpen && <OnboardingTour onFinish={finishOnboarding} />}
    </div>
  );
}

const importFieldOptions = ["姓名", "性别", "班级", "学号", "成绩", "身高", "忽略此列"];

type ImportCell = string | number | boolean | Date | null;

function guessImportField(header: string) {
  const normalized = header.toLocaleLowerCase().replace(/\s+/g, "");
  if (/姓名|学生名|name/.test(normalized)) return "姓名";
  if (/性别|男女|gender|sex/.test(normalized)) return "性别";
  if (/班级|班别|class/.test(normalized)) return "班级";
  if (/学号|学籍|编号|student.?no|id/.test(normalized)) return "学号";
  if (/成绩|分数|总分|score/.test(normalized)) return "成绩";
  if (/身高|height/.test(normalized)) return "身高";
  return "忽略此列";
}

function parseCsv(text: string): ImportCell[][] {
  const rows: string[][] = [[]];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      rows.at(-1)?.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)?.push(field);
      field = "";
      rows.push([]);
    } else {
      field += character;
    }
  }
  rows.at(-1)?.push(field);
  return rows
    .map((row, rowIndex) => row.map((cell, cellIndex) => rowIndex === 0 && cellIndex === 0 ? cell.replace(/^\uFEFF/, "") : cell))
    .filter((row) => row.some((cell) => String(cell).trim()));
}

function ImportDialog({ ready, defaultClassName, onReady, onClose, onConfirm }: {
  ready: boolean;
  defaultClassName: string;
  onReady: () => void;
  onClose: () => void;
  onConfirm: (students: Student[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("高二3班学生名单.xlsx");
  const [rows, setRows] = useState<ImportCell[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const headers = (rows[0] ?? []).map((cell) => String(cell ?? "").trim());

  const prepareRows = (nextRows: ImportCell[][], nextFileName: string) => {
    const nextHeaders = (nextRows[0] ?? []).map((cell) => String(cell ?? "").trim());
    if (nextRows.length < 2 || !nextHeaders.some(Boolean)) throw new Error("文件中没有可导入的数据");
    setRows(nextRows);
    setFileName(nextFileName);
    setMappings(Object.fromEntries(nextHeaders.map((header) => [header, guessImportField(header)])));
    setError("");
    onReady();
  };

  const acceptFile = async (file?: File) => {
    setLoading(true);
    setError("");
    try {
      if (!file) {
        prepareRows([
          ["学生姓名", "男女", "班级名称", "学籍号", "总成绩", "身高(cm)"],
          ...initialStudents.map((student) => [student.name, student.gender, student.className, student.studentNo ?? "", student.score ?? "", student.height ?? ""]),
        ], "示例学生名单.xlsx");
      } else if (file.name.toLocaleLowerCase().endsWith(".csv")) {
        prepareRows(parseCsv(await file.text()), file.name);
      } else {
        const { readSheet } = await import("read-excel-file/browser");
        prepareRows(await readSheet(file) as unknown as ImportCell[][], file.name);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取这个文件");
    } finally {
      setLoading(false);
    }
  };

  const importStudents = () => {
    const indexFor = (target: string) => headers.findIndex((header) => mappings[header] === target);
    const nameIndex = indexFor("姓名");
    const genderIndex = indexFor("性别");
    if (nameIndex < 0 || genderIndex < 0) {
      setError("请至少映射姓名和性别字段");
      return;
    }
    const classIndex = indexFor("班级");
    const numberIndex = indexFor("学号");
    const scoreIndex = indexFor("成绩");
    const heightIndex = indexFor("身高");
    const valueAt = (row: ImportCell[], index: number) => index >= 0 ? row[index] : null;
    const invalidGenderRows: number[] = [];
    const imported = rows.slice(1).map((row, index): Student | undefined => {
      const name = String(valueAt(row, nameIndex) ?? "").trim();
      if (!name) return undefined;
      const rawGender = String(valueAt(row, genderIndex) ?? "").trim().toLocaleLowerCase();
      const isFemale = ["女", "女生", "女性", "female", "f", "woman"].includes(rawGender);
      const isMale = ["男", "男生", "男性", "male", "m", "man"].includes(rawGender);
      if (!isFemale && !isMale) {
        invalidGenderRows.push(index + 2);
        return undefined;
      }
      const gender: Student["gender"] = isFemale ? "女" : "男";
      const toOptionalNumber = (value: ImportCell) => {
        if (value == null || value === "") return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      };
      return {
        id: `imported-${Date.now()}-${index}`,
        name,
        gender,
        className: String(valueAt(row, classIndex) ?? defaultClassName).trim() || defaultClassName,
        studentNo: String(valueAt(row, numberIndex) ?? "").trim() || undefined,
        score: toOptionalNumber(valueAt(row, scoreIndex)),
        height: toOptionalNumber(valueAt(row, heightIndex)),
        tags: [],
      };
    }).filter((student): student is Student => Boolean(student));
    if (invalidGenderRows.length) {
      const shownRows = invalidGenderRows.slice(0, 5).join("、");
      setError(`第 ${shownRows}${invalidGenderRows.length > 5 ? " 等" : ""} 行的性别无法识别，请修正为“男”或“女”`);
      return;
    }
    if (!imported.length) {
      setError("没有找到包含姓名的有效数据行");
      return;
    }
    onConfirm(imported);
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div><span className="eyebrow">EXCEL IMPORT</span><h2 id="import-title">导入学生名单</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </header>
        <div className="modal-stepper"><span className={ready ? "is-done" : "is-current"}>1 选择文件</span><i /><span className={ready ? "is-current" : ""}>2 字段映射</span><i /><span>3 检查导入</span></div>
        {!ready ? (
          <>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => void acceptFile(event.target.files?.[0])}
            />
            <button
              className="upload-dropzone"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void acceptFile(event.dataTransfer.files[0]);
              }}
            >
              <UploadCloud size={34} />
              <strong>{loading ? "正在读取文件…" : "拖入 Excel，或点击选择文件"}</strong>
              <span>支持 .xlsx、.csv，首行应为字段名称</span>
              <small>文件只在本机读取，不会上传云端</small>
            </button>
            {error && <p className="import-error" role="alert">{error}</p>}
            <button className="text-button import-sample-button" type="button" disabled={loading} onClick={() => void acceptFile()}>没有文件？载入示例名单</button>
          </>
        ) : (
          <div className="mapping-content">
            <div className="file-ready"><FileSpreadsheet size={20} /><span><strong>{fileName}</strong><small>{Math.max(0, rows.length - 1)} 行 · {headers.length} 列 · 已在本机读取</small></span><Check size={18} /></div>
            <div className="mapping-grid">
              {headers.map((source) => (
                <label key={source}>
                  <span>{source}</span>
                  <ChevronRight size={15} aria-hidden="true" />
                  <select
                    aria-label={`${source}映射到`}
                    value={mappings[source]}
                    onChange={(event) => setMappings((current) => ({ ...current, [source]: event.target.value }))}
                  >
                    {importFieldOptions.map((target) => <option key={target} value={target}>{target}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mapping-result"><Check size={17} /><span><strong>字段映射可以调整</strong>姓名和性别必须匹配，未映射的班级将使用当前班级。</span></div>
            {error && <p className="import-error" role="alert">{error}</p>}
          </div>
        )}
        <footer className="modal-footer">
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="button" disabled={!ready || loading} onClick={importStudents}>检查并导入 <ArrowRight size={17} /></button>
        </footer>
      </section>
    </div>
  );
}

function SettingsDialog({ preferences, onSave, onClose }: { preferences: Preferences; onSave: (preferences: Preferences) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(preferences);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div><span className="eyebrow">PREFERENCES</span><h2 id="settings-title">界面偏好</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </header>
        <div className="settings-list">
          <label><span><Sparkles size={18} /><b>降低动态效果</b><small>关闭弧线换位、波浪入座和脉冲反馈</small></span><input type="checkbox" checked={draft.reducedMotion} onChange={(event) => setDraft((current) => ({ ...current, reducedMotion: event.target.checked }))} /></label>
          <label><span><Keyboard size={18} /><b>显示快捷键提示</b><small>在按钮和菜单中显示键盘操作</small></span><input type="checkbox" checked={draft.showShortcutHints} onChange={(event) => setDraft((current) => ({ ...current, showShortcutHints: event.target.checked }))} /></label>
          <label><span><LockKeyhole size={18} /><b>离开时自动锁定</b><small>切换到其他窗口时遮挡学生信息</small></span><input type="checkbox" checked={draft.autoLock} onChange={(event) => setDraft((current) => ({ ...current, autoLock: event.target.checked }))} /></label>
        </div>
        <footer className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={() => onSave(draft)}>保存偏好</button></footer>
      </section>
    </div>
  );
}

export default App;
