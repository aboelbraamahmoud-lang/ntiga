import * as XLSX from "xlsx";
import {
  EXAMS,
  assignmentKey,
  canonicalClass,
  defaultImportAliases,
  defaultStatusAliases,
  gradeFromClass,
  normalizeArabic,
  type ExamKey,
  type RecordRow,
  type Settings,
  type Status,
  type TeacherAssignment,
  type TeacherProfile,
} from "./results-engine.ts";

export type Issue = { severity: "error" | "warning"; row: number; message: string; sheet?: string };
export type ImportResult = { fileName: string; sheet: string; headerRow: number; rows: RecordRow[]; issues: Issue[]; settings: Settings; headers: string[] };
export type TeacherImportResult = { fileName: string; sheet: string; headerRow: number; profiles: TeacherProfile[]; assignments: TeacherAssignment[]; issues: Issue[]; headers: string[] };
export type ImportedScore = { score: number | null; status: Status; raw: string; recognized: boolean };
export type ScoreColumn = { key: string; index: number; header: string; numericCount: number; statusCount: number; suggestedTotal: number };
export type ResultSourceRow = { id: string; studentId: string; studentName: string; grade: string; className: string; sourceRow: number; values: Record<string, ImportedScore> };
export type ResultSheetImport = {
  id: string;
  fileName: string;
  sheet: string;
  hidden: boolean;
  headerRow: number;
  schoolName: string;
  subject: string;
  period: string;
  selected: boolean;
  selectedScoreKey: string;
  scoreColumns: ScoreColumn[];
  rows: ResultSourceRow[];
  issues: Issue[];
};
export type ResultWorkbookImport = { fileName: string; sheets: ResultSheetImport[]; issues: Issue[] };
export type PendingResultRow = { id: string; studentId: string; studentName: string; grade: string; className: string; subject: string; score: number | null; status: Status; recognized: boolean; sourceFile: string; sourceSheet: string; sourceRow: number };
export type MappingStatus = "matched" | "missing" | "ambiguous" | "mismatch" | "manual";
export type MappingResolution = { key: string; subject: string; grade: string; className: string; rows: number; status: MappingStatus; selectedProfileId: string; candidateProfileIds: string[] };

const txt = (value: unknown) => String(value ?? "").trim();
const norm = normalizeArabic;
function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/،|,/g, ".").trim();
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}
function scoreStatus(value: unknown, hasScore: boolean, settings?: Settings): { status: Status; recognized: boolean } {
  if (hasScore) return { status: "present", recognized: true };
  const valueNorm = norm(value);
  if (!valueNorm) return { status: "not_enrolled", recognized: true };
  const aliases = settings?.statusAliases ?? defaultStatusAliases;
  const cases: [Status, string[]][] = [["absent", aliases.absent], ["excused", aliases.excused], ["unexcused", aliases.unexcused], ["deprived", aliases.deprived], ["not_enrolled", aliases.not_enrolled]];
  const found = cases.find(([, aliases]) => aliases.some((alias) => norm(alias) === valueNorm));
  return found ? { status: found[0], recognized: true } : { status: "not_enrolled", recognized: false };
}
const splitClasses = (value: unknown) => txt(value).split(/[،,;؛\n]+/).map((part) => part.trim()).filter(Boolean);
const validClass = (value: string) => /^\d{1,2}\/.+$/u.test(value);
const niceTotal = (max: number) => [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100].find((value) => value >= max) ?? Math.ceil(max);

export function parseTeacherWorkbook(data: ArrayBuffer, fileName: string, settings?: Settings): TeacherImportResult {
  const workbook = XLSX.read(data, { type: "array" });
  const issues: Issue[] = [];
  let best: { sheet: string; matrix: unknown[][]; headerRow: number; map: Record<string, number> } | null = null;
  const configured = settings?.importAliases ?? defaultImportAliases;
  const aliases = { teacher: configured.teacher, subject: configured.subject, department: configured.department, coordinator: configured.coordinator, classes: configured.classes };

  for (const sheet of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: true });
    for (let rowIndex = 0; rowIndex < Math.min(20, matrix.length); rowIndex++) {
      const map: Record<string, number> = {};
      matrix[rowIndex].forEach((heading, colIndex) => Object.entries(aliases).forEach(([key, names]) => {
        if (names.some((name) => norm(name) === norm(heading))) map[key] = colIndex;
      }));
      const score = ["teacher", "subject", "classes"].filter((key) => map[key] !== undefined).length;
      const previousScore = best ? ["teacher", "subject", "classes"].filter((key) => best?.map[key] !== undefined).length : -1;
      if (score > previousScore) best = { sheet, matrix, headerRow: rowIndex, map };
    }
  }

  if (!best || best.map.teacher === undefined || best.map.subject === undefined || best.map.classes === undefined) {
    return { fileName, sheet: best?.sheet ?? "", headerRow: 0, profiles: [], assignments: [], issues: [{ severity: "error", row: 0, message: "تعذر العثور على أعمدة اسم المعلم والمادة والصفوف التي يقوم بتدريسها." }], headers: [] };
  }

  const { sheet, matrix, headerRow, map } = best;
  if (map.department === undefined) issues.push({ severity: "warning", row: headerRow + 1, sheet, message: "لا يوجد عمود للقسم؛ استخدمت المادة كقسم مؤقتًا ويمكن تعديلها قبل الاعتماد." });
  const maxColumns = Math.min(40, Math.max(...matrix.map((row) => row.length), 0));
  const profiles: TeacherProfile[] = [];
  const assignments: TeacherAssignment[] = [];

  for (let rowIndex = headerRow + 1; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex];
    const teacher = txt(row[map.teacher]);
    const subject = txt(row[map.subject]);
    const department = map.department === undefined ? subject : txt(row[map.department]);
    const coordinator = map.coordinator === undefined ? "" : txt(row[map.coordinator]);
    if (!teacher) continue;
    const classes = [...new Set(row.slice(map.classes, maxColumns).flatMap((value, offset) => map.classes + offset === map.coordinator ? [] : splitClasses(value)).map(canonicalClass).filter(Boolean))];
    const profileId = `teacher-${rowIndex + 1}-${norm(teacher).slice(0, 40)}`;
    profiles.push({ id: profileId, teacher, subject, department: department || subject, coordinator, classes, sourceRow: rowIndex + 1 });
    if (!subject) issues.push({ severity: "warning", row: rowIndex + 1, sheet, message: `المعلم «${teacher}» بلا مادة ولن يربط تلقائيًا.` });
    if (!classes.length) issues.push({ severity: "warning", row: rowIndex + 1, sheet, message: `المعلم «${teacher}» بلا صفوف أو شعب مسندة.` });
    for (const className of classes) {
      if (!validClass(className)) {
        issues.push({ severity: "warning", row: rowIndex + 1, sheet, message: `تعذر توحيد الصف/الشعبة «${className}» للمعلم «${teacher}».` });
        continue;
      }
      assignments.push({
        id: `assignment-${profileId}-${norm(subject)}-${norm(className)}`,
        profileId,
        teacher,
        subject,
        department: department || subject,
        grade: gradeFromClass(className),
        className,
      });
    }
  }

  const byAssignment = new Map<string, Set<string>>();
  assignments.forEach((assignment) => {
    const key = assignmentKey(assignment.subject, assignment.className);
    const teachers = byAssignment.get(key) ?? new Set<string>();
    teachers.add(assignment.teacher);
    byAssignment.set(key, teachers);
  });
  byAssignment.forEach((teachers, key) => {
    if (teachers.size > 1) issues.push({ severity: "warning", row: 0, sheet, message: `أكثر من معلم مسند لنفس المادة والشعبة: ${key.replace("|", " — ")}.` });
  });
  if (!profiles.length) issues.push({ severity: "error", row: 0, sheet, message: "لم يتم العثور على أسماء معلمين صالحة." });
  if (!assignments.length) issues.push({ severity: "warning", row: 0, sheet, message: "لا توجد إسنادات مكتملة للربط الآلي حتى الآن." });
  return { fileName, sheet, headerRow: headerRow + 1, profiles, assignments, issues, headers: matrix[headerRow].map(txt) };
}

function readMeta(matrix: unknown[][], headerRow: number, sheet: string) {
  const lines = matrix.slice(0, headerRow).flat().map(txt).filter(Boolean);
  const combined = lines.join(" ");
  const subjectMatch = combined.match(/المادة\s*[:：]\s*(.*?)(?=\s*[-–—]\s*الفترة\s*[:：]|$)/u);
  const periodMatch = combined.match(/الفترة\s*[:：]\s*(.*)$/u);
  const genericSheet = ["ورقة1", "sheet1", "البيانات", "النتائج"].some((name) => norm(name) === norm(sheet));
  const schoolName = txt(matrix[0]?.[0]).split(/\r?\n/)[0]?.trim() ?? "";
  return { schoolName, subject: txt(subjectMatch?.[1]) || (genericSheet ? "" : sheet), period: txt(periodMatch?.[1]) };
}

export function parseResultWorkbook(data: ArrayBuffer, fileName: string, settings?: Settings): ResultWorkbookImport {
  const workbook = XLSX.read(data, { type: "array" });
  const configured = settings?.importAliases ?? defaultImportAliases;
  const resultAliases = { studentId: configured.studentId, studentName: configured.studentName, className: configured.className };
  const sheets: ResultSheetImport[] = [];
  const workbookIssues: Issue[] = [];
  for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
    const sheet = workbook.SheetNames[sheetIndex];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: true });
    let headerRow = -1;
    let map: Record<string, number> = {};
    for (let rowIndex = 0; rowIndex < Math.min(25, matrix.length); rowIndex++) {
      const candidate: Record<string, number> = {};
      matrix[rowIndex].forEach((heading, colIndex) => Object.entries(resultAliases).forEach(([key, aliases]) => {
        if (aliases.some((alias) => norm(alias) === norm(heading))) candidate[key] = colIndex;
      }));
      if (["studentId", "studentName", "className"].every((key) => candidate[key] !== undefined)) { headerRow = rowIndex; map = candidate; break; }
    }
    if (headerRow < 0) continue;

    const issues: Issue[] = [];
    const header = matrix[headerRow];
    const coreColumns = new Set(Object.values(map));
    const scoreColumns: ScoreColumn[] = [];
    for (let colIndex = 0; colIndex < Math.min(40, header.length); colIndex++) {
      const heading = txt(header[colIndex]);
      if (!heading || coreColumns.has(colIndex)) continue;
      let numericCount = 0, statusCount = 0, max = 0;
      for (let rowIndex = headerRow + 1; rowIndex < matrix.length; rowIndex++) {
        const raw = matrix[rowIndex]?.[colIndex];
        const number = numberValue(raw);
        if (number !== null) { numericCount++; max = Math.max(max, number); }
        else if (txt(raw) && scoreStatus(raw, false, settings).recognized) statusCount++;
      }
      if (numericCount || statusCount) scoreColumns.push({ key: String(colIndex), index: colIndex, header: heading, numericCount, statusCount, suggestedTotal: niceTotal(max || 100) });
    }
    const meta = readMeta(matrix, headerRow, sheet);
    if (!meta.subject) issues.push({ severity: "warning", row: headerRow + 1, sheet, message: "لم أتعرف على اسم المادة؛ اكتبه في شاشة المراجعة." });
    if (!scoreColumns.length) issues.push({ severity: "error", row: headerRow + 1, sheet, message: "لم أجد عمود درجات صالحًا في هذه الورقة." });

    const rows: ResultSourceRow[] = [];
    for (let rowIndex = headerRow + 1; rowIndex < matrix.length; rowIndex++) {
      const row = matrix[rowIndex];
      const studentId = txt(row[map.studentId]);
      const studentName = txt(row[map.studentName]);
      const rawClass = txt(row[map.className]);
      if (!studentId && !studentName && !rawClass) continue;
      if (studentId === "1" && studentName === "1" && rawClass === "1") continue;
      if (!studentId || !studentName || !rawClass) {
        issues.push({ severity: "warning", row: rowIndex + 1, sheet, message: "تم تجاهل صف ناقص الرقم أو الاسم أو الشعبة." });
        continue;
      }
      const className = canonicalClass(rawClass);
      if (!validClass(className)) issues.push({ severity: "warning", row: rowIndex + 1, sheet, message: `صيغة الشعبة «${rawClass}» غير معتادة وستحتاج مراجعة الربط.` });
      const values: Record<string, ImportedScore> = {};
      scoreColumns.forEach((column) => {
        const raw = row[column.index];
        const score = numberValue(raw);
        const state = scoreStatus(raw, score !== null, settings);
        values[column.key] = { score, status: state.status, raw: txt(raw), recognized: state.recognized };
        if (txt(raw) && !state.recognized) issues.push({ severity: "warning", row: rowIndex + 1, sheet, message: `القيمة «${txt(raw)}» في عمود «${column.header}» ليست درجة أو حالة معروفة.` });
      });
      rows.push({ id: `${fileName}-${sheet}-${rowIndex + 1}`, studentId, studentName, grade: gradeFromClass(className), className, sourceRow: rowIndex + 1, values });
    }
    const periodNorm = norm(meta.period);
    const selected = scoreColumns.find((column) => periodNorm && (norm(column.header) === periodNorm || norm(column.header).includes(periodNorm) || periodNorm.includes(norm(column.header))))
      ?? scoreColumns.find((column) => !norm(column.header).includes(norm("التقييم الرئيسي")))
      ?? scoreColumns.at(-1);
    if (!rows.length) issues.push({ severity: "error", row: 0, sheet, message: "لا توجد سجلات طلاب قابلة للقراءة في هذه الورقة." });
    sheets.push({
      id: `${fileName}-${sheetIndex}-${norm(sheet)}`,
      fileName,
      sheet,
      hidden: Boolean(workbook.Workbook?.Sheets?.[sheetIndex]?.Hidden),
      headerRow: headerRow + 1,
      schoolName: meta.schoolName,
      subject: meta.subject,
      period: meta.period,
      selected: !Boolean(workbook.Workbook?.Sheets?.[sheetIndex]?.Hidden),
      selectedScoreKey: selected?.key ?? "",
      scoreColumns,
      rows,
      issues,
    });
  }
  if (!sheets.length) workbookIssues.push({ severity: "error", row: 0, message: "لم أجد أي ورقة تحتوي الأعمدة: الرقم، الاسم، الشعبة الصفية." });
  return { fileName, sheets, issues: workbookIssues };
}

export function materializeResultRows(imports: ResultWorkbookImport[]): PendingResultRow[] {
  return imports.flatMap((file) => file.sheets.filter((sheet) => sheet.selected && sheet.selectedScoreKey).flatMap((sheet) => sheet.rows.map((row) => {
    const value = row.values[sheet.selectedScoreKey] ?? { score: null, status: "not_enrolled" as Status, recognized: false };
    return { id: row.id, studentId: row.studentId, studentName: row.studentName, grade: row.grade, className: row.className, subject: sheet.subject.trim(), score: value.score, status: value.status, recognized: value.recognized, sourceFile: file.fileName, sourceSheet: sheet.sheet, sourceRow: row.sourceRow };
  })));
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: b.length + 1 }, (_, row) => [row, ...Array(a.length).fill(0)]);
  for (let col = 0; col <= a.length; col++) matrix[0][col] = col;
  for (let row = 1; row <= b.length; row++) for (let col = 1; col <= a.length; col++) matrix[row][col] = b[row - 1] === a[col - 1] ? matrix[row - 1][col - 1] : 1 + Math.min(matrix[row - 1][col - 1], matrix[row][col - 1], matrix[row - 1][col]);
  return matrix[b.length][a.length];
}
const similarity = (a: string, b: string) => Math.max(a.length, b.length) ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 1;

export function buildMappingResolutions(rows: PendingResultRow[], profiles: TeacherProfile[], assignments: TeacherAssignment[], manual: Record<string, string> = {}): MappingResolution[] {
  const grouped = new Map<string, PendingResultRow[]>();
  rows.forEach((row) => { const key = assignmentKey(row.subject, row.className); grouped.set(key, [...(grouped.get(key) ?? []), row]); });
  const profileIds = new Set(profiles.map((profile) => profile.id));
  return [...grouped.entries()].map(([key, subset]) => {
    const first = subset[0];
    const exact = [...new Set(assignments.filter((assignment) => assignmentKey(assignment.subject, assignment.className) === key).map((assignment) => assignment.profileId))];
    const manualId = manual[key] && profileIds.has(manual[key]) ? manual[key] : "";
    if (manualId) return { key, subject: first.subject, grade: first.grade, className: first.className, rows: subset.length, status: "manual" as const, selectedProfileId: manualId, candidateProfileIds: exact };
    if (exact.length === 1) return { key, subject: first.subject, grade: first.grade, className: first.className, rows: subset.length, status: "matched" as const, selectedProfileId: exact[0], candidateProfileIds: exact };
    if (exact.length > 1) return { key, subject: first.subject, grade: first.grade, className: first.className, rows: subset.length, status: "ambiguous" as const, selectedProfileId: "", candidateProfileIds: exact };
    const subjectNorm = norm(first.subject);
    const sameClass = assignments.filter((assignment) => canonicalClass(assignment.className) === canonicalClass(first.className));
    const fuzzy = [...new Set(sameClass.filter((assignment) => similarity(subjectNorm, norm(assignment.subject)) >= 0.72).map((assignment) => assignment.profileId))];
    const sameSubject = profiles.filter((profile) => norm(profile.subject) === subjectNorm).map((profile) => profile.id);
    const candidates = [...new Set([...fuzzy, ...sameSubject])];
    return { key, subject: first.subject, grade: first.grade, className: first.className, rows: subset.length, status: fuzzy.length ? "mismatch" as const : "missing" as const, selectedProfileId: "", candidateProfileIds: candidates };
  }).sort((a, b) => a.grade.localeCompare(b.grade, "ar", { numeric: true }) || a.className.localeCompare(b.className, "ar", { numeric: true }) || a.subject.localeCompare(b.subject, "ar"));
}

// قارئ النموذج الشامل السابق للحفاظ على التوافق مع الملفات التي أُنشئت بالإصدار الأول.
const legacyCore = { studentId: ["الرقم الأكاديمي", "رقم الطالب", "student id"], studentName: ["اسم الطالب", "student name"], grade: ["الصف", "grade"], className: ["الشعبة", "الفصل", "class", "section"], department: ["القسم", "department"], subject: ["المادة", "subject"], teacher: ["المعلم", "اسم المعلم", "teacher"] } as const;
const scoreNames = ["درجة الاختبار الأول", "درجة الاختبار الثاني", "درجة الاختبار الثالث", "درجة الاختبار الرابع"];
const stateNames = ["حالة الاختبار الأول", "حالة الاختبار الثاني", "حالة الاختبار الثالث", "حالة الاختبار الرابع"];
export function parseWorkbook(data: ArrayBuffer, fileName: string, current: Settings): ImportResult {
  const workbook = XLSX.read(data, { type: "array" }), issues: Issue[] = [];
  const settings = { ...current, exams: current.exams.map((exam) => ({ ...exam })), bands: current.bands.map((band) => ({ ...band })) };
  const settingsSheet = workbook.SheetNames.find((name) => norm(name) === norm("الإعدادات"));
  if (settingsSheet) {
    const records = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[settingsSheet], { header: 1, raw: true, defval: null });
    const values = new Map(records.map((row) => [txt(row[0]), row[2]]));
    if (txt(values.get("school_name"))) settings.schoolName = txt(values.get("school_name"));
    if (txt(values.get("academic_year"))) settings.academicYear = txt(values.get("academic_year"));
    settings.exams = settings.exams.map((exam, index) => { const total = numberValue(values.get(`exam${index + 1}_total`)), name = txt(values.get(`exam${index + 1}_name`)); return { ...exam, name: name || exam.name, total: total && total > 0 ? total : exam.total }; });
    const pass = numberValue(values.get("pass_threshold")); if (pass !== null && pass >= 0 && pass <= 100) settings.pass = pass;
  }
  const sheet = workbook.SheetNames.find((name) => norm(name) === norm("درجات الطلاب")) ?? workbook.SheetNames[0] ?? "";
  if (!sheet) return { fileName, sheet, headerRow: 0, rows: [], issues: [{ severity: "error", row: 0, message: "لا توجد أوراق في الملف." }], settings, headers: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: false });
  let headerRow = -1, map: Record<string, number> = {};
  for (let rowIndex = 0; rowIndex < Math.min(12, matrix.length); rowIndex++) {
    const candidate: Record<string, number> = {};
    matrix[rowIndex].forEach((heading, colIndex) => { Object.entries(legacyCore).forEach(([key, aliases]) => { if (aliases.some((alias) => norm(alias) === norm(heading))) candidate[key] = colIndex; }); scoreNames.forEach((name, index) => { if (norm(name) === norm(heading)) candidate[`score${index}`] = colIndex; }); stateNames.forEach((name, index) => { if (norm(name) === norm(heading)) candidate[`state${index}`] = colIndex; }); });
    if (Object.keys(candidate).length > Object.keys(map).length) { map = candidate; headerRow = rowIndex; }
  }
  const required = Object.keys(legacyCore);
  if (headerRow < 0 || required.filter((key) => map[key] !== undefined).length < 4) return { fileName, sheet, headerRow: 0, rows: [], issues: [...issues, { severity: "error", row: 0, message: "تعذر العثور على صف العناوين." }], settings, headers: [] };
  required.forEach((key) => { if (map[key] === undefined) issues.push({ severity: "error", row: headerRow + 1, message: `العمود المطلوب «${(legacyCore as unknown as Record<string, readonly string[]>)[key][0]}» غير موجود.` }); });
  const rows: RecordRow[] = [];
  for (let rowIndex = headerRow + 1; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex];
    if (row.every((value) => value === null || txt(value) === "")) continue;
    const get = (key: string) => map[key] === undefined ? null : row[map[key]];
    const base = { studentId: txt(get("studentId")), studentName: txt(get("studentName")), grade: txt(get("grade")), className: txt(get("className")), department: txt(get("department")), subject: txt(get("subject")), teacher: txt(get("teacher")) };
    Object.entries(base).forEach(([key, value]) => { if (!value) issues.push({ severity: "error", row: rowIndex + 1, message: `قيمة «${(legacyCore as unknown as Record<string, readonly string[]>)[key][0]}» مطلوبة.` }); });
    const scores = {} as Record<ExamKey, number | null>, statuses = {} as Record<ExamKey, Status>;
    EXAMS.forEach((exam, index) => { const raw = get(`score${index}`), score = numberValue(raw), state = scoreStatus(get(`state${index}`), score !== null, settings); scores[exam] = score; statuses[exam] = state.status; if (score !== null && (score < 0 || score > settings.exams[index].total)) issues.push({ severity: "error", row: rowIndex + 1, message: `الدرجة ${score} خارج النطاق 0–${settings.exams[index].total}.` }); });
    rows.push({ id: `${base.studentId}-${norm(base.className)}-${norm(base.subject)}`, ...base, scores, statuses });
  }
  return { fileName, sheet, headerRow: headerRow + 1, rows, issues, settings, headers: matrix[headerRow].map(txt) };
}
