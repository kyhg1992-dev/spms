import type { Lang } from "@/i18n/i18n"

type Pair = { ar: string; en: string }

const WO_STATUS: Record<string, Pair> = {
  open: { ar: "مفتوح", en: "Open" },
  assigned: { ar: "معيّن", en: "Assigned" },
  in_progress: { ar: "قيد التنفيذ", en: "In progress" },
  waiting_parts: { ar: "بانتظار قطع", en: "Waiting parts" },
  waiting_approval: { ar: "بانتظار الاعتماد", en: "Waiting approval" },
  completed: { ar: "مكتمل", en: "Completed" },
  closed: { ar: "مغلق", en: "Closed" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
  on_hold: { ar: "معلّق", en: "On hold" },
}

const PRIORITY: Record<string, Pair> = {
  low: { ar: "منخفض", en: "Low" },
  medium: { ar: "متوسط", en: "Medium" },
  high: { ar: "مرتفع", en: "High" },
  critical: { ar: "حرج", en: "Critical" },
}

const ASSET_STATUS: Record<string, Pair> = {
  active: { ar: "نشط", en: "Active" },
  maintenance: { ar: "صيانة", en: "Maintenance" },
  retired: { ar: "متوقف", en: "Retired" },
}

const ROLE: Record<string, Pair> = {
  admin: { ar: "مسؤول", en: "Admin" },
  manager: { ar: "مدير", en: "Manager" },
  technician: { ar: "فني", en: "Technician" },
  requester: { ar: "مقدّم طلب", en: "Requester" },
}

const PM_SERVICE: Record<string, Pair> = {
  A: { ar: "شاملة — A", en: "Comprehensive — A" },
  B: { ar: "كبيرة — B", en: "Major — B" },
  C: { ar: "متوسطة — C", en: "Intermediate — C" },
  D: { ar: "صغرى — D", en: "Minor — D" },
  E: { ar: "اختبار — E", en: "Inspection — E" },
  F: { ar: "خاصة — F", en: "Special — F" },
}

const PM_TRIGGER: Record<string, Pair> = {
  time: { ar: "زمنية", en: "Time-based" },
  hours: { ar: "ساعات التشغيل", en: "Operating hours" },
  km: { ar: "مسافة / عدّاد", en: "Distance / odometer" },
  both: { ar: "مزدوجة (زمن + عدّاد)", en: "Both (time + meter)" },
}

const NOTIF_TYPE: Record<string, Pair> = {
  work_order: { ar: "أمر عمل", en: "Work order" },
  pm_schedule: { ar: "صيانة دورية", en: "PM schedule" },
  asset: { ar: "أصل", en: "Asset" },
  system: { ar: "نظام", en: "System" },
}

const ASSET_CATEGORY: Record<string, Pair> = {
  vehicles: { ar: "مركبات", en: "Vehicles" },
  equipment: { ar: "معدات", en: "Equipment" },
  other: { ar: "أخرى", en: "Other" },
}

function pick(map: Record<string, Pair>, key: string, lang: Lang): string {
  const entry = map[key]
  return entry ? entry[lang] : key
}

/** Build a set of language-bound label functions for data enums. */
export function makeLabels(lang: Lang) {
  return {
    woStatus: (k: string) => pick(WO_STATUS, k, lang),
    priority: (k: string) => pick(PRIORITY, k, lang),
    assetStatus: (k: string) => pick(ASSET_STATUS, k, lang),
    role: (k: string) => pick(ROLE, k, lang),
    pmService: (k: string) => pick(PM_SERVICE, k, lang),
    pmTrigger: (k: string) => pick(PM_TRIGGER, k, lang),
    notifType: (k: string) => pick(NOTIF_TYPE, k, lang),
    assetCategory: (k: string) => pick(ASSET_CATEGORY, k, lang),
  }
}

export type Labels = ReturnType<typeof makeLabels>
