import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore"

import { workOrderEvent } from "@/lib/notification-engine"
import { getWorkOrderLifecycleStatus } from "@/lib/work-order-lifecycle"
import { normalizeWorkOrder } from "@/lib/work-order-normalize"
import { db } from "@/lib/firebase"
import type {
  SpmsUser,
  UserRole,
  WorkOrderDelegationEntry,
  WorkOrderDelegationStatus,
} from "@/models/firestore"
import type { AsyncState } from "@/services/firestore/crud"
import { emitOperationalEventNotifications } from "@/services/firestore/notification-engine-service"
import { reassignWorkOrderLifecycle } from "@/services/firestore/work-order-lifecycle-service"

type AdminReassignmentInput = {
  workOrderId: string
  newAssigneeUid: string
  reassignedBy: string
  actorRole: UserRole
  reassignmentReason: string
}

type CreateDelegationInput = {
  workOrderId: string
  delegatedFrom: string
  delegatedTo: string
  delegatedBy: string
  actorRole: UserRole
  delegationReason: string
  delegationExpiresAt?: Date
}

type CancelDelegationInput = {
  workOrderId: string
  delegatedBy: string
  actorRole: UserRole
  cancellationReason?: string
}

type AcceptDelegationInput = {
  workOrderId: string
  acceptedBy: string
}

type AdminAssignmentResult = {
  workOrderId: string
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

async function loadUser(uid: string): Promise<SpmsUser & { id: string }> {
  const snap = await getDoc(doc(db, "users", uid))
  if (!snap.exists()) throw new Error("User not found")
  return { id: snap.id, ...(snap.data() as Omit<SpmsUser, "id">) }
}

async function loadWorkOrder(workOrderId: string) {
  const ref = doc(db, "workOrders", workOrderId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Work order not found")
  return { ref, workOrder: normalizeWorkOrder(snap.id, snap.data()) }
}

function assertManager(role: UserRole): void {
  if (!managerRole(role)) throw new Error("Only admin or manager can perform this operation")
}

function assertOperationalWorkOrder(status: ReturnType<typeof getWorkOrderLifecycleStatus>): void {
  if (status === "CLOSED" || status === "CANCELLED") {
    throw new Error("Closed or cancelled work orders cannot be reassigned or delegated")
  }
}

function assertAssignableUser(user: SpmsUser & { id: string }): void {
  if (!user.isActive) throw new Error("New assignee must be an active user")
  if (user.role !== "technician" && user.role !== "manager") {
    throw new Error("New assignee should be a technician or manager")
  }
}

function delegationEntry(input: {
  delegatedFrom: string
  delegatedTo: string
  delegatedBy: string
  delegationReason: string
  delegationStatus: WorkOrderDelegationStatus
  delegationExpiresAt?: Date
  acceptedAt?: Timestamp
}): WorkOrderDelegationEntry {
  return {
    delegatedFrom: input.delegatedFrom,
    delegatedTo: input.delegatedTo,
    delegatedBy: input.delegatedBy,
    delegatedAt: Timestamp.now(),
    delegationReason: input.delegationReason,
    delegationExpiresAt: input.delegationExpiresAt
      ? Timestamp.fromDate(input.delegationExpiresAt)
      : undefined,
    delegationStatus: input.delegationStatus,
    acceptedAt: input.acceptedAt,
  }
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

export async function adminReassignWorkOrder(
  input: AdminReassignmentInput
): Promise<AsyncState<AdminAssignmentResult>> {
  try {
    assertManager(input.actorRole)
    if (!input.reassignmentReason.trim()) throw new Error("Reassignment reason is required")
    const [{ workOrder }, newAssignee] = await Promise.all([
      loadWorkOrder(input.workOrderId),
      loadUser(input.newAssigneeUid),
    ])
    assertOperationalWorkOrder(getWorkOrderLifecycleStatus(workOrder))
    assertAssignableUser(newAssignee)

    const previousAssignee = workOrder.assignedTo ?? workOrder.assigneeId
    const result = await reassignWorkOrderLifecycle({
      workOrderId: input.workOrderId,
      assignedTo: input.newAssigneeUid,
      assignedBy: input.reassignedBy,
      actorRole: input.actorRole,
      reassignmentReason: input.reassignmentReason,
    })
    if (result.error) return errorState<AdminAssignmentResult>(result.error)

    if (previousAssignee) {
      await emitOperationalEventNotifications({
        actorUid: input.reassignedBy,
        event: workOrderEvent({
          eventType: "WORK_ORDER_REASSIGNED",
          workOrderId: input.workOrderId,
          title: workOrder.title,
          targetUserIds: [previousAssignee],
          requesterId: workOrder.requesterId,
        }),
      })
    }

    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<AdminAssignmentResult>(error)
  }
}

export async function createWorkOrderDelegation(
  input: CreateDelegationInput
): Promise<AsyncState<AdminAssignmentResult>> {
  try {
    assertManager(input.actorRole)
    if (!input.delegationReason.trim()) throw new Error("Delegation reason is required")
    const [{ ref, workOrder }, fromUser, toUser] = await Promise.all([
      loadWorkOrder(input.workOrderId),
      loadUser(input.delegatedFrom),
      loadUser(input.delegatedTo),
    ])
    assertOperationalWorkOrder(getWorkOrderLifecycleStatus(workOrder))
    assertAssignableUser(fromUser)
    assertAssignableUser(toUser)

    const entry = delegationEntry({
      delegatedFrom: input.delegatedFrom,
      delegatedTo: input.delegatedTo,
      delegatedBy: input.delegatedBy,
      delegationReason: input.delegationReason.trim(),
      delegationExpiresAt: input.delegationExpiresAt,
      delegationStatus: "ACTIVE",
    })

    const batch = writeBatch(db)
    batch.update(ref, stripUndefined({
      delegatedFrom: entry.delegatedFrom,
      delegatedTo: entry.delegatedTo,
      delegatedBy: entry.delegatedBy,
      delegatedAt: serverTimestamp(),
      delegationReason: entry.delegationReason,
      delegationExpiresAt: entry.delegationExpiresAt,
      delegationStatus: entry.delegationStatus,
      delegationHistory: arrayUnion(stripUndefined(entry)),
      updatedAt: serverTimestamp(),
    }))
    batch.set(doc(collection(db, "activityLogs")), audit({
      actorUid: input.delegatedBy,
      actionKey: "work_order.delegation_created",
      workOrderId: input.workOrderId,
      labelAr: `إنشاء تفويض لأمر العمل من ${entry.delegatedFrom} إلى ${entry.delegatedTo}`,
    }))
    await batch.commit()

    await emitOperationalEventNotifications({
      actorUid: input.delegatedBy,
      event: workOrderEvent({
        eventType: "WORK_ORDER_DELEGATED",
        workOrderId: input.workOrderId,
        title: workOrder.title,
        targetUserIds: [entry.delegatedFrom, entry.delegatedTo],
        requesterId: workOrder.requesterId,
      }),
    })

    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<AdminAssignmentResult>(error)
  }
}

export async function cancelWorkOrderDelegation(
  input: CancelDelegationInput
): Promise<AsyncState<AdminAssignmentResult>> {
  try {
    assertManager(input.actorRole)
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    const batch = writeBatch(db)
    batch.update(ref, stripUndefined({
      delegationStatus: "CANCELLED",
      delegationReason: input.cancellationReason?.trim() || workOrder.delegationReason,
      updatedAt: serverTimestamp(),
    }))
    batch.set(doc(collection(db, "activityLogs")), audit({
      actorUid: input.delegatedBy,
      actionKey: "work_order.delegation_cancelled",
      workOrderId: input.workOrderId,
      labelAr: "إلغاء تفويض أمر العمل",
    }))
    await batch.commit()

    await emitOperationalEventNotifications({
      actorUid: input.delegatedBy,
      event: workOrderEvent({
        eventType: "DELEGATION_CANCELLED",
        workOrderId: input.workOrderId,
        title: workOrder.title,
        targetUserIds: [workOrder.delegatedFrom, workOrder.delegatedTo].filter(
          (uid): uid is string => !!uid
        ),
        requesterId: workOrder.requesterId,
      }),
    })

    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<AdminAssignmentResult>(error)
  }
}

export async function acceptDelegatedTask(
  input: AcceptDelegationInput
): Promise<AsyncState<AdminAssignmentResult>> {
  try {
    const { ref, workOrder } = await loadWorkOrder(input.workOrderId)
    if (workOrder.delegationStatus !== "ACTIVE") throw new Error("No active delegation to accept")
    if (workOrder.delegatedTo !== input.acceptedBy) {
      throw new Error("Only the delegated user can accept this task")
    }

    const entry = delegationEntry({
      delegatedFrom: workOrder.delegatedFrom ?? "",
      delegatedTo: input.acceptedBy,
      delegatedBy: workOrder.delegatedBy ?? input.acceptedBy,
      delegationReason: workOrder.delegationReason ?? "Accepted delegated task",
      delegationExpiresAt: workOrder.delegationExpiresAt?.toDate(),
      delegationStatus: "ACTIVE",
      acceptedAt: Timestamp.now(),
    })

    const batch = writeBatch(db)
    batch.update(ref, stripUndefined({
      assignedTo: input.acceptedBy,
      assigneeId: input.acceptedBy,
      delegationHistory: arrayUnion(stripUndefined(entry)),
      updatedAt: serverTimestamp(),
    }))
    batch.set(doc(collection(db, "activityLogs")), audit({
      actorUid: input.acceptedBy,
      actionKey: "work_order.delegated_task_accepted",
      workOrderId: input.workOrderId,
      labelAr: "قبول مهمة عمل مفوضة",
    }))
    await batch.commit()

    await emitOperationalEventNotifications({
      actorUid: input.acceptedBy,
      event: workOrderEvent({
        eventType: "DELEGATED_TASK_ACCEPTED",
        workOrderId: input.workOrderId,
        title: workOrder.title,
        targetUserIds: [workOrder.delegatedFrom, workOrder.delegatedBy].filter(
          (uid): uid is string => !!uid
        ),
        requesterId: workOrder.requesterId,
      }),
    })

    return doneState({ workOrderId: input.workOrderId })
  } catch (error) {
    return errorState<AdminAssignmentResult>(error)
  }
}

