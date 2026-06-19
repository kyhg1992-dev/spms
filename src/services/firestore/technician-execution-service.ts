import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore"

import { workOrderEvent } from "@/lib/notification-engine"
import {
  appendTechnicianNote,
  assertTechnicianExecution,
  canCompleteExecution,
  canSaveExecutionDraft,
  canStartExecution,
  completionTargetStatus,
  type TechnicianExecutionDraft,
} from "@/lib/technician-execution"
import { normalizeWorkOrder } from "@/lib/work-order-normalize"
import { workOrderLifecycleToStatus } from "@/lib/work-order-lifecycle"
import { db } from "@/lib/firebase"
import type { UserRole, WorkOrderLifecycleStatus } from "@/models/firestore"
import type { AsyncState } from "@/services/firestore/crud"
import { emitOperationalEventNotifications } from "@/services/firestore/notification-engine-service"
import { canAccess } from "@/services/firestore/permissions"

type ExecutionResult = {
  workOrderId: string
  lifecycleStatus?: WorkOrderLifecycleStatus
}

type ExecutionInput = {
  workOrderId: string
  technicianUid: string
  actorRole: UserRole
}

type DraftInput = ExecutionInput & {
  draft: TechnicianExecutionDraft
}

type NoteInput = ExecutionInput & {
  note: string
}

function doneState<T>(data: T): AsyncState<T> {
  return { loading: false, data, error: null }
}

function errorState<T>(error: unknown): AsyncState<T> {
  return {
    loading: false,
    data: null,
    error: error instanceof Error ? error.message : String(error),
  }
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>
}

function cleanStringArray(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  return cleaned.length ? cleaned : undefined
}

function cleanMeterReading(draft: TechnicianExecutionDraft) {
  if (!draft.meterReadingAtExecution) return undefined
  return stripUndefined({
    kind: draft.meterReadingAtExecution.kind,
    value: draft.meterReadingAtExecution.value,
    readingId: draft.meterReadingAtExecution.readingId?.trim() || undefined,
    capturedAt: draft.meterReadingAtExecution.capturedAt,
  })
}

function cleanChecklist(draft: TechnicianExecutionDraft) {
  if (!draft.executionChecklist) return undefined
  return draft.executionChecklist.map((item) =>
    stripUndefined({
      id: item.id,
      labelAr: item.labelAr,
      labelEn: item.labelEn?.trim() || undefined,
      isDone: item.isDone,
      checkedAt: item.checkedAt,
      note: item.note?.trim() || undefined,
      qtyUsed: item.qtyUsed?.trim() || undefined,
    })
  )
}

function cleanExtraItems(draft: TechnicianExecutionDraft) {
  if (!draft.extraItems) return undefined
  const rows = draft.extraItems
    .map((it) => ({ desc: it.desc.trim(), qty: it.qty?.trim() || undefined }))
    .filter((it) => it.desc)
    .map((it) => stripUndefined(it))
  return rows.length ? rows : undefined
}

function ensureCanUpdate(role: UserRole): void {
  if (!canAccess(role, "workOrders", "update")) throw new Error("Permission denied")
}

async function loadWorkOrder(workOrderId: string) {
  const ref = doc(db, "workOrders", workOrderId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Work order not found")
  return { ref, workOrder: normalizeWorkOrder(snap.id, snap.data()) }
}

function draftPatch(draft: TechnicianExecutionDraft): Record<string, unknown> {
  return stripUndefined({
    technicianNotes: draft.technicianNotes?.trim() || undefined,
    completionNotes: draft.completionNotes?.trim() || undefined,
    actualLaborHours: draft.actualLaborHours,
    laborHours: draft.actualLaborHours,
    actualDowntimeHours: draft.actualDowntimeHours,
    downtimeHours: draft.actualDowntimeHours,
    meterReadingAtExecution: cleanMeterReading(draft),
    executionChecklist: cleanChecklist(draft),
    executionPhotos: cleanStringArray(draft.executionPhotos),
    extraItems: cleanExtraItems(draft),
    observationNotes: draft.observationNotes?.trim() || undefined,
    requiredPartsNote: draft.requiredPartsNote?.trim() || undefined,
    safetyNotes: draft.safetyNotes?.trim() || undefined,
  })
}

function audit(input: {
  actorUid: string
  actionKey: string
  workOrderId: string
  labelAr: string
}) {
  return {
    actorUid: input.actorUid,
    actionKey: input.actionKey,
    entityType: "work_order",
    entityId: input.workOrderId,
    labelAr: input.labelAr,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

export async function startExecution(input: ExecutionInput): Promise<AsyncState<ExecutionResult>> {
  try {
    ensureCanUpdate(input.actorRole)
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    assertTechnicianExecution(canStartExecution(workOrder))

    const batch = writeBatch(db)
    batch.update(ref, {
      lifecycleStatus: "IN_PROGRESS",
      status: "in_progress",
      executionStartedAt: workOrder.executionStartedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, "activityLogs")), audit({
      actorUid: input.technicianUid,
      actionKey: "work_order.execution_started",
      workOrderId: input.workOrderId,
      labelAr: "بدء تنفيذ أمر العمل بواسطة الفني",
    }))
    await batch.commit()
    return doneState({ workOrderId: input.workOrderId, lifecycleStatus: "IN_PROGRESS" })
  } catch (error) {
    return errorState<ExecutionResult>(error)
  }
}

export async function saveExecutionDraft(input: DraftInput): Promise<AsyncState<ExecutionResult>> {
  try {
    ensureCanUpdate(input.actorRole)
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    assertTechnicianExecution(canSaveExecutionDraft(workOrder))

    const batch = writeBatch(db)
    batch.update(ref, {
      ...draftPatch(input.draft),
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, "activityLogs")), audit({
      actorUid: input.technicianUid,
      actionKey: "work_order.execution_draft_saved",
      workOrderId: input.workOrderId,
      labelAr: "حفظ مسودة تنفيذ أمر العمل",
    }))
    await batch.commit()
    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<ExecutionResult>(error)
  }
}

export async function completeExecution(input: DraftInput): Promise<AsyncState<ExecutionResult>> {
  try {
    ensureCanUpdate(input.actorRole)
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    assertTechnicianExecution(canCompleteExecution(workOrder, input.draft))

    const targetStatus = completionTargetStatus(workOrder)

    // Labor hours are computed automatically: elapsed time from when execution STARTED
    // (بدء التنفيذ) until now (إنهاء التنفيذ). Falls back to the open time if the start
    // was never recorded.
    const patch = draftPatch(input.draft)
    const startedMs =
      workOrder.executionStartedAt && typeof workOrder.executionStartedAt.toMillis === "function"
        ? workOrder.executionStartedAt.toMillis()
        : workOrder.createdAt && typeof workOrder.createdAt.toMillis === "function"
          ? workOrder.createdAt.toMillis()
          : undefined
    if (typeof startedMs === "number") {
      const autoHours = Math.max(0, Math.round(((Date.now() - startedMs) / 3_600_000) * 10) / 10)
      patch.actualLaborHours = autoHours
      patch.laborHours = autoHours
    }

    const batch = writeBatch(db)
    batch.update(ref, {
      ...patch,
      lifecycleStatus: targetStatus,
      status: workOrderLifecycleToStatus(targetStatus),
      executionCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, "activityLogs")), audit({
      actorUid: input.technicianUid,
      actionKey: "work_order.execution_completed",
      workOrderId: input.workOrderId,
      labelAr: targetStatus === "WAITING_APPROVAL"
        ? "إكمال التنفيذ وإرسال أمر العمل للاعتماد"
        : "إكمال تنفيذ أمر العمل",
    }))
    await batch.commit()

    await emitOperationalEventNotifications({
      actorUid: input.technicianUid,
      event: workOrderEvent({
        eventType: targetStatus === "WAITING_APPROVAL"
          ? "WORK_ORDER_WAITING_APPROVAL"
          : "WORK_ORDER_COMPLETED",
        workOrderId: input.workOrderId,
        title: workOrder.title,
        requesterId: workOrder.requesterId,
      }),
    })

    return doneState({ workOrderId: input.workOrderId, lifecycleStatus: targetStatus })
  } catch (error) {
    return errorState<ExecutionResult>(error)
  }
}

export async function addExecutionNote(input: NoteInput): Promise<AsyncState<ExecutionResult>> {
  try {
    ensureCanUpdate(input.actorRole)
    if (!input.note.trim()) return errorState<ExecutionResult>("Execution note is required")
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    assertTechnicianExecution(canSaveExecutionDraft(workOrder))

    const batch = writeBatch(db)
    batch.update(ref, {
      technicianNotes: appendTechnicianNote(workOrder.technicianNotes, input.note),
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, "activityLogs")), audit({
      actorUid: input.technicianUid,
      actionKey: "work_order.execution_note_added",
      workOrderId: input.workOrderId,
      labelAr: "إضافة ملاحظة تنفيذ من الفني",
    }))
    await batch.commit()
    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<ExecutionResult>(error)
  }
}
