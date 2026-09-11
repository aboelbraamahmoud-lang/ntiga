import { assignmentsFromRows, canonicalClass, defaultSettings, EXAMS, type ExamKey, type RecordRow, type Status, type Workspace } from "./results-engine.ts";
const grades=["السابع","الثامن","التاسع"], sections=["أ","ب","ج"];
const subjects=[
  ["اللغة العربية","اللغة العربية",["أ. سامر الهادي","أ. مريم خالد","أ. رانيا عادل"]],
  ["الرياضيات","الرياضيات",["أ. عمر ناصر","أ. هدى طارق","أ. لينا ماهر"]],
  ["العلوم","العلوم",["أ. مازن أمين","أ. ندى حسن","أ. ياسر فؤاد"]],
  ["اللغة الإنجليزية","اللغة الإنجليزية",["أ. ليلى حمد","أ. كريم وائل","أ. هالة نبيل"]],
  ["الدراسات الاجتماعية","الدراسات الاجتماعية",["أ. منى شريف","أ. حسام زكي","أ. داليا سعد"]],
] as const;
function h(t:string){let x=2166136261;for(let i=0;i<t.length;i++){x^=t.charCodeAt(i);x=Math.imul(x,16777619)}return Math.abs(x>>>0)}
const clamp=(v:number)=>Math.max(20,Math.min(100,v));
function stat(seed:string,exam:ExamKey):Status{const n=h(seed+exam)%100;return n<3?"excused":n===3?"unexcused":n===4&&exam!=="exam1"?"deprived":"present"}
export function demoRows(){const out:RecordRow[]=[];let serial=1;grades.forEach((grade,gi)=>sections.forEach((sec,ci)=>{const students=Array.from({length:18},(_,i)=>({id:`ST-${String(serial+i).padStart(4,"0")}`,name:`طالب تجريبي ${String(serial+i).padStart(3,"0")}`}));serial+=18;subjects.forEach(([subject,department,teachers],si)=>students.forEach((student)=>{const seed=student.id+subject, p1=clamp(43+h(seed)%50), p2=clamp(p1+(h(seed+"2")%16-5)), p3=clamp(p2+(h(seed+"3")%13-4)), p4=clamp(p3+(h(seed+"4")%12-3));const ps={exam1:p1,exam2:p2,exam3:p3,exam4:p4};const statuses=Object.fromEntries(EXAMS.map(e=>[e,stat(seed,e)])) as Record<ExamKey,Status>;const scores=Object.fromEntries(EXAMS.map((e,i)=>[e,statuses[e]==="present"?Math.round(ps[e]*defaultSettings.exams[i].total/50)/2:null])) as Record<ExamKey,number|null>;out.push({id:`${student.id}-${si}`,studentId:student.id,studentName:student.name,grade,className:canonicalClass(`${grade} ${sec}`),department,subject,teacher:teachers[(gi+ci+si)%3],scores,statuses});}));}));return out}
export function demoWorkspace():Workspace{const rows=demoRows(),directory=assignmentsFromRows(rows);return{version:3,settings:{...defaultSettings,exams:defaultSettings.exams.map(e=>({...e})),bands:defaultSettings.bands.map(b=>({...b})),reportDesign:{...defaultSettings.reportDesign,reportNames:{...defaultSettings.reportDesign.reportNames},signatureLabels:{...defaultSettings.reportDesign.signatureLabels}},importAliases:{...defaultSettings.importAliases},statusAliases:{...defaultSettings.statusAliases}},rows,...directory,activeExam:"exam4",imports:[{id:"demo",name:"بيانات-تجريبية.xlsx",at:"2026-09-10T08:00:00.000Z",rows:810,warnings:0,kind:"results",exam:"exam4"}],customReports:[]}}
