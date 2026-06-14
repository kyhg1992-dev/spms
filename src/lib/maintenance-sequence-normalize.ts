import { Timestamp, type DocumentData } from "firebase/firestore"

import type {
  MaintenanceActionCode,
  MaintenanceSequenceTemplate,
  MaintenanceServiceCode,
  MaintenanceServiceLevel,
  MaintenanceServiceTask,
  MaintenanceTriggerMode,
  MeterReadingKind,
} from "@/models/firestore"

const SERVICE_CODES: MaintenanceServiceCode[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(
  ""
) as MaintenanceServiceCode[]
const ACTION_CODES: MaintenanceActionCode[] = [
  "REPLACE",
  "CLEAN",
  "CHECK",
  "DRAIN",
  "GREASE",
  "ADJUST",
  "WASH",
  "REFILL",
]

function asServiceCode(v: unknown): MaintenanceServiceCode | null {
  return typeof v === "string" && (SERVICE_CODES as string[]).includes(v)
    ? (v as MaintenanceServiceCode)
    : null
}

function asSequence(v: unknown): MaintenanceServiceCode[] {
  if (!Array.isArray(v)) return []
  return v.map(asServiceCode).filter((code): code is MaintenanceServiceCode => code !== null)
}

function asAction(v: unknown): MaintenanceActionCode {
  return typeof v === "string" && (ACTION_CODES as string[]).includes(v.toUpperCase())
    ? (v.toUpperCase() as MaintenanceActionCode)
    : "CHECK"
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v)
}

function asTask(v: unknown): MaintenanceServiceTask | null {
  if (!v || typeof v !== "object") return null
  const d = v as Record<string, unknown>
  const descAr = asStr(d.descAr).trim()
  const descEn = asStr(d.descEn).trim()
  if (!descAr && !descEn) return null
  return {
    descAr: descAr || descEn,
    descEn: descEn || undefined,
    itemCode: asStr(d.itemCode).trim() || undefined,
    qty: asStr(d.qty).trim() || undefined,
    action: asAction(d.action),
    partNo: asStr(d.partNo).trim() || undefined,
  }
}

function asLevel(v: unknown): MaintenanceServiceLevel | null {
  if (!v || typeof v !== "object") return null
  const d = v as Record<string, unknown>
  const code = asServiceCode(d.code)
  if (!code) return null
  const tasks = Array.isArray(d.tasks)
    ? d.tasks.map(asTask).filter((t): t is MaintenanceServiceTask => t !== null)
    : []
  return {
    code,
    nameAr: asStr(d.nameAr).trim() || code,
    nameEn: asStr(d.nameEn).trim() || undefined,
    tasks,
  }
}

function asTrigger(v: unknown): MaintenanceTriggerMode | undefined {
  return v === "hours" || v === "km" || v === "time" ? v : undefined
}

function asMeterKind(v: unknown): MeterReadingKind {
  return v === "odometer" ? "odometer" : "operating_hours"
}

function asTimestamp(v: unknown): Timestamp {
  return v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp) : Timestamp.now()
}

export function normalizeMaintenanceTemplate(
  docId: string,
  data: DocumentData
): MaintenanceSequenceTemplate & { id: string } {
  const d = data as Record<string, unknown>
  const trigger = asTrigger(d.triggerMode)
  // Keep meterKind consistent with triggerMode when present.
  const meterKind =
    trigger === "km" ? "odometer" : trigger === "hours" ? "operating_hours" : asMeterKind(d.meterKind)
  return {
    id: docId,
    createdAt: asTimestamp(d.createdAt),
    updatedAt: asTimestamp(d.updatedAt),
    templateCode: asStr(d.templateCode).trim(),
    name: asStr(d.name).trim(),
    assetTypeLabel: asStr(d.assetTypeLabel).trim() || undefined,
    sequence: asSequence(d.sequence),
    stepInterval:
      typeof d.stepInterval === "number"
        ? d.stepInterval
        : typeof d.stepInterval === "string"
          ? Number(d.stepInterval) || 0
          : 0,
    meterKind,
    triggerMode: trigger,
    levels: Array.isArray(d.levels)
      ? d.levels.map(asLevel).filter((l): l is MaintenanceServiceLevel => l !== null)
      : undefined,
    isActive: typeof d.isActive === "boolean" ? d.isActive : true,
    description: asStr(d.description).trim() || undefined,
  }
}
