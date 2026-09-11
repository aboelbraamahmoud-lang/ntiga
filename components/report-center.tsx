"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, FileDown, FileText, GraduationCap, Medal, Printer, School, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heading, Panel, Picker } from "@/components/results-ui";
import { ReportFooter, ReportHeader, reportStyle } from "@/components/report-chrome";
import {
  EXAMS,
  bandOf,
  deltaText,
  examOf,
  groups,
  pct,
  percent,
  statusArabic,
  summary,
  valueAdded,
  values,
  type ExamKey,
  type RecordRow,
  type Settings,
  type Workspace,
} from "@/lib/results-engine";

type ReportType = "summary" | "levels" | "struggling" | "teachers" | "comparison";
type Scope = "className" | "teacher";
type PageData = { key: string; title: string; entity: string; scope: Scope; className: string; teacher: string; subject: string; rows: RecordRow[]; allRows: RecordRow[]; rowOffset: number; part: number; totalParts: number };

const reportOptions = [
  { id: "summary" as const, title: "ملخص النتائج", text: "حضور ونجاح وتحصيل وتوزيع المستويات", icon: FileText },
  { id: "levels" as const, title: "تحليل المستويات", text: "كشف تفصيلي للطلاب مجمّع حسب مستوى الأداء", icon: Medal },
  { id: "struggling" as const, title: "الطلاب ضمن نسبة", text: "قائمة علاجية حسب حد مئوي تختاره", icon: TrendingDown },
  { id: "teachers" as const, title: "متوسطات المعلمين", text: "صفوف المعلم ومتوسط النجاح والتحصيل", icon: GraduationCap },
  { id: "comparison" as const, title: "مقارنة اختبارين", text: "درجة ونسبة وفارق ومستوى لكل طالب", icon: ArrowLeftRight },
];

const uniq = (items: string[]) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
const scoreText = (row: RecordRow, exam: ExamKey) => row.scores[exam] === null ? statusArabic(row.statuses[exam]) : String(row.scores[exam]);

function makePages(rows: RecordRow[], scope: Scope, entity: string, subject: string, reportType: ReportType, exam: ExamKey, threshold: number, settings: Settings): PageData[] {
  const subjectRows = subject === "الكل" ? rows : rows.filter((row) => row.subject === subject);
  const entities = entity === "الكل" ? uniq(subjectRows.map((row) => row[scope])) : [entity];
  const detailed = reportType === "levels" || reportType === "struggling" || reportType === "comparison";
  const pages: PageData[] = [];
  entities.forEach((name) => {
    const entityRows = subjectRows.filter((row) => row[scope] === name);
    if (!detailed) {
      pages.push({ key: `${scope}-${name}`, title: name, entity: name, scope, className: scope === "className" ? name : "", teacher: scope === "teacher" ? name : uniq(entityRows.map((row) => row.teacher)).join("، "), subject: subject === "الكل" ? "كل المواد" : subject, rows: entityRows, allRows: entityRows, rowOffset: 0, part: 1, totalParts: 1 });
      return;
    }
    const classNames = scope === "teacher" ? uniq(entityRows.map((row) => row.className)) : [name];
    classNames.forEach((className) => {
      const classRows = entityRows.filter((row) => row.className === className);
      const subjects = subject === "الكل" ? uniq(classRows.map((row) => row.subject)) : [subject];
      subjects.forEach((subjectName) => {
        const subjectPageRows = classRows.filter((row) => row.subject === subjectName);
        const pageRows = reportType === "struggling"
          ? subjectPageRows.filter((row) => { const value = pct(row, exam, settings); return value !== null && value < threshold; }).sort((a, b) => (pct(a, exam, settings) ?? 0) - (pct(b, exam, settings) ?? 0))
          : reportType === "levels"
            ? [...subjectPageRows].sort((a, b) => (pct(b, exam, settings) ?? -1) - (pct(a, exam, settings) ?? -1))
            : subjectPageRows;
        const teacher = scope === "teacher" ? name : uniq(subjectPageRows.map((row) => row.teacher)).join("، ");
        const pageSize = reportType === "comparison" ? 28 : reportType === "levels" ? 34 : 36;
        const chunks = pageRows.length ? Array.from({ length: Math.ceil(pageRows.length / pageSize) }, (_, index) => pageRows.slice(index * pageSize, (index + 1) * pageSize)) : [[]];
        chunks.forEach((chunk, index) => pages.push({ key: `${scope}-${name}-${className}-${subjectName}-${index}`, title: `${className} — ${subjectName}`, entity: name, scope, className, teacher, subject: subjectName, rows: chunk, allRows: reportType === "struggling" ? pageRows : subjectPageRows, rowOffset: index * pageSize, part: index + 1, totalParts: chunks.length }));
      });
    });
  });
  return pages;
}

function DistributionRow({ rows, exam, workspace }: { rows: RecordRow[]; exam: ExamKey; workspace: Workspace }) {
  const metrics = summary(rows, exam, workspace.settings);
  return <div className="report-distribution">{workspace.settings.bands.map((band) => <div key={band.id} style={{ borderTopColor: band.color }}><span>{band.label}</span><b>{metrics.bandCounts[band.id] ?? 0}</b><small>{band.min}–{band.max}%</small></div>)}</div>;
}

function SummaryReport({ page, exam, workspace }: { page: PageData; exam: ExamKey; workspace: Workspace }) {
  const metrics = summary(page.allRows, exam, workspace.settings);
  const dimension = page.scope === "teacher" ? "className" : "teacher";
  const table = groups(page.allRows, dimension, exam, workspace.settings, EXAMS.indexOf(exam) > 0 ? EXAMS[EXAMS.indexOf(exam) - 1] : null);
  return <>
    <div className="report-meta-grid"><b>{page.className || page.entity}</b><span>{page.teacher || "جميع المعلمين"}</span><span>{examOf(workspace.settings, exam).name} · من {examOf(workspace.settings, exam).total}</span></div>
    <div className="report-kpis">{[["عدد الطلاب", metrics.students], ["حاضر/مقيم", metrics.evaluated], ["غائب", metrics.absent + metrics.excused + metrics.unexcused], ["ناجح", metrics.passed], ["راسب", metrics.failed], ["نسبة النجاح", percent(metrics.success)], ["نسبة التحصيل", percent(metrics.achievement)]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{value}</b></div>)}</div>
    <h2 className="report-section-title">ملخص الأداء</h2>
    <table className="report-table"><thead><tr><th>{page.scope === "teacher" ? "الصف/الشعبة" : "المعلم"}</th><th>الطلاب</th><th>ناجح</th><th>راسب</th><th>نسبة النجاح</th><th>نسبة التحصيل</th><th>القيمة المضافة</th></tr></thead><tbody>{table.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.metric.evaluated}</td><td>{item.metric.passed}</td><td>{item.metric.failed}</td><td>{percent(item.metric.success)}</td><td>{percent(item.metric.achievement)}</td><td>{item.va ? deltaText(item.va.delta) : "خط أساس"}</td></tr>)}</tbody><tfoot><tr><td>الإجمالي / المتوسط</td><td>{metrics.evaluated}</td><td>{metrics.passed}</td><td>{metrics.failed}</td><td>{percent(metrics.success)}</td><td>{percent(metrics.achievement)}</td><td>—</td></tr></tfoot></table>
    <h2 className="report-section-title">توزيع مستويات الأداء</h2><DistributionRow rows={page.allRows} exam={exam} workspace={workspace}/>
  </>;
}

function LevelsReport({ page, exam, workspace }: { page: PageData; exam: ExamKey; workspace: Workspace }) {
  const rows = [...page.rows].sort((a, b) => (pct(b, exam, workspace.settings) ?? -1) - (pct(a, exam, workspace.settings) ?? -1));
  const metrics = summary(page.allRows, exam, workspace.settings);
  return <>
    <div className="report-meta-grid"><b>الصف: {page.className}</b><span>المعلم: {page.teacher || "غير مربوط"}</span><span>{examOf(workspace.settings, exam).name} · {examOf(workspace.settings, exam).total} درجة</span></div>
    <div className="report-kpis compact">{[["الطلاب", metrics.students], ["الحضور", metrics.evaluated], ["الغياب", metrics.absent + metrics.excused + metrics.unexcused], ["ناجح", metrics.passed], ["راسب", metrics.failed], ["النجاح", percent(metrics.success)], ["التحصيل", percent(metrics.achievement)]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{value}</b></div>)}</div>
    <table className="report-table student-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th><th>ملاحظات</th></tr></thead><tbody>{rows.map((row, index) => { const value = pct(row, exam, workspace.settings), band = value === null ? null : bandOf(value, workspace.settings.bands); return <tr key={row.id}><td>{page.rowOffset + index + 1}</td><td>{row.studentName}</td><td>{scoreText(row, exam)}</td><td>{value === null ? "—" : percent(value, 0)}</td><td><span className="report-band" style={{ background: band?.color ?? "#94a3b8" }}>{band?.label ?? statusArabic(row.statuses[exam])}</span></td><td></td></tr>; })}</tbody></table>
    <DistributionRow rows={page.allRows} exam={exam} workspace={workspace}/>
  </>;
}

function ComparisonReport({ page, from, to, workspace }: { page: PageData; from: ExamKey; to: ExamKey; workspace: Workspace }) {
  const fromExam = examOf(workspace.settings, from), toExam = examOf(workspace.settings, to);
  const pairs = page.rows.map((row) => ({ row, a: pct(row, from, workspace.settings), b: pct(row, to, workspace.settings) }));
  const current = summary(page.allRows, to, workspace.settings), added = valueAdded(page.allRows, from, to, workspace.settings);
  return <>
    <div className="report-meta-grid"><b>الصف: {page.className}</b><span>المعلم: {page.teacher || "غير مربوط"}</span><span>{fromExam.name} ← {toExam.name}</span></div>
    <div className="report-kpis compact">{[["الطلاب", current.students], ["حاضر", current.evaluated], ["ناجح", current.passed], ["راسب", current.failed], ["النجاح", percent(current.success)], ["التحصيل", percent(current.achievement)], ["القيمة المضافة", deltaText(added.delta)]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{value}</b></div>)}</div>
    <table className="report-table comparison-table"><thead><tr><th rowSpan={2}>م</th><th rowSpan={2}>اسم الطالب</th><th colSpan={2}>{fromExam.name}</th><th colSpan={2}>{toExam.name}</th><th rowSpan={2}>معدل الإنجاز</th><th rowSpan={2}>المستوى</th><th rowSpan={2}>ملاحظات</th></tr><tr><th>{fromExam.total}</th><th>النسبة</th><th>{toExam.total}</th><th>النسبة</th></tr></thead><tbody>{pairs.map(({ row, a, b }, index) => { const delta = a === null || b === null ? null : b - a; return <tr key={row.id}><td>{page.rowOffset + index + 1}</td><td>{row.studentName}</td><td>{scoreText(row, from)}</td><td>{a === null ? "—" : percent(a, 0)}</td><td>{scoreText(row, to)}</td><td>{b === null ? "—" : percent(b, 0)}</td><td>{delta === null ? "—" : deltaText(delta)}</td><td className={delta === null ? "" : delta > workspace.settings.stable ? "positive" : delta < -workspace.settings.stable ? "negative" : "stable"}>{delta === null ? "—" : delta > workspace.settings.stable ? "+" : delta < -workspace.settings.stable ? "−" : "="}</td><td></td></tr>; })}</tbody></table>
    <div className="report-comparison-summary"><div><b>مؤشرات الإنجاز</b><p><span>تحسن</span>{added.improved}</p><p><span>ثبات</span>{added.stable}</p><p><span>تراجع</span>{added.declined}</p></div><div><b>نسبة النجاح</b><p><span>{fromExam.name}</span>{percent(summary(page.allRows, from, workspace.settings).success)}</p><p><span>{toExam.name}</span>{percent(current.success)}</p></div><div><b>التحصيل الأكاديمي</b><p><span>{fromExam.name}</span>{percent(summary(page.allRows, from, workspace.settings).achievement)}</p><p><span>{toExam.name}</span>{percent(current.achievement)}</p></div></div>
  </>;
}

function StrugglingReport({ page, exam, threshold, workspace }: { page: PageData; exam: ExamKey; threshold: number; workspace: Workspace }) {
  const rows = page.rows.map((row) => ({ row, value: pct(row, exam, workspace.settings) })).filter((item): item is { row: RecordRow; value: number } => item.value !== null && item.value < threshold).sort((a, b) => a.value - b.value);
  return <>
    <div className="report-meta-grid"><b>الصف: {page.className}</b><span>المعلم: {page.teacher || "غير مربوط"}</span><span>{examOf(workspace.settings, exam).name} · أقل من {threshold}%</span></div>
    <table className="report-table student-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الصف</th><th>الدرجة</th><th>النسبة</th><th>ملاحظات وخطة الدعم</th></tr></thead><tbody>{rows.length ? rows.map(({ row, value }, index) => <tr key={row.id}><td>{page.rowOffset + index + 1}</td><td>{row.studentName}</td><td>{row.className}</td><td>{row.scores[exam]}</td><td>{percent(value, 0)}</td><td></td></tr>) : <tr><td colSpan={6}>لا يوجد طلاب ضمن النسبة المحددة.</td></tr>}</tbody></table>
  </>;
}

function TeacherReport({ page, exam, workspace }: { page: PageData; exam: ExamKey; workspace: Workspace }) {
  const metrics = summary(page.allRows, exam, workspace.settings), classes = groups(page.allRows, "className", exam, workspace.settings, EXAMS.indexOf(exam) > 0 ? EXAMS[EXAMS.indexOf(exam) - 1] : null);
  return <>
    <div className="report-meta-grid"><b>اسم المعلم: {page.teacher || page.entity}</b><span>المادة: {page.subject}</span><span>{examOf(workspace.settings, exam).name}</span></div>
    <table className="report-table teacher-table"><thead><tr><th>الصف/الشعبة</th><th>عدد الطلاب</th><th>نسبة النجاح</th><th>نسبة التحصيل</th><th>مؤشر الأداء</th><th>القيمة المضافة</th></tr></thead><tbody>{classes.map((item) => { const band = bandOf(item.metric.achievement, workspace.settings.bands); return <tr key={item.name}><td>{item.name}</td><td>{item.metric.students}</td><td>{percent(item.metric.success)}</td><td>{percent(item.metric.achievement)}</td><td><span className="report-band" style={{ background: band?.color }}>{band?.label}</span></td><td>{item.va ? deltaText(item.va.delta) : "خط أساس"}</td></tr>; })}</tbody><tfoot><tr><td>المتوسط</td><td>{metrics.students}</td><td>{percent(metrics.success)}</td><td>{percent(metrics.achievement)}</td><td>{bandOf(metrics.achievement, workspace.settings.bands)?.label}</td><td>—</td></tr></tfoot></table>
    <h2 className="report-section-title">توزيع مستويات طلاب المعلم</h2><DistributionRow rows={page.allRows} exam={exam} workspace={workspace}/>
  </>;
}

export function ReportCenter({ workspace, onExportExcel }: { workspace: Workspace; onExportExcel: () => void }) {
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [scope, setScope] = useState<Scope>("className");
  const [entity, setEntity] = useState("الكل");
  const [subject, setSubject] = useState("الكل");
  const [exam, setExam] = useState<ExamKey>(workspace.activeExam);
  const [fromExam, setFromExam] = useState<ExamKey>("exam1");
  const [toExam, setToExam] = useState<ExamKey>(workspace.activeExam);
  const [threshold, setThreshold] = useState(workspace.settings.pass);
  const subjectRows = subject === "الكل" ? workspace.rows : workspace.rows.filter((row) => row.subject === subject);
  const entityValues = values(subjectRows, scope);
  const pages = useMemo(() => makePages(workspace.rows, scope, entity, subject, reportType, exam, threshold, workspace.settings), [workspace.rows, workspace.settings, scope, entity, subject, reportType, exam, threshold]);
  const comparison = reportType === "comparison";

  return <div className="space-y-6">
    <div className="report-screen-only space-y-6">
      <Heading kicker="مركز التقارير والطباعة" title="مخرجات جاهزة لكل اختبار أو مقارنة" desc="اختر شكل التقرير، ثم المعلم أو الصف، والاختبار أو الاختبارين. خيار «الكل» ينشئ صفحة A4 مستقلة لكل معلم أو صف." action={<><Button variant="outline" onClick={onExportExcel}><FileDown/>Excel شامل</Button><Button onClick={() => window.print()} className="bg-[#8f3f12]"><Printer/>طباعة / حفظ PDF</Button></>}/>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{reportOptions.map((option) => <button key={option.id} onClick={() => { setReportType(option.id); if (option.id === "teachers") setScope("teacher"); }} className={`rounded-2xl border p-4 text-right transition ${reportType === option.id ? "border-[#8f3f12] bg-[#fff7ed] shadow-[0_10px_30px_rgba(143,63,18,.12)]" : "bg-white hover:border-slate-300"}`}><option.icon className={`size-6 ${reportType === option.id ? "text-[#8f3f12]" : "text-slate-500"}`}/><b className="mt-3 block">{workspace.settings.reportDesign.reportNames[option.id]}</b><small className="mt-1 block leading-5 text-slate-500">{option.text}</small></button>)}</div>
      <Panel title="إعداد التقرير" desc="تتغير المعاينة فورًا، ولا تؤثر هذه الاختيارات في بيانات النتائج."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><div><Label>المخرج حسب</Label><Picker className="mt-2 w-full" value={scope} onChange={(value) => { setScope(value as Scope); setEntity("الكل"); }} items={reportType === "teachers" ? [{ value: "teacher", label: "معلم" }] : [{ value: "className", label: "صف / شعبة" }, { value: "teacher", label: "معلم" }]}/></div><div><Label>{scope === "teacher" ? "المعلم" : "الصف / الشعبة"}</Label><Picker className="mt-2 w-full" value={entityValues.includes(entity) ? entity : "الكل"} onChange={setEntity} items={[{ value: "الكل", label: scope === "teacher" ? "كل المعلمين — صفحة لكل معلم" : "كل الصفوف — صفحة لكل صف" }, ...entityValues.map((value) => ({ value, label: value }))]}/></div><div><Label>المادة</Label><Picker className="mt-2 w-full" value={subject} onChange={(value) => { setSubject(value); setEntity("الكل"); }} items={[{ value: "الكل", label: "كل المواد" }, ...values(workspace.rows, "subject").map((value) => ({ value, label: value }))]}/></div>{comparison ? <><div><Label>الاختبار الأول</Label><Picker className="mt-2 w-full" value={fromExam} onChange={(value) => setFromExam(value as ExamKey)} items={workspace.settings.exams.map((item) => ({ value: item.key, label: item.name }))}/></div><div><Label>الاختبار الثاني</Label><Picker className="mt-2 w-full" value={toExam} onChange={(value) => setToExam(value as ExamKey)} items={workspace.settings.exams.map((item) => ({ value: item.key, label: item.name }))}/></div></> : <div><Label>الاختبار</Label><Picker className="mt-2 w-full" value={exam} onChange={(value) => setExam(value as ExamKey)} items={workspace.settings.exams.map((item) => ({ value: item.key, label: `${item.name} — من ${item.total}` }))}/></div>}{reportType === "struggling" && <div><Label>أقل من (%)</Label><Input className="mt-2" type="number" min="0" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))}/></div>}</div><div className="mt-4 flex flex-wrap items-center gap-2"><Badge className="bg-slate-100 text-slate-700">{pages.length.toLocaleString("ar-EG")} صفحة جاهزة</Badge>{comparison && fromExam === toExam && <Badge className="bg-rose-50 text-rose-700">اختر اختبارين مختلفين</Badge>}<Button onClick={() => window.print()} disabled={!pages.length || (comparison && fromExam === toExam)} className="mr-auto bg-[#123247]"><Printer/>طباعة التقرير الحالي</Button></div></Panel>
    </div>

    <div className="report-preview-shell"><div id="printable-reports" className="print-zone">{pages.length ? pages.map((page, index) => { const assessment = comparison ? `${examOf(workspace.settings, fromExam).name} × ${examOf(workspace.settings, toExam).name}` : examOf(workspace.settings, exam).name; const part = page.totalParts > 1 ? ` — الجزء ${page.part} من ${page.totalParts}` : ""; return <section className="school-report-page" style={reportStyle(workspace)} key={page.key}><ReportHeader workspace={workspace} title={`${workspace.settings.reportDesign.reportNames[reportType]}: ${assessment}${part}`} subject={page.subject} assessment={assessment}/>{reportType === "summary" && <SummaryReport page={page} exam={exam} workspace={workspace}/>} {reportType === "levels" && <LevelsReport page={page} exam={exam} workspace={workspace}/>} {reportType === "struggling" && <StrugglingReport page={page} exam={exam} threshold={threshold} workspace={workspace}/>} {reportType === "teachers" && <TeacherReport page={{ ...page, teacher: page.teacher || page.entity }} exam={exam} workspace={workspace}/>} {reportType === "comparison" && <ComparisonReport page={page} from={fromExam} to={toExam} workspace={workspace}/>}<ReportFooter workspace={workspace} teacher={page.teacher} subject={page.subject}/><span className="report-page-number">صفحة {index + 1} من {pages.length}</span></section>; }) : <div className="rounded-2xl border bg-white p-12 text-center"><School className="mx-auto size-10 text-slate-300"/><b className="mt-4 block">لا توجد بيانات تطابق الاختيارات</b></div>}</div></div>
  </div>;
}
