# SPMS — نظام الصيانة الوقائية الذكي (Smart Preventive Maintenance System)

نظام إدارة صيانة (CMMS) عربي RTL لإدارة الأصول والمركبات، الصيانة الوقائية بتسلسل A/B/C/D،
أوامر العمل، والمسح الميداني عبر الباركود. مبني على React 19 + TypeScript + Vite + Firebase + Tailwind + shadcn/ui.

**نشر حيّ:** https://spms-3d73a.web.app

---

## التقنيات

- **الواجهة:** React 19, TypeScript, Vite (rolldown), React Router 6
- **التصميم:** Tailwind CSS v4, shadcn/ui, خط Tajawal, RTL، نظام ألوان مركزي (`src/lib/spms-colors.ts`)
- **الخلفية:** Firebase (Auth, Firestore) — لا backend مخصّص
- **الخريطة:** Leaflet + OpenStreetMap (بلا مفتاح API)، إحداثيات المدن في `src/lib/saudi-locations.ts`
- **المسح:** html5-qrcode (كاميرا) + إدخال يدوي
- **Excel:** SheetJS (`xlsx`) لاستيراد الأصول بربط الأعمدة
- **الذكاء الاصطناعي:** Gemini API (اقتراح مهام القوالب) — المفتاح يُدخل وقت التشغيل، لا يُخزّن

## التشغيل محلياً

```bash
npm install
cp .env.example .env.local   # املأ قيم VITE_FIREBASE_*
npm run dev                  # http://localhost:5173
npm run build                # tsc -b && vite build
npm run firebase:deploy:hosting
```

`.env.local` و`.env.gemini` مستثناة من Git (أسرار). انسخ `.env.example` واملأها بإعدادات مشروع Firebase.

## المفاهيم الجوهرية (مهمة لإكمال العمل)

### محرك تسلسل الصيانة A/B/C/D
- `src/lib/maintenance-sequence.ts` — `getNextCode(template, lastCode, currentReading, lastReading)` نقي وقابل للاختبار.
- **القالب** (`MaintenanceSequenceTemplate` في `src/models/firestore.ts`): لكل نوع معدة، يحوي:
  - `sequence` — تسلسل دوري بأي أكواد A–Z (مثل `["D","C","D","B","D","C","D","A"]`)
  - `stepInterval` + `triggerMode` (ساعات/كم/زمن)
  - `levels[]` — كل مستوى: `nameAr` + `tasks[]` (وصف EN/AR، itemCode، qty، action، partNo)
- **الأصل يملك**: `maintenanceTemplateId` + `lastServiceCode` + `lastServiceReading` → يحسب «الخدمة القادمة».
- **توليد أمر العمل**: يرث مهام المستوى المستحق (`src/services/firestore/pm-work-order-service.ts`).
- **الإغلاق يقدّم التناوب**: `work-order-lifecycle-service.ts` يحدّث موضع الأصل عند إغلاق أمر الصيانة.

### الأدوار والصلاحيات
`admin | manager | technician | requester` — مُنفَّذة في `src/services/firestore/permissions.ts` وفي `firestore.rules`
(قائمة على دور المستخدم في مستند `users/{uid}`، بلا أي تجاوز).

### التدفّق الميداني
`/scan/:assetId` (يفتحه QR الأصل) → الخدمة القادمة + آخر صيانة + تسجيل قراءة + طلب تنفيذ/استثناء.
الفنّي يهبط على `/dashboard/scan` (ماسح كاميرا + بحث برقم الأصل/اللوحة).

## بنية المجلدات

```
src/
  components/       مكوّنات الواجهة (assets, work-orders, dashboard, maintenance, ui)
  pages/spms/       صفحات النظام (assets, work-orders, maintenance, scan, dashboard, ...)
  lib/              المنطق النقي (محرك التسلسل، الألوان، المواقع، التطبيع، gemini-client)
  models/firestore.ts   كل أنواع البيانات
  services/firestore/   طبقة Firestore (crud, spms-service, محركات PM/التنفيذ/دورة الحياة)
  i18n/             تعدّد لغوي عربي/إنجليزي (الواجهة + شاشات الفنّي مترجمة)
firestore.rules     قواعد الأمان القائمة على الأدوار
```

## ما تبقّى (نقاط لإكمال العمل)

- **i18n**: التنقّل + الدخول + شاشات الفنّي مترجمة؛ بقية صفحات الإدارة عربية — تُكمَّل بإضافة مفاتيح في `src/i18n/i18n.tsx` وتمرير `t()`.
- **Firebase Storage**: غير مُفعّل بعد (صور الأصول/اللوجو الكبيرة) — يُفعَّل من Console + نشر `storage.rules`.
- **خصم المخزون / عرض التكلفة**: مُستبعدان عمداً حسب متطلّبات العميل.
- وثائق معمارية تفصيلية في ملفات `*.md` بالجذر (PM_ENGINE_ARCHITECTURE، WORK_ORDER_LIFECYCLE، إلخ).

## ملاحظات أمان قبل الإطلاق

- غيّر كلمات مرور الحسابات التجريبية.
- راجع `firestore.rules` (قائمة على الأدوار، بلا تجاوزات).
