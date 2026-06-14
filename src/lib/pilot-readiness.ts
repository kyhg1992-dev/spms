export type PilotReadinessStatus = "ready" | "warning" | "blocked"

export type PilotReadinessItem = {
  key: string
  status: PilotReadinessStatus
  labelAr: string
  labelEn: string
  detail?: string
}

export function buildPilotEnvironmentChecks(env: Record<string, string | undefined>): PilotReadinessItem[] {
  const required = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ]

  return required.map((key) => {
    const ok = !!env[key]?.trim()
    return {
      key,
      status: ok ? "ready" : "blocked",
      labelAr: `متغير البيئة ${key}`,
      labelEn: `Environment variable ${key}`,
      detail: ok ? undefined : "Missing required Firebase environment variable.",
    }
  })
}

export function pilotWarningBannerText(status: PilotReadinessStatus): { ar: string; en: string } {
  if (status === "blocked") {
    return {
      ar: "بيئة التجربة غير جاهزة. راجع إعدادات Firebase قبل التشغيل.",
      en: "Pilot environment is blocked. Review Firebase configuration before use.",
    }
  }
  if (status === "warning") {
    return {
      ar: "بيئة التجربة تعمل مع ملاحظات تشغيلية. راقب أول وردية بعناية.",
      en: "Pilot is running with operational warnings. Monitor the first shift closely.",
    }
  }
  return {
    ar: "بيئة التجربة جاهزة للاستخدام المحدود.",
    en: "Pilot environment is ready for controlled use.",
  }
}
