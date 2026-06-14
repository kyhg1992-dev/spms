export const workOrderStatusAr: Record<string, string> = {
  open: "مفتوح",
  assigned: "معيّن",
  in_progress: "قيد التنفيذ",
  waiting_parts: "بانتظار قطع",
  waiting_approval: "بانتظار الاعتماد",
  completed: "مكتمل",
  closed: "مغلق",
  cancelled: "ملغى",
  /** Legacy persisted values */
  on_hold: "معلق",
}

export const workOrderPriorityAr: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
}

export const assetStatusAr: Record<string, string> = {
  active: "نشط",
  maintenance: "صيانة",
  retired: "متوقف",
}

export const notificationTypeAr: Record<string, string> = {
  work_order: "أمر عمل",
  pm_schedule: "صيانة دورية",
  asset: "أصل",
  system: "نظام",
}

export const notificationPriorityAr: Record<string, string> = {
  low: "منخفض",
  normal: "عادي",
  high: "مرتفع",
  critical: "حرج",
}

export const pmServiceTypeAr: Record<string, string> = {
  A: "خدمة دورية أساسية — A",
  B: "فحص وقائي — B",
  C: "صيانة موسعة — C",
  D: "عُمرة كاملة — D",
  E: "اختبار ومطابقة — E",
  F: "طبطبة كبرى — F",
}

export const pmTriggerModeAr: Record<string, string> = {
  time: "زمنية",
  hours: "ساعات التشغيل",
  km: "مسافة / عداد",
  both: "مزدوجة (زمن + عدّاد)",
}

export const userRoleAr: Record<string, string> = {
  admin: "مسؤول",
  manager: "مدير",
  technician: "فني",
  requester: "مقدّم طلب",
}
