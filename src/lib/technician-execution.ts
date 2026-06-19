import type {
  WorkOrder,
  WorkOrderExecutionChecklistItem,
  WorkOrderExecutionMeterReading,
  WorkOrderLifecycleStatus,
} from "@/models/firestore"
import { getWorkOrderLifecycleStatus } from "@/lib/work-order-lifecycle"

export type TechnicianExecutionDraft = {
  technicianNotes?: string
  completionNotes?: string
  actualLaborHours?: number
  actualDowntimeHours?: number
  meterReadingAtExecution?: WorkOrderExecutionMeterReading
  executionChecklist?: WorkOrderExecutionChecklistItem[]
  executionPhotos?: string[]
  extraItems?: { desc: string; qty?: string }[]
  observationNotes?: string
  requiredPartsNote?: string
  safetyNotes?: string
}

export type TechnicianExecutionValidation = {
  ok: boolean
  errors: string[]
}

function currentStatus(workOrder: WorkOrder): WorkOrderLifecycleStatus {
  return getWorkOrderLifecycleStatus(workOrder)
}

function hasAssignedTechnician(workOrder: WorkOrder): boolean {
  return !!(workOrder.assignedTo?.trim() || workOrder.assigneeId?.trim())
}

export function canStartExecution(workOrder: WorkOrder): TechnicianExecutionValidation {
  const status = currentStatus(workOrder)
  const errors: string[] = []
  if (status !== "ASSIGNED" && status !== "IN_PROGRESS") {
    errors.push("Execution can start only for ASSIGNED or IN_PROGRESS work orders.")
  }
  if (!hasAssignedTechnician(workOrder)) {
    errors.push("Execution requires an assigned technician.")
  }
  return { ok: errors.length === 0, errors }
}

export function canSaveExecutionDraft(workOrder: WorkOrder): TechnicianExecutionValidation {
  const status = currentStatus(workOrder)
  const errors: string[] = []
  if (!["ASSIGNED", "IN_PROGRESS", "WAITING_PARTS", "WAITING_APPROVAL"].includes(status)) {
    errors.push("Execution draft can be saved only while the work order is operational.")
  }
  return { ok: errors.length === 0, errors }
}

export function canCompleteExecution(
  workOrder: WorkOrder,
  draft: TechnicianExecutionDraft
): TechnicianExecutionValidation {
  const status = currentStatus(workOrder)
  const completionNotes = draft.completionNotes ?? workOrder.completionNotes
  const errors: string[] = []

  if (status !== "ASSIGNED" && status !== "IN_PROGRESS") {
    errors.push("Technician can complete only ASSIGNED or IN_PROGRESS work orders.")
  }
  if (!completionNotes?.trim()) {
    errors.push("Completion notes are required.")
  }
  // Labor hours are computed automatically (start → end); no manual entry required.
  return { ok: errors.length === 0, errors }
}

export function completionTargetStatus(workOrder: WorkOrder): WorkOrderLifecycleStatus {
  return workOrder.approvalRequired ? "WAITING_APPROVAL" : "COMPLETED"
}

export function assertTechnicianExecution(result: TechnicianExecutionValidation): void {
  if (!result.ok) throw new Error(result.errors.join(" "))
}

export function appendTechnicianNote(existing: string | undefined, note: string): string {
  const clean = note.trim()
  if (!clean) return existing ?? ""
  return existing?.trim() ? `${existing.trim()}\n\n${clean}` : clean
}

