/**
 * Central SPMS color system.
 *
 * - moduleColor: a distinct brand color per navigation module (colored icons).
 * - serviceLevelColor: A/B/C/D severity scale derived from the WA380-6 forms
 *   (A comprehensive = red … D minor = green).
 * - actionColor: maintenance action codes (REPLACE/CLEAN/…) as colored chips.
 *
 * Values are hex so they read correctly on the white/light chip fills used for
 * badges; pair `fg` text on `bg` fill (both from the same hue family).
 */

export type Swatch = { bg: string; fg: string; solid: string }

/** Per-module accent color for navigation/section icons. */
export const MODULE_COLOR: Record<string, string> = {
  dashboard: "#2563eb", // blue
  scan: "#0891b2", // cyan
  assets: "#0d9488", // teal
  workOrders: "#d97706", // amber
  pm: "#16a34a", // green
  templates: "#4f46e5", // indigo
  notifications: "#e11d48", // rose
  reports: "#7c3aed", // violet
  maintenanceLog: "#0f766e", // deep teal
  activity: "#0891b2", // cyan
  settings: "#64748b", // slate
  users: "#db2777", // pink
  inventory: "#9333ea", // purple
}

/** Every service code A–Z so any equipment family can pick its own scheme. */
export const ALL_SERVICE_CODES: string[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

/** A/B/C/D keep the meaningful severity scale (red → orange → amber → green). */
const SERVICE_LEVEL: Record<string, Swatch> = {
  A: { bg: "#FCEBEB", fg: "#A32D2D", solid: "#C00000" }, // شاملة / Comprehensive
  B: { bg: "#FFF1E0", fg: "#9A4F06", solid: "#D97706" }, // كبيرة / Major
  C: { bg: "#FAEEDA", fg: "#854F0B", solid: "#B8860B" }, // متوسطة / Intermediate
  D: { bg: "#E9F7EC", fg: "#15803D", solid: "#16A34A" }, // صغرى / Minor
  E: { bg: "#E6F1FB", fg: "#185FA5", solid: "#2563EB" },
  F: { bg: "#EEEDFE", fg: "#3C3489", solid: "#7C3AED" },
}

/** Deterministic distinct color for any letter not in the fixed set (G…Z). */
function generatedSwatch(code: string): Swatch {
  const idx = Math.max(0, code.charCodeAt(0) - 65)
  const hue = Math.round((idx * 360) / 26)
  return {
    bg: `hsl(${hue} 72% 93%)`,
    fg: `hsl(${hue} 60% 30%)`,
    solid: `hsl(${hue} 58% 46%)`,
  }
}

export function serviceLevelColor(code: string): Swatch {
  if (SERVICE_LEVEL[code]) return SERVICE_LEVEL[code]
  if (/^[A-Z]$/.test(code)) return generatedSwatch(code)
  return SERVICE_LEVEL.A
}

/** Maintenance action codes (bilingual keys map to the English token). */
const ACTION: Record<string, Swatch> = {
  REPLACE: { bg: "#FCEBEB", fg: "#A32D2D", solid: "#DC2626" },
  CLEAN: { bg: "#E6F1FB", fg: "#185FA5", solid: "#2563EB" },
  CHECK: { bg: "#F1EFE8", fg: "#444441", solid: "#64748B" },
  GREASE: { bg: "#FAEEDA", fg: "#854F0B", solid: "#B8860B" },
  DRAIN: { bg: "#E1F5EE", fg: "#0F6E56", solid: "#0D9488" },
  REFILL: { bg: "#E9F7EC", fg: "#15803D", solid: "#16A34A" },
  ADJUST: { bg: "#EEEDFE", fg: "#3C3489", solid: "#7C3AED" },
  WASH: { bg: "#E6F6FB", fg: "#0E6A82", solid: "#0891B2" },
}

export function actionColor(action: string): Swatch {
  return ACTION[action?.toUpperCase()] ?? ACTION.CHECK
}
