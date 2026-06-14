import { appendActivityLog } from "@/services/audit"

export type OperationalErrorCode =
  | "PERMISSION_DENIED"
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "DUPLICATE_PREVENTED"
  | "FIREBASE_UNAVAILABLE"
  | "UNKNOWN"

export type OperationalError = {
  code: OperationalErrorCode
  message: string
  messageAr: string
  cause?: unknown
}

const userMessages: Record<OperationalErrorCode, { ar: string; en: string }> = {
  PERMISSION_DENIED: {
    ar: "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
    en: "You do not have permission to perform this action.",
  },
  VALIDATION_FAILED: {
    ar: "تحقق من البيانات المطلوبة ثم حاول مرة أخرى.",
    en: "Check the required data and try again.",
  },
  NOT_FOUND: {
    ar: "السجل المطلوب غير موجود أو لم يعد متاحا.",
    en: "The requested record was not found or is no longer available.",
  },
  DUPLICATE_PREVENTED: {
    ar: "تم منع إنشاء سجل مكرر بأمان.",
    en: "A duplicate record was safely prevented.",
  },
  FIREBASE_UNAVAILABLE: {
    ar: "تعذر الاتصال بخدمات Firebase. حاول لاحقا.",
    en: "Firebase services are unavailable. Try again later.",
  },
  UNKNOWN: {
    ar: "حدث خطأ تشغيلي غير متوقع.",
    en: "An unexpected operational error occurred.",
  },
}

export function toOperationalError(error: unknown): OperationalError {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  if (normalized.includes("permission")) {
    return { code: "PERMISSION_DENIED", message, messageAr: userMessages.PERMISSION_DENIED.ar, cause: error }
  }
  if (normalized.includes("not found")) {
    return { code: "NOT_FOUND", message, messageAr: userMessages.NOT_FOUND.ar, cause: error }
  }
  if (normalized.includes("required") || normalized.includes("validation")) {
    return { code: "VALIDATION_FAILED", message, messageAr: userMessages.VALIDATION_FAILED.ar, cause: error }
  }
  if (normalized.includes("firebase") || normalized.includes("unavailable")) {
    return { code: "FIREBASE_UNAVAILABLE", message, messageAr: userMessages.FIREBASE_UNAVAILABLE.ar, cause: error }
  }

  return { code: "UNKNOWN", message, messageAr: userMessages.UNKNOWN.ar, cause: error }
}

export function userFacingOperationalError(
  error: unknown,
  language: "ar" | "en" = "ar"
): string {
  const operational = toOperationalError(error)
  return language === "ar" ? operational.messageAr : userMessages[operational.code].en
}

export async function auditOperationalError(input: {
  actorUid: string
  entityType: string
  entityId: string
  actionKey: string
  error: unknown
}): Promise<void> {
  const operational = toOperationalError(input.error)
  await appendActivityLog({
    actorUid: input.actorUid,
    actionKey: `error.${input.actionKey}`,
    entityType: input.entityType,
    entityId: input.entityId,
    labelAr: `${operational.messageAr} (${operational.code})`,
  })
}
