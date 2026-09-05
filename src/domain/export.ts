import type { AssignmentMap, ExportVariant, SeatDefinition, Student } from "../types";

export type SeatingExportFormat = "xlsx" | "png" | "pdf";

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
  variant?: ExportVariant;
}

function safeFileName(value: string) {
  return (value.trim() || "班级座次表").replace(/[\\/:*?"<>|]/g, "-");
}

interface BrowserWritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface BrowserFileHandle {
  createWritable(): Promise<BrowserWritableFile>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<BrowserFileHandle>;
};

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Firefox and Safari may not start consuming a large Blob immediately. Keep
  // the object URL alive long enough for the browser download manager to take it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function saveBlobLocally(blob: Blob, fileName: string) {
  const showSaveFilePicker = (window as WindowWithSavePicker).showSaveFilePicker;

  // On HTTPS deployments Chromium can write through the native Save dialog.
  // This avoids browsers treating an async, generated export as an unsolicited
  // download. HTTP deployments and other browsers use the download fallback.
  if (window.isSecureContext && showSaveFilePicker) {
    const extension = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
    try {
      const handle = await showSaveFilePicker({
        suggestedName: fileName,
        types: extension ? [{
          description: "班阵导出文件",
          accept: { [blob.type || "application/octet-stream"]: [extension] },
        }] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("已取消保存");
      }
      // A browser may expose the API but deny it in an embedded page. Falling
      // back to a normal download still lets the user save the generated file.
    }
  }

  triggerBrowserDownload(blob, fileName);
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
  const { Workbook } = (await import("exceljs")).default;
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
      seat.disabled ? "停用" : student?.isClassRepresentative ? "已入座（课代表）" : student ? "已入座" : "空位",
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

export async function downloadStudentImportTemplate(className: string) {
  const { Workbook } = (await import("exceljs")).default;
  const workbook = new Workbook();
  workbook.creator = "班阵";
  const sheet = workbook.addWorksheet("学生名单", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "姓名", key: "name", width: 16 },
    { header: "性别", key: "gender", width: 10 },
    { header: "班级", key: "className", width: 18 },
    { header: "学号", key: "studentNo", width: 18 },
    { header: "成绩等级", key: "score", width: 12 },
    { header: "身高(cm)", key: "height", width: 14 },
    { header: "标签", key: "tags", width: 28 },
  ];
  sheet.getRow(1).height = 26;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F6FED" } };
  });
  sheet.addRow({ name: "张同学", gender: "男", className, studentNo: "2026001", score: "A", height: 172, tags: "组长候选、体育委员" });
  sheet.addRow({ name: "李同学", gender: "女", className, studentNo: "2026002", score: "B", height: 165, tags: "视力关注" });
  sheet.getColumn("gender").eachCell((cell, rowNumber) => {
    if (rowNumber > 1) cell.dataValidation = { type: "list", allowBlank: true, formulae: ['"男,女"'] };
  });
  sheet.getColumn("score").eachCell((cell, rowNumber) => {
    if (rowNumber > 1) cell.dataValidation = { type: "list", allowBlank: true, formulae: ['"A,B,C,D"'] };
  });
  const note = workbook.addWorksheet("填写说明");
  note.columns = [{ width: 20 }, { width: 66 }];
  note.addRows([
    ["字段", "填写要求"],
    ["姓名", "必填"],
    ["性别", "选填；填写时只使用“男”或“女”"],
    ["班级", `可留空；导入时将使用当前班级“${className}”`],
    ["学号", "必填；重复学号会更新已有学生"],
    ["成绩等级", "选填；只使用 A、B、C、D"],
    ["身高", "选填，只填写数字"],
    ["标签", "选填；多个标签使用顿号、逗号或分号分隔"],
  ]);
  note.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  await saveBlobLocally(new Blob([buffer as unknown as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeFileName(className)}_学生导入模板.xlsx`);
  return "导入模板已下载";
}

function buildCompactCanvas(options: SeatingExportOptions) {
  const seats = sortedSeats(options.seats);
  const classroomSeats = seats.filter((seat) => !seat.guardian);
  const guardianSeats = seats.filter((seat) => seat.guardian);
  const studentMap = new Map(options.students.map((student) => [student.id, student]));
  const groups = [...new Set(classroomSeats.map((seat) => seat.group))];
  const maxRows = Math.max(1, ...classroomSeats.map((seat) => seat.row + 1));
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = Math.max(1120, 330 + maxRows * 118);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前环境不支持精简版导出");

  const margin = 92;
  const contentWidth = canvas.width - margin * 2;
  const groupGap = 34;
  const groupWidth = groups.length
    ? (contentWidth - Math.max(0, groups.length - 1) * groupGap) / groups.length
    : contentWidth;
  const gridTop = 294;
  const rowHeight = 96;
  const rowGap = 18;
  const ink = "#202124";
  const muted = "#6b6e73";
  const line = "#aeb2b8";
  const disabledFill = "#f1f2f3";
  const representativeFill = "#c98118";

  const drawRepresentativeBadge = (student: Student | undefined, x: number, y: number) => {
    if (!student?.isClassRepresentative) return;
    context.beginPath();
    context.arc(x, y, 14, 0, Math.PI * 2);
    context.fillStyle = representativeFill;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#ffffff";
    context.stroke();
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.font = '700 15px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText("课", x, y + 1);
  };

  const drawSeatName = (
    text: string,
    student: Student | undefined,
    centerX: number,
    centerY: number,
    maxWidth: number,
    nameFont: string,
    color: string,
  ) => {
    context.save();
    context.font = nameFont;
    const nameWidth = context.measureText(text).width;
    const horizontalScale = Math.min(1, maxWidth / Math.max(1, nameWidth));
    context.translate(centerX, centerY);
    context.scale(horizontalScale, 1);
    context.textAlign = "center";
    context.fillStyle = options.showGender && student?.gender === "男"
      ? "#4e77a9"
      : options.showGender && student?.gender === "女"
        ? "#d15f7a"
        : color;
    context.font = nameFont;
    context.fillText(text, 0, 0);
    context.restore();
  };

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = ink;
  context.textBaseline = "middle";
  context.font = '700 48px "Microsoft YaHei", "PingFang SC", sans-serif';
  context.fillText(`${options.className}座次表`, margin, 72);
  context.fillStyle = muted;
  context.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif';
  context.textAlign = "right";
  context.fillText(options.versionName, canvas.width - margin, 72);
  context.strokeStyle = ink;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(margin, 112);
  context.lineTo(canvas.width - margin, 112);
  context.stroke();

  const podiumWidth = 230;
  const podiumHeight = 70;
  const podiumX = (canvas.width - podiumWidth) / 2;
  const podiumY = 146;
  context.lineWidth = 2.5;
  context.strokeStyle = ink;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(podiumX, podiumY, podiumWidth, podiumHeight, 8);
  context.fill();
  context.stroke();
  context.fillStyle = ink;
  context.textAlign = "center";
  context.font = '700 30px "Microsoft YaHei", "PingFang SC", sans-serif';
  context.fillText("讲台", canvas.width / 2, podiumY + podiumHeight / 2);

  guardianSeats.forEach((seat) => {
    const width = 160;
    const x = seat.guardian === "left" ? podiumX - width - 30 : podiumX + podiumWidth + 30;
    const student = studentForSeat(seat, options.assignments, studentMap);
    context.fillStyle = seat.disabled ? disabledFill : "#ffffff";
    context.strokeStyle = line;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, podiumY, width, podiumHeight, 8);
    context.fill();
    context.stroke();
    drawSeatName(
      seat.disabled ? "×" : student?.name ?? "空位",
      seat.disabled ? undefined : student,
      x + width / 2,
      podiumY + 30,
      width - 24,
      '600 25px "Microsoft YaHei", "PingFang SC", sans-serif',
      seat.disabled ? muted : ink,
    );
    if (!seat.disabled) drawRepresentativeBadge(student, x + 17, podiumY + 17);
    context.fillStyle = muted;
    context.font = '500 17px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(seat.guardian === "left" ? "左护法" : "右护法", x + width / 2, podiumY + 55);
  });

  groups.forEach((group, groupIndex) => {
    const groupSeats = classroomSeats.filter((seat) => seat.group === group);
    const columnCount = Math.max(1, ...groupSeats.map((seat) => seat.column + 1));
    const left = margin + groupIndex * (groupWidth + groupGap);
    const seatGap = 10;
    const seatWidth = (groupWidth - Math.max(0, columnCount - 1) * seatGap) / columnCount;
    context.fillStyle = muted;
    context.textAlign = "left";
    context.font = '600 21px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(`第 ${group + 1} 大组`, left, gridTop - 30);
    if (options.showGroupBoundaries) {
      context.strokeStyle = "#d0d3d7";
      context.lineWidth = 2;
      context.setLineDash([10, 8]);
      context.strokeRect(left - 10, gridTop - 6, groupWidth + 20, maxRows * (rowHeight + rowGap) - rowGap + 12);
      context.setLineDash([]);
    }
    groupSeats.forEach((seat) => {
      const x = left + seat.column * (seatWidth + seatGap);
      const y = gridTop + seat.row * (rowHeight + rowGap);
      const student = studentForSeat(seat, options.assignments, studentMap);
      context.fillStyle = seat.disabled ? disabledFill : "#ffffff";
      context.strokeStyle = seat.disabled ? "#c9ccd0" : ink;
      context.lineWidth = seat.disabled ? 2 : 2.4;
      context.beginPath();
      context.roundRect(x, y, seatWidth, rowHeight, 8);
      context.fill();
      context.stroke();
      const hasStudentNumber = Boolean(student && options.showStudentNo && student.studentNo);
      drawSeatName(
        seat.disabled ? "×" : student?.name ?? "空位",
        seat.disabled ? undefined : student,
        x + seatWidth / 2,
        y + (hasStudentNumber ? 38 : rowHeight / 2),
        seatWidth - 18,
        `700 ${seatWidth < 120 ? 24 : 29}px "Microsoft YaHei", "PingFang SC", sans-serif`,
        seat.disabled ? muted : ink,
      );
      if (!seat.disabled) drawRepresentativeBadge(student, x + 17, y + 17);
      if (student) {
        const detail = options.showStudentNo ? student.studentNo?.slice(-3) ?? "" : "";
        if (detail) {
          context.fillStyle = muted;
          context.font = '500 17px "Microsoft YaHei", "PingFang SC", sans-serif';
          context.fillText(detail, x + seatWidth / 2, y + 70);
        }
      }
    });
  });

  context.fillStyle = muted;
  context.textAlign = "left";
  context.font = '400 17px "Microsoft YaHei", "PingFang SC", sans-serif';
  context.fillText("班阵 · 精简版", margin, canvas.height - 38);
  return canvas;
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

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("无法生成画面文件")), type, quality);
  });
}

function joinBytes(chunks: ReadonlyArray<Uint8Array<ArrayBufferLike>>) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

async function canvasToPdfBlob(canvas: HTMLCanvasElement) {
  const jpeg = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.94)).arrayBuffer());
  const encoder = new TextEncoder();
  const encode = (value: string) => encoder.encode(value);
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 22.68;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
  const imageWidth = canvas.width * scale;
  const imageHeight = canvas.height * scale;
  const imageX = (pageWidth - imageWidth) / 2;
  const imageY = (pageHeight - imageHeight) / 2;
  const number = (value: number) => value.toFixed(3).replace(/\.?0+$/, "");
  const content = `q\n${number(imageWidth)} 0 0 ${number(imageHeight)} ${number(imageX)} ${number(imageY)} cm\n/Im0 Do\nQ\n`;
  const objects: Uint8Array[][] = [
    [encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")],
    [encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")],
    [encode(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(pageWidth)} ${number(pageHeight)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`)],
    [encode(`4 0 obj\n<< /Length ${encode(content).length} >>\nstream\n${content}endstream\nendobj\n`)],
    [
      encode(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      encode("\nendstream\nendobj\n"),
    ],
  ];
  const chunks: Uint8Array<ArrayBufferLike>[] = [encode("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n")];
  const offsets = [0];
  let byteLength = chunks[0].length;
  objects.forEach((object) => {
    offsets.push(byteLength);
    object.forEach((chunk) => {
      chunks.push(chunk);
      byteLength += chunk.length;
    });
  });
  const xrefOffset = byteLength;
  const xrefEntries = offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  chunks.push(encode(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefEntries}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
  return new Blob([joinBytes(chunks) as BlobPart], { type: "application/pdf" });
}

export async function exportSeatingPlan(options: SeatingExportOptions) {
  const fileName = safeFileName(options.fileName);
  if (options.format === "xlsx") {
    await saveBlobLocally(await buildWorkbook(options), `${fileName}.xlsx`);
    return "已导出 Excel 工作簿";
  }
  const variant = options.variant ?? "standard";
  const snapshot = variant === "compact"
    ? buildCompactCanvas(options)
    : options.sourceCanvas
      ? createCanvasSnapshot(options.sourceCanvas, options.appTheme ?? "minimal")
      : undefined;
  const outputName = `${fileName}_${variant === "compact" ? "精简版" : "普通版"}`;
  if (options.format === "png") {
    if (!snapshot) throw new Error("画布正在准备，请稍后再导出");
    await saveBlobLocally(await canvasToBlob(snapshot), `${outputName}.png`);
    return `已导出${variant === "compact" ? "精简版" : "普通版"} PNG`;
  }
  if (!snapshot) throw new Error("画布正在准备，请稍后再导出");
  await saveBlobLocally(await canvasToPdfBlob(snapshot), `${outputName}.pdf`);
  return `已导出${variant === "compact" ? "精简版" : "普通版"} PDF`;
}
