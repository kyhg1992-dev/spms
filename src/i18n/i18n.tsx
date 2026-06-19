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
