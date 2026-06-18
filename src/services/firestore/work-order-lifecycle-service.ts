import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore"

import { normalizeAsset } from "@/lib/asset-normalize"
import { normalizeMaintenanceTemplate } from "@/lib/maintenance-sequence-normalize"
import { normalizeWorkOrder } from "@/lib/work-order-normalize"
import { workOrderEvent } from "@/lib/notification-engine"
import {
  assertWorkOrderTransition,
  createReassignmentEntry,
  validateReassignment,
  workOrderLifecycleToStatus,
  type WorkOrderCompletionData,
} from "@/lib/work-order-lifecycle"
import { db } from "@/lib/firebase"
import type { UserRole, WorkOrderLifecycleStatus } from "@/models/firestore"
import type { AsyncState } from "@/services/firestore/crud"
import { emitOperationalEventNotifications } from "@/services/firestore/notification-engine-service"
import { canAccess } from "@/services/firestore/permissions"

type TransitionInput = {
  workOrderId: string
  targetStatus: WorkOrderLifecycleStatus
  actorUid: string
  actorRole: UserRole
  completionData?: WorkOrderCompletionData
  assignedTo?: string
  approvalRequired?: boolean
}

type ReassignmentInput = {
  workOrderId: string
  assignedTo: string
  assignedBy: string
  actorRole: UserRole
  reassignmentReason: string
}

type ApprovalInput = {
  workOrderId: string
  actorUid: string
  actorRole: UserRole
}

type RejectionInput = ApprovalInput & {
  rejectionReason: string
}

type ClosureInput = {
  workOrderId: string
  actorUid: string
  actorRole: UserRole
}

type LifecycleResult = {
  workOrderId: string
  lifecycleStatus?: WorkOrderLifecycleStatus
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

function managerRole(role: UserRole): boolean {
  return role === "admin" || role === "manager"
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>
}

function completionPatch(data: WorkOrderCompletionData | undefined) {
  if (!data) return {}
  return stripUndefined({
    completionNotes: data.completionNotes?.trim(),
    laborHours: data.laborHours,
    downtimeHours: data.downtimeHours,
    downtimeMinutes: data.downtimeMinutes,
    completionMeterReadingId: data.completionMeterReadingId?.trim() || undefined,
    attachmentsPlaceholder: data.attachmentsPlaceholder,
  })
}

function auditLabel(status: WorkOrderLifecycleStatus): string {
  switch (status) {
    case "OPEN":
      return "فتح أمر العمل"
    case "ASSIGNED":
      return "إسناد أمر العمل"
    case "IN_PROGRESS":
      return "بدء تنفيذ أمر العمل"
    case "WAITING_PARTS":
      return "تعليق أمر العمل بانتظار قطع الغيار"
    case "WAITING_APPROVAL":
      return "إرسال أمر العمل للاعتماد"
    case "COMPLETED":
      return "إكمال أمر العمل"
    case "CLOSED":
      return "إغلاق أمر العمل"
    case "CANCELLED":
      return "إلغاء أمر العمل"
  }
}

async function emitWorkOrderStatusNotification(input: {
  workOrderId: string
  title: string
  actorUid: string
  targetStatus: WorkOrderLifecycleStatus
  assignedTo?: string
  requesterId?: string
}): Promise<void> {
  if (input.targetStatus === "ASSIGNED") {
    await emitOperationalEventNotifications({
      actorUid: input.actorUid,
      event: workOrderEvent({
        eventType: "WORK_ORDER_ASSIGNED",
        workOrderId: input.workOrderId,
        title: input.title,
        targetUserIds: input.assignedTo ? [input.assignedTo] : undefined,
        requesterId: input.requesterId,
      }),
    })
  }
  if (input.targetStatus === "COMPLETED") {
    await emitOperationalEventNotifications({
      actorUid: input.actorUid,
      event: workOrderEvent({
        eventType: "WORK_ORDER_COMPLETED",
        workOrderId: input.workOrderId,
        title: input.title,
        requesterId: input.requesterId,
      }),
    })
  }
  if (input.targetStatus === "WAITING_APPROVAL") {
    await emitOperationalEventNotifications({
      actorUid: input.actorUid,
      event: workOrderEvent({
        eventType: "WORK_ORDER_WAITING_APPROVAL",
        workOrderId: input.workOrderId,
        title: input.title,
      }),
    })
  }
}

async function loadWorkOrder(workOrderId: string) {
  const ref = doc(db, "workOrders", workOrderId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Work order not found")
  return { ref, workOrder: normalizeWorkOrder(snap.id, snap.data()) }
}

/**
 * Advance the asset's maintenance rotation cursor to the position this work order
 * performed, so the "next service" rolls forward. Stores the authoritative
 * `lastServiceIndex` (handles repeated codes) plus the code/reading/date. Returns
 * `true` when it queued an asset update, so the caller can mark the WO advanced and
 * never double-advance across approve→close.
 */
async function advanceAssetRotation(
  batch: ReturnType<typeof writeBatch>,
  workOrder: ReturnType<typeof normalizeWorkOrder>
): Promise<boolean> {
  if (workOrder.rotationAdvanced) return false
  if (!workOrder.serviceLevelCode || !workOrder.assetId) return false

  const assetSnap = await getDoc(doc(db, "assets", workOrder.assetId))
  if (!assetSnap.exists()) return false
  const asset = normalizeAsset(assetSnap.id, assetSnap.data())

  let reading = asset.operatingHours ?? 0
  if (asset.maintenanceTemplateId) {
    const tplSnap = await getDoc(doc(db, "maintenanceTemplates", asset.maintenanceTemplateId))
    if (tplSnap.exists()) {
      const tpl = normalizeMaintenanceTemplate(tplSnap.id, tplSnap.data())
      reading = tpl.meterKind === "odometer" ? asset.odometer ?? 0 : asset.operatingHours ?? 0
    }
  }

  batch.update(
    doc(db, "assets", workOrder.assetId),
    stripUndefined({
      lastServiceCode: workOrder.serviceLevelCode,
      lastServiceIndex: workOrder.serviceLevelIndex,
      lastServiceReading: reading,
      lastServiceAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  )
  return true
}

function ensureCanUpdate(role: UserRole): void {
  if (!canAccess(role, "workOrders", "update")) throw new Error("Permission denied")
}

export async function transitionWorkOrderLifecycle(input: TransitionInput): Promise<AsyncState<LifecycleResult>> {
  try {
    ensureCanUpdate(input.actorRole)
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    assertWorkOrderTransition({
      workOrder,
      targetStatus: input.targetStatus,
      actorRole: input.actorRole,
      completionData: input.completionData,
      assignedTo: input.assignedTo,
      approvalRequired: input.approvalRequired,
    })

    const batch = writeBatch(db)

    // When a service work order closes, advance the asset's rotation position so
    // the next service is computed as a continuation (not from scratch).
    const advanced =
      input.targetStatus === "CLOSED" ? await advanceAssetRotation(batch, workOrder) : false

    const patch = stripUndefined({
      status: workOrderLifecycleToStatus(input.targetStatus),
      lifecycleStatus: input.targetStatus,
      assignedTo: input.assignedTo?.trim() || undefined,
      assigneeId: input.assignedTo?.trim() || undefined,
      approvalRequired: input.approvalRequired,
      closedAt: input.targetStatus === "CLOSED" ? serverTimestamp() : undefined,
      closedByUid: input.targetStatus === "CLOSED" ? input.actorUid : undefined,
      rotationAdvanced: advanced ? true : undefined,
      updatedAt: serverTimestamp(),
      ...completionPatch(input.completionData),
    })

    batch.update(ref, patch)
    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.actorUid,
      actionKey: "work_order.status_change",
      entityType: "work_order",
      entityId: input.workOrderId,
      labelAr: auditLabel(input.targetStatus),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await batch.commit()
    await emitWorkOrderStatusNotification({
      workOrderId: input.workOrderId,
      title: workOrder.title,
      actorUid: input.actorUid,
      targetStatus: input.targetStatus,
      assignedTo: input.assignedTo ?? workOrder.assignedTo ?? workOrder.assigneeId,
      requesterId: workOrder.requesterId,
    })
    return doneState({ workOrderId: input.workOrderId, lifecycleStatus: input.targetStatus })
  } catch (error) {
    return errorState<LifecycleResult>(error)
  }
}

export async function reassignWorkOrderLifecycle(input: ReassignmentInput): Promise<AsyncState<LifecycleResult>> {
  const validation = validateReassignment(input)
  if (!validation.ok) return errorState<LifecycleResult>(validation.errors.join(" "))

  try {
    ensureCanUpdate(input.actorRole)
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    const previousAssignedTo = workOrder.assignedTo ?? workOrder.assigneeId
    const entry = createReassignmentEntry({
      assignedTo: input.assignedTo.trim(),
      assignedBy: input.assignedBy.trim(),
      reassignedAt: Timestamp.now(),
      reassignmentReason: input.reassignmentReason.trim(),
      previousAssignedTo,
    })

    const batch = writeBatch(db)
    batch.update(ref, stripUndefined({
      assignedTo: entry.assignedTo,
      assigneeId: entry.assignedTo,
      assignedBy: entry.assignedBy,
      reassignedAt: serverTimestamp(),
      reassignmentReason: entry.reassignmentReason,
      reassignmentHistory: arrayUnion(stripUndefined(entry)),
      status: workOrder.status === "open" ? "assigned" : undefined,
      lifecycleStatus: workOrder.lifecycleStatus === "OPEN" ? "ASSIGNED" : undefined,
      updatedAt: serverTimestamp(),
    }))
    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.assignedBy,
      actionKey: "work_order.reassign",
      entityType: "work_order",
      entityId: input.workOrderId,
      labelAr: `إعادة إسناد أمر العمل إلى ${entry.assignedTo}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await batch.commit()
    await emitOperationalEventNotifications({
      actorUid: input.assignedBy,
      event: workOrderEvent({
        eventType: "WORK_ORDER_REASSIGNED",
        workOrderId: input.workOrderId,
        title: workOrder.title,
        targetUserIds: [entry.assignedTo],
        requesterId: workOrder.requesterId,
      }),
    })
    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<LifecycleResult>(error)
  }
}

export async function approveWorkOrderLifecycle(input: ApprovalInput): Promise<AsyncState<LifecycleResult>> {
  if (!managerRole(input.actorRole)) return errorState<LifecycleResult>("Approval requires admin or manager role")
  try {
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    const batch = writeBatch(db)
    // Approving a service work order advances the asset's rotation immediately, so
    // the "next service" rolls forward the moment the manager approves (guarded so
    // a later close does not advance again).
    const advanced = await advanceAssetRotation(batch, workOrder)
    batch.update(ref, stripUndefined({
      approvalRequired: true,
      approvedByUid: input.actorUid,
      approvedAt: serverTimestamp(),
      rejectedAt: null,
      rejectedByUid: null,
      rejectionReason: null,
      rotationAdvanced: advanced ? true : undefined,
      updatedAt: serverTimestamp(),
    }))
    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.actorUid,
      actionKey: "work_order.approve",
      entityType: "work_order",
      entityId: input.workOrderId,
      labelAr: "اعتماد أمر العمل",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await batch.commit()
    await emitOperationalEventNotifications({
      actorUid: input.actorUid,
      event: workOrderEvent({
        eventType: "APPROVAL_ACCEPTED",
        workOrderId: input.workOrderId,
        title: workOrder.title,
        targetUserIds: workOrder.assignedTo || workOrder.assigneeId ? [workOrder.assignedTo ?? workOrder.assigneeId ?? ""] : undefined,
        requesterId: workOrder.requesterId,
      }),
    })
    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<LifecycleResult>(error)
  }
}

export async function rejectWorkOrderLifecycle(input: RejectionInput): Promise<AsyncState<LifecycleResult>> {
  if (!managerRole(input.actorRole)) return errorState<LifecycleResult>("Rejection requires admin or manager role")
  if (!input.rejectionReason.trim()) return errorState<LifecycleResult>("rejectionReason is required")
  try {
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    const batch = writeBatch(db)
    batch.update(ref, {
      approvalRequired: true,
      rejectedByUid: input.actorUid,
      rejectedAt: serverTimestamp(),
      rejectionReason: input.rejectionReason.trim(),
      lifecycleStatus: "IN_PROGRESS",
      status: "in_progress",
      updatedAt: serverTimestamp(),
    })
    batch.set(doc(collection(db, "activityLogs")), {
      actorUid: input.actorUid,
      actionKey: "work_order.reject",
      entityType: "work_order",
      entityId: input.workOrderId,
      labelAr: "رفض اعتماد أمر العمل وإعادته للتنفيذ",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await batch.commit()
    await emitOperationalEventNotifications({
      actorUid: input.actorUid,
      event: workOrderEvent({
        eventType: "APPROVAL_REJECTED",
        workOrderId: input.workOrderId,
        title: workOrder.title,
        targetUserIds: workOrder.assignedTo || workOrder.assigneeId ? [workOrder.assignedTo ?? workOrder.assigneeId ?? ""] : undefined,
        requesterId: workOrder.requesterId,
      }),
    })
    return doneState({ workOrderId: input.workOrderId, lifecycleStatus: "IN_PROGRESS" })
  } catch (error) {
    return errorState<LifecycleResult>(error)
  }
}

export async function closeWorkOrderLifecycle(input: ClosureInput): Promise<AsyncState<LifecycleResult>> {
  if (!managerRole(input.actorRole)) return errorState<LifecycleResult>("Closure requires admin or manager role")
  return transitionWorkOrderLifecycle({
    workOrderId: input.workOrderId,
    targetStatus: "CLOSED",
    actorUid: input.actorUid,
    actorRole: input.actorRole,
  })
}
