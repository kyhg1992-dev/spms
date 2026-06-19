import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { makeLabels } from "@/lib/labels"

export type Lang = "ar" | "en"

const STORAGE_KEY = "spms.lang"

/** Translation dictionary. Add keys as modules are localized. */
const DICT: Record<string, { ar: string; en: string }> = {
  // App shell / nav
  "app.title": { ar: "صيانة وقائية ذكية SPMS", en: "SPMS Smart Maintenance" },
  "nav.dashboard": { ar: "نظرة قيادية", en: "Dashboard" },
  "nav.scan": { ar: "مسح", en: "Scan" },
  "nav.assets": { ar: "الأصول", en: "Assets" },
  "nav.workOrders": { ar: "أوامر العمل", en: "Work Orders" },
  "nav.maintenanceLog": { ar: "سجل الصيانة", en: "Maintenance Log" },
  "nav.pm": { ar: "صيانة وقائية", en: "Preventive" },
  "nav.templates": { ar: "قوالب الصيانة", en: "Templates" },
  "nav.notifications": { ar: "الإشعارات", en: "Notifications" },
  "nav.reports": { ar: "تقارير", en: "Reports" },
  "nav.activity": { ar: "النشاطات", en: "Activity" },
  "nav.settings": { ar: "الإعدادات", en: "Settings" },
  "nav.users": { ar: "المستخدمون", en: "Users" },
  "header.search": { ar: "بحث ومِرشد تنقل…", en: "Search & navigate…" },
  "header.profile": { ar: "الملف الشخصي", en: "Profile" },
  "header.logout": { ar: "تسجيل الخروج", en: "Sign out" },
  "header.menu": { ar: "القائمة", en: "Menu" },
  "common.language": { ar: "اللغة", en: "Language" },
  "common.search": { ar: "بحث", en: "Search" },
  "common.fullDetails": { ar: "التفاصيل الكاملة", en: "Full details" },
  // Scan / technician
  "scan.title": { ar: "مسح الأصل", en: "Scan asset" },
  "scan.subtitle": { ar: "امسح باركود/QR الأصل أو أدخل رقمه لعرض حالة الصيانة.", en: "Scan the asset barcode/QR or enter its number to view maintenance status." },
  "scan.scanner": { ar: "الماسح الضوئي", en: "Scanner" },
  "scan.aim": { ar: "وجّه الكاميرا إلى رمز QR على الأصل.", en: "Point the camera at the asset QR code." },
  "scan.startCam": { ar: "تشغيل الكاميرا والمسح", en: "Start camera & scan" },
  "scan.stopCam": { ar: "إيقاف الكاميرا", en: "Stop camera" },
  "scan.manualUsb": { ar: "إدخال يدوي / ماسح USB", en: "Manual / USB scanner" },
  "scan.codeOrPlate": { ar: "رقم الأصل أو رقم اللوحة", en: "Asset no. or plate" },
  "scan.notFound": { ar: "لم يُعثر على أصل بهذا الرقم أو اللوحة", en: "No asset found for this number or plate" },
  "scan.maintStatus": { ar: "حالة الصيانة", en: "Maintenance status" },
  "scan.nextService": { ar: "الخدمة القادمة", en: "Next service" },
  "scan.lastService": { ar: "آخر صيانة تمّت", en: "Last service" },
  "scan.dueNow": { ar: "مستحقة الآن", en: "Due now" },
  "scan.after": { ar: "بعد", en: "in" },
  "scan.noTemplate": { ar: "لا قالب صيانة مرتبط بهذا الأصل بعد.", en: "No maintenance template assigned to this asset yet." },
  "scan.recordReading": { ar: "تسجيل قراءة العدّاد", en: "Record meter reading" },
  "scan.currentReading": { ar: "القراءة الحالية للأصل", en: "Current asset reading" },
  "scan.type": { ar: "النوع", en: "Type" },
  "scan.hours": { ar: "ساعات", en: "Hours" },
  "scan.km": { ar: "كيلومتر", en: "Km" },
  "scan.reading": { ar: "القراءة", en: "Reading" },
  "scan.record": { ar: "تسجيل", en: "Record" },
  "scan.invalidReading": { ar: "أدخل قراءة صحيحة", en: "Enter a valid reading" },
  "scan.readingSaved": { ar: "تم تسجيل القراءة", en: "Reading recorded" },
  "scan.generateWO": { ar: "توليد أمر عمل", en: "Generate work order" },
  "scan.requestExec": { ar: "طلب تنفيذ صيانة", en: "Request maintenance" },
  "scan.requestException": { ar: "طلب استثناء (غير مستحقة)", en: "Request exception (not due)" },
  "scan.requestSentExec": { ar: "أُرسل طلب التنفيذ للمشرف", en: "Maintenance request sent to supervisor" },
  "scan.requestSentExc": { ar: "أُرسل طلب الاستثناء للمشرف", en: "Exception request sent to supervisor" },
  // Login
  "login.welcome": { ar: "مرحباً بك", en: "Welcome back" },
  "login.subtitle": { ar: "سجّل الدخول للمتابعة إلى لوحة التحكم", en: "Sign in to continue to your dashboard" },
  "login.email": { ar: "البريد الإلكتروني", en: "Email" },
  "login.password": { ar: "كلمة المرور", en: "Password" },
  "login.submit": { ar: "تسجيل الدخول", en: "Sign in" },
  "login.submitting": { ar: "جاري الدخول...", en: "Signing in..." },
  "login.error": { ar: "فشل تسجيل الدخول. تحقق من البريد وكلمة المرور.", en: "Sign-in failed. Check your email and password." },
  "login.quick": { ar: "دخول سريع (تجريبي)", en: "Quick sign-in (demo)" },
  "login.heroTitle": { ar: "إدارة صيانة احترافية بين يديك", en: "Professional maintenance management in your hands" },
  "login.heroSub": { ar: "تتبّع الأصول، وأتمتة الصيانة الوقائية، وإدارة المخزون — في منصّة عربية واحدة.", en: "Track assets, automate preventive maintenance, and manage inventory — in one platform." },
  // Common
  "common.create": { ar: "إنشاء", en: "Create" },
  "common.cancel": { ar: "إلغاء", en: "Cancel" },
  "common.delete": { ar: "حذف", en: "Delete" },
  "common.edit": { ar: "تعديل", en: "Edit" },
  "common.details": { ar: "تفاصيل", en: "Details" },
  "common.save": { ar: "حفظ", en: "Save" },
  "common.loading": { ar: "جارٍ التحميل…", en: "Loading…" },
  "common.deleting": { ar: "يحذف…", en: "Deleting…" },
  "common.prev": { ar: "السابق", en: "Previous" },
  "common.next": { ar: "التالي", en: "Next" },
  "common.actions": { ar: "إجراءات", en: "Actions" },
  "common.allStatuses": { ar: "كل الحالات", en: "All statuses" },
  "common.allCategories": { ar: "كل الفئات", en: "All categories" },
  "common.clearFilters": { ar: "مسح المرشّحات", en: "Clear filters" },
  "common.syncing": { ar: "مزامنة…", en: "Syncing…" },
  // Table columns
  "col.image": { ar: "صورة", en: "Image" },
  "col.code": { ar: "الرمز", en: "Code" },
  "col.name": { ar: "الاسم", en: "Name" },
  "col.category": { ar: "الفئة", en: "Category" },
  "col.location": { ar: "الموقع", en: "Location" },
  "col.status": { ar: "الحالة", en: "Status" },
  "col.nextService": { ar: "الخدمة القادمة", en: "Next service" },
  "col.lastUpdate": { ar: "آخر تحديث", en: "Last update" },
  // Assets page
  "assets.title": { ar: "إدارة الأصول", en: "Asset management" },
  "assets.subtitle": { ar: "جداول حيّة عبر Firestore مع تحديثات فورية", en: "Live Firestore tables with real-time updates" },
  "assets.importExcel": { ar: "استيراد من Excel", en: "Import from Excel" },
  "assets.add": { ar: "إضافة أصل", en: "Add asset" },
  "assets.loadError": { ar: "تعذّر تحميل قائمة الأصول.", en: "Failed to load the asset list." },
  "assets.tableTitle": { ar: "جدول الأصول", en: "Assets table" },
  "assets.tableSubtitle": { ar: "بحث، تصفية، وترقيم صفحات", en: "Search, filter, and pagination" },
  "assets.searchPlaceholder": { ar: "بحث برمز أو اسم أو تسلسلي أو موقع…", en: "Search by code, name, serial, or site…" },
  "assets.emptyTitle": { ar: "لا توجد أصول مسجَّلة بعد", en: "No assets registered yet" },
  "assets.emptyHint": { ar: "ابدأ بإضافة أصل أو استيراد من Excel.", en: "Start by adding an asset or importing from Excel." },
  "assets.noResults": { ar: "لا توجد نتائج مطابقة", en: "No matching results" },
  "assets.noResultsHint": { ar: "جرّب تغيير عبارات البحث أو التصفيات.", en: "Try changing your search or filters." },
  "assets.selectAll": { ar: "تحديد كل النتائج", en: "Select all results" },
  "assets.clearSelection": { ar: "إلغاء التحديد", en: "Clear selection" },
  "assets.deleteSelected": { ar: "حذف المحدّد", en: "Delete selected" },
  "assets.pageOf": { ar: "الصفحة", en: "Page" },
  "assets.of": { ar: "من", en: "of" },
  "assets.totalAfterFilter": { ar: "إجمالي بعد التصفية", en: "total after filter" },
  "assets.bulkDeleteTitle": { ar: "حذف الأصول المحدّدة؟", en: "Delete selected assets?" },
  "assets.bulkDeleteDesc": { ar: "سيُحذف المحدّد نهائياً ولا يمكن التراجع. (أوامر العمل والقراءات المرتبطة لا تُحذف تلقائياً.)", en: "Selected items are permanently deleted (linked work orders and readings are not removed automatically)." },
  "assets.confirmDelete": { ar: "تأكيد الحذف", en: "Confirm delete" },
  // Work orders list
  "wo.title": { ar: "أوامر العمل التنفيذية", en: "Work orders" },
  "wo.subtitle": { ar: "تتبّع الحالات والإسناد وسير العمل.", en: "Track statuses, assignment, and workflow." },
  "wo.loadError": { ar: "تعذّر تحميل أوامر العمل.", en: "Failed to load work orders." },
  "wo.logTitle": { ar: "سجل الأعمال", en: "Work log" },
  "wo.logSubtitle": { ar: "تحديث لحظي عبر Firestore", en: "Real-time via Firestore" },
  "wo.empty": { ar: "لم تُنشأ أي أوامر عمل بعد.", en: "No work orders created yet." },
  "wo.emptyHint": { ar: "ابدأ بتوليد أمر من صفحة الأصل أو المسح.", en: "Generate one from an asset page or the scan flow." },
  "col.titleCol": { ar: "العنوان", en: "Title" },
  "col.asset": { ar: "الأصل", en: "Asset" },
  "col.priority": { ar: "الأولوية", en: "Priority" },
  "col.due": { ar: "الاستحقاق", en: "Due" },
  "col.pending": { ar: "عالق عند", en: "Pending at" },
  "col.technician": { ar: "الفنّي", en: "Technician" },
  "col.approver": { ar: "المعتمِد", en: "Approver" },
  "col.requestNo": { ar: "رقم الطلب", en: "Request no." },
  "col.date": { ar: "التاريخ", en: "Date" },
  "col.action": { ar: "الإجراء", en: "Action" },
  // Maintenance log
  "mlog.title": { ar: "سجل الصيانة", en: "Maintenance log" },
  "mlog.subtitle": { ar: "كل أوامر الصيانة على مستوى الأسطول — بحث باليوم أو رقم الأصل أو اللوحة.", en: "Fleet-wide maintenance orders — search by date, asset number, or plate." },
  "mlog.cardTitle": { ar: "السجل التراكمي", en: "Cumulative log" },
  "mlog.cardSubtitle": { ar: "التاريخ، الأصل، الإجراء، الفنّي، المعتمِد، رقم الطلب، والحالة.", en: "Date, asset, action, technician, approver, request no., and status." },
  "mlog.searchLabel": { ar: "بحث برقم الأصل أو اللوحة", en: "Search by asset no. or plate" },
  "mlog.from": { ar: "من", en: "From" },
  "mlog.to": { ar: "إلى", en: "To" },
  "mlog.active": { ar: "قيد المعالجة", en: "Active" },
  "mlog.closedCancelled": { ar: "مغلقة/ملغاة", en: "Closed/Cancelled" },
  "mlog.exportExcel": { ar: "تصدير Excel", en: "Export Excel" },
  "mlog.print": { ar: "طباعة التقرير", en: "Print report" },
  "mlog.noResults": { ar: "لا توجد نتائج مطابقة.", en: "No matching results." },
  "mlog.totalResults": { ar: "إجمالي النتائج", en: "Total results" },
  "mlog.confirmDelete": { ar: "حذف هذا السجل نهائياً؟ لا يمكن التراجع.", en: "Delete this record permanently? This cannot be undone." },
  "mlog.deleted": { ar: "تم حذف السجل", en: "Record deleted" },
  // Users
  "users.title": { ar: "المستخدمون", en: "Users" },
  "users.subtitle": { ar: "إدارة الأدوار والوصول (للمدراء والمسؤولين)", en: "Manage roles and access (managers & admins)" },
  "users.add": { ar: "إضافة مستخدم", en: "Add user" },
  "users.cardSubtitle": { ar: "أدوار SPMS والحسابات النشطة", en: "SPMS roles and active accounts" },
  "users.loadError": { ar: "تعذر تحميل المستخدمين.", en: "Failed to load users." },
  "users.empty": { ar: "لا يوجد مستخدمون", en: "No users" },
  "users.emptyHint": { ar: "أضف أول مستخدم لبدء التشغيل.", en: "Add the first user to get started." },
  "col.userName": { ar: "الاسم", en: "Name" },
  "col.email": { ar: "البريد", en: "Email" },
  "col.role": { ar: "الدور", en: "Role" },
  "col.password": { ar: "كلمة المرور", en: "Password" },
  "users.active": { ar: "نشط", en: "Active" },
  "users.suspended": { ar: "موقوف", en: "Suspended" },
  "users.activate": { ar: "تفعيل", en: "Activate" },
  "users.deactivate": { ar: "تعطيل", en: "Deactivate" },
  "users.deleteUser": { ar: "حذف المستخدم", en: "Delete user" },
  "users.deleted": { ar: "تم حذف المستخدم", en: "User deleted" },
  "users.activated": { ar: "تم تفعيل المستخدم", en: "User activated" },
  "users.deactivated": { ar: "تم تعطيل المستخدم", en: "User deactivated" },
  // Pending owner
  "pending.done": { ar: "مكتمل — لا شيء معلّق", en: "Completed — nothing pending" },
  "pending.approval": { ar: "بانتظار اعتماد المدير", en: "Awaiting manager approval" },
  "pending.waitingPartsTech": { ar: "عند الفنّي (بانتظار قطع غيار)", en: "With technician (awaiting parts)" },
  "pending.waitingParts": { ar: "بانتظار قطع الغيار", en: "Awaiting parts" },
  "pending.technician": { ar: "عند الفنّي المُسنَد", en: "With the assigned technician" },
  "pending.assign": { ar: "بانتظار الإسناد من المدير", en: "Awaiting assignment by manager" },
  // Work order detail + stepper
  "wod.allWO": { ar: "كل أوامر العمل", en: "All work orders" },
  "wod.card": { ar: "كرت أمر العمل", en: "Work-order card" },
  "wod.notFound": { ar: "أمر عمل غير موجود", en: "Work order not found" },
  "wod.notFoundHint": { ar: "ربما تم حذف المعرف أو المسار خاطئ.", en: "The ID may have been deleted or the path is wrong." },
  "wod.back": { ar: "العودة لقائمة الأوامر", en: "Back to work orders" },
  "wod.dates": { ar: "التواريخ التشغيلية", en: "Operational dates" },
  "wod.datesHint": { ar: "تسجيل أمر العمل وآخر تحديث ومواعيد الإغلاق.", en: "Created, last updated, and closing dates." },
  "wod.created": { ar: "التسجيل", en: "Created" },
  "wod.dueExpected": { ar: "متوقّع الإغلاق", en: "Expected close" },
  "wod.closedActual": { ar: "الإغلاق الفعلي", en: "Actual close" },
  "wod.measures": { ar: "القياسات التشغيلية", en: "Operational measures" },
  "wod.measuresHint": { ar: "مدة التنفيذ المحسوبة وحالة الاعتماد.", en: "Computed execution duration and approval status." },
  "wod.execDuration": { ar: "مدة التنفيذ (ساعات)", en: "Execution duration (hours)" },
  "wod.approvalRequired": { ar: "مطلوب اعتماد", en: "Approval required" },
  "wod.taskDesc": { ar: "وصف مهمة تنفيذية", en: "Execution task description" },
  "wod.internalNotes": { ar: "ملاحظات داخلية", en: "Internal notes" },
  "wod.noInternalNotes": { ar: "لا توجد ملاحظات داخلية.", en: "No internal notes." },
  "wod.activityLog": { ar: "سجل الحركة التشغيلي", en: "Operational activity log" },
  "wod.activityHint": { ar: "ملخص لحالة الأمر والتنفيذ والاعتماد والأثر التدقيقي.", en: "Summary of status, execution, approval, and audit trail." },
  "wod.requestRef": { ar: "رقم الطلب المرجعي (النظام الأساسي)", en: "Reference request number (main system)" },
  "wod.requestRefHint": { ar: "اربط أمر العمل بالطلب المفتوح في النظام الأساسي.", en: "Link this work order to the request opened in the main system." },
  "wod.requestSaved": { ar: "تم حفظ رقم الطلب المرجعي", en: "Reference request number saved" },
  // Execution summary + form
  "exec.summary": { ar: "ملخّص التنفيذ", en: "Execution summary" },
  "exec.summaryHint": { ar: "ما دوّنه الفنّي — يراجعه المعتمِد قبل الاعتماد.", en: "What the technician recorded — reviewed by the approver before approval." },
  "exec.checklist": { ar: "قائمة مهام التنفيذ", en: "Execution checklist" },
  "exec.qtyUsed": { ar: "الكمية المستهلكة", en: "Qty used" },
  "exec.extraItems": { ar: "مواد/أعمال إضافية (غير مدرجة بالقالب)", en: "Extra materials/tasks (not in template)" },
  "exec.addItem": { ar: "إضافة بند", en: "Add item" },
  "exec.itemDesc": { ar: "الوصف", en: "Description" },
  "exec.observation": { ar: "ملاحظات الطلب (أضرار/إطار تالف…)", en: "Request notes (damage/worn tire…)" },
  "exec.photos": { ar: "صور", en: "Photos" },
  "exec.addPhoto": { ar: "إضافة صورة", en: "Add photo" },
  "exec.completionNotes": { ar: "ملاحظات الإكمال", en: "Completion notes" },
  "exec.partsNote": { ar: "ملاحظة قطع الغيار", en: "Required parts note" },
  "exec.safetyNotes": { ar: "ملاحظات السلامة", en: "Safety notes" },
  "exec.none": { ar: "لا يوجد", en: "None" },
  "exec.done": { ar: "تمّ", en: "Done" },
  "exec.pending": { ar: "لم يُنفّذ", en: "Pending" },
  "exec.hasNotes": { ar: "يحتوي ملاحظات", en: "Has notes" },
  "exec.download": { ar: "تنزيل", en: "Download" },
  "exec.viewPhoto": { ar: "عرض الصورة", en: "View photo" },
  // Edit work order
  "woedit.title": { ar: "تعديل أمر العمل", en: "Edit work order" },
  "woedit.titleField": { ar: "العنوان", en: "Title" },
  "woedit.desc": { ar: "الوصف", en: "Description" },
  "woedit.priority": { ar: "الأولوية", en: "Priority" },
  "woedit.internalNotes": { ar: "ملاحظات داخلية", en: "Internal notes" },
  "woedit.saved": { ar: "تم حفظ التعديلات", en: "Changes saved" },
  "woedit.edit": { ar: "تعديل", en: "Edit" },
  // Dashboard pending
  "dash.myPending": { ar: "الطلبات العالقة لديك", en: "Your pending requests" },
  "dash.myPendingHint": { ar: "أوامر العمل المنتظرة لإجرائك.", en: "Work orders waiting on your action." },
  "dash.noPending": { ar: "لا طلبات عالقة لديك.", en: "No pending requests for you." },
  // WO list split
  "wo.viewPending": { ar: "العالقة", en: "Pending" },
  "wo.viewDone": { ar: "المنفّذة", en: "Executed" },
  "common.yes": { ar: "نعم", en: "Yes" },
  "common.no": { ar: "لا", en: "No" },
  "step.open": { ar: "مفتوح", en: "Open" },
  "step.assign": { ar: "إسناد", en: "Assign" },
  "step.execute": { ar: "تنفيذ", en: "Execute" },
  "step.approve": { ar: "اعتماد", en: "Approve" },
  "step.close": { ar: "إغلاق", en: "Close" },
  "step.stuckAt": { ar: "عالق عند", en: "Pending at" },
  "step.done": { ar: "مكتمل", en: "Completed" },
  "step.cancelled": { ar: "أمر العمل ملغى", en: "Work order cancelled" },
  // Reports
  "rep.title": { ar: "التقارير", en: "Reports" },
  "rep.subtitle": { ar: "تصدير البيانات التشغيلية ومؤشرات الصيانة.", en: "Export operational data and maintenance KPIs." },
  "rep.assetsReport": { ar: "تقرير الأصول", en: "Assets report" },
  "rep.pmReport": { ar: "تقرير الصيانة الوقائية", en: "Preventive maintenance report" },
  "rep.woReport": { ar: "تقرير أوامر العمل", en: "Work orders report" },
  "rep.exportExcel": { ar: "تصدير Excel", en: "Export Excel" },
  "rep.kpisTitle": { ar: "مؤشرات تشغيلية جاهزة للتصدير", en: "Operational KPIs ready for export" },
  "rep.woSummary": { ar: "ملخص فوري — حالة أوامر العمل", en: "Snapshot — work-order statuses" },
  "rep.statusCol": { ar: "الحالة", en: "Status" },
  "rep.kpis": { ar: "مؤشرات تشغيلية", en: "Operational KPIs" },
  "rep.woDist": { ar: "توزيع حالات أوامر العمل", en: "Work-order status distribution" },
  "rep.count": { ar: "العدد", en: "Count" },
  "rep.noData": { ar: "لا بيانات", en: "No data" },
  "rep.assetCount": { ar: "أصل", en: "assets" },
  "rep.pmCount": { ar: "مخطط", en: "plans" },
  "rep.woCount": { ar: "أمر", en: "orders" },
  // Settings
  "set.title": { ar: "الإعدادات", en: "Settings" },
  "set.subtitle": { ar: "تهيئة بيانات المؤسسة وضوابط التنبيهات.", en: "Configure company profile and alert settings." },
  "set.profile": { ar: "الملف المؤسسي", en: "Company profile" },
  "set.profileHint": { ar: "الحفظ يقتصر على المدراء أو المشرف العام.", en: "Saving is limited to managers or the admin." },
  "set.logo": { ar: "لوجو الشركة (يظهر في الرئيسية والتقارير والكروت)", en: "Company logo (dashboard, reports, cards)" },
  "set.logoRemove": { ar: "حذف اللوجو", en: "Remove logo" },
  "set.companyName": { ar: "الاسم التجاري المعروض", en: "Displayed company name" },
  "set.timezone": { ar: "المنطقة الزمنية", en: "Time zone" },
  "set.locale": { ar: "اللغة الافتراضية", en: "Default locale" },
  "set.pmReminder": { ar: "تذكير PM قبل (أيام)", en: "PM reminder before (days)" },
  "set.anomaly": { ar: "عتبة شذوذ العداد (%)", en: "Meter anomaly threshold (%)" },
  "set.aliases": { ar: "مرادفات المواقع للخريطة (رمز = مدينة)", en: "Map location aliases (code = city)" },
  "set.aliasesHint": { ar: "سطر لكل رمز: «الرمز = اسم المدينة». تُستخدم لرسم الأصول على الخريطة.", en: "One line per code: \"code = city\". Used to plot assets on the map." },
  "set.saved": { ar: "تم تحديث إعدادات المؤسسة", en: "Company settings updated" },
  "set.logoSaved": { ar: "تم حفظ اللوجو", en: "Logo saved" },
  "set.logoRemoved": { ar: "تم حذف اللوجو", en: "Logo removed" },
  "set.dangerTitle": { ar: "منطقة الخطر — تصفير بيانات التجربة", en: "Danger zone — reset test data" },
  "set.dangerDesc": { ar: "يحذف كل أوامر العمل والقراءات والإشعارات ويعيد ضبط مؤشّر الصيانة لكل أصل. لا يمكن التراجع.", en: "Deletes all work orders, readings, and notifications, and resets each asset's maintenance cursor. Cannot be undone." },
  "set.dangerConfirm": { ar: "اكتب «تصفير» للتأكيد", en: "Type \"تصفير\" to confirm" },
  "set.dangerButton": { ar: "تصفير بيانات التجربة الآن", en: "Reset test data now" },
  "set.resetting": { ar: "جارٍ التصفير…", en: "Resetting…" },
  // Notifications
  "notif.title": { ar: "الإشعارات", en: "Notifications" },
  "notif.subtitle": { ar: "تنبيهات النظام وأوامر العمل والصيانة", en: "System, work-order, and maintenance alerts" },
  "notif.updating": { ar: "تحديث…", en: "Updating…" },
  "notif.loadError": { ar: "تعذر تحميل الإشعارات.", en: "Failed to load notifications." },
  "notif.inbox": { ar: "صندوق الوارد", en: "Inbox" },
  "notif.inboxHint": { ar: "يُفلتر حسب المستخدم ما لم تكن صلاحية مدير", en: "Filtered per user unless you are a manager" },
  "notif.empty": { ar: "لا توجد إشعارات", en: "No notifications" },
  "notif.emptyHint": { ar: "ستظهر التنبيهات الجديدة هنا فور وصولها.", en: "New alerts appear here as they arrive." },
  // Activity log
  "act.title": { ar: "سجل النشاط النظامي", en: "System activity log" },
  "act.subtitle": { ar: "أثر تدقيقي لكل الإجراءات.", en: "Audit trail of all actions." },
  "act.loadError": { ar: "تعذر تحميل السجل وفق سياسات Firestore.", en: "Failed to load the log under Firestore policies." },
  "act.colActivity": { ar: "النشاط", en: "Activity" },
  "act.colEntity": { ar: "نوع الكيان", en: "Entity type" },
  "act.colId": { ar: "معرّف", en: "ID" },
  "act.colTime": { ar: "الوقت", en: "Time" },
  "act.empty": { ar: "لا يوجد نشاط مسجّل.", en: "No recorded activity." },
  // Dashboard
  "dash.badge": { ar: "منصّة المؤسسة", en: "Enterprise platform" },
  "dash.title": { ar: "لوحة قيادة للصيانة الوقائية الذكية", en: "Smart Preventive Maintenance Dashboard" },
  "dash.subtitle": { ar: "مؤشرات حيّة لتتبّع الأصول الثقيلة وحركة الفرق الصيانية والامتثال للصيانة الدورية.", en: "Live metrics tracking heavy assets, technician workload, and preventive-maintenance compliance." },
  "dash.quickWO": { ar: "أوامر العمل", en: "Work orders" },
  "dash.quickPM": { ar: "جدول صيانة دورية", en: "Preventive schedule" },
  "dash.syncError": { ar: "تعذّر مزامنة جزء من الواجهات التشغيلية. راجع الاتصال وتكوين Firebase.", en: "Some operational data failed to sync. Check your connection and Firebase config." },
  "dash.kpi.availability": { ar: "صافي التوفر التقريبي", en: "Approx. availability" },
  "dash.kpi.availabilityHint": { ar: "نسبة أسطول نشط غير في صيانة", en: "Active fleet not under maintenance" },
  "dash.kpi.mtbf": { ar: "MTBF تشغيلي", en: "Operational MTBF" },
  "dash.kpi.mtbfHint": { ar: "ساعات تشغيل مجمّعة / عدد الحوادث", en: "Aggregate run hours / incidents" },
  "dash.kpi.mttr": { ar: "MTTR إصلاحات", en: "Repair MTTR" },
  "dash.kpi.mttrHint": { ar: "متوسط زمن إغلاق الأوامر المكتملة", en: "Avg. time to close completed orders" },
  "dash.kpi.activeWO": { ar: "أوامر عمل نشطة", en: "Active work orders" },
  "dash.kpi.activeWOHint": { ar: "جميع الحالات التنفيذية", en: "All in-progress states" },
  "dash.kpi.delayedPm": { ar: "PM متأخر", en: "Overdue PM" },
  "dash.kpi.delayedPmHint": { ar: "خطط فعّالة متجاوزة للموعد", en: "Active plans past due" },
  "dash.kpi.fleet": { ar: "الأسطول المملوك", en: "Owned fleet" },
  "dash.kpi.fleetHint": { ar: "أصول غير متوقفة", en: "Non-retired assets" },
  "dash.kpi.unread": { ar: "تنبيهات غير مقروءة", en: "Unread alerts" },
  "dash.kpi.unreadHint": { ar: "في مركز الإشعارات", en: "In the notification center" },
  "dash.kpi.totalAssets": { ar: "إجمالي الأصول", en: "Total assets" },
  "dash.kpi.totalAssetsHint": { ar: "كل الأصول المسجّلة", en: "All registered assets" },
  "dash.kpi.locations": { ar: "عدد المواقع", en: "Sites" },
  "dash.kpi.locationsHint": { ar: "مواقع ميدانية مميّزة", en: "Distinct field sites" },
  "dash.fleetMap": { ar: "خريطة الأسطول", en: "Fleet map" },
  "dash.workload": { ar: "أحمال الفنيين (أوامر مفتوحة)", en: "Technician workload (open orders)" },
  "dash.upcomingPm": { ar: "صيانة وقائية قادمة", en: "Upcoming preventive maintenance" },
  "dash.woStates": { ar: "حالات أوامر العمل", en: "Work-order statuses" },
  "dash.pmCompliance": { ar: "التزام الصيانة الوقائية", en: "PM compliance" },
  "dash.noData": { ar: "لا بيانات", en: "No data" },
  // Announcements / bulletins
  "ann.title": { ar: "الإعلانات والبلاغات", en: "Announcements & Bulletins" },
  "ann.subtitle": { ar: "تعميمات وبلاغات الفريق", en: "Team notices and bulletins" },
  "ann.empty": { ar: "لا توجد إعلانات بعد.", en: "No announcements yet." },
  "ann.new": { ar: "إعلان جديد", en: "New announcement" },
  "ann.formTitle": { ar: "عنوان الإعلان", en: "Announcement title" },
  "ann.formBody": { ar: "التفاصيل", en: "Details" },
  "ann.publish": { ar: "نشر", en: "Publish" },
  "ann.published": { ar: "تم نشر الإعلان", en: "Announcement published" },
  "ann.deleted": { ar: "تم حذف الإعلان", en: "Announcement deleted" },
  "ann.priority": { ar: "الأهمية", en: "Priority" },
  "ann.normal": { ar: "عادي", en: "Normal" },
  "ann.important": { ar: "مهم", en: "Important" },
  "ann.urgent": { ar: "عاجل", en: "Urgent" },
}

type I18nValue = {
  lang: Lang
  dir: "rtl" | "ltr"
  setLang: (lang: Lang) => void
  toggle: () => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "ar" || stored === "en") return stored
  } catch {
    // ignore
  }
  return "ar"
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr"

  useEffect(() => {
    const el = document.documentElement
    el.lang = lang
    el.dir = dir
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore
    }
  }, [lang, dir])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggle = useCallback(() => setLangState((p) => (p === "ar" ? "en" : "ar")), [])
  const t = useCallback(
    (key: string) => {
      const entry = DICT[key]
      return entry ? entry[lang] : key
    },
    [lang]
  )

  const value = useMemo<I18nValue>(() => ({ lang, dir, setLang, toggle, t }), [lang, dir, setLang, toggle, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Language-aware data labels (statuses, priorities, roles…) bound to current lang. */
export function useLabels() {
  const { lang } = useI18n()
  return useMemo(() => makeLabels(lang), [lang])
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}
