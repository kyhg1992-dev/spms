import type {
  ActivityLogEntry,
  Asset,
  AttachmentDoc,
  CollectionName,
  CompanySettings,
  MaintenanceSequenceTemplate,
  MeterReading,
  Notification,
  PMSchedule,
  SpmsCollectionMap,
  SpmsEntity,
  SpmsUser,
  UserRole,
  WorkOrder,
  WorkOrderLifecycleStatus,
} from "@/models/firestore"

import {
  bulkCreate,
  bulkDelete,
  createOne,
  createWithId,
  getOne,
  listMany,
  removeOne,
  updateOne,
  type AsyncState,
} from "@/services/firestore/crud"
import { canAccess } from "@/services/firestore/permissions"
import {
  acceptDelegatedTask,
  adminReassignWorkOrder,
  cancelWorkOrderDelegation,
  createWorkOrderDelegation,
} from "@/services/firestore/admin-delegation-service"
import {
  archiveNotification,
  emitOperationalEventNotifications,
  markNotificationRead,
} from "@/services/firestore/notification-engine-service"
import type { OperationalEventPayload } from "@/lib/notification-engine"
import {
  recalculatePMSchedulesForAsset,
  recordMeterReadingAndRunPMEngine,
} from "@/services/firestore/pm-engine-service"
import {
  completePMThroughWorkOrder,
  generateServiceWorkOrderFromAsset,
  generateWorkOrderFromPMSchedule,
} from "@/services/firestore/pm-work-order-service"
import {
  approveWorkOrderLifecycle,
  closeWorkOrderLifecycle,
  finalizeWorkOrderLifecycle,
  reassignWorkOrderLifecycle,
  rejectWorkOrderLifecycle,
  transitionWorkOrderLifecycle,
} from "@/services/firestore/work-order-lifecycle-service"
import type { WorkOrderCompletionData } from "@/lib/work-order-lifecycle"
import {
  addExecutionNote,
  completeExecution,
  saveExecutionDraft,
  startExecution,
} from "@/services/firestore/technician-execution-service"
import type { TechnicianExecutionDraft } from "@/lib/technician-execution"
import {
  loadMaintenanceTemplates,
  resolveNextCodeForAsset,
} from "@/services/firestore/maintenance-sequence-service"
import type { MaintenanceServiceCode } from "@/models/firestore"

function forbidden<T>(): AsyncState<T> {
  return { loading: false, data: null, error: "Permission denied" }
}

async function createEntity<K extends CollectionName>(
  role: UserRole,
  collection: K,
  payload: Omit<SpmsCollectionMap[K], "id" | "createdAt" | "updatedAt">
): Promise<AsyncState<string>> {
  if (!canAccess(role, collection, "create")) return forbidden<string>()
  return createOne(collection, payload)
}

async function updateEntity<K extends CollectionName>(
  role: UserRole,
  collection: K,
  id: string,
  payload: Partial<Omit<SpmsCollectionMap[K], "id" | "createdAt" | "updatedAt">>
): Promise<AsyncState<boolean>> {
  if (!canAccess(role, collection, "update")) return forbidden<boolean>()
  return updateOne(collection, id, payload)
}

async function deleteEntity(
  role: UserRole,
  collection: CollectionName,
  id: string
): Promise<AsyncState<boolean>> {
  if (!canAccess(role, collection, "delete")) return forbidden<boolean>()
  return removeOne(collection, id)
}

async function getEntity<K extends CollectionName>(
  role: UserRole,
  collection: K,
  id: string
): Promise<AsyncState<SpmsCollectionMap[K]>> {
  if (!canAccess(role, collection, "read")) return forbidden<SpmsCollectionMap[K]>()
  return getOne<SpmsCollectionMap[K]>(collection, id)
}

async function listEntity<K extends CollectionName>(
  role: UserRole,
  collection: K
): Promise<AsyncState<Array<SpmsCollectionMap[K]>>> {
  if (!canAccess(role, collection, "read")) return forbidden<Array<SpmsCollectionMap[K]>>()
  return listMany<SpmsCollectionMap[K]>(collection, { orderByField: "updatedAt" })
}

export async function createUser(
  role: UserRole,
  uid: string,
  payload: Omit<SpmsUser, "id" | "createdAt" | "updatedAt">
) {
  if (!canAccess(role, "users", "create")) return forbidden<string>()
  return createWithId("users", uid, payload)
}

export async function getUser(role: UserRole, uid: string) {
  return getEntity(role, "users", uid)
}

export async function listUsers(role: UserRole) {
  return listEntity(role, "users")
}

export async function updateUser(
  role: UserRole,
  uid: string,
  payload: Partial<Omit<SpmsUser, "id" | "createdAt" | "updatedAt">>
) {
  return updateEntity(role, "users", uid, payload)
}

export async function deleteUser(role: UserRole, uid: string) {
  return deleteEntity(role, "users", uid)
}

export async function createAsset(
  role: UserRole,
  payload: Omit<Asset, "id" | "createdAt" | "updatedAt">
) {
  return createEntity(role, "assets", payload)
}

export async function getAsset(role: UserRole, id: string) {
  return getEntity(role, "assets", id)
}

export async function listAssets(role: UserRole) {
  return listEntity(role, "assets")
}

export async function updateAsset(
  role: UserRole,
  id: string,
  payload: Partial<Omit<Asset, "id" | "createdAt" | "updatedAt">>
) {
  return updateEntity(role, "assets", id, payload)
}

export async function deleteAsset(role: UserRole, id: string) {
  return deleteEntity(role, "assets", id)
}

export async function bulkCreateAssets(
  role: UserRole,
  payloads: Array<Omit<Asset, "id" | "createdAt" | "updatedAt">>,
  onProgress?: (done: number, total: number) => void
) {
  if (!canAccess(role, "assets", "create")) return forbidden<number>()
  return bulkCreate("assets", payloads, onProgress)
}

export async function bulkDeleteAssets(
  role: UserRole,
  ids: string[],
  onProgress?: (done: number, total: number) => void
) {
  if (!canAccess(role, "assets", "delete")) return forbidden<number>()
  return bulkDelete("assets", ids, onProgress)
}

export async function createWorkOrder(
  role: UserRole,
  payload: Omit<WorkOrder, "id" | "createdAt" | "updatedAt">
) {
  return createEntity(role, "workOrders", payload)
}

export async function getWorkOrder(role: UserRole, id: string) {
  return getEntity(role, "workOrders", id)
}

export async function listWorkOrders(role: UserRole) {
  return listEntity(role, "workOrders")
}

export async function updateWorkOrder(
  role: UserRole,
  id: string,
  payload: Partial<Omit<WorkOrder, "id" | "createdAt" | "updatedAt">>
) {
  return updateEntity(role, "workOrders", id, payload)
}

export async function deleteWorkOrder(role: UserRole, id: string) {
  return deleteEntity(role, "workOrders", id)
}

export async function deleteMeterReading(role: UserRole, id: string) {
  return deleteEntity(role, "meterReadings", id)
}

export async function transitionWorkOrder(
  role: UserRole,
  input: {
    workOrderId: string
    targetStatus: WorkOrderLifecycleStatus
    actorUid: string
    completionData?: WorkOrderCompletionData
    assignedTo?: string
    approvalRequired?: boolean
  }
) {
  return transitionWorkOrderLifecycle({
    workOrderId: input.workOrderId,
    targetStatus: input.targetStatus,
    actorUid: input.actorUid,
    actorRole: role,
    completionData: input.completionData,
    assignedTo: input.assignedTo,
    approvalRequired: input.approvalRequired,
  })
}

export async function reassignWorkOrder(
  role: UserRole,
  input: {
    workOrderId: string
    assignedTo: string
    assignedBy: string
    reassignmentReason: string
  }
) {
  return reassignWorkOrderLifecycle({ ...input, actorRole: role })
}

export async function adminReassignWorkOrderControlled(
  role: UserRole,
  input: {
    workOrderId: string
    newAssigneeUid: string
    reassignedBy: string
    reassignmentReason: string
  }
) {
  return adminReassignWorkOrder({ ...input, actorRole: role })
}

export async function createDelegation(
  role: UserRole,
  input: {
    workOrderId: string
    delegatedFrom: string
    delegatedTo: string
    delegatedBy: string
    delegationReason: string
    delegationExpiresAt?: Date
  }
) {
  return createWorkOrderDelegation({ ...input, actorRole: role })
}

export async function cancelDelegation(
  role: UserRole,
  input: {
    workOrderId: string
    delegatedBy: string
    cancellationReason?: string
  }
) {
  return cancelWorkOrderDelegation({ ...input, actorRole: role })
}

export async function acceptDelegation(workOrderId: string, acceptedBy: string) {
  return acceptDelegatedTask({ workOrderId, acceptedBy })
}

export async function approveWorkOrder(role: UserRole, workOrderId: string, actorUid: string) {
  return approveWorkOrderLifecycle({ workOrderId, actorUid, actorRole: role })
}

export async function rejectWorkOrder(
  role: UserRole,
  input: { workOrderId: string; actorUid: string; rejectionReason: string }
) {
  return rejectWorkOrderLifecycle({ ...input, actorRole: role })
}

export async function closeWorkOrder(role: UserRole, workOrderId: string, actorUid: string) {
  return closeWorkOrderLifecycle({ workOrderId, actorUid, actorRole: role })
}

/** One-click approve + close + advance rotation. */
export async function finalizeWorkOrder(role: UserRole, workOrderId: string, actorUid: string) {
  return finalizeWorkOrderLifecycle({ workOrderId, actorUid, actorRole: role })
}

export async function startTechnicianExecution(
  role: UserRole,
  workOrderId: string,
  technicianUid: string
) {
  return startExecution({ workOrderId, technicianUid, actorRole: role })
}

export async function saveTechnicianExecutionDraft(
  role: UserRole,
  input: {
    workOrderId: string
    technicianUid: string
    draft: TechnicianExecutionDraft
  }
) {
  return saveExecutionDraft({ ...input, actorRole: role })
}

export async function completeTechnicianExecution(
  role: UserRole,
  input: {
    workOrderId: string
    technicianUid: string
    draft: TechnicianExecutionDraft
  }
) {
  return completeExecution({ ...input, actorRole: role })
}

export async function addTechnicianExecutionNote(
  role: UserRole,
  input: {
    workOrderId: string
    technicianUid: string
    note: string
  }
) {
  return addExecutionNote({ ...input, actorRole: role })
}

export async function createPMSchedule(
  role: UserRole,
  payload: Omit<PMSchedule, "id" | "createdAt" | "updatedAt">
) {
  return createEntity(role, "pmSchedules", payload)
}

export async function getPMSchedule(role: UserRole, id: string) {
  return getEntity(role, "pmSchedules", id)
}

export async function listPMSchedules(role: UserRole) {
  return listEntity(role, "pmSchedules")
}

export async function updatePMSchedule(
  role: UserRole,
  id: string,
  payload: Partial<Omit<PMSchedule, "id" | "createdAt" | "updatedAt">>
) {
  return updateEntity(role, "pmSchedules", id, payload)
}

export async function deletePMSchedule(role: UserRole, id: string) {
  return deleteEntity(role, "pmSchedules", id)
}

export async function generatePMWorkOrder(
  role: UserRole,
  input: { pmScheduleId: string; actorUid: string }
) {
  return generateWorkOrderFromPMSchedule({ ...input, role })
}

export async function completePMFromWorkOrder(
  role: UserRole,
  input: { pmScheduleId: string; workOrderId: string; actorUid: string }
) {
  return completePMThroughWorkOrder({ ...input, role })
}

export async function generateAssetServiceWorkOrder(
  role: UserRole,
  input: { assetId: string; actorUid: string }
) {
  return generateServiceWorkOrderFromAsset({ ...input, role })
}

/** -------- Maintenance sequence templates (A/B/C/D engine) -------- */

export async function createMaintenanceTemplate(
  role: UserRole,
  payload: Omit<MaintenanceSequenceTemplate, "id" | "createdAt" | "updatedAt">
) {
  return createEntity(role, "maintenanceTemplates", payload)
}

export async function getMaintenanceTemplate(role: UserRole, id: string) {
  return getEntity(role, "maintenanceTemplates", id)
}

export async function listMaintenanceTemplates(role: UserRole) {
  return listEntity(role, "maintenanceTemplates")
}

export async function updateMaintenanceTemplate(
  role: UserRole,
  id: string,
  payload: Partial<Omit<MaintenanceSequenceTemplate, "id" | "createdAt" | "updatedAt">>
) {
  return updateEntity(role, "maintenanceTemplates", id, payload)
}

export async function deleteMaintenanceTemplate(role: UserRole, id: string) {
  return deleteEntity(role, "maintenanceTemplates", id)
}

/** Load all templates into the engine registry (call on session start). */
export async function primeMaintenanceTemplates(role: UserRole) {
  return loadMaintenanceTemplates(role)
}

/** Compute the next service code for an asset using its sequence template. */
export async function getNextMaintenanceCode(
  role: UserRole,
  input: {
    templateId: string
    assetId: string
    lastCode: MaintenanceServiceCode | null
    lastReading: number
  }
) {
  return resolveNextCodeForAsset(role, input)
}

export async function createNotification(
  role: UserRole,
  payload: Omit<Notification, "id" | "createdAt" | "updatedAt">
) {
  return createEntity(role, "notifications", payload)
}

export async function getNotification(role: UserRole, id: string) {
  return getEntity(role, "notifications", id)
}

export async function listNotifications(role: UserRole, viewerUid?: string) {
  if (!canAccess(role, "notifications", "read"))
    return forbidden<Array<Notification & { id: string }>>()
  const canReadAll = role === "admin" || role === "manager"
  if (!canReadAll) {
    if (!viewerUid) return forbidden<Array<Notification & { id: string }>>()
    return listMany<Notification>("notifications", {
      orderByField: "updatedAt",
      whereClauses: [{ field: "userId", op: "==", value: viewerUid }],
    })
  }
  return listMany<Notification>("notifications", { orderByField: "updatedAt" })
}

export async function updateNotification(
  role: UserRole,
  id: string,
  payload: Partial<Omit<Notification, "id" | "createdAt" | "updatedAt">>
) {
  return updateEntity(role, "notifications", id, payload)
}

export async function deleteNotification(role: UserRole, id: string) {
  return deleteEntity(role, "notifications", id)
}

export async function emitOperationalNotificationEvent(
  _role: UserRole,
  input: { event: OperationalEventPayload; actorUid: string }
) {
  return emitOperationalEventNotifications(input)
}

export async function markOperationalNotificationRead(
  _role: UserRole,
  notificationId: string,
  isRead = true,
  actorUid?: string
) {
  return markNotificationRead(notificationId, isRead, actorUid)
}

export async function archiveOperationalNotification(
  _role: UserRole,
  input: { notificationId: string; archiveReason?: string; actorUid?: string }
) {
  return archiveNotification(input)
}

export async function listCollection(
  role: UserRole,
  collection: CollectionName,
  viewerUid?: string
): Promise<AsyncState<SpmsEntity[]>> {
  if (!canAccess(role, collection, "read")) return forbidden<SpmsEntity[]>()
  if (collection === "notifications") {
    const result = await listNotifications(role, viewerUid)
    return result as AsyncState<SpmsEntity[]>
  }
  return listMany<SpmsEntity>(collection, { orderByField: "updatedAt" })
}

/** -------- Meter readings & attachments (operational) -------- */

export async function createMeterReading(
  role: UserRole,
  payload: Omit<MeterReading, "id" | "createdAt" | "updatedAt">
) {
  return createEntity(role, "meterReadings", payload)
}

export async function createMeterReadingWithPMEngine(
  role: UserRole,
  payload: Omit<MeterReading, "id" | "createdAt" | "updatedAt">
) {
  return recordMeterReadingAndRunPMEngine(role, {
    assetId: payload.assetId,
    kind: payload.kind,
    value: payload.value,
    note: payload.note,
    enteredByUid: payload.enteredByUid,
  })
}

export async function recalculateAssetPMEngine(
  role: UserRole,
  assetId: string,
  actorUid: string
) {
  return recalculatePMSchedulesForAsset(role, { assetId, actorUid })
}

export async function createAttachment(role: UserRole, payload: Omit<AttachmentDoc, "id" | "createdAt" | "updatedAt">) {
  return createEntity(role, "attachments", payload)
}

export async function deleteAttachment(role: UserRole, id: string) {
  return deleteEntity(role, "attachments", id)
}

/** -------- Org settings singleton (`main`) -------- */

export async function getCompanySettings(role: UserRole) {
  return getEntity(role, "companySettings", "main")
}

export async function updateCompanySettings(
  role: UserRole,
  payload: Partial<Omit<CompanySettings, "id" | "createdAt" | "updatedAt">>
) {
  return updateEntity(role, "companySettings", "main", payload)
}

/** -------- Observability -------- */

export async function listActivityLogs(role: UserRole) {
  return listEntity(role, "activityLogs")
}

export async function deleteActivityLog(role: UserRole, id: string) {
  return deleteEntity(role, "activityLogs", id)
}

export async function appendActivityStructured(
  role: UserRole,
  payload: Omit<ActivityLogEntry, "id" | "createdAt" | "updatedAt">
): Promise<AsyncState<string>> {
  if (!canAccess(role, "activityLogs", "create")) return forbidden<string>()
  return createOne("activityLogs", payload)
}
