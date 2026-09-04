import type { AssignmentMap, SeatDefinition, Student } from "../types";

export type SeatingExportFormat = "xlsx" | "svg" | "png" | "pdf" | "pptx";

interface SeatingExportOptions {
  format: SeatingExportFormat;
  fileName: string;
  className: string;
  versionName: string;
  students: Student[];
  seats: SeatDefinition[];
  assignments: AssignmentMap;
  showGender: boolean;
  showStudentNo: boolean;
  showGroupBoundaries: boolean;
  tableTheme: "paper" | "ink";
  sourceCanvas?: HTMLCanvasElement | null;
  appTheme?: "minimal" | "cute";
}

function safeFileName(value: string) {
  return (value.trim() || "班级座次表").replace(/[\\/:*?"<>|]/g, "-");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

function sortedSeats(seats: SeatDefinition[]) {
  return [...seats].sort((a, b) => {
    if (a.guardian || b.guardian) {
      if (a.guardian && b.guardian) {
        const guardianOrder = { left: 0, right: 1 } as const;
        return guardianOrder[a.guardian] - guardianOrder[b.guardian];
      }
      return a.guardian ? -1 : 1;
    }
    return a.group - b.group || a.row - b.row || a.column - b.column;
  });
}

function studentForSeat(seat: SeatDefinition, assignments: AssignmentMap, studentMap: Map<string, Student>) {
  return studentMap.get(assignments[seat.id] ?? "");
}

async function buildWorkbook(options: SeatingExportOptions) {
  const { Workbook } = await import("exceljs");
  const inkTheme = options.tableTheme === "ink";
  const workbook = new Workbook();
  workbook.creator = "班阵";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("座次表", {
    views: [{ state: "frozen", ySplit: 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [
    { key: "group", width: 10 },
    { key: "row", width: 8 },
    { key: "column", width: 10 },
    { key: "name", width: 16 },
    { key: "gender", width: 10 },
    { key: "studentNo", width: 16 },
    { key: "status", width: 12 },
  ];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = `${options.className}座次表`;
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF242521" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;
  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = options.versionName;
  sheet.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF6D6C66" } };
  sheet.getCell("A2").alignment = { horizontal: "center" };
  const header = sheet.addRow(["大组", "排", "桌位", "姓名", "性别", "学号", "状态"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { horizontal: "center", vertical: "middle" };
  header.height = 23;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: inkTheme ? "FF111111" : "FF2F6FED" } };
  });
  const studentMap = new Map(options.students.map((student) => [student.id, student]));
  sortedSeats(options.seats).forEach((seat) => {
    const student = studentForSeat(seat, options.assignments, studentMap);
    const row = sheet.addRow([
      seat.guardian ? "讲台护法" : `第 ${seat.group + 1} 组`,
      seat.guardian ? "" : seat.row + 1,
      seat.guardian ? (seat.guardian === "left" ? "左侧" : "右侧") : seat.column + 1,
      seat.disabled ? "" : student?.name ?? "",
      options.showGender ? student?.gender ?? "" : "",
      options.showStudentNo ? student?.studentNo ?? "" : "",
      seat.disabled ? "停用" : student ? "已入座" : "空位",
    ]);
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.height = 21;
    if (inkTheme) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FF777777" } },
          left: { style: "thin", color: { argb: "FF777777" } },
          bottom: { style: "thin", color: { argb: "FF777777" } },
          right: { style: "thin", color: { argb: "FF777777" } },
        };
      });
    }
    if (seat.disabled) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: inkTheme ? "FFE5E5E5" : "FFE9E8E4" } };
      });
    }
    if (options.showGroupBoundaries && !seat.guardian && seat.row === 0 && seat.column === 0) {
      row.eachCell((cell) => {
        cell.border = { ...cell.border, top: { style: "medium", color: { argb: inkTheme ? "FF111111" : "FF2F6FED" } } };
      });
    }
  });
  sheet.autoFilter = { from: "A3", to: "G3" };
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as unknown as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function buildSvg(options: SeatingExportOptions) {
  const seats = sortedSeats(options.seats);
  const classroomSeats = seats.filter((seat) => !seat.guardian);
  const guardianSeats = seats.filter((seat) => seat.guardian);
  const studentMap = new Map(options.students.map((student) => [student.id, student]));
  const groups = [...new Set(classroomSeats.map((seat) => seat.group))];
  const groupWidth = 188;
  const seatWidth = 76;
  const seatHeight = 42;
  const rowGap = 10;
  const groupGap = 28;
  const margin = 48;
  const maxRows = Math.max(1, ...classroomSeats.map((seat) => seat.row + 1));
  const width = Math.max(760, margin * 2 + groups.length * groupWidth + Math.max(0, groups.length - 1) * groupGap);
  const height = 170 + maxRows * (seatHeight + rowGap) + 70;
  const seatNodes = groups.flatMap((group, groupIndex) => classroomSeats.filter((seat) => seat.group === group).map((seat) => {
    const x = margin + groupIndex * (groupWidth + groupGap) + seat.column * (seatWidth + 8);
    const y = 156 + seat.row * (seatHeight + rowGap);
    const student = studentForSeat(seat, options.assignments, studentMap);
    const detail = seat.disabled
      ? ""
      : [options.showGender ? student?.gender : "", options.showStudentNo ? student?.studentNo?.slice(-3) : ""].filter(Boolean).join(" · ");
    return `<g><rect x="${x}" y="${y}" width="${seatWidth}" height="${seatHeight}" rx="5" fill="${seat.disabled ? "#e9e8e4" : "#fffdf8"}" stroke="${seat.disabled ? "#c5c3bd" : "#aaa79f"}"/><text x="${x + seatWidth / 2}" y="${seat.disabled ? y + 26 : y + 18}" text-anchor="middle" font-size="${seat.disabled ? 13 : 12}" font-weight="${seat.disabled ? 600 : 700}" fill="${seat.disabled ? "#777670" : "#242521"}">${xmlEscape(seat.disabled ? "×" : student?.name ?? "空位")}</text>${detail ? `<text x="${x + seatWidth / 2}" y="${y + 33}" text-anchor="middle" font-size="9" fill="#6d6c66">${xmlEscape(detail)}</text>` : ""}</g>`;
  })).join("");
  const guardianNodes = guardianSeats.map((seat) => {
    const x = seat.guardian === "left" ? width / 2 - 55 - 18 - seatWidth : width / 2 + 55 + 18;
    const student = studentForSeat(seat, options.assignments, studentMap);
    const label = seat.guardian === "left" ? "左护法" : "右护法";
    const content = seat.disabled ? "×" : student?.name ?? "空位";
    return `<g><text x="${x + seatWidth / 2}" y="96" text-anchor="middle" font-size="9" font-weight="700" fill="#2f6fed">${label}</text><rect x="${x}" y="100" width="${seatWidth}" height="${seatHeight}" rx="5" fill="${seat.disabled ? "#e9e8e4" : "#eaf1ff"}" stroke="${seat.disabled ? "#c5c3bd" : "#2f6fed"}"/><text x="${x + seatWidth / 2}" y="126" text-anchor="middle" font-size="12" font-weight="700" fill="#242521">${xmlEscape(content)}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8f5ed"/><text x="${margin}" y="44" font-size="13" fill="#6d6c66">${xmlEscape(options.versionName)}</text><text x="${margin}" y="78" font-size="26" font-weight="700" fill="#242521">${xmlEscape(options.className)}座次表</text><rect x="${width / 2 - 55}" y="100" width="110" height="34" rx="5" fill="#fffdf8" stroke="#242521"/><text x="${width / 2}" y="122" text-anchor="middle" font-size="13" font-weight="700">讲台</text>${guardianNodes}${seatNodes}<text x="${margin}" y="${height - 28}" font-size="10" fill="#6d6c66">班阵 · 本地生成</text></svg>`;
}

function drawCuteBackdrop(context: CanvasRenderingContext2D, width: number, height: number, scale: number) {
  const pawWidth = Math.min(width * 0.7, 760 * scale);
  const pawHeight = pawWidth / 1.12;
  const left = (width - pawWidth) / 2;
  const top = height * 0.51 - pawHeight / 2;
  const ellipse = (x: number, y: number, radiusX: number, radiusY: number, alpha: number) => {
    context.beginPath();
    context.ellipse(left + pawWidth * x, top + pawHeight * y, pawWidth * radiusX, pawHeight * radiusY, 0, 0, Math.PI * 2);
    context.fillStyle = `rgba(239, 135, 168, ${alpha})`;
    context.fill();
  };

  context.save();
  context.filter = `blur(${8 * scale}px)`;
  ellipse(0.5, 0.71, 0.24, 0.21, 0.15);
  ellipse(0.22, 0.31, 0.12, 0.16, 0.13);
  ellipse(0.4, 0.19, 0.12, 0.17, 0.13);
  ellipse(0.6, 0.19, 0.12, 0.17, 0.13);
  ellipse(0.78, 0.31, 0.12, 0.16, 0.13);
  context.restore();

  context.strokeStyle = "rgba(226, 145, 170, 0.16)";
  context.lineWidth = Math.max(1, scale);
  context.beginPath();
  context.roundRect(12 * scale, 12 * scale, width - 24 * scale, height - 24 * scale, 18 * scale);
  context.stroke();
}

function createCanvasSnapshot(source: HTMLCanvasElement, theme: "minimal" | "cute") {
  if (!source.width || !source.height) throw new Error("画布正在准备，请稍后再导出");
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前环境不支持画面导出");
  const scale = source.clientWidth ? source.width / source.clientWidth : 1;

  context.fillStyle = theme === "cute" ? "#fff8fa" : "#f8f5ed";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (theme === "cute") drawCuteBackdrop(context, canvas.width, canvas.height, scale);

  context.strokeStyle = theme === "cute" ? "rgba(203, 125, 149, 0.065)" : "rgba(86, 84, 77, 0.075)";
  context.lineWidth = Math.max(1, scale);
  for (let x = 0; x <= canvas.width; x += 24 * scale) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 24 * scale) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png") {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("无法生成画面文件")), type);
  });
}

function buildSnapshotSvg(canvas: HTMLCanvasElement) {
  const image = canvas.toDataURL("image/png");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="100%" height="100%" href="${image}"/></svg>`;
}

async function buildPresentation(options: SeatingExportOptions, snapshot: HTMLCanvasElement) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "班阵";
  presentation.subject = options.versionName;
  presentation.title = `${options.className}座次表`;
  presentation.company = "班阵";
  const slide = presentation.addSlide();
  slide.background = { color: options.appTheme === "cute" ? "FFF8FA" : "F8F5ED" };
  slide.addText(`${options.className}座次表`, {
    x: 0.45,
    y: 0.18,
    w: 7.2,
    h: 0.35,
    fontFace: "Microsoft YaHei",
    fontSize: 20,
    bold: true,
    color: options.appTheme === "cute" ? "3B3034" : "242521",
    margin: 0,
  });
  slide.addText(options.versionName, {
    x: 8.2,
    y: 0.23,
    w: 4.65,
    h: 0.24,
    fontFace: "Microsoft YaHei",
    fontSize: 9,
    color: options.appTheme === "cute" ? "826D75" : "6D6C66",
    align: "right",
    margin: 0,
  });
  const maxWidth = 12.45;
  const maxHeight = 6.48;
  const ratio = snapshot.width / snapshot.height;
  const width = Math.min(maxWidth, maxHeight * ratio);
  const height = width / ratio;
  slide.addImage({
    data: snapshot.toDataURL("image/png"),
    x: (13.333 - width) / 2,
    y: 0.72 + (maxHeight - height) / 2,
    w: width,
    h: height,
  });
  slide.addText("班阵 · 本地生成", { x: 0.45, y: 7.2, w: 3, h: 0.16, fontSize: 7, color: "8B8982", margin: 0 });
  const output = await presentation.write({ outputType: "blob", compression: true });
  return output instanceof Blob
    ? output
    : new Blob([output as BlobPart], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function printSnapshot(canvas: HTMLCanvasElement, title: string) {
  const frame = document.createElement("iframe");
  frame.title = "座次画面打印";
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.opacity = "0";
  document.body.appendChild(frame);
  const target = frame.contentWindow;
  if (!target) {
    frame.remove();
    throw new Error("无法打开打印窗口");
  }
  const image = canvas.toDataURL("image/png");
  target.document.open();
  target.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${xmlEscape(title)}</title><style>@page{size:landscape;margin:8mm}html,body{height:100%;margin:0}body{display:grid;place-items:center}img{display:block;max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="${image}" alt="座次画面"></body></html>`);
  target.document.close();
  window.setTimeout(() => {
    target.focus();
    target.print();
  }, 180);
  window.setTimeout(() => frame.remove(), 60_000);
}

export async function exportSeatingPlan(options: SeatingExportOptions) {
  const fileName = safeFileName(options.fileName);
  if (options.format === "xlsx") {
    downloadBlob(await buildWorkbook(options), `${fileName}.xlsx`);
    return "已导出 Excel 工作簿";
  }
  const snapshot = options.sourceCanvas
    ? createCanvasSnapshot(options.sourceCanvas, options.appTheme ?? "minimal")
    : undefined;
  if (options.format === "svg") {
    downloadBlob(new Blob([snapshot ? buildSnapshotSvg(snapshot) : buildSvg(options)], { type: "image/svg+xml;charset=utf-8" }), `${fileName}.svg`);
    return "当前画面已导出为 SVG";
  }
  if (options.format === "png") {
    if (!snapshot) throw new Error("画布正在准备，请稍后再导出");
    downloadBlob(await canvasToBlob(snapshot), `${fileName}.png`);
    return "当前画面已导出为高清 PNG";
  }
  if (options.format === "pdf") {
    if (!snapshot) throw new Error("画布正在准备，请稍后再导出");
    printSnapshot(snapshot, fileName);
    return "已打开当前画面的打印窗口，可另存为 PDF";
  }
  if (!snapshot) throw new Error("画布正在准备，请稍后再导出");
  downloadBlob(await buildPresentation(options, snapshot), `${fileName}.pptx`);
  return "已导出包含当前画面的 PowerPoint";
}
