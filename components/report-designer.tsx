/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { ImagePlus, RefreshCcw, Save, Stamp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Panel } from "@/components/results-ui";
import { defaultReportDesign, type ReportDesign, type ReportNameKey, type Settings, type Workspace } from "@/lib/results-engine";

type Props = { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>> };

const reportKeys: { key: ReportNameKey; label: string }[] = [
  { key: "summary", label: "تقرير الملخص" }, { key: "levels", label: "تقرير المستويات" }, { key: "struggling", label: "تقرير الطلاب المستهدفين" },
  { key: "teachers", label: "تقرير متوسطات المعلمين" }, { key: "comparison", label: "تقرير المقارنة" },
];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border bg-slate-50 p-3"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange}/></div>;
}

export function ReportDesigner({ workspace, setWorkspace }: Props) {
  const logoRef = useRef<HTMLInputElement>(null), stampRef = useRef<HTMLInputElement>(null);
  const design = workspace.settings.reportDesign;
  const updateDesign = (patch: Partial<ReportDesign>) => setWorkspace((current) => ({ ...current, settings: { ...current.settings, reportDesign: { ...current.settings.reportDesign, ...patch } } }));
  const updateSettings = (patch: Partial<Settings>) => setWorkspace((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  const imageFile = (kind: "logoDataUrl" | "stampDataUrl", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 750_000) { toast.error("اختر صورة لا تتجاوز 750 كيلوبايت"); return; }
    const reader = new FileReader(); reader.onload = () => updateDesign({ [kind]: String(reader.result) }); reader.readAsDataURL(file);
  };
  return <div className="space-y-6">
    <Heading kicker="هوية موحدة لكل المخرجات" title="مصمم التقارير" desc="أي تعديل هنا يُطبَّق على التقارير الأساسية والمخصصة: الترويسة، العناوين، الألوان، التوقيعات، الشعار والتذييل." action={<Button variant="outline" onClick={() => { updateDesign({ ...defaultReportDesign, reportNames: { ...defaultReportDesign.reportNames }, signatureLabels: { ...defaultReportDesign.signatureLabels } }); toast.success("تمت استعادة التصميم الافتراضي"); }}><RefreshCcw/>استعادة الافتراضي</Button>}/>
    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <div className="space-y-5">
        <Panel title="الترويسة والهوية" desc="يمكنك تغيير كل عبارة تظهر أعلى التقرير.">
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>السطر الرئيسي</Label><Input className="mt-2" value={design.ministryHeader} onChange={(e) => updateDesign({ ministryHeader: e.target.value })}/></div><div><Label>السطر التعريفي</Label><Input className="mt-2" value={design.systemHeader} onChange={(e) => updateDesign({ systemHeader: e.target.value })}/></div><div><Label>مسمى المدرسة</Label><Input className="mt-2" value={design.schoolLabel} onChange={(e) => updateDesign({ schoolLabel: e.target.value })}/></div><div><Label>مسمى العام</Label><Input className="mt-2" value={design.yearLabel} onChange={(e) => updateDesign({ yearLabel: e.target.value })}/></div><div><Label>مسمى التقييم</Label><Input className="mt-2" value={design.assessmentLabel} onChange={(e) => updateDesign({ assessmentLabel: e.target.value })}/></div><div><Label>مسمى المادة</Label><Input className="mt-2" value={design.subjectLabel} onChange={(e) => updateDesign({ subjectLabel: e.target.value })}/></div></div>
        </Panel>
        <Panel title="أسماء التقارير" desc="تظهر الأسماء الجديدة في شاشة الاختيار وعلى النسخ المطبوعة."><div className="grid gap-4 sm:grid-cols-2">{reportKeys.map((item) => <div key={item.key}><Label>{item.label}</Label><Input className="mt-2" value={design.reportNames[item.key]} onChange={(e) => updateDesign({ reportNames: { ...design.reportNames, [item.key]: e.target.value } })}/></div>)}</div></Panel>
        <Panel title="مسميات التوقيعات"><div className="grid gap-4 sm:grid-cols-2"><div><Label>المعلم</Label><Input className="mt-2" value={design.signatureLabels.teacher} onChange={(e) => updateDesign({ signatureLabels: { ...design.signatureLabels, teacher: e.target.value } })}/></div><div><Label>المنسق</Label><Input className="mt-2" value={design.signatureLabels.coordinator} onChange={(e) => updateDesign({ signatureLabels: { ...design.signatureLabels, coordinator: e.target.value } })}/></div><div><Label>النائب الأكاديمي</Label><Input className="mt-2" value={design.signatureLabels.vice} onChange={(e) => updateDesign({ signatureLabels: { ...design.signatureLabels, vice: e.target.value } })}/></div><div><Label>مدير المدرسة</Label><Input className="mt-2" value={design.signatureLabels.principal} onChange={(e) => updateDesign({ signatureLabels: { ...design.signatureLabels, principal: e.target.value } })}/></div></div></Panel>
      </div>
      <div className="space-y-5">
        <Panel title="الشعار والختم" desc="تُحفظ الصور داخل إعدادات المنصة وتظهر في التقارير."><input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => imageFile("logoDataUrl", e.target.files?.[0])}/><input ref={stampRef} type="file" accept="image/*" className="hidden" onChange={(e) => imageFile("stampDataUrl", e.target.files?.[0])}/><div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={() => logoRef.current?.click()}><ImagePlus/>اختيار الشعار</Button><Button variant="outline" onClick={() => stampRef.current?.click()}><Stamp/>اختيار الختم</Button></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="grid min-h-28 place-items-center rounded-xl border bg-slate-50">{design.logoDataUrl ? <img src={design.logoDataUrl} alt="الشعار" className="max-h-24 max-w-full object-contain"/> : <span className="text-3xl font-black" style={{ color: design.primaryColor }}>{design.logoLetter}</span>}</div><div className="grid min-h-28 place-items-center rounded-xl border bg-slate-50">{design.stampDataUrl ? <img src={design.stampDataUrl} alt="الختم" className="max-h-24 max-w-full object-contain"/> : <small className="text-slate-400">لا يوجد ختم</small>}</div></div><div className="mt-4"><Label>الحرف البديل عند عدم رفع شعار</Label><Input className="mt-2" value={design.logoLetter} onChange={(e) => updateDesign({ logoLetter: e.target.value.slice(0, 3) })}/></div></Panel>
        <Panel title="الألوان والعناصر الظاهرة"><div className="grid grid-cols-3 gap-3">{[["الأساسي","primaryColor"],["الثانوي","secondaryColor"],["التمييز","accentColor"]].map(([label,key]) => <label key={key} className="rounded-xl border bg-slate-50 p-3 text-sm"><span className="mb-2 block">{label}</span><input type="color" value={design[key as "primaryColor"]} onChange={(e) => updateDesign({ [key]: e.target.value })} className="h-10 w-full"/></label>)}</div><div className="mt-4 grid gap-3"><Toggle label="إظهار الشعار" checked={design.showLogo} onChange={(value) => updateDesign({ showLogo: value })}/><Toggle label="إظهار الختم" checked={design.showStamp} onChange={(value) => updateDesign({ showStamp: value })}/><Toggle label="إظهار التوقيعات" checked={design.showSignatures} onChange={(value) => updateDesign({ showSignatures: value })}/><Toggle label="إظهار رؤية المدرسة" checked={design.showVision} onChange={(value) => updateDesign({ showVision: value })}/><Toggle label="إظهار بيانات الإعداد والطباعة" checked={design.showAttribution} onChange={(value) => updateDesign({ showAttribution: value })}/></div></Panel>
        <Panel title="التذييل"><Label>عبارة تذييل إضافية</Label><Textarea className="mt-2" value={design.footerText} onChange={(e) => updateDesign({ footerText: e.target.value })} placeholder="حقوق الاستخدام أو ملاحظة إدارية"/><Toggle label="إظهار تاريخ ووقت الإصدار" checked={workspace.settings.showGeneratedAt} onChange={(value) => updateSettings({ showGeneratedAt: value })}/></Panel>
      </div>
    </div>
    <Panel title="معاينة فورية"><div className="designer-report-preview" style={{ "--report-primary": design.primaryColor, "--report-secondary": design.secondaryColor, "--report-accent": design.accentColor } as React.CSSProperties}><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3">{design.showLogo && (design.logoDataUrl ? <img src={design.logoDataUrl} alt="" className="size-14 object-contain"/> : <span className="grid size-14 place-items-center rounded-full border-4 font-black" style={{ borderColor: design.primaryColor, color: design.primaryColor }}>{design.logoLetter}</span>)}<div><b>{design.ministryHeader}</b><small className="block text-slate-500">{design.systemHeader}</small></div></div><div className="text-left text-sm"><p>{design.schoolLabel}: <b>{workspace.settings.schoolName}</b></p><p>{design.yearLabel}: <b>{workspace.settings.academicYear}</b></p></div></div><h3 style={{ background: `linear-gradient(90deg, ${design.secondaryColor}, ${design.primaryColor})` }}>عنوان التقرير المحدد</h3><div className="grid grid-cols-2 gap-3 text-sm"><p>{design.assessmentLabel}: الاختبار</p><p>{design.subjectLabel}: المادة</p></div><div className="mt-5 grid grid-cols-4 gap-2">{["الطلاب","الناجحون","نسبة النجاح","التحصيل"].map((label) => <div key={label}><small>{label}</small><b>—</b></div>)}</div><div className="mt-8 border-t pt-3 text-center text-xs text-slate-500">{design.footerText || "معاينة التذييل"}</div></div></Panel>
    <div className="flex justify-end"><Button className="bg-teal-700" onClick={() => toast.success("تُحفظ التعديلات تلقائيًا وتُطبق على كل التقارير")}><Save/>اعتماد التصميم الحالي</Button></div>
  </div>;
}
