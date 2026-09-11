import fs from "node:fs";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { demoRows } from "../lib/demo-data.ts";
import { canonicalClass, defaultSettings, migrateWorkspace, pct, summary, validateBands, valueAdded, type RecordRow } from "../lib/results-engine.ts";
import { buildMappingResolutions, materializeResultRows, parseResultWorkbook, parseTeacherWorkbook, parseWorkbook } from "../lib/importer.ts";

const settings = { ...defaultSettings, exams: defaultSettings.exams.map((e) => ({ ...e })), bands: defaultSettings.bands.map((b) => ({ ...b })) };
const base: RecordRow = { id:"1", studentId:"1", studentName:"طالب", grade:"السابع", className:"أ", department:"رياضيات", subject:"رياضيات", teacher:"معلم", scores:{ exam1:10, exam2:15, exam3:null, exam4:null }, statuses:{ exam1:"present", exam2:"present", exam3:"excused", exam4:"not_enrolled" } };
assert.equal(pct(base,"exam1",settings),50,"النسبة في اختبار من 20");
assert.equal(pct(base,"exam2",settings),50,"النسبة في اختبار من 30");
assert.equal(summary([base],"exam1",settings).passed,1,"حد النجاح شامل 50");
assert.equal(summary([{...base,scores:{...base.scores,exam1:9.5}}],"exam1",settings).failed,1,"أقل من 50 راسب");
assert.equal(valueAdded([base],"exam1","exam2",settings).delta,0,"اختلاف الإجماليات لا يخلق قيمة مضافة وهمية");
assert.equal(summary([base],"exam3",settings).evaluated,0,"الغائب مستبعد من التحصيل");
assert.equal(validateBands(settings.bands).length,0,"المستويات الافتراضية متصلة");
const badBands=settings.bands.map((b)=>({...b}));badBands[1].min=79;assert.ok(validateBands(badBands).length>0,"كشف التداخل");
assert.equal(demoRows().length,810,"حجم البيانات التجريبية");
const bytes=fs.readFileSync("public/نموذج-استيراد-نتائج-المدرسة.xlsx");
const parsed=parseWorkbook(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,"template.xlsx",settings);
assert.equal(parsed.rows.length,3,"قراءة صفوف النموذج");
assert.equal(parsed.issues.filter((i)=>i.severity==="error").length,0,"النموذج بلا أخطاء مانعة");

const teacherBook=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(teacherBook,XLSX.utils.aoa_to_sheet([
  ["م","اسم المعلم","المادة","القسم","الصفوف التي يقوم بتدريسها","صف إضافي"],
  [1,"معلم نموذجي","التربية الإسلامية","المواد الشرعية","سابع 1","07/2"],
]),"المعلمون");
const teacherBytes=XLSX.write(teacherBook,{type:"array",bookType:"xlsx"}) as ArrayBuffer;
const teachers=parseTeacherWorkbook(teacherBytes,"teachers.xlsx");
assert.equal(teachers.profiles.length,1,"قراءة سجل المعلم");
assert.equal(teachers.assignments.length,2,"قراءة الصفوف الأفقية للمعلم");
assert.equal(canonicalClass("سابع 1"),"7/1","توحيد اسم الصف العربي");
assert.equal(canonicalClass("07/1"),"7/1","إزالة الصفر البادئ من اسم الصف");
assert.equal(canonicalClass("الثامن ب"),"8/2","تحويل حرف الشعبة إلى رقم");
assert.equal(migrateWorkspace({ rows: [{ ...base, className: "07/1" }] }).rows[0].className,"7/1","ترحيل البيانات القديمة إلى التنسيق الجديد");

const resultBook=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(resultBook,XLSX.utils.aoa_to_sheet([
  ["مدرسة الاختبار"],
  ["المادة:التربية الاسلامية - الفترة:منتصف الفصل الأول"],
  ["الرقم","الاسم","الشعبة الصفية","التقييم الرئيسي","منتصف الفصل الأول"],
  [101,"طالب أول","07/1",10,15],
  [102,"طالب ثان","سابع 2",8,"غائب"],
  [1,1,1],
]),"التربية الاسلامية");
const resultBytes=XLSX.write(resultBook,{type:"array",bookType:"xlsx"}) as ArrayBuffer;
const resultImport=parseResultWorkbook(resultBytes,"results.xlsx");
assert.equal(resultImport.sheets.length,1,"اكتشاف ورقة النتيجة");
assert.equal(resultImport.sheets[0].rows.length,2,"تجاهل الصف الوهمي وقراءة الطلاب");
assert.equal(resultImport.sheets[0].scoreColumns.length,2,"اكتشاف أعمدة الدرجات والحالات");
const pending=materializeResultRows([resultImport]);
assert.equal(pending.length,2,"تحويل بيانات النتيجة للمرحلة المؤقتة");
assert.equal(pending[1].status,"absent","قراءة حالة الغياب");
const mapping=buildMappingResolutions(pending,teachers.profiles,teachers.assignments);
assert.equal(mapping.filter((item)=>item.status==="matched").length,2,"الربط التلقائي بالمادة والشعبة بعد التطبيع");

console.log(JSON.stringify({passed:20,demoRows:demoRows().length,templateRows:parsed.rows.length,teacherAssignments:teachers.assignments.length,resultRows:pending.length}));
