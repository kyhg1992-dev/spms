import type { WorkOrder } from "@/models/firestore"
import { canCompleteExecution, canSaveExecutionDraft, canStartExecution } from "@/lib/technician-execution"

export type MobileTechnicianAction = {
  key: "start" | "draft" | "complete"
  labelAr: string
  labelEn: string
  enabled: boolean
  reason?: string
}

export type OfflineExecutionDraft = {
  workOrderId: string
  technicianUid: string
  technicianNotes?: string
  completionNotes?: string
  actualLaborHours?: number
  actualDowntimeHours?: number
  updatedAtIso: string
  syncStatus: "local_only" | "sync_pending" | "synced"
}

export function buildMobileTechnicianActions(workOrder: WorkOrder): MobileTechnicianAction[] {
  const start = canStartExecution(workOrder)
  const draft = canSaveExecutionDraft(workOrder)
  const complete = canCompleteExecution(workOrder, {})

  return [
    {
      key: "start",
      labelAr: "بدء",
      labelEn: "Start",
      enabled: start.ok,
      reason: start.errors[0],
    },
    {
      key: "draft",
      labelAr: "حفظ",
      labelEn: "Save",
      enabled: draft.ok,
      reason: draft.errors[0],
    },
    {
      key: "complete",
      labelAr: "إكمال",
      labelEn: "Complete",
      enabled: complete.ok,
      reason: complete.errors[0],
    },
  ]
}

export function createOfflineExecutionDraft(input: {
  workOrderId: string
  technicianUid: string
  technicianNotes?: string
  completionNotes?: string
  actualLaborHours?: number
  actualDowntimeHours?: number
}): OfflineExecutionDraft {
  return {
    ...input,
    updatedAtIso: new Date().toISOString(),
    syncStatus: "local_only",
  }
}
