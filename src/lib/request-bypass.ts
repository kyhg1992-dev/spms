import type { CompanySettings } from "@/models/firestore"

/** Default code that bypasses the CAM request number (configurable in settings). */
export const DEFAULT_BYPASS_CODE = "202520262027"

export function bypassCodeOf(settings?: Pick<CompanySettings, "requestBypassCode"> | null): string {
  return settings?.requestBypassCode?.trim() || DEFAULT_BYPASS_CODE
}

/** True when the entered value matches the (configured) bypass code. */
export function isBypassCode(
  value: string,
  settings?: Pick<CompanySettings, "requestBypassCode"> | null
): boolean {
  return value.trim() === bypassCodeOf(settings)
}
