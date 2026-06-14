import { Timestamp, type DocumentData } from "firebase/firestore"

import type { PMSchedule, PMServiceType, PMStatus, PMTriggerMode } from "@/models/firestore"

function asServiceType(v: unknown): PMServiceType {
  if (typeof v === "string" && /^[A-Z]$/.test(v)) return v as PMServiceType
  return "A"
}

function asTrigger(v: unknown): PMTriggerMode {
  if (
    typeof v === "string" &&
    ["time", "hours", "km", "both"].includes(v)
  ) {
    return v as PMTriggerMode
  }
  return "time"
}

function asPMStatus(v: unknown): PMStatus | undefined {
  if (typeof v === "string" && ["OK", "DUE_SOON", "OVERDUE", "CRITICAL"].includes(v)) {
    return v as PMStatus
  }
  return undefined
}

export function normalizePMSchedule(docId: string, data: DocumentData): PMSchedule & { id: string } {
  const d = data as Record<string, unknown>
  const createdAt =
    d.createdAt && typeof (d.createdAt as Timestamp).toMillis === "function"
      ? (d.createdAt as Timestamp)
      : Timestamp.now()
  const updatedAt =
    d.updatedAt && typeof (d.updatedAt as Timestamp).toMillis === "function"
      ? (d.updatedAt as Timestamp)
      : Timestamp.now()

  const nextRunRaw = d.nextRunAt
  const nextRunAt =
    nextRunRaw && typeof (nextRunRaw as Timestamp).toMillis === "function"
      ? (nextRunRaw as Timestamp)
      : Timestamp.now()

  return {
    id: docId,
    createdAt,
    updatedAt,
    assetId: typeof d.assetId === "string" ? d.assetId : "",
    title: typeof d.title === "string" ? d.title : "",
    serviceType: asServiceType(d.serviceType),
    frequencyDays:
      typeof d.frequencyDays === "number" ? d.frequencyDays : typeof d.frequencyDays === "string"
        ? Number(d.frequencyDays) || 30
        : 30,
    nextRunAt,
    lastRunAt:
      d.lastRunAt && typeof (d.lastRunAt as Timestamp).toMillis === "function"
        ? (d.lastRunAt as Timestamp)
        : undefined,
    isActive: typeof d.isActive === "boolean" ? d.isActive : true,
    triggerMode: asTrigger(d.triggerMode),
    nextDueHours: typeof d.nextDueHours === "number" ? d.nextDueHours : undefined,
    nextDueKm: typeof d.nextDueKm === "number" ? d.nextDueKm : undefined,
    overdueStatus: typeof d.overdueStatus === "boolean" ? d.overdueStatus : undefined,
    dueSoonStatus: typeof d.dueSoonStatus === "boolean" ? d.dueSoonStatus : undefined,
    pmStatus: asPMStatus(d.pmStatus),
    meterHoursInterval: typeof d.meterHoursInterval === "number" ? d.meterHoursInterval : undefined,
    meterKmInterval: typeof d.meterKmInterval === "number" ? d.meterKmInterval : undefined,
    autoCreateWorkOrder:
      typeof d.autoCreateWorkOrder === "boolean" ? d.autoCreateWorkOrder : undefined,
    templateCode: typeof d.templateCode === "string" ? d.templateCode : undefined,
    lastCompletedWorkOrderId:
      typeof d.lastCompletedWorkOrderId === "string" ? d.lastCompletedWorkOrderId : undefined,
    lastGeneratedWorkOrderId:
      typeof d.lastGeneratedWorkOrderId === "string" ? d.lastGeneratedWorkOrderId : undefined,
    maintenanceTemplateId:
      typeof d.maintenanceTemplateId === "string" ? d.maintenanceTemplateId : undefined,
    lastServiceReading: typeof d.lastServiceReading === "number" ? d.lastServiceReading : undefined,
  }
}
