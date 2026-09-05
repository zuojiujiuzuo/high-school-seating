import {
  ArchiveRestore,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Keyboard,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AdvancedLayoutDialog,
  ApplyCandidateDialog,
  ClearClassDialog,
  CreateClassDialog,
  CreateVersionDialog,
  DeleteStudentDialog,
  DeleteWorkspaceDialog,
  DialogSelect,
  LockScreen,
  RestoreDataDialog,
  StudentBatchDialog,
  StudentEditorDialog,
  StudentInfoManagerDialog,
  type StudentBulkPatch,
  type VersionCopyMode,
} from "./components/AppDialogs";
import { ClassroomCanvas } from "./components/ClassroomCanvas";
import { ExportPreview } from "./components/ExportPreview";
import { LegalNoticeDialog } from "./components/LegalNoticeDialog";
import { LicenseGate, LicenseSettingsCard } from "./components/LicenseGate";
import { OnboardingTour } from "./components/OnboardingTour";
import { RosterSidebar } from "./components/RosterSidebar";
import { SeatLayoutOverlay } from "./components/SeatLayoutOverlay";
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
  EXAMPLE_CLASS_NAME,
  initiallySelectedStudentIds,
  students as initialStudents,
} from "./data/mockData";
import {
  importLicenseFile,
  initialLicenseStatus,
  licenseFailure,
  readLicenseStatus,
  type LicenseStatus,
} from "./data/license";
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
import {
  collectDataBackup,
  decryptDataBackup,
  downloadDataBackup,
  encryptDataBackup,
  restoreDataBackup,
  summarizeDataBackup,
  type DataBackupPayload,
  type DataBackupSummary,
} from "./data/dataBackup";
import { moveAssignmentGroup } from "./domain/assignments";
import { createCandidates } from "./domain/candidates";
import { downloadStudentImportTemplate, exportSeatingPlan } from "./domain/export";
import { createGridSeats, createGuardianSeats, createPresetSeats, getLayoutPreset } from "./domain/layoutPresets";
import { buildConstraints, findRuleConflicts } from "./domain/rules";
import { parseScoreGrade, SCORE_GRADES } from "./domain/scoreGrades";
import { parseStudentTags } from "./domain/studentImport";
import { removeStudentFromProject } from "./domain/students";
import { useHistory } from "./hooks/useHistory";
import type {
  AssignmentMap,
  AppTheme,
  ConstraintType,
  DoorPlacement,
  ExportVariant,
  GenerationStrategy,
  GenerationWeights,
  GuardianSide,
  LayoutConfig,
  LayoutPresetId,
  ProjectState,
  ScoreGrade,
  SeatDefinition,
  SeatingCandidate,
  Student,
  WizardStep,
} from "./types";

const EMPTY_LAYOUT_ASSIGNMENTS: AssignmentMap = {};
const DOOR_PLACEMENT_ORDER: DoorPlacement[] = ["front-left", "front-right", "back-left", "back-right"];
const DEFAULT_CLASSES = [EXAMPLE_CLASS_NAME];
const DEFAULT_VERSIONS = ["日常换位 · 第4期"];
const WORKSPACE_CATALOG_STORAGE_KEY = "banzhen-workspace-catalog-v1";
const ONBOARDING_STORAGE_KEY = "banzhen-onboarding-v1";
const INITIAL_LAYOUT_STORAGE_KEY = "banzhen-initial-layout-v1";
const PENDING_INITIAL_LAYOUT_STORAGE_KEY = "banzhen-pending-initial-layout-v1";
const FIRST_IMPORT_AUTO_SEATED_STORAGE_KEY = "banzhen-first-import-auto-seated-v1";
const DEFAULT_GENERATION_WEIGHTS: GenerationWeights = { score: 72, height: 58, appearance: 25 };

function layoutWorkspaceId(className: string, versionName: string) {
  return `${encodeURIComponent(className)}:${encodeURIComponent(versionName)}`;
}

function firstImportAutoSeatedKey(className: string) {
  return `${FIRST_IMPORT_AUTO_SEATED_STORAGE_KEY}:${encodeURIComponent(className)}`;
}

function needsInitialLayout(className: string, versionName: string) {
  return !window.localStorage.getItem(INITIAL_LAYOUT_STORAGE_KEY)
    || window.localStorage.getItem(PENDING_INITIAL_LAYOUT_STORAGE_KEY) === layoutWorkspaceId(className, versionName);
}

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
  const hasMissingGender = students.some((student) => student.gender === "未填写");
  const [currentStep, setCurrentStep] = useState<WizardStep>("seating");
  const [theme, setTheme] = useState<AppTheme>(() => window.localStorage.getItem("banzhen-theme") === "minimal" ? "minimal" : "cute");
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [tool, setTool] = useState<ToolMode>("select");
  const [selectedIds, setSelectedIds] = useState(initiallySelectedStudentIds);
  const [selectedRule, setSelectedRule] = useState<ConstraintType>("not_adjacent");
  const [ruleConflicts, setRuleConflicts] = useState<ReturnType<typeof findRuleConflicts>>([]);
  const [algorithms, setAlgorithms] = useState<GenerationStrategy[]>(["group_balanced"]);
  const generationWeights = DEFAULT_GENERATION_WEIGHTS;
  const [candidates, setCandidates] = useState<SeatingCandidate[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string>();
  const [generationPulse, setGenerationPulse] = useState(0);
  const [printMode, setPrintMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(initialLicenseStatus);
  const [pendingDataRestore, setPendingDataRestore] = useState<{
    fileName: string;
    payload: DataBackupPayload;
    summary: DataBackupSummary;
  }>();
  const [restoringData, setRestoringData] = useState(false);
  const [legalOpen, setLegalOpen] = useState(() => !window.localStorage.getItem(LEGAL_STORAGE_KEY));
  const [legalAcknowledged, setLegalAcknowledged] = useState(() => Boolean(window.localStorage.getItem(LEGAL_STORAGE_KEY)));
  const [importReady, setImportReady] = useState(false);
  const [toast, setToast] = useState<string>();
  const [studentEditor, setStudentEditor] = useState<{ mode: "create" } | { mode: "edit"; student: Student }>();
  const [studentInfoManagerOpen, setStudentInfoManagerOpen] = useState(false);
  const [returnToStudentInfoManager, setReturnToStudentInfoManager] = useState(false);
  const [studentPendingDeletion, setStudentPendingDeletion] = useState<Student>();
  const [bulkEditIds, setBulkEditIds] = useState<string[]>();
  const [advancedLayoutOpen, setAdvancedLayoutOpen] = useState(false);
  const [layoutChooserOpen, setLayoutChooserOpen] = useState(() => needsInitialLayout(currentClass, currentVersion));
  const [layoutChooserRequired, setLayoutChooserRequired] = useState(() => needsInitialLayout(currentClass, currentVersion));
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
  const [exportVariant, setExportVariant] = useState<ExportVariant>("standard");
  const [showGender, setShowGender] = useState(true);
  const [showStudentNo, setShowStudentNo] = useState(false);
  const [showGroupBoundaries, setShowGroupBoundaries] = useState(true);
  const [exportFileName, setExportFileName] = useState(`${EXAMPLE_CLASS_NAME}_座次表_第4期`);
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
  const studentLocations = useMemo(() => {
    const seatMap = new Map(layoutSeats.map((seat) => [seat.id, seat]));
    return Object.entries(displayAssignments).reduce<Record<string, string>>((result, [seatId, studentId]) => {
      const seat = seatMap.get(seatId);
      if (!seat || !studentId) return result;
      result[studentId] = seat.guardian
        ? `${seat.guardian === "left" ? "左" : "右"}护法`
        : `${seat.group + 1} 列 · ${seat.row + 1} 排`;
      return result;
    }, {});
  }, [displayAssignments, layoutSeats]);

  useEffect(() => {
    if (!activeCandidate) setApplyCandidateConfirmOpen(false);
  }, [activeCandidate]);

  useEffect(() => {
    let active = true;
    void readLicenseStatus()
      .then((status) => {
        if (active) setLicenseStatus(status);
      })
      .catch((error) => {
        if (active) {
          setLicenseStatus(licenseFailure(error instanceof Error ? error.message : "无法读取本机授权状态"));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasMissingGender) return;
    setAlgorithms((current) => {
      if (!current.includes("romance_guard")) return current;
      const available = current.filter((strategy) => strategy !== "romance_guard" && strategy !== "gender_separated");
      return available.length ? available : ["random"];
    });
  }, [hasMissingGender]);

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

  const importOfflineLicense = async (file: File) => {
    let nextStatus: LicenseStatus;
    try {
      nextStatus = await importLicenseFile(file);
    } catch (error) {
      nextStatus = licenseFailure(error instanceof Error ? error.message : "授权文件导入失败");
    }
    if (licenseStatus.state === "licensed" && nextStatus.state !== "licensed") {
      showToast(nextStatus.message);
      return nextStatus;
    }
    setLicenseStatus(nextStatus);
    if (nextStatus.state === "licensed") {
      showToast(`正版授权已验证：${nextStatus.licensee ?? nextStatus.licenseId}`);
    }
    return nextStatus;
  };

  const licenseRequired = licenseStatus.state !== "licensed";

  const changeTheme = (nextTheme: AppTheme) => {
    document.documentElement.classList.add("theme-switching");
    setTheme(nextTheme);
    window.localStorage.setItem("banzhen-theme", nextTheme);
    showToast(nextTheme === "cute" ? "已切换到猫爪主题" : "已切换到简约主题");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => document.documentElement.classList.remove("theme-switching"));
    });
  };

  const exportAppData = async () => {
    try {
      saveProjectState(currentClass, currentVersion, history.value);
      window.localStorage.setItem(WORKSPACE_CATALOG_STORAGE_KEY, JSON.stringify(workspaceCatalog));
      window.localStorage.setItem("banzhen-current-class", currentClass);
      window.localStorage.setItem("banzhen-current-version", currentVersion);
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
      window.localStorage.setItem("banzhen-theme", theme);
      const exportedAt = new Date();
      const payload = collectDataBackup(window.localStorage, exportedAt.toISOString());
      const content = await encryptDataBackup(payload);
      downloadDataBackup(content, exportedAt);
      showToast("数据已加密导出为 .zj 文件");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "数据导出失败");
      throw error;
    }
  };

  const prepareDataRestore = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zj")) {
      throw new Error("请选择班阵导出的 .zj 文件");
    }
    try {
      const payload = await decryptDataBackup(await file.text());
      setPendingDataRestore({ fileName: file.name, payload, summary: summarizeDataBackup(payload) });
      setSettingsOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "数据导入失败");
      throw error;
    }
  };

  const confirmDataRestore = () => {
    if (!pendingDataRestore) return;
    setRestoringData(true);
    try {
      restoreDataBackup(pendingDataRestore.payload, window.localStorage);
      window.location.reload();
    } catch (error) {
      setRestoringData(false);
      showToast(error instanceof Error ? `恢复失败：${error.message}` : "数据恢复失败");
    }
  };

  useEffect(() => {
    if (licenseStatus.state !== "licensed") return;
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
  }, [currentClass, currentVersion, history.value, licenseStatus.state, preferences]);

  useEffect(() => {
    if (licenseStatus.state !== "licensed") return;
    window.localStorage.setItem(WORKSPACE_CATALOG_STORAGE_KEY, JSON.stringify(workspaceCatalog));
  }, [licenseStatus.state, workspaceCatalog]);

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
      if (licenseStatus.state !== "licensed") return;
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
  }, [history.redo, history.undo, licenseStatus.state]);

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
      const initialLayoutRequired = needsInitialLayout(nextClass, nextVersion);
      setLayoutChooserRequired(initialLayoutRequired);
      setLayoutChooserOpen(initialLayoutRequired);
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
      setCurrentStep("seating");
      window.localStorage.removeItem(firstImportAutoSeatedKey(name));
      window.localStorage.setItem(PENDING_INITIAL_LAYOUT_STORAGE_KEY, layoutWorkspaceId(name, initialVersion));
      setLayoutChooserRequired(true);
      setLayoutChooserOpen(true);
      setSelectedIds([]);
      setCandidates([]);
      setActiveCandidateId(undefined);
      setCreateClassOpen(false);
      setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      showToast(`已创建${name}，请选择初始座位布局`);
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
    setCurrentStep("seating");
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
      setCurrentStep("seating");
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
      setCurrentStep("seating");
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

  const completeLayoutSelection = () => {
    window.localStorage.setItem(INITIAL_LAYOUT_STORAGE_KEY, new Date().toISOString());
    if (window.localStorage.getItem(PENDING_INITIAL_LAYOUT_STORAGE_KEY) === layoutWorkspaceId(currentClass, currentVersion)) {
      window.localStorage.removeItem(PENDING_INITIAL_LAYOUT_STORAGE_KEY);
    }
    setLayoutChooserRequired(false);
    setLayoutChooserOpen(false);
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
    if (returnToStudentInfoManager) {
      setStudentInfoManagerOpen(true);
      setReturnToStudentInfoManager(false);
    }
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(isEditing ? `${savedStudent.name}的信息已更新` : `已添加${savedStudent.name}，可从待入座名单拖入座位`);
  };

  const updateStudentInlineInfo = (
    studentId: string,
    patch: Partial<Pick<Student, "gender" | "className" | "studentNo" | "score" | "height" | "tags">>,
  ) => {
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      students: current.students.map((student) => student.id === studentId
        ? { ...student, ...patch }
        : student),
    }));
    setCandidates([]);
    setActiveCandidateId(undefined);
  };

  const deleteStudent = () => {
    const student = studentPendingDeletion;
    if (!student) return;
    const removedRuleCount = history.value.constraints.filter((constraint) => (
      constraint.pair.a === student.id || constraint.pair.b === student.id
    )).length;
    history.commit((current) => removeStudentFromProject(current, student.id));
    setSelectedIds((current) => current.filter((id) => id !== student.id));
    setStudentPendingDeletion(undefined);
    setRuleConflicts([]);
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(removedRuleCount > 0
      ? `${student.name}已删除，并移除 ${removedRuleCount} 条关联规则；可使用撤销恢复`
      : `${student.name}已删除，可使用撤销恢复`);
  };

  const toggleClassRepresentative = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    const nextValue = !student.isClassRepresentative;
    history.commit((current) => ({
      ...current,
      students: current.students.map((item) => item.id === studentId
        ? { ...item, isClassRepresentative: nextValue }
        : item),
    }));
    showToast(nextValue ? `${student.name}已设为课代表` : `已取消${student.name}的课代表标记`);
  };

  const addStudentTag = (studentId: string, rawTag: string) => {
    const tag = rawTag.trim();
    const student = students.find((item) => item.id === studentId);
    if (!student || !tag) return;
    const shouldRemove = student.tags?.includes(tag) ?? false;
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      students: current.students.map((item) => item.id === studentId
        ? {
          ...item,
          tags: shouldRemove
            ? (item.tags ?? []).filter((currentTag) => currentTag !== tag)
            : [...(item.tags ?? []), tag],
        }
        : item),
    }));
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(shouldRemove ? `已取消${student.name}的“${tag}”标签` : `已为${student.name}添加“${tag}”标签`);
  };

  const applyBulkStudentPatch = (patch: StudentBulkPatch) => {
    const selected = new Set(bulkEditIds ?? []);
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      students: current.students.map((student) => selected.has(student.id) ? {
        ...student,
        ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
        ...(patch.score !== undefined ? { score: patch.score } : {}),
        ...(patch.height !== undefined ? { height: patch.height } : {}),
        ...(patch.clearTags ? { tags: [] } : patch.tag ? { tags: [...new Set([...(student.tags ?? []), patch.tag])] } : {}),
      } : student),
    }));
    const count = selected.size;
    setBulkEditIds(undefined);
    if (returnToStudentInfoManager) {
      setStudentInfoManagerOpen(true);
      setReturnToStudentInfoManager(false);
    }
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

  const moveSelectedSeats = (sourceSeatIds: string[], targetSeatIds: string[]) => {
    history.commit((current) => ({
      ...current,
      solutionConfirmed: false,
      assignments: moveAssignmentGroup(
        activeCandidate?.assignments ?? current.assignments,
        sourceSeatIds,
        targetSeatIds,
      ),
    }));
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(`已整体移动 ${sourceSeatIds.length} 名学生，可随时撤销`);
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

  const changeLayoutPreset = (nextPreset: LayoutPresetId, guardianSides = history.value.guardianSides) => {
    const presetSeats = createPresetSeats(nextPreset);
    const nextSeats = [...presetSeats, ...createGuardianSeats(guardianSides)];
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
      guardianSides,
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

  const changeLayoutConfig = (
    config: LayoutConfig,
    aisleWidth = history.value.aisleWidth,
    guardianSides = history.value.guardianSides,
  ) => {
    const nextSeats = [...createGridSeats(config), ...createGuardianSeats(guardianSides)];
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
      guardianSides,
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
      { strategies: algorithms },
      generationWeights,
      generationSequence.current,
    );
    setCandidates(nextCandidates);
    setActiveCandidateId(nextCandidates[0].id);
    setGenerationPulse((current) => current + 1);
    showToast("已生成新方案，不满意可再次生成");
  };

  const applyCandidate = () => {
    if (!activeCandidate) return;
    history.commit((current) => ({ ...current, solutionConfirmed: true, assignments: activeCandidate.assignments }));
    setApplyCandidateConfirmOpen(false);
    setCandidates([]);
    setActiveCandidateId(undefined);
    showToast(`${activeCandidate.label}已应用`);
  };

  const exportAssignments = async (
    assignments: AssignmentMap,
    format: Exclude<ExportFormat, "zj">,
    variant: ExportVariant,
  ) => {
    const sourceCanvas = format === "xlsx" || variant === "compact"
      ? null
      : document.querySelector<HTMLCanvasElement>(".export-canvas-preview .pixi-host canvas")
        ?? document.querySelector<HTMLCanvasElement>(".canvas-shell:not(.export-canvas-preview) .pixi-host canvas");
    if (format !== "xlsx" && variant === "standard" && !sourceCanvas) {
      throw new Error("画布正在准备，请稍后再导出");
    }
    return exportSeatingPlan({
      format,
      fileName: exportFileName,
      className: currentClass,
      versionName: currentVersion,
      students,
      seats: layoutSeats,
      assignments,
      showGender,
      showStudentNo,
      showGroupBoundaries,
      tableTheme: exportTheme,
      sourceCanvas,
      appTheme: theme,
      variant,
    });
  };

  const handleExport = async () => {
    if (exportFormat === "zj") {
      await exportAppData();
      return;
    }
    try {
      const message = await exportAssignments(displayAssignments, exportFormat, exportVariant);
      showToast(message);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导出失败，请重试");
    }
  };

  const confirmCandidateAndExport = () => {
    const assignments = activeCandidate?.assignments ?? history.value.assignments;
    const candidateLabel = activeCandidate?.label;
    history.commit((current) => ({ ...current, solutionConfirmed: true, assignments }));
    setCandidates([]);
    setActiveCandidateId(undefined);
    setExportFormat("pdf");
    setExportVariant("compact");
    setCurrentStep("export");
    setPrintMode(false);
    showToast(candidateLabel
      ? `${candidateLabel}已确认，请选择导出格式`
      : "当前座位方案已确认，请选择导出格式");
  };

  function handleStepChange(step: WizardStep) {
    const targetIndex = steps.findIndex((item) => item.id === step);
    const hasIncompleteRequiredFields = students.some((student) => !student.name.trim() || !student.studentNo?.trim());
    if (targetIndex > 0 && hasIncompleteRequiredFields) {
      setCurrentStep("roster");
      showToast("请先补全姓名和学号");
      return;
    }
    if (targetIndex > 1 && !layoutSeats.some((seat) => !seat.disabled)) {
      setCurrentStep("layout");
      showToast("请先创建至少一个可用座位");
      return;
    }
    if (step === "export" && activeCandidate) {
      setCurrentStep("seating");
      showToast("请先应用当前方案，再进入导出");
      return;
    }
    if (step === "export" && !history.value.solutionConfirmed) {
      setCurrentStep("seating");
      showToast("请先生成并应用方案");
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
        : "请先在右侧“方案”页生成方案";
      return (
        <button
          className="workflow-primary"
          type="button"
          disabled={!activeCandidate}
          title={activeCandidate ? "确认应用当前预览方案" : unavailableReason}
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

  const usesStructuredExportPreview = currentStep === "export" && (exportFormat === "xlsx" || exportFormat === "zj" || exportVariant === "compact");
  const isCanvasStep = currentStep === "layout"
    || currentStep === "seating"
    || (currentStep === "export" && !usesStructuredExportPreview);

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
    <div className={`app-shell theme-${theme} font-size-${preferences.fontSize} mode-simple ${printMode ? "print-mode" : ""} ${reducedMotion ? "reduce-motion" : ""} ${preferences.showShortcutHints ? "" : "hide-shortcuts"}`}>
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
            licenseStatus={licenseStatus}
            theme={theme}
            fontSize={preferences.fontSize}
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
            onImportClassFile={prepareDataRestore}
            onClearClass={() => setClearClassOpen(true)}
            onDeleteClass={() => setDeleteWorkspaceTarget("class")}
            onCreateVersion={() => setCreateVersionOpen(true)}
            onDeleteVersion={() => setDeleteWorkspaceTarget("version")}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onTogglePrint={enterPrintMode}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenLicense={() => setSettingsOpen(true)}
            onOpenOnboarding={() => {
              setCurrentStep("seating");
              setTool("select");
              setOnboardingOpen(true);
            }}
            onOpenLegal={() => setLegalOpen(true)}
            onThemeChange={changeTheme}
            onFontSizeChange={(fontSize) => {
              setPreferences((current) => ({ ...current, fontSize }));
              showToast({
                auto: "字体将随窗口大小自动调整",
                standard: "已切换为标准字体",
                large: "已切换为大字",
                xlarge: "已切换为超大字",
              }[fontSize]);
            }}
          />
        </>
      )}

      <main className={`workspace-grid step-${currentStep}`}>
        {!printMode && currentStep === "seating" && (
          <RosterSidebar
            students={unseatedStudents}
            selectedIds={selectedIds}
            onToggleStudent={toggleStudent}
            onAddStudentTag={addStudentTag}
            onDeleteStudent={setStudentPendingDeletion}
            onOpenImport={() => setImportOpen(true)}
            onAddStudent={() => setStudentEditor({ mode: "create" })}
            onOpenStudentInfo={() => setStudentInfoManagerOpen(true)}
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
              onDeleteStudent={setStudentPendingDeletion}
              onBatchEdit={setBulkEditIds}
            />
            <RosterPanel onImport={() => setImportOpen(true)} onAddStudent={() => setStudentEditor({ mode: "create" })} onNext={() => handleStepChange("layout")} />
          </>
        )}

        {isCanvasStep && (
          <div className={`canvas-shell ${currentStep === "export" ? "export-canvas-preview" : ""} ${toast && !printMode ? "has-toast" : ""}`} data-tour-target="seating-canvas">
            {toast && !printMode && <div className="toast canvas-toast" role="status"><Check size={18} />{toast}</div>}
            {!printMode && currentStep !== "export" && (
              <ToolRail
                active={tool}
                layoutConfig={history.value.layoutConfig}
                layoutPreset={layoutPreset}
                students={students}
                studentLocations={studentLocations}
                showStudentSearch={currentStep === "seating"}
                onChange={setTool}
                onOpenLayout={() => setLayoutChooserOpen(true)}
                onApplyPreset={changeLayoutPreset}
                onApplyLayout={(config) => {
                  changeLayoutConfig(config);
                  showToast(`已应用 ${config.groups} 列 × ${config.rows} 排布局`);
                }}
                onTemplateSaved={showToast}
                onSelectStudent={(studentId) => {
                  const student = students.find((item) => item.id === studentId);
                  setTool("select");
                  setSelectedIds([studentId]);
                  showToast(studentLocations[studentId]
                    ? `已定位 ${student?.name ?? "学生"} · ${studentLocations[studentId]}`
                    : `${student?.name ?? "学生"}当前在待入座名单`);
                }}
              />
            )}
            <ClassroomCanvas
              students={students}
              seats={layoutSeats}
              assignments={currentStep === "layout" ? EMPTY_LAYOUT_ASSIGNMENTS : displayAssignments}
              selectedStudentIds={printMode ? [] : selectedIds}
              constraints={history.value.constraints}
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
              onMoveStudentGroup={moveSelectedSeats}
              onSeatStudent={seatStudent}
              onAddSeat={addCanvasSeat}
              onMoveSeat={moveCanvasSeat}
              onClearSeat={clearCanvasSeat}
              onAisleWidthChange={changeAisleWidth}
              onMovePodium={movePodium}
              onToolFeedback={showToast}
              onToggleSeatDisabled={toggleSeatDisabled}
              onToggleClassRepresentative={toggleClassRepresentative}
              onAddStudentTag={addStudentTag}
              onToggleGuardianSeat={toggleGuardianSeat}
            />
            {currentStep === "export" && (
              <div className="canvas-export-status">
                {exportVariant === "compact" ? "精简版 · 导出时自动居中排版" : "普通版 · 按当前画布导出"}
              </div>
            )}
          </div>
        )}

        {!printMode && currentStep === "layout" && (
          <LayoutPanel
            preset={layoutPreset}
            doorPlacements={doorPlacements}
            disabledSeatCount={history.value.disabledSeatIds.length}
            groups={history.value.layoutConfig.groups}
            rows={history.value.layoutConfig.rows}
            seatsPerDesk={history.value.layoutConfig.columns}
            aisleWidth={history.value.aisleWidth}
            onPresetChange={changeLayoutPreset}
            onDoorPlacementToggle={toggleDoorPlacement}
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
            hasMissingGender={hasMissingGender}
            onOpenStudentInfo={() => setStudentInfoManagerOpen(true)}
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
            onGenerate={generateSolutions}
            simpleMode
            hasGeneratedPlan={Boolean(activeCandidate)}
            onConfirmAndExport={confirmCandidateAndExport}
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
              variant={exportVariant}
              onFormatChange={setExportFormat}
              onShowGenderChange={setShowGender}
              onShowStudentNoChange={setShowStudentNo}
              onShowGroupBoundariesChange={setShowGroupBoundaries}
              onFileNameChange={setExportFileName}
              onThemeChange={setExportTheme}
              onVariantChange={setExportVariant}
              onExport={handleExport}
              onImportClassFile={prepareDataRestore}
              onBack={() => setCurrentStep("seating")}
            />
            {usesStructuredExportPreview && exportFormat !== "zj" && (
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
            {exportFormat === "zj" && (
              <section className="class-file-preview-shell" aria-labelledby="class-file-preview-title">
                <div className="class-file-preview-card">
                  <span className="class-file-preview-icon" aria-hidden="true"><ArchiveRestore size={34} strokeWidth={1.7} /></span>
                  <span className="eyebrow">CLASS FILE · .ZJ</span>
                  <h2 id="class-file-preview-title">班级文件用于整机迁移</h2>
                  <p>导出后把文件带到新电脑，在同一位置选择“导入班级文件”，即可恢复整个工作区。</p>
                  <dl>
                    <div><dt>班级</dt><dd>{workspaceCatalog.classes.length}</dd></div>
                    <div><dt>座位版本</dt><dd>{Object.values(workspaceCatalog.versionsByClass).reduce((total, versions) => total + versions.length, 0)}</dd></div>
                    <div><dt>文件保护</dt><dd>AES-GCM 加密</dd></div>
                  </dl>
                  <div className="class-file-preview-tip"><LockKeyhole size={17} /><span>学生名单、规则、模板和界面设置会一起保存，导入前会先显示备份摘要供确认。</span></div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {layoutChooserOpen && (
        <SeatLayoutOverlay
          config={history.value.layoutConfig}
          preset={layoutPreset}
          required={layoutChooserRequired}
          onClose={() => {
            if (!layoutChooserRequired) setLayoutChooserOpen(false);
          }}
          onApplyCustom={(config) => {
            changeLayoutConfig(config);
            completeLayoutSelection();
            showToast(`布局已更新：${config.groups} 列 × ${config.rows} 排，共 ${config.groups * config.rows * config.columns + history.value.guardianSides.length} 座`);
          }}
          onApplyPreset={(nextPreset) => {
            changeLayoutPreset(nextPreset);
            completeLayoutSelection();
          }}
        />
      )}

      {printMode && (
        <button className="exit-print-button" type="button" onClick={exitPrintMode}>
          <X size={17} />退出纯净视图
        </button>
      )}

      {toast && !printMode && !isCanvasStep && <div className="toast" role="status"><Check size={18} />{toast}</div>}

      {importOpen && (
        <ImportDialog
          ready={importReady}
          onReady={() => setImportReady(true)}
          onClose={() => {
            setImportOpen(false);
            setImportReady(false);
          }}
          defaultClassName={currentClass}
          onDownloadTemplate={() => void downloadStudentImportTemplate(currentClass).then(showToast).catch((error) => showToast(error instanceof Error ? error.message : "模板下载失败"))}
          onConfirm={(importedStudents) => {
            const knownByNumber = new Map(history.value.students.filter((student) => student.studentNo).map((student) => [student.studentNo, student]));
            const updatedCount = importedStudents.filter((student) => student.studentNo && knownByNumber.has(student.studentNo)).length;
            const incomingCount = importedStudents.length - updatedCount;
            const nextStudents = [...history.value.students];
            importedStudents.forEach((student) => {
              const existingIndex = student.studentNo
                ? nextStudents.findIndex((item) => item.studentNo === student.studentNo)
                : -1;
              if (existingIndex >= 0) {
                const existing = nextStudents[existingIndex];
                nextStudents[existingIndex] = {
                  ...existing,
                  name: student.name,
                  className: student.className,
                  ...(student.studentNo ? { studentNo: student.studentNo } : {}),
                  ...(student.gender !== "未填写" ? { gender: student.gender } : {}),
                  ...(student.score !== undefined ? { score: student.score } : {}),
                  ...(student.height !== undefined ? { height: student.height } : {}),
                  ...(student.tags?.length ? { tags: student.tags } : {}),
                };
              } else {
                nextStudents.push(student);
              }
            });
            history.commit((current) => ({ ...current, solutionConfirmed: false, students: nextStudents }));
            setImportOpen(false);
            setImportReady(false);
            const autoSeatingKey = firstImportAutoSeatedKey(currentClass);
            const shouldAutoSeat = !window.localStorage.getItem(autoSeatingKey)
              && layoutSeats.some((seat) => !seat.disabled);
            if (shouldAutoSeat) {
              const romanceGuardReady = nextStudents.every((student) => student.gender !== "未填写");
              const defaultStrategies: GenerationStrategy[] = romanceGuardReady
                ? ["romance_guard", "height"]
                : ["height"];
              generationSequence.current += 1;
              const nextCandidates = createCandidates(
                history.value.assignments,
                layoutSeats,
                history.value.constraints,
                nextStudents,
                { strategies: defaultStrategies },
                generationWeights,
                generationSequence.current,
              );
              setAlgorithms(defaultStrategies);
              setCandidates(nextCandidates);
              setActiveCandidateId(nextCandidates[0]?.id);
              setGenerationPulse((current) => current + 1);
              window.localStorage.setItem(autoSeatingKey, new Date().toISOString());
              showToast(romanceGuardReady
                ? `导入完成：新增 ${incomingCount} 人，更新 ${updatedCount} 人；已按防早恋＋身高生成方案`
                : `导入完成：新增 ${incomingCount} 人，更新 ${updatedCount} 人；已按身高生成方案，补充性别后可启用防早恋`);
            } else {
              setCandidates([]);
              setActiveCandidateId(undefined);
              showToast(`导入完成：新增 ${incomingCount} 人，更新 ${updatedCount} 人`);
            }
          }}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          preferences={preferences}
          licenseStatus={licenseStatus}
          onExportData={exportAppData}
          onImportData={prepareDataRestore}
          onImportLicense={importOfflineLicense}
          onSave={(nextPreferences) => {
            setPreferences(nextPreferences);
            setSettingsOpen(false);
            showToast("界面偏好已保存");
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {pendingDataRestore && (
        <RestoreDataDialog
          fileName={pendingDataRestore.fileName}
          exportedAt={pendingDataRestore.payload.exportedAt}
          summary={pendingDataRestore.summary}
          restoring={restoringData}
          onClose={() => setPendingDataRestore(undefined)}
          onConfirm={confirmDataRestore}
        />
      )}

      {studentEditor && (
        <StudentEditorDialog
          student={studentEditor.mode === "edit" ? studentEditor.student : undefined}
          defaultClassName={currentClass}
          onClose={() => {
            setStudentEditor(undefined);
            if (returnToStudentInfoManager) {
              setStudentInfoManagerOpen(true);
              setReturnToStudentInfoManager(false);
            }
          }}
          onSave={saveStudent}
        />
      )}

      {studentInfoManagerOpen && (
        <StudentInfoManagerDialog
          students={students}
          onClose={() => setStudentInfoManagerOpen(false)}
          onInlineUpdate={updateStudentInlineInfo}
          onEdit={(student) => {
            setStudentInfoManagerOpen(false);
            setReturnToStudentInfoManager(true);
            setStudentEditor({ mode: "edit", student });
          }}
          onBatchEdit={(studentIds) => {
            setStudentInfoManagerOpen(false);
            setReturnToStudentInfoManager(true);
            setBulkEditIds(studentIds);
          }}
        />
      )}

      {studentPendingDeletion && (() => {
        const relatedRules = history.value.constraints.filter((constraint) => (
          constraint.pair.a === studentPendingDeletion.id || constraint.pair.b === studentPendingDeletion.id
        ));
        const relatedStudentIds = new Set(relatedRules.map((constraint) => (
          constraint.pair.a === studentPendingDeletion.id ? constraint.pair.b : constraint.pair.a
        )));
        return (
          <DeleteStudentDialog
            student={studentPendingDeletion}
            relatedRuleCount={relatedRules.length}
            relatedStudentCount={relatedStudentIds.size}
            onClose={() => setStudentPendingDeletion(undefined)}
            onConfirm={deleteStudent}
          />
        );
      })()}

      {bulkEditIds && (
        <StudentBatchDialog
          count={bulkEditIds.length}
          onClose={() => {
            setBulkEditIds(undefined);
            if (returnToStudentInfoManager) {
              setStudentInfoManagerOpen(true);
              setReturnToStudentInfoManager(false);
            }
          }}
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

      {onboardingOpen && !legalOpen && !layoutChooserOpen && <OnboardingTour onFinish={finishOnboarding} />}

      {licenseRequired && <LicenseGate status={licenseStatus} onImport={importOfflineLicense} />}
    </div>
  );
}

const importFieldOptions = ["姓名", "学号", "性别", "班级", "成绩等级", "身高", "标签", "忽略此列"];
const requiredImportFields = new Set(["姓名", "学号"]);
const importScoreGradeOptions = SCORE_GRADES.map((grade) => ({ value: grade, label: grade }));

type ImportCell = string | number | boolean | Date | null;

function importCellText(value: ImportCell | undefined) {
  if (value instanceof Date) return value.toLocaleDateString("zh-CN");
  return value == null ? "" : String(value);
}

function normalizeImportGender(value: ImportCell | undefined): Student["gender"] {
  const normalized = importCellText(value).trim().toLocaleLowerCase();
  if (["女", "女生", "女性", "female", "f", "woman"].includes(normalized)) return "女";
  if (["男", "男生", "男性", "male", "m", "man"].includes(normalized)) return "男";
  return "未填写";
}

function guessImportField(header: string) {
  const normalized = header.toLocaleLowerCase().replace(/\s+/g, "");
  if (/姓名|学生名|name/.test(normalized)) return "姓名";
  if (/性别|男女|gender|sex/.test(normalized)) return "性别";
  if (/班级|班别|class/.test(normalized)) return "班级";
  if (/学号|学籍|编号|student.?no|id/.test(normalized)) return "学号";
  if (/成绩|等级|分数|总分|score|grade/.test(normalized)) return "成绩等级";
  if (/身高|height/.test(normalized)) return "身高";
  if (/标签|标记/.test(normalized) || /^(?:tags?|labels?)$/.test(normalized)) return "标签";
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

function ImportFieldPicker({ source, value, onChange }: {
  source: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOnPointerDown);
    window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus());
    return () => window.removeEventListener("pointerdown", closeOnPointerDown);
  }, [open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveOptionFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']")];
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1) % options.length
          : (currentIndex - 1 + options.length) % options.length;
    options[nextIndex]?.focus();
  };

  return (
    <div
      className={`import-field-picker ${open ? "is-open" : ""}`}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        className="import-field-trigger"
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`将${source}列设为，当前是${value}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span>{value}</span>
        {requiredImportFields.has(value) && <small>必填</small>}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="import-field-menu" id={menuId} role="menu" aria-label={`将${source}列设为`} onKeyDown={moveOptionFocus}>
          <div className="import-field-menu-heading">
            <small>{source}</small>
            <strong>这列对应哪个字段？</strong>
          </div>
          {importFieldOptions.map((option) => (
            <button
              className={`${option === value ? "is-current" : ""} ${option === "忽略此列" ? "is-muted" : ""}`}
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              tabIndex={option === value ? 0 : -1}
              onClick={() => {
                onChange(option);
                closeAndFocusTrigger();
              }}
            >
              <span>{option}</span>
              {requiredImportFields.has(option) && <small>必填</small>}
              {option === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportDialog({ ready, defaultClassName, onReady, onClose, onDownloadTemplate, onConfirm }: {
  ready: boolean;
  defaultClassName: string;
  onReady: () => void;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onConfirm: (students: Student[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState(`${EXAMPLE_CLASS_NAME}学生名单.xlsx`);
  const [rows, setRows] = useState<ImportCell[][]>([]);
  const [mappings, setMappings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const headers = (rows[0] ?? []).map((cell) => String(cell ?? "").trim());
  const nameIndex = mappings.findIndex((target) => target === "姓名");
  const numberIndex = mappings.findIndex((target) => target === "学号");
  const requiredMappingReady = nameIndex >= 0 && numberIndex >= 0;
  const missingRequiredCellCount = requiredMappingReady
    ? rows.slice(1).reduce((count, row) => (
      count
      + (importCellText(row[nameIndex]).trim() ? 0 : 1)
      + (importCellText(row[numberIndex]).trim() ? 0 : 1)
    ), 0)
    : 0;

  const prepareRows = (nextRows: ImportCell[][], nextFileName: string) => {
    const columnCount = Math.max(0, ...nextRows.map((row) => row.length));
    if (nextRows.length < 2 || columnCount < 2) throw new Error("数据不对：至少需要两列数据（姓名和学号）");
    const nextHeaders = Array.from({ length: columnCount }, (_, index) => (
      importCellText(nextRows[0]?.[index]).trim() || `第 ${index + 1} 列`
    ));
    const dataRows = nextRows.slice(1).filter((row) => row.some((cell) => importCellText(cell).trim()));
    if (!dataRows.length) throw new Error("数据不对：文件中没有可导入的数据行");
    const normalizedRows: ImportCell[][] = [
      nextHeaders,
      ...dataRows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? "")),
    ];
    const usedTargets = new Set<string>();
    const nextMappings = nextHeaders.map((header) => {
      const guessed = guessImportField(header);
      if (guessed === "忽略此列" || usedTargets.has(guessed)) return "忽略此列";
      usedTargets.add(guessed);
      return guessed;
    });
    setRows(normalizedRows);
    setFileName(nextFileName);
    setMappings(nextMappings);
    setError("");
    onReady();
  };

  const acceptFile = async (file?: File) => {
    setLoading(true);
    setError("");
    try {
      if (!file) {
        prepareRows([
          ["学生姓名", "男女", "班级名称", "学籍号", "成绩等级", "身高(cm)", "标签"],
          ...initialStudents.map((student) => [student.name, student.gender, student.className, student.studentNo ?? "", student.score ?? "", student.height ?? "", student.tags?.join("、") ?? ""]),
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

  const changeMapping = (columnIndex: number, target: string) => {
    setMappings((current) => current.map((value, index) => {
      if (index === columnIndex) return target;
      if (target !== "忽略此列" && value === target) return "忽略此列";
      return value;
    }));
    setError("");
  };

  const updatePreviewCell = (dataRowIndex: number, columnIndex: number, value: string) => {
    setRows((current) => current.map((row, rowIndex) => (
      rowIndex === dataRowIndex + 1
        ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell)
        : row
    )));
    setError("");
  };

  const deletePreviewRow = (dataRowIndex: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== dataRowIndex + 1));
    setError("");
  };

  const importStudents = () => {
    if (nameIndex < 0 || numberIndex < 0) {
      setError("请至少映射姓名和学号字段");
      return;
    }
    const indexFor = (target: string) => mappings.findIndex((mapping) => mapping === target);
    const classIndex = indexFor("班级");
    const genderIndex = indexFor("性别");
    const scoreIndex = indexFor("成绩等级");
    const heightIndex = indexFor("身高");
    const tagsIndex = indexFor("标签");
    const valueAt = (row: ImportCell[], index: number) => index >= 0 ? row[index] : null;
    const incompleteRows: number[] = [];
    const invalidScoreRows = scoreIndex < 0 ? [] : rows.slice(1).flatMap((row, index) => {
      const value = importCellText(valueAt(row, scoreIndex)).trim();
      return value && !parseScoreGrade(value) ? [index + 2] : [];
    });
    if (invalidScoreRows.length) {
      const shownRows = invalidScoreRows.slice(0, 5).join("、");
      setError(`第 ${shownRows}${invalidScoreRows.length > 5 ? " 等" : ""} 行的成绩等级无效，只能选择 A、B、C 或 D`);
      return;
    }
    const imported = rows.slice(1).map((row, index): Student | undefined => {
      const name = importCellText(valueAt(row, nameIndex)).trim();
      const studentNo = importCellText(valueAt(row, numberIndex)).trim();
      if (!name || !studentNo) {
        incompleteRows.push(index + 2);
        return undefined;
      }
      const toOptionalNumber = (value: ImportCell) => {
        if (value == null || value === "") return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      };
      return {
        id: `imported-${Date.now()}-${index}`,
        name,
        gender: normalizeImportGender(valueAt(row, genderIndex)),
        className: importCellText(valueAt(row, classIndex)).trim() || defaultClassName,
        studentNo,
        score: parseScoreGrade(valueAt(row, scoreIndex)),
        height: toOptionalNumber(valueAt(row, heightIndex)),
        tags: parseStudentTags(valueAt(row, tagsIndex)),
      };
    }).filter((student): student is Student => Boolean(student));
    if (incompleteRows.length) {
      const shownRows = incompleteRows.slice(0, 5).join("、");
      setError(`第 ${shownRows}${incompleteRows.length > 5 ? " 等" : ""} 行缺少姓名或学号，请补全后再导入`);
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
      <section className={`modal import-dialog ${ready ? "is-preview" : ""}`} role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div><span className="eyebrow">EXCEL IMPORT</span><h2 id="import-title">导入学生名单</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </header>
        <div className="modal-stepper"><span className={ready ? "is-done" : "is-current"}>1 上传文件</span><i /><span className={ready ? "is-current" : ""}>2 确认字段并编辑数据</span></div>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".xlsx,.csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void acceptFile(file);
          }}
        />
        {!ready ? (
          <div className="import-upload-stage">
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
              <span>支持任意列结构的 .xlsx、.csv，首行应为字段名称</span>
              <small>文件只在本机读取，不会上传云端</small>
            </button>
            {error && <p className="import-error" role="alert">{error}</p>}
            <div className="import-helper-actions">
              <button className="secondary-button" type="button" disabled={loading} onClick={onDownloadTemplate}><Download size={16} />下载导入模板</button>
              <button className="text-button import-sample-button" type="button" disabled={loading} onClick={() => void acceptFile()}>载入示例名单</button>
            </div>
          </div>
        ) : (
          <div className="mapping-content">
            <div className="file-ready">
              <FileSpreadsheet size={20} />
              <span><strong>{fileName}</strong><small>{Math.max(0, rows.length - 1)} 行 · {headers.length} 列 · 已在本机读取</small></span>
              <button className="text-button" type="button" onClick={() => fileInputRef.current?.click()}><RefreshCw size={14} />重新选择</button>
            </div>
            <div className={`import-mapping-guide ${requiredMappingReady && missingRequiredCellCount === 0 ? "is-complete" : ""}`} role="status" aria-live="polite">
              <div className="import-guide-intro">
                <span>填写指导</span>
                <strong>{requiredMappingReady ? "必填字段已映射，请核对数据" : "先完成 2 个必填字段"}</strong>
                <small>打开每列表头的下拉进行设置，红框表示仍需填写。</small>
              </div>
              <div className="import-guide-steps" aria-label="导入必填步骤">
                <div className={nameIndex >= 0 ? "is-ready" : ""}>
                  <i>{nameIndex >= 0 ? <Check size={13} /> : "1"}</i>
                  <span><small>设置姓名列</small><strong>{nameIndex >= 0 ? headers[nameIndex] : "待选择"}</strong></span>
                </div>
                <ArrowRight size={15} aria-hidden="true" />
                <div className={numberIndex >= 0 ? "is-ready" : ""}>
                  <i>{numberIndex >= 0 ? <Check size={13} /> : "2"}</i>
                  <span><small>设置学号列</small><strong>{numberIndex >= 0 ? headers[numberIndex] : "待选择"}</strong></span>
                </div>
                <ArrowRight size={15} aria-hidden="true" />
                <div className={requiredMappingReady && missingRequiredCellCount === 0 ? "is-ready" : ""}>
                  <i>{requiredMappingReady && missingRequiredCellCount === 0 ? <Check size={13} /> : "3"}</i>
                  <span><small>检查必填数据</small><strong>{!requiredMappingReady ? "等待映射" : missingRequiredCellCount > 0 ? `还缺 ${missingRequiredCellCount} 处` : "可以导入"}</strong></span>
                </div>
              </div>
            </div>
            <div className="import-preview-scroll">
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th className="import-row-number">行</th>
                    {headers.map((source, columnIndex) => (
                      <th key={`${source}-${columnIndex}`}>
                        <span title={source}>{source}</span>
                        <ImportFieldPicker
                          source={source}
                          value={mappings[columnIndex] ?? "忽略此列"}
                          onChange={(target) => changeMapping(columnIndex, target)}
                        />
                      </th>
                    ))}
                    <th className="import-row-action">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(1).map((row, dataRowIndex) => (
                    <tr key={dataRowIndex}>
                      <th className="import-row-number" scope="row">{dataRowIndex + 2}</th>
                      {headers.map((header, columnIndex) => {
                        const isRequiredColumn = columnIndex === nameIndex || columnIndex === numberIndex;
                        const isMissingRequiredValue = isRequiredColumn && !importCellText(row[columnIndex]).trim();
                        const isScoreGradeColumn = mappings[columnIndex] === "成绩等级";
                        const scoreGrade = parseScoreGrade(row[columnIndex]) ?? "";
                        const isInvalidScoreGrade = isScoreGradeColumn && Boolean(importCellText(row[columnIndex]).trim()) && !scoreGrade;
                        return (
                          <td className={isMissingRequiredValue || isInvalidScoreGrade ? "is-required-missing" : ""} key={`${header}-${columnIndex}`}>
                            {isScoreGradeColumn ? (
                              <DialogSelect<ScoreGrade | "">
                                id={`import-score-grade-${dataRowIndex}-${columnIndex}`}
                                label={`第 ${dataRowIndex + 2} 行，成绩等级`}
                                className="import-score-grade-select score-grade-select"
                                value={scoreGrade}
                                options={importScoreGradeOptions}
                                placeholder={isInvalidScoreGrade ? "需选择" : "请选择"}
                                invalid={isInvalidScoreGrade}
                                onChange={(grade) => updatePreviewCell(dataRowIndex, columnIndex, grade)}
                              />
                            ) : (
                              <input
                                aria-label={`第 ${dataRowIndex + 2} 行，${header}`}
                                aria-invalid={isMissingRequiredValue || undefined}
                                value={importCellText(row[columnIndex])}
                                onChange={(event) => updatePreviewCell(dataRowIndex, columnIndex, event.target.value)}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="import-row-action">
                        <button className="icon-button" type="button" aria-label={`删除第 ${dataRowIndex + 2} 行`} title="删除此行" onClick={() => deletePreviewRow(dataRowIndex)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {rows.length <= 1 && <tr><td className="import-preview-empty" colSpan={headers.length + 2}>当前没有可导入的数据行，请重新选择文件。</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mapping-result"><Check size={17} /><span><strong>数据只在本机预览和修改</strong>未映射的班级使用“{defaultClassName}”，同一学号会更新已有学生。</span></div>
            {error && <p className="import-error" role="alert">{error}</p>}
          </div>
        )}
        <footer className="modal-footer">
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="button" disabled={!ready || loading || rows.length <= 1 || nameIndex < 0 || numberIndex < 0} onClick={importStudents}>确认导入 {Math.max(0, rows.length - 1)} 行 <ArrowRight size={17} /></button>
        </footer>
      </section>
    </div>
  );
}

function SettingsDialog({ preferences, licenseStatus, onExportData, onImportData, onImportLicense, onSave, onClose }: {
  preferences: Preferences;
  licenseStatus: LicenseStatus;
  onExportData: () => Promise<void>;
  onImportData: (file: File) => Promise<void>;
  onImportLicense: (file: File) => Promise<LicenseStatus>;
  onSave: (preferences: Preferences) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(preferences);
  const [dataAction, setDataAction] = useState<"export" | "import">();
  const [dataError, setDataError] = useState<string>();
  const importInputRef = useRef<HTMLInputElement>(null);
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
          <div><span className="eyebrow">SETTINGS</span><h2 id="settings-title">设置与授权</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </header>
        <div className="settings-list">
          <label><span><Sparkles size={18} /><b>降低动态效果</b><small>关闭弧线换位、波浪入座和脉冲反馈</small></span><input type="checkbox" checked={draft.reducedMotion} onChange={(event) => setDraft((current) => ({ ...current, reducedMotion: event.target.checked }))} /></label>
          <label><span><Keyboard size={18} /><b>显示快捷键提示</b><small>在按钮和菜单中显示键盘操作</small></span><input type="checkbox" checked={draft.showShortcutHints} onChange={(event) => setDraft((current) => ({ ...current, showShortcutHints: event.target.checked }))} /></label>
          <label><span><LockKeyhole size={18} /><b>离开时自动锁定</b><small>切换到其他窗口时遮挡学生信息</small></span><input type="checkbox" checked={draft.autoLock} onChange={(event) => setDraft((current) => ({ ...current, autoLock: event.target.checked }))} /></label>
        </div>
        <div className="settings-license-section">
          <div className="settings-section-heading"><span className="eyebrow">OFFLINE LICENSE</span><h3>正版验证</h3></div>
          <LicenseSettingsCard status={licenseStatus} onImport={onImportLicense} />
        </div>
        <div className="settings-data-section">
          <div className="settings-section-heading"><span className="eyebrow">DATA TRANSFER</span><h3>数据迁移</h3></div>
          <div className="settings-data-card">
            <div className="settings-data-copy"><LockKeyhole size={19} /><span><b>换电脑也能继续使用</b><small>导出全部班级、座位版本、规则和设置。文件内容为加密数据，导入后可直接恢复。</small></span></div>
            <div className="settings-data-actions">
              <button className="secondary-button" type="button" disabled={Boolean(dataAction)} onClick={() => {
                setDataError(undefined);
                setDataAction("export");
                void onExportData().catch(() => setDataError("导出失败，请检查浏览器的下载权限。")).finally(() => setDataAction(undefined));
              }}><Download size={16} />{dataAction === "export" ? "正在导出…" : "导出 .zj"}</button>
              <button className="secondary-button" type="button" disabled={Boolean(dataAction)} onClick={() => importInputRef.current?.click()}><UploadCloud size={16} />{dataAction === "import" ? "正在读取…" : "导入 .zj"}</button>
              <input
                ref={importInputRef}
                className="visually-hidden"
                type="file"
                accept=".zj,application/octet-stream"
                aria-label="选择班阵 .zj 备份文件"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setDataError(undefined);
                  setDataAction("import");
                  void onImportData(file).catch((error) => setDataError(error instanceof Error ? error.message : "导入失败，请检查备份文件。")).finally(() => setDataAction(undefined));
                }}
              />
            </div>
            {dataError && <p className="settings-data-error" role="alert">{dataError}</p>}
          </div>
        </div>
        <footer className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" onClick={() => onSave(draft)}>保存偏好</button></footer>
      </section>
    </div>
  );
}

export default App;
