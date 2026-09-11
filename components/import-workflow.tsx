"use client";

import { useMemo, useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Link2,
  Trash2,
  Upload,
  Users,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Heading, Kpi, nfmt, Panel, Picker } from "@/components/results-ui";
import {
  buildMappingResolutions,
  materializeResultRows,
  parseResultWorkbook,
  parseTeacherWorkbook,
  type MappingResolution,
  type ResultSheetImport,
  type ResultWorkbookImport,
  type TeacherImportResult,
} from "@/lib/importer";
import {
  EXAMS,
  assignmentKey,
  canonicalClass,
  examOf,
  gradeFromClass,
  normalizeArabic,
  type ExamKey,
  type RecordRow,
  type TeacherAssignment,
  type Workspace,
} from "@/lib/results-engine";

type Props = { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; onDone: () => void };
const mappingLabels: Record<MappingResolution["status"], string> = { matched: "مطابق تلقائيًا", missing: "إسناد غير موجود", ambiguous: "أكثر من معلم", mismatch: "اختلاف تسمية", manual: "حُسم يدويًا" };
const mappingStyles: Record<MappingResolution["status"], string> = { matched: "bg-emerald-50 text-emerald-700", missing: "bg-rose-50 text-rose-700", ambiguous: "bg-amber-50 text-amber-700", mismatch: "bg-sky-50 text-sky-700", manual: "bg-violet-50 text-violet-700" };

function uniqueRecordKey(row: Pick<RecordRow, "studentId" | "subject" | "className">) { return `${normalizeArabic(row.studentId)}|${assignmentKey(row.subject, row.className)}`; }

export function ImportWorkflow({ workspace, setWorkspace, onDone }: Props) {
  const teacherInput = useRef<HTMLInputElement>(null);
  const resultsInput = useRef<HTMLInputElement>(null);
  const [teacherStage, setTeacherStage] = useState<TeacherImportResult | null>(null);
  const [resultFiles, setResultFiles] = useState<ResultWorkbookImport[]>([]);
  const [busy, setBusy] = useState<"teachers" | "results" | "">("");
  const [targetExam, setTargetExam] = useState<ExamKey>(workspace.activeExam);
  const [examTotal, setExamTotal] = useState(examOf(workspace.settings, workspace.activeExam).total);
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({});

  const pendingRows = useMemo(() => materializeResultRows(resultFiles), [resultFiles]);
  const mappings = useMemo(() => buildMappingResolutions(pendingRows, workspace.teachers, workspace.teacherAssignments, manualLinks), [pendingRows, workspace.teachers, workspace.teacherAssignments, manualLinks]);
  const unresolved = mappings.filter((mapping) => !mapping.selectedProfileId);
  const invalidScores = pendingRows.filter((row) => !row.recognized || (row.score !== null && (row.score < 0 || row.score > examTotal)) || !row.subject);
  const duplicateRows = useMemo(() => {
    const seen = new Set<string>(), duplicates = new Set<string>();
    pendingRows.forEach((row) => { const key = uniqueRecordKey(row); if (seen.has(key)) duplicates.add(key); else seen.add(key); });
    return duplicates.size;
  }, [pendingRows]);
  const matchedRows = mappings.filter((mapping) => mapping.selectedProfileId).reduce((sum, mapping) => sum + mapping.rows, 0);

  async function readTeachers(file: File) {
    setBusy("teachers");
    try {
      setTeacherStage(parseTeacherWorkbook(await file.arrayBuffer(), file.name, workspace.settings));
      toast.success("تم فحص قاعدة المعلمين");
    } catch {
      toast.error("تعذر قراءة ملف المعلمين");
    } finally { setBusy(""); }
  }

  function updateTeacherProfile(profileId: string, patch: { teacher?: string; subject?: string; department?: string; coordinator?: string; classes?: string[] }) {
    setTeacherStage((current) => current ? {
      ...current,
      profiles: current.profiles.map((profile) => profile.id === profileId ? { ...profile, ...patch } : profile),
      assignments: (() => {
        const profile = current.profiles.find((item) => item.id === profileId);
        if (!profile) return current.assignments;
        const updated = { ...profile, ...patch };
        const retained = current.assignments.filter((assignment) => assignment.profileId !== profileId);
        const rebuilt = updated.subject ? updated.classes.map((className) => ({ id: `assignment-${updated.id}-${normalizeArabic(updated.subject)}-${normalizeArabic(className)}`, profileId: updated.id, teacher: updated.teacher, subject: updated.subject, department: updated.department || updated.subject, grade: gradeFromClass(className), className: canonicalClass(className) } satisfies TeacherAssignment)) : [];
        return [...retained, ...rebuilt];
      })(),
    } : current);
  }

  function commitTeachers() {
    if (!teacherStage || teacherStage.issues.some((issue) => issue.severity === "error") || !teacherStage.profiles.length) return;
    setWorkspace((current) => {
      const assignmentsByKey = new Map<string, TeacherAssignment[]>();
      teacherStage.assignments.forEach((assignment) => { const key = assignmentKey(assignment.subject, assignment.className); assignmentsByKey.set(key, [...(assignmentsByKey.get(key) ?? []), assignment]); });
      const rows = current.rows.map((row) => {
        const matches = assignmentsByKey.get(assignmentKey(row.subject, row.className)) ?? [];
        return matches.length === 1 ? { ...row, teacher: matches[0].teacher, department: matches[0].department } : { ...row, teacher: "", department: row.subject };
      });
      return {
        ...current,
        rows,
        teachers: teacherStage.profiles,
        teacherAssignments: teacherStage.assignments,
        imports: [{ id: crypto.randomUUID(), name: teacherStage.fileName, at: new Date().toISOString(), rows: teacherStage.assignments.length, warnings: teacherStage.issues.filter((issue) => issue.severity === "warning").length, kind: "teachers" as const }, ...current.imports],
      };
    });
    setTeacherStage(null);
    setManualLinks({});
    toast.success("تم اعتماد قاعدة المعلمين وإعادة فحص الربط");
  }

  async function readResults(files: File[]) {
    if (!files.length) return;
    setBusy("results");
    try {
      const parsed: ResultWorkbookImport[] = [];
      for (const file of files) parsed.push(parseResultWorkbook(await file.arrayBuffer(), file.name, workspace.settings));
      setResultFiles(parsed);
      setManualLinks({});
      const suggestions = parsed.flatMap((file) => file.sheets.flatMap((sheet) => sheet.scoreColumns.filter((column) => column.key === sheet.selectedScoreKey).map((column) => column.suggestedTotal)));
      if (suggestions.length) {
        const counts = new Map<number, number>(); suggestions.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
        setExamTotal([...counts].sort((a, b) => b[1] - a[1])[0][0]);
      }
      toast.success(`تم فحص ${files.length.toLocaleString("ar-EG")} ملف`);
    } catch {
      toast.error("تعذر قراءة أحد ملفات النتائج");
    } finally { setBusy(""); }
  }

  function updateSheet(sheetId: string, patch: Partial<ResultSheetImport>) {
    setResultFiles((files) => files.map((file) => ({ ...file, sheets: file.sheets.map((sheet) => sheet.id === sheetId ? { ...sheet, ...patch } : sheet) })));
    setManualLinks({});
  }

  function onDropResults(event: DragEvent<HTMLButtonElement>) { event.preventDefault(); void readResults([...event.dataTransfer.files].filter((file) => /\.(xlsx|xls|csv)$/i.test(file.name))); }

  function commitResults() {
    if (!pendingRows.length || unresolved.length || invalidScores.length || duplicateRows || examTotal <= 0) return;
    const profileMap = new Map(workspace.teachers.map((profile) => [profile.id, profile]));
    const resolutionMap = new Map(mappings.map((mapping) => [mapping.key, mapping]));
    const manualAssignments = mappings.filter((mapping) => mapping.status === "manual").flatMap((mapping) => {
      const profile = profileMap.get(mapping.selectedProfileId); if (!profile) return [];
      return [{ id: `manual-${profile.id}-${normalizeArabic(mapping.subject)}-${normalizeArabic(mapping.className)}`, profileId: profile.id, teacher: profile.teacher, subject: mapping.subject, department: profile.department || mapping.subject, grade: mapping.grade, className: canonicalClass(mapping.className) } satisfies TeacherAssignment];
    });
    setWorkspace((current) => {
      const records = new Map(current.rows.map((row) => [uniqueRecordKey(row), row]));
      for (const row of pendingRows) {
        const resolution = resolutionMap.get(assignmentKey(row.subject, row.className));
        const profile = resolution ? profileMap.get(resolution.selectedProfileId) : undefined;
        if (!profile) continue;
        const key = uniqueRecordKey(row);
        const existing = records.get(key);
        const base: RecordRow = existing ?? {
          id: `${row.studentId}-${normalizeArabic(row.subject)}-${normalizeArabic(row.className)}`,
          studentId: row.studentId,
          studentName: row.studentName,
          grade: row.grade,
          className: canonicalClass(row.className),
          department: profile.department || row.subject,
          subject: row.subject,
          teacher: profile.teacher,
          scores: Object.fromEntries(EXAMS.map((exam) => [exam, null])) as Record<ExamKey, number | null>,
          statuses: Object.fromEntries(EXAMS.map((exam) => [exam, "not_enrolled"])) as Record<ExamKey, "not_enrolled">,
        };
        records.set(key, { ...base, studentName: row.studentName, grade: row.grade, className: canonicalClass(row.className), subject: row.subject, teacher: profile.teacher, department: profile.department || row.subject, scores: { ...base.scores, [targetExam]: row.score }, statuses: { ...base.statuses, [targetExam]: row.status } });
      }
      const names = [...new Set(resultFiles.map((file) => file.fileName))];
      return {
        ...current,
        activeExam: targetExam,
        settings: { ...current.settings, exams: current.settings.exams.map((exam) => exam.key === targetExam ? { ...exam, total: examTotal } : exam) },
        rows: [...records.values()],
        teachers: current.teachers.map((profile) => {
          const additions = manualAssignments.filter((assignment) => assignment.profileId === profile.id).map((assignment) => assignment.className);
          return additions.length ? { ...profile, classes: [...new Set([...profile.classes, ...additions])] } : profile;
        }),
        teacherAssignments: [...current.teacherAssignments.filter((assignment) => !manualAssignments.some((manual) => assignmentKey(manual.subject, manual.className) === assignmentKey(assignment.subject, assignment.className))), ...manualAssignments],
        imports: [{ id: crypto.randomUUID(), name: names.join("، "), at: new Date().toISOString(), rows: pendingRows.length, warnings: resultFiles.flatMap((file) => [...file.issues, ...file.sheets.flatMap((sheet) => sheet.issues)]).filter((issue) => issue.severity === "warning").length, kind: "results" as const, exam: targetExam }, ...current.imports],
      };
    });
    setResultFiles([]);
    setManualLinks({});
    toast.success("تم اعتماد النتائج وربطها بالمعلمين وتحديث التحليلات");
    onDone();
  }

  const teacherErrors = teacherStage?.issues.filter((issue) => issue.severity === "error") ?? [];
  const teacherWarnings = teacherStage?.issues.filter((issue) => issue.severity === "warning") ?? [];
  return <div className="space-y-6">
    <Heading kicker="بوابة الاستيراد الذكية" title="من ملف المدرسة إلى تحليل موثوق" desc="استورد قاعدة المعلمين مرة واحدة، ثم ارفع ملفات النتائج كما تصدر من المدرسة. لن تُعتمد أي نتيجة قبل مراجعة المادة والشعبة والمعلم والدرجة الكلية." action={<div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="/نموذج-قاعدة-بيانات-المعلمين.xlsx" download><Download/>نموذج المعلمين</a></Button><Button variant="outline" asChild><a href="/نموذج-نتيجة-مادة.xlsx" download><Download/>نموذج النتيجة</a></Button></div>}/>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      ["١", "قاعدة المعلمين", "الاسم والمادة والقسم والصفوف"], ["٢", "مراجعة الإسناد", "تحويل سابع أ إلى 7/1"], ["٣", "ملفات النتائج", "ملف أو عدة ملفات معًا"], ["٤", "اختيار الاختبار", "العمود والدرجة الكلية"], ["٥", "اعتماد آمن", "بعد حسم كل حالات الربط"],
    ].map(([number, title, text]) => <div className="rounded-2xl border bg-white p-4" key={title}><span className="grid size-8 place-items-center rounded-full bg-teal-700 font-black text-white">{number}</span><b className="mt-3 block">{title}</b><small className="text-slate-500">{text}</small></div>)}</div>

    <Panel title="١ — قاعدة بيانات المعلمين" desc="يقبل النموذج المرفق: اسم المعلم، المادة، القسم، منسق المادة، ثم الصفوف. يستخدم منسق المادة تلقائيًا في توقيع تقاريرها.">
      <input ref={teacherInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readTeachers(file); event.currentTarget.value = ""; }}/>
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 p-5 sm:flex-row sm:items-center sm:justify-between"><div><b className="flex items-center gap-2 text-sky-950"><Database className="size-5"/>{workspace.teachers.length ? `القاعدة الحالية: ${nfmt(workspace.teachers.length)} معلم` : "ابدأ برفع ملف المعلمين"}</b><p className="mt-1 text-sm text-sky-800/70">الإسنادات القابلة للربط: {nfmt(workspace.teacherAssignments.length)}</p></div><Button onClick={() => teacherInput.current?.click()} disabled={busy === "teachers"} className="bg-[#123247]"><Upload/>{busy === "teachers" ? "جارٍ الفحص…" : "اختيار ملف المعلمين"}</Button></div>
      {teacherStage && <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3"><Kpi label="المعلمون" value={nfmt(teacherStage.profiles.length)} hint={`ورقة ${teacherStage.sheet}`} icon={Users} tone="navy"/><Kpi label="الإسنادات" value={nfmt(teacherStage.assignments.length)} hint="مادة + شعبة" icon={Link2}/><Kpi label="الملاحظات" value={nfmt(teacherWarnings.length + teacherErrors.length)} hint={`${nfmt(teacherErrors.length)} مانعة`} icon={teacherErrors.length ? XCircle : AlertCircle} tone={teacherErrors.length ? "rose" : "gold"}/></div>
        <div className="max-h-[520px] overflow-auto rounded-xl border"><Table><TableHeader className="sticky top-0 bg-slate-50"><TableRow><TableHead className="min-w-52 text-right">المعلم</TableHead><TableHead className="min-w-48 text-right">المادة</TableHead><TableHead className="min-w-48 text-right">القسم</TableHead><TableHead className="min-w-52 text-right">منسق المادة</TableHead><TableHead className="min-w-72 text-right">الصفوف والشعب</TableHead></TableRow></TableHeader><TableBody>{teacherStage.profiles.map((profile) => <TableRow key={profile.id}><TableCell><Input value={profile.teacher} onChange={(event) => updateTeacherProfile(profile.id, { teacher: event.target.value })}/><small className="block pt-1 text-slate-400">صف المصدر {profile.sourceRow}</small></TableCell><TableCell><Input value={profile.subject} placeholder="اسم المادة" onChange={(event) => updateTeacherProfile(profile.id, { subject: event.target.value })}/></TableCell><TableCell><Input value={profile.department} placeholder="اسم القسم" onChange={(event) => updateTeacherProfile(profile.id, { department: event.target.value })}/></TableCell><TableCell><Input value={profile.coordinator} placeholder="اسم المنسق" onChange={(event) => updateTeacherProfile(profile.id, { coordinator: event.target.value })}/></TableCell><TableCell><Input value={profile.classes.join("، ")} placeholder="7/1، 7/2، 8/1" onChange={(event) => updateTeacherProfile(profile.id, { classes: event.target.value.split(/[،,;؛\n]+/).map(canonicalClass).filter(Boolean) })}/><small className="block pt-1 text-slate-400">يمكن تعديل جميع البيانات قبل الاعتماد</small></TableCell></TableRow>)}</TableBody></Table></div>
        {!!teacherStage.issues.length && <div className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">{teacherStage.issues.slice(0, 12).map((issue, index) => <p key={index}>• {issue.row ? `صف ${issue.row}: ` : ""}{issue.message}</p>)}</div>}
        <div className="flex justify-end"><Button onClick={commitTeachers} disabled={!!teacherErrors.length || !teacherStage.profiles.length} className="bg-teal-700"><CheckCircle2/>اعتماد قاعدة المعلمين</Button></div>
      </div>}
    </Panel>

    <Panel title="٢ — ملفات النتائج" desc="ارفع ملفات المواد والصفوف معًا. يكتشف النظام ورقة البيانات، واسم المادة، والفترة، وعمودي التقييم تلقائيًا.">
      <input ref={resultsInput} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { void readResults([...(event.target.files ?? [])]); event.currentTarget.value = ""; }}/>
      <button onClick={() => resultsInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDropResults} className="grid min-h-48 w-full place-items-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50 p-8 text-center"><span><Upload className="mx-auto size-10 text-teal-700"/><b className="mt-4 block text-lg">{busy === "results" ? "جارٍ فحص الملفات…" : "اسحب ملفات النتائج هنا أو اضغط للاختيار"}</b><small className="mt-2 block text-slate-500">يمكن اختيار عدة ملفات XLSX في دفعة واحدة</small></span></button>
      {!!resultFiles.length && <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-slate-50 p-4"><div><Label>الاختبار المستهدف</Label><Picker className="mt-2 min-w-52" value={targetExam} onChange={(value) => { const exam = value as ExamKey; setTargetExam(exam); setExamTotal(examOf(workspace.settings, exam).total); }} items={workspace.settings.exams.map((exam) => ({ value: exam.key, label: exam.name }))}/></div><div><Label>الدرجة الكلية لهذا الاختبار</Label><Input className="mt-2 w-40" type="number" min="0.01" step="0.5" value={examTotal} onChange={(event) => setExamTotal(Number(event.target.value))}/></div><Badge className="mb-1 bg-white text-slate-700">تُحدّث كل المعادلات تلقائيًا</Badge><Button className="mb-0.5 mr-auto" variant="ghost" onClick={() => { setResultFiles([]); setManualLinks({}); }}><Trash2/>مسح الملفات</Button></div>
        <div className="grid gap-4 xl:grid-cols-2">{resultFiles.flatMap((file) => file.sheets).map((sheet) => <div key={sheet.id} className={`rounded-2xl border p-4 ${sheet.selected ? "bg-white" : "bg-slate-50 opacity-70"}`}><div className="flex items-start gap-3"><input className="mt-1 size-4 accent-teal-700" type="checkbox" checked={sheet.selected} onChange={(event) => updateSheet(sheet.id, { selected: event.target.checked })}/><div className="min-w-0 flex-1"><b className="block truncate">{sheet.fileName}</b><small className="text-slate-500">ورقة: {sheet.sheet} · {nfmt(sheet.rows.length)} طالب</small></div>{sheet.hidden && <Badge variant="outline">ورقة مخفية</Badge>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>المادة المكتشفة</Label><Input className="mt-2" value={sheet.subject} onChange={(event) => updateSheet(sheet.id, { subject: event.target.value })}/></div><div><Label>عمود الدرجة المعتمد</Label><Picker className="mt-2 w-full" value={sheet.selectedScoreKey} onChange={(value) => updateSheet(sheet.id, { selectedScoreKey: value })} items={sheet.scoreColumns.map((column) => ({ value: column.key, label: `${column.header} — مقترح ${column.suggestedTotal}` }))}/></div></div><p className="mt-3 text-xs text-slate-500">الفترة: {sheet.period || "غير مذكورة"} · صف العناوين: {sheet.headerRow}</p></div>)}</div>
      </div>}
    </Panel>

    {!!pendingRows.length && <Panel title="٣ — مراجعة الربط قبل الاعتماد" desc="الربط الدقيق يعتمد على المادة + الشعبة. تستطيع حسم أي حالة ناقصة باختيار المعلم الصحيح؛ وسيُحفظ هذا الإسناد للمرة التالية.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="السجلات المقروءة" value={nfmt(pendingRows.length)} hint={`${nfmt(mappings.length)} مادة/شعبة`} icon={FileSpreadsheet} tone="navy"/><Kpi label="مربوطة" value={nfmt(matchedRows)} hint="تلقائيًا أو يدويًا" icon={CheckCircle2}/><Kpi label="تحتاج حسمًا" value={nfmt(unresolved.length)} hint="لن يعتمد الملف قبل حلها" icon={AlertCircle} tone={unresolved.length ? "rose" : "teal"}/><Kpi label="أخطاء الدرجات" value={nfmt(invalidScores.length + duplicateRows)} hint={duplicateRows ? `${nfmt(duplicateRows)} سجل مكرر` : `النطاق 0–${examTotal}`} icon={invalidScores.length || duplicateRows ? XCircle : WandSparkles} tone={invalidScores.length || duplicateRows ? "rose" : "gold"}/></div>
      <div className="mt-5 max-h-[620px] overflow-auto rounded-xl border"><Table><TableHeader className="sticky top-0 z-10 bg-slate-50"><TableRow><TableHead className="text-right">الصف/الشعبة</TableHead><TableHead className="text-right">المادة</TableHead><TableHead>الطلاب</TableHead><TableHead className="text-right">حالة الربط</TableHead><TableHead className="min-w-72 text-right">المعلم</TableHead></TableRow></TableHeader><TableBody>{mappings.map((mapping) => { const profile = workspace.teachers.find((item) => item.id === mapping.selectedProfileId); const candidates = new Set(mapping.candidateProfileIds); const options = [...workspace.teachers].sort((a, b) => Number(candidates.has(b.id)) - Number(candidates.has(a.id)) || a.teacher.localeCompare(b.teacher, "ar")).map((item) => ({ value: item.id, label: `${item.teacher} — ${item.subject || "بلا مادة"}` })); return <TableRow key={mapping.key}><TableCell><b>{mapping.className}</b><small className="block text-slate-400">{mapping.grade}</small></TableCell><TableCell>{mapping.subject || <span className="text-rose-600">غير محددة</span>}</TableCell><TableCell>{nfmt(mapping.rows)}</TableCell><TableCell><Badge className={mappingStyles[mapping.status]}>{mappingLabels[mapping.status]}</Badge></TableCell><TableCell>{mapping.status === "matched" ? <span className="font-bold text-emerald-800">{profile?.teacher}</span> : <Picker className="w-full" value={mapping.selectedProfileId || "__none__"} onChange={(value) => setManualLinks((current) => ({ ...current, [mapping.key]: value === "__none__" ? "" : value }))} items={[{ value: "__none__", label: options.length ? "اختر المعلم الصحيح" : "استورد قاعدة المعلمين أولًا" }, ...options]}/>}</TableCell></TableRow>; })}</TableBody></Table></div>
      {(unresolved.length > 0 || invalidScores.length > 0 || duplicateRows > 0) && <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm leading-7 text-rose-800">{unresolved.length > 0 && <p>• توجد {nfmt(unresolved.length)} حالة ربط لم تُحسم.</p>}{invalidScores.length > 0 && <p>• توجد {nfmt(invalidScores.length)} درجة أو مادة غير صالحة للدرجة الكلية المحددة.</p>}{duplicateRows > 0 && <p>• رفعت سجلات مكررة لنفس الطالب والمادة والشعبة في هذه الدفعة.</p>}</div>}
      {!workspace.teachers.length && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><BookOpen className="ml-2 inline size-4"/>استورد قاعدة المعلمين واعتمدها أولًا حتى تظهر اختيارات الربط.</div>}
      <div className="mt-5 flex justify-end"><Button onClick={commitResults} disabled={!pendingRows.length || !!unresolved.length || !!invalidScores.length || !!duplicateRows || examTotal <= 0} className="bg-teal-700"><CheckCircle2/>اعتماد النتائج وتحديث كل التحليلات</Button></div>
    </Panel>}
  </div>;
}
