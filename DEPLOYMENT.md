# نشر منصة تحليل نتائج المدرسة

## GitHub

1. أنشئ مستودعًا جديدًا فارغًا في GitHub.
2. فك ضغط الحزمة وافتح الطرفية داخل المجلد.
3. نفّذ الأوامر التالية بعد استبدال رابط المستودع:

```bash
git init
git add .
git commit -m "Initial school results analytics release"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

## Vercel

1. افتح Vercel واختر **Add New → Project**.
2. استورد مستودع GitHub السابق.
3. اترك Framework على **Next.js**؛ يقرأ Vercel إعدادات `vercel.json` تلقائيًا.
4. اضغط **Deploy**. لا توجد متغيرات بيئة مطلوبة للنسخة الأساسية.

### طريقة الحفظ على Vercel

تعمل النسخة الأساسية فورًا وتحفظ البيانات في المتصفح نفسه (`localStorage`). لذلك:

- البيانات تبقى عند إعادة فتح الموقع من الجهاز والمتصفح نفسيهما.
- استخدم **النسخ والأرشيف → تنزيل JSON** بانتظام، ويمكن استعادته على جهاز آخر.
- التخزين المشترك بين عدة أجهزة أو مستخدمين يحتاج إضافة قاعدة بيانات سحابية لاحقًا (مثل Vercel Postgres أو Neon أو Supabase).

## تشغيل محلي سريع

يتطلب Node.js 22.13 أو أحدث وpnpm:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

ثم افتح العنوان الذي يظهر في الطرفية.

## اختبار نسخة Vercel قبل الدفع

```bash
pnpm run build:vercel
```

إذا اكتمل الأمر بلا أخطاء فالحزمة جاهزة للبناء على Vercel.
