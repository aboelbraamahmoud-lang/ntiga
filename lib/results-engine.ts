export const EXAMS = ["exam1", "exam2", "exam3", "exam4"] as const;
export type ExamKey = (typeof EXAMS)[number];
export type Status = "present" | "absent" | "excused" | "unexcused" | "deprived" | "not_enrolled";
export type Macro = "above" | "average" | "below";
export type Exam = { key: ExamKey; name: string; total: number };
export type Band = { id: string; label: string; min: number; max: number; color: string; macro: Macro };
export type ReportNameKey = "summary" | "levels" | "struggling" | "teachers" | "comparison";
export type ReportDesign = {
  ministryHeader: string; systemHeader: string; logoLetter: string; logoDataUrl: string; stampDataUrl: string;
  schoolLabel: string; yearLabel: string; assessmentLabel: string; subjectLabel: string;
  reportNames: Record<ReportNameKey, string>;
  signatureLabels: { teacher: string; coordinator: string; vice: string; principal: string };
  primaryColor: string; secondaryColor: string; accentColor: string; footerText: string;
  showLogo: boolean; showStamp: boolean; showSignatures: boolean; showVision: boolean; showAttribution: boolean;
};
export type ImportAliases = { studentId: string[]; studentName: string[]; className: string[]; teacher: string[]; subject: string[]; department: string[]; coordinator: string[]; classes: string[] };
export type StatusAliases = Record<Exclude<Status, "present">, string[]>;
export type Settings = {
  schoolName: string; academicYear: string; principalName: string; academicViceName: string; coordinatorName: string; schoolVision: string;
  programmerDesignerName: string; reportSystemName: string; preparedByName: string; reviewedByName: string; showGeneratedAt: boolean;
  exams: Exam[]; pass: number; stable: number; bands: Band[]; reportDesign: ReportDesign; importAliases: ImportAliases; statusAliases: StatusAliases;
};
export type RecordRow = { id: string; studentId: string; studentName: string; grade: string; className: string; department: string; subject: string; teacher: string; scores: Record<ExamKey, number | null>; statuses: Record<ExamKey, Status> };
export type TeacherProfile = { id: string; teacher: string; subject: string; department: string; coordinator: string; classes: string[]; sourceRow?: number };
export type TeacherAssignment = { id: string; profileId: string; teacher: string; subject: string; department: string; grade: string; className: string };
export type ImportLog = { id: string; name: string; at: string; rows: number; warnings: number; kind?: "teachers" | "results"; exam?: ExamKey };
export type CustomReportTemplate = { id: string; name: string; title: string; subtitle: string; mode: "detail" | "summary"; groupBy: Dimension; subject: string; entityDimension: Dimension; entity: string; exam: ExamKey; compareExam: ExamKey; minPercent: number; maxPercent: number; columns: { key: string; label: string }[]; orientation: "portrait" | "landscape"; footerText: string };
export type Workspace = { version: 3; settings: Settings; rows: RecordRow[]; teachers: TeacherProfile[]; teacherAssignments: TeacherAssignment[]; activeExam: ExamKey; imports: ImportLog[]; customReports: CustomReportTemplate[] };

export const defaultReportDesign: ReportDesign = {
  ministryHeader: "وزارة التربية والتعليم والتعليم العالي", systemHeader: "نظام تحليل النتائج المدرسية", logoLetter: "م", logoDataUrl: "", stampDataUrl: "",
  schoolLabel: "المدرسة", yearLabel: "العام الأكاديمي", assessmentLabel: "التقييم", subjectLabel: "المادة",
  reportNames: { summary: "ملخص النتائج", levels: "تحليل المستويات", struggling: "الطلاب ضمن نسبة", teachers: "متوسطات المعلمين", comparison: "مقارنة اختبارين" },
  signatureLabels: { teacher: "توقيع معلم المادة", coordinator: "منسق المادة", vice: "النائب الأكاديمي", principal: "مدير المدرسة" },
  primaryColor: "#8f3f12", secondaryColor: "#174f62", accentColor: "#385f2a", footerText: "",
  showLogo: true, showStamp: true, showSignatures: true, showVision: true, showAttribution: true,
};

export const defaultImportAliases: ImportAliases = {
  studentId: ["الرقم", "الرقم الأكاديمي", "رقم الطالب", "student id"], studentName: ["الاسم", "اسم الطالب", "student name"],
  className: ["الشعبة الصفية", "الصف والشعبة", "الصف/الشعبة", "الشعبة", "الفصل", "section"], teacher: ["اسم المعلم", "المعلم"],
  subject: ["المادة", "اسم المادة"], department: ["القسم", "اسم القسم"], coordinator: ["اسم منسق المادة", "منسق المادة", "المنسق"], classes: ["الصفوف التي يقوم بتدريسها", "الصفوف والشعب", "الصفوف", "الصف والشعبة"],
};

export const defaultStatusAliases: StatusAliases = {
  absent: ["غائب", "غياب"], excused: ["معذور", "غياب بعذر", "غائب بعذر"], unexcused: ["غياب دون عذر", "غياب بدون عذر"],
  deprived: ["محروم"], not_enrolled: ["غير مقيد", "غير مسجل", "غير موجود", "not enrolled", "n/a"],
};

export const defaultSettings: Settings = {
  schoolName: "مدرسة الريادة النموذجية", academicYear: "2026/2027", principalName: "", academicViceName: "", coordinatorName: "", schoolVision: "متعلم ريادي لتنمية مستدامة",
  programmerDesignerName: "", reportSystemName: "منصة تحليل نتائج المدرسة", preparedByName: "", reviewedByName: "", showGeneratedAt: true, pass: 50, stable: 0.5,
  exams: [
    { key: "exam1", name: "الاختبار الأول", total: 20 }, { key: "exam2", name: "الاختبار الثاني", total: 30 },
    { key: "exam3", name: "الاختبار الثالث", total: 30 }, { key: "exam4", name: "الاختبار الرابع", total: 40 },
  ],
  bands: [
    { id: "excellent", label: "ممتاز", min: 90, max: 100, color: "#0f766e", macro: "above" },
    { id: "very_good", label: "جيد جدًا", min: 80, max: 90, color: "#2a948b", macro: "above" },
    { id: "good", label: "جيد", min: 70, max: 80, color: "#d49a2f", macro: "average" },
    { id: "acceptable", label: "مقبول", min: 60, max: 70, color: "#e5b653", macro: "average" },
    { id: "weak", label: "ضعيف", min: 50, max: 60, color: "#dd7856", macro: "below" },
    { id: "very_weak", label: "ضعيف جدًا", min: 0, max: 50, color: "#b84a55", macro: "below" },
  ],
  reportDesign: defaultReportDesign,
  importAliases: defaultImportAliases,
  statusAliases: defaultStatusAliases,
};

export const examOf = (s: Settings, key: ExamKey) => s.exams.find((e) => e.key === key)!;
export const previousExam = (key: ExamKey): ExamKey | null => { const i = EXAMS.indexOf(key); return i > 0 ? EXAMS[i - 1] : null; };
const arabicDigits = (value: string) => value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
export const normalizeArabic = (value: unknown) => arabicDigits(String(value ?? "")).trim().toLowerCase().replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[\s_\-–—:./\\()]+/g, "");
const gradeWords: Record<string, string> = { "اول":"1", "الاول":"1", "ثاني":"2", "الثاني":"2", "ثالث":"3", "الثالث":"3", "رابع":"4", "الرابع":"4", "خامس":"5", "الخامس":"5", "سادس":"6", "السادس":"6", "سابع":"7", "السابع":"7", "ثامن":"8", "الثامن":"8", "تاسع":"9", "التاسع":"9", "عاشر":"10", "العاشر":"10", "حاديعشر":"11", "الحاديعشر":"11", "ثانيعشر":"12", "الثانيعشر":"12" };
const gradeLabels: Record<string, string> = { "1":"الأول", "2":"الثاني", "3":"الثالث", "4":"الرابع", "5":"الخامس", "6":"السادس", "7":"السابع", "8":"الثامن", "9":"التاسع", "10":"العاشر", "11":"الحادي عشر", "12":"الثاني عشر" };
const sectionWords: Record<string, string> = { "ا":"1", "أ":"1", "ب":"2", "ج":"3", "د":"4", "ه":"5", "هـ":"5", "و":"6", "ز":"7", "ح":"8", "ط":"9", "ي":"10" };
const canonicalSection = (value: string) => sectionWords[value.trim()] ?? sectionWords[normalizeArabic(value)] ?? value.trim().toUpperCase();
export function canonicalClass(value: unknown) {
  const raw = arabicDigits(String(value ?? "")).trim().replace(/[\\|_-]+/g, "/").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
  if (!raw) return "";
  const numeric = raw.match(/^0?(\d{1,2})(?:\/|\s)+([\p{L}\d]+)$/u);
  if (numeric) return `${Number(numeric[1])}/${canonicalSection(numeric[2])}`;
  const compact = normalizeArabic(raw);
  for (const [word, code] of Object.entries(gradeWords).sort((a, b) => b[0].length - a[0].length)) {
    if (!compact.startsWith(word)) continue;
    const section = compact.slice(word.length);
    if (section) return `${code}/${canonicalSection(section)}`;
  }
  return raw.replace(/\s/g, "");
}
export function gradeFromClass(value: unknown) { const code = canonicalClass(value).split("/")[0]; return gradeLabels[code] ?? (code ? `الصف ${code}` : "غير محدد"); }
export const assignmentKey = (subject: unknown, className: unknown) => `${normalizeArabic(subject)}|${canonicalClass(className).toLowerCase()}`;
export function coordinatorForSubject(workspace: Workspace, subject: unknown) {
  const wanted = normalizeArabic(subject);
  if (wanted && ![normalizeArabic("الكل"), normalizeArabic("كل المواد"), normalizeArabic("غير محدد")].includes(wanted)) {
    const exact = [...new Set(workspace.teachers.filter((profile) => normalizeArabic(profile.subject) === wanted).map((profile) => profile.coordinator?.trim()).filter(Boolean))];
    if (exact.length) return exact.join("، ");
    const byDepartment = [...new Set(workspace.teachers.filter((profile) => normalizeArabic(profile.department) === wanted).map((profile) => profile.coordinator?.trim()).filter(Boolean))];
    if (byDepartment.length) return byDepartment.join("، ");
  }
  return workspace.settings.coordinatorName.trim();
}
export const pct = (row: RecordRow, exam: ExamKey, settings: Settings): number | null => {
  const score = row.scores[exam], total = examOf(settings, exam).total;
  return row.statuses[exam] === "present" && score !== null && score >= 0 && score <= total && total > 0 ? score / total * 100 : null;
};
export const bandOf = (value: number, bands: Band[]) => [...bands].sort((a, b) => b.min - a.min).find((b) => value >= b.min && (value < b.max || (b.max === 100 && value <= 100)));

export function summary(rows: RecordRow[], exam: ExamKey, settings: Settings) {
  const bandCounts = Object.fromEntries(settings.bands.map((b) => [b.id, 0])) as Record<string, number>;
  const macro = { above: 0, average: 0, below: 0 } as Record<Macro, number>;
  let evaluated = 0, passed = 0, raw = 0, possible = 0, absent = 0, excused = 0, unexcused = 0, deprived = 0, notEnrolled = 0;
  const students = new Set<string>();
  for (const row of rows) {
    students.add(row.studentId); const st = row.statuses[exam];
    if (st === "absent") absent++; if (st === "excused") excused++; if (st === "unexcused") unexcused++; if (st === "deprived") deprived++; if (st === "not_enrolled") notEnrolled++;
    const p = pct(row, exam, settings); if (p === null) continue;
    evaluated++; raw += row.scores[exam] ?? 0; possible += examOf(settings, exam).total; if (p >= settings.pass) passed++;
    const b = bandOf(p, settings.bands); if (b) { bandCounts[b.id]++; macro[b.macro]++; }
  }
  return { rows: rows.length, students: students.size, evaluated, passed, failed: evaluated - passed, absent, excused, unexcused, deprived, notEnrolled, success: evaluated ? passed / evaluated * 100 : 0, achievement: possible ? raw / possible * 100 : 0, raw, bandCounts, macro };
}

export function valueAdded(rows: RecordRow[], from: ExamKey, to: ExamKey, settings: Settings) {
  const deltas = rows.map((r) => { const a = pct(r, from, settings), b = pct(r, to, settings); return a === null || b === null ? null : b - a; }).filter((v): v is number => v !== null);
  const improved = deltas.filter((d) => d > settings.stable).length, declined = deltas.filter((d) => d < -settings.stable).length;
  return { paired: deltas.length, delta: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0, improved, declined, stable: deltas.length - improved - declined };
}

export type Dimension = "grade" | "className" | "department" | "subject" | "teacher";
export function groups(rows: RecordRow[], dim: Dimension, exam: ExamKey, settings: Settings, from?: ExamKey | null) {
  const map = new Map<string, RecordRow[]>(); rows.forEach((r) => map.set(r[dim] || "غير محدد", [...(map.get(r[dim] || "غير محدد") ?? []), r]));
  return [...map].map(([name, subset]) => ({ name, subset, metric: summary(subset, exam, settings), va: from ? valueAdded(subset, from, exam, settings) : null })).sort((a, b) => b.metric.achievement - a.metric.achievement);
}
export const values = (rows: RecordRow[], dim: Dimension) => [...new Set(rows.map((r) => r[dim]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
export const percent = (n: number, d = 1) => `${n.toLocaleString("ar-EG", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
export const deltaText = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("ar-EG", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ن.م`;
export function validateBands(bands: Band[]) { const e: string[] = []; const sorted = [...bands].sort((a,b)=>a.min-b.min); if (sorted[0]?.min !== 0) e.push("يجب أن تبدأ المستويات من 0."); if (sorted.at(-1)?.max !== 100) e.push("يجب أن تنتهي المستويات عند 100."); sorted.forEach((b,i)=>{ if(b.min<0||b.max>100||b.min>=b.max)e.push(`حدود «${b.label}» غير صحيحة.`); if(i&&b.min!==sorted[i-1].max)e.push(`يوجد تداخل أو فجوة قبل «${b.label}».`); }); return [...new Set(e)]; }
export const statusArabic = (s: Status) => ({ present: "حاضر", absent: "غائب", excused: "معذور / غياب بعذر", unexcused: "غياب دون عذر", deprived: "محروم", not_enrolled: "غير مقيد" }[s]);

export function assignmentsFromRows(rows: RecordRow[]) {
  const profiles = new Map<string, TeacherProfile>();
  const assignments = new Map<string, TeacherAssignment>();
  rows.filter((row) => row.teacher).forEach((row) => {
    const profileKey = `${normalizeArabic(row.teacher)}|${normalizeArabic(row.subject)}|${normalizeArabic(row.department)}`;
    const profileId = `profile-${profileKey}`;
    const profile = profiles.get(profileKey) ?? { id: profileId, teacher: row.teacher, subject: row.subject, department: row.department || row.subject, coordinator: "", classes: [] };
    if (!profile.classes.includes(row.className)) profile.classes.push(row.className);
    profiles.set(profileKey, profile);
    const key = `${profileId}|${assignmentKey(row.subject, row.className)}`;
    assignments.set(key, { id: `assignment-${key}`, profileId, teacher: row.teacher, subject: row.subject, department: row.department || row.subject, grade: row.grade || gradeFromClass(row.className), className: canonicalClass(row.className) });
  });
  return { teachers: [...profiles.values()], teacherAssignments: [...assignments.values()] };
}

export function migrateWorkspace(input: unknown): Workspace {
  const candidate = input as Partial<Workspace> & { version?: number; rows?: RecordRow[] };
  const rows = (Array.isArray(candidate?.rows) ? candidate.rows : []).map((row) => { const className = canonicalClass(row.className); return { ...row, className, grade: gradeFromClass(className) }; });
  const derived = assignmentsFromRows(rows);
  const rawSettings = candidate?.settings ?? {} as Partial<Settings>;
  const reportDesign = { ...defaultReportDesign, ...(rawSettings.reportDesign ?? {}), reportNames: { ...defaultReportDesign.reportNames, ...(rawSettings.reportDesign?.reportNames ?? {}) }, signatureLabels: { ...defaultReportDesign.signatureLabels, ...(rawSettings.reportDesign?.signatureLabels ?? {}) } };
  const importAliases = { ...defaultImportAliases, ...(rawSettings.importAliases ?? {}) };
  const statusAliases = { ...defaultStatusAliases, ...(rawSettings.statusAliases ?? {}) };
  const teachers = (Array.isArray(candidate?.teachers) ? candidate.teachers : derived.teachers).map((profile) => ({ ...profile, coordinator: profile.coordinator ?? "", classes: profile.classes.map(canonicalClass) }));
  const teacherAssignments = (Array.isArray(candidate?.teacherAssignments) ? candidate.teacherAssignments : derived.teacherAssignments).map((assignment) => { const className = canonicalClass(assignment.className); return { ...assignment, className, grade: gradeFromClass(className) }; });
  return {
    version: 3,
    settings: { ...defaultSettings, ...rawSettings, exams: rawSettings.exams ?? defaultSettings.exams.map((e) => ({ ...e })), bands: rawSettings.bands ?? defaultSettings.bands.map((b) => ({ ...b })), reportDesign, importAliases, statusAliases },
    rows,
    teachers,
    teacherAssignments,
    activeExam: EXAMS.includes(candidate?.activeExam as ExamKey) ? candidate.activeExam as ExamKey : "exam1",
    imports: Array.isArray(candidate?.imports) ? candidate.imports : [],
    customReports: Array.isArray(candidate?.customReports) ? candidate.customReports : [],
  };
}
