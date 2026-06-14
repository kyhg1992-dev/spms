import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

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

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}
