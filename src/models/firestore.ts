import type { Timestamp } from "firebase/firestore"

type UserRole = "admin" | "manager" | "technician" | "requester"

/** Enterprise work order statuses (legacy `on_hold` maps to `waiting_parts`). */
export type WorkOrderStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "waiting_parts"
  | "waiting_approval"
  | "completed"
  | "closed"
  | "cancelled"

/** Back-compat exported string union used in validators */
export type LegacyWorkOrderStatusForRead = WorkOrderStatus | "on_hold"
export type WorkOrderLifecycleStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED"

export type WorkOrderPriority = "low" | "medium" | "high" | "critical"
export type AssetStatus = "active" | "maintenance" | "retired"

export type NotificationType = "work_order" | "pm_schedule" | "asset" | "system"
export type NotificationChannel = "in_app" | "email"
export type NotificationPriority = "low" | "normal" | "high" | "critical"
export type OperationalNotificationPriority = "INFO" | "WARNING" | "CRITICAL"
export type OperationalEventType =
  | "PM_DUE_SOON"
  | "PM_OVERDUE"
  | "PM_WORK_ORDER_GENERATED"
  | "PM_COMPLETED_NEXT_SCHEDULED"
  | "WORK_ORDER_ASSIGNED"
  | "WORK_ORDER_REASSIGNED"
  | "WORK_ORDER_COMPLETED"
  | "WORK_ORDER_WAITING_APPROVAL"
  | "APPROVAL_ACCEPTED"
  | "APPROVAL_REJECTED"
  | "METER_ANOMALY_DETECTED"
  | "WORK_ORDER_DELEGATED"
  | "DELEGATION_CANCELLED"
  | "DELEGATED_TASK_ACCEPTED"

/** PM classification (service codes). Any English letter A–Z is allowed so each
 * vehicle/equipment family can use its own coding scheme. */
export type PMServiceType =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z"
export type PMTriggerMode = "time" | "hours" | "km" | "both"
export type PMStatus = "OK" | "DUE_SOON" | "OVERDUE" | "CRITICAL"

export type MeterReadingKind = "operating_hours" | "odometer"

export type AttachmentLinkType = "asset" | "work_order" | "pm_schedule"

export type WorkOrderReassignmentEntry = {
  assignedTo: string
  assignedBy: string
  reassignedAt: Timestamp
  reassignmentReason: string
  previousAssignedTo?: string
}

export type WorkOrderDelegationStatus = "ACTIVE" | "EXPIRED" | "CANCELLED"

export type WorkOrderDelegationEntry = {
  delegatedFrom: string
  delegatedTo: string
  delegatedBy: string
  delegatedAt: Timestamp
  delegationReason: string
  delegationExpiresAt?: Timestamp
  delegationStatus: WorkOrderDelegationStatus
  acceptedAt?: Timestamp
}

export type WorkOrderExecutionChecklistItem = {
  id: string
  labelAr: string
  labelEn?: string
  isDone: boolean
  checkedAt?: Timestamp
  note?: string
}

export type WorkOrderExecutionMeterReading = {
  kind: MeterReadingKind
  value: number
  readingId?: string
  capturedAt?: Timestamp
}

export type BaseDoc = {
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** SPMS operator profile synced with Firebase Auth UID as document ID in most flows. */
export type SpmsUser = BaseDoc & {
  email: string
  displayName: string
  role: UserRole
  phone?: string
  isActive: boolean
  /** Department code for routing & reporting */
  departmentId?: string
  /** Technician focus e.g. electrical, hydraulic */
  specialization?: string
}

export type Asset = BaseDoc & {
  assetCode: string
  assetName: string
  category: string
  brand: string
  model: string
  serialNo: string
  plateNo: string
  department: string
  location: string
  /** Equipment class code (e.g. GNR, LDR, VAN). */
  equipmentClass?: string
  /** Branch code. */
  branch?: string
  /** Responsible business unit. */
  businessUnit?: string
  /** Geographic coordinates captured at registration (for the fleet map). */
  latitude?: number
  longitude?: number
  operatingHours: number
  odometer: number
  status: AssetStatus
  purchaseDate?: Timestamp
  warrantyExpiry?: Timestamp
  assignedToUid?: string
  vendorName?: string
  sparePartsNote?: string
  documentsMeta?: string
  notes: string
  imageUrl: string
  /** Optional persisted deep-link or storage path for QR (usually derived client-side). */
  qrPayload?: string
  /** Maintenance template assigned to this asset (drives its A/B/C/D rotation). */
  maintenanceTemplateId?: string
  /** Last service level performed — the rotation's current position (continuation). */
  lastServiceCode?: PMServiceType
  /** Meter reading (per template trigger) at the last performed service. */
  lastServiceReading?: number
  /** Legacy migrations */
  manufacturer?: string
  serialNumber?: string
  installedAt?: Timestamp
  lastServiceAt?: Timestamp
}

export type WorkOrder = BaseDoc & {
  title: string
  description: string
  assetId: string
  requesterId: string
  assigneeId?: string
  assignedTo?: string
  assignedBy?: string
  reassignedAt?: Timestamp
  reassignmentReason?: string
  reassignmentHistory?: WorkOrderReassignmentEntry[]
  delegatedFrom?: string
  delegatedTo?: string
  delegatedBy?: string
  delegatedAt?: Timestamp
  delegationReason?: string
  delegationExpiresAt?: Timestamp
  delegationStatus?: WorkOrderDelegationStatus
  delegationHistory?: WorkOrderDelegationEntry[]
  status: WorkOrderStatus | LegacyWorkOrderStatusForRead
  lifecycleStatus?: WorkOrderLifecycleStatus
  priority: WorkOrderPriority
  dueDate?: Timestamp
  closedAt?: Timestamp
  closedByUid?: string
  executionStartedAt?: Timestamp
  executionCompletedAt?: Timestamp
  technicianNotes?: string
  laborHours?: number
  downtimeMinutes?: number
  downtimeHours?: number
  completionNotes?: string
  actualLaborHours?: number
  actualDowntimeHours?: number
  meterReadingAtExecution?: WorkOrderExecutionMeterReading
  executionChecklist?: WorkOrderExecutionChecklistItem[]
  executionPhotos?: string[]
  requiredPartsNote?: string
  safetyNotes?: string
  completionMeterReadingId?: string
  attachmentsPlaceholder?: string[]
  internalNotes?: string
  estimatedCost?: number
  actualCost?: number
  approvalRequired?: boolean
  approvedByUid?: string
  approvedAt?: Timestamp
  rejectedAt?: Timestamp
  rejectedByUid?: string
  rejectionReason?: string
  pmScheduleId?: string
  sourceType?: "PM" | "MANUAL" | "REQUEST"
  sourceRef?: string
  /** Service level (A/B/C/D) this PM work order performs, from the maintenance template. */
  serviceLevelCode?: MaintenanceServiceCode
  serviceLevelNameAr?: string
  /** Full task list inherited from the template level (checklist + part requirements). */
  serviceTasks?: MaintenanceServiceTask[]
  /** WO workflow comment thread (minimal v1 single text / future subcollection friendly) */
  lastPublicComment?: string
}

export type PMSchedule = BaseDoc & {
  assetId: string
  title: string
  serviceType: PMServiceType
  /** Calendar-based recurrence in days when trigger includes time */
  frequencyDays: number
  nextRunAt: Timestamp
  lastRunAt?: Timestamp
  isActive: boolean
  triggerMode: PMTriggerMode
  /** Thresholds for meter-based triggers */
  nextDueHours?: number
  nextDueKm?: number
  overdueStatus?: boolean
  dueSoonStatus?: boolean
  pmStatus?: PMStatus
  meterHoursInterval?: number
  meterKmInterval?: number
  /** When true, completion flow should enqueue a WO (handled by automation or manual). */
  autoCreateWorkOrder?: boolean
  templateCode?: string
  lastCompletedWorkOrderId?: string
  lastGeneratedWorkOrderId?: string
  /** Document id of the {@link MaintenanceSequenceTemplate} driving the A/B/C/D rotation. */
  maintenanceTemplateId?: string
  /** Meter value (per template `meterKind`) recorded at the last completed service. */
  lastServiceReading?: number
}

/** Service codes used by maintenance sequence templates (mirrors PM service classes). */
export type MaintenanceServiceCode = PMServiceType

/** What drives a template's rotation: operating hours, odometer km, or calendar time. */
export type MaintenanceTriggerMode = "hours" | "km" | "time"

/** Maintenance action verbs (bilingual at display time). */
export type MaintenanceActionCode =
  | "REPLACE"
  | "CLEAN"
  | "CHECK"
  | "DRAIN"
  | "GREASE"
  | "ADJUST"
  | "WASH"
  | "REFILL"

/** A single line in a service level's checklist — also the part requirement (inventory link). */
export type MaintenanceServiceTask = {
  descAr: string
  descEn?: string
  /** Internal inventory item code, e.g. "OE001TUR002D". */
  itemCode?: string
  /** Quantity string as printed (e.g. "23", "1", "kg", "—"). */
  qty?: string
  action: MaintenanceActionCode
  /** OEM part number or free note (e.g. "6736-51-5142", "عند الحاجة"). */
  partNo?: string
}

/** One service level (A/B/C/D) with its full execution checklist. */
export type MaintenanceServiceLevel = {
  code: MaintenanceServiceCode
  nameAr: string
  nameEn?: string
  tasks: MaintenanceServiceTask[]
}

/**
 * A reusable A/B/C/D maintenance template bound to an asset type/model.
 *
 * The rotation: an asset advances one step along `sequence` each time its meter
 * accrues `stepInterval` units (per `triggerMode`/`meterKind`); the sequence is
 * cyclic. Each level in `levels` carries the full bilingual task checklist that
 * a generated work order inherits. This is the data the engine (`getNextCode`)
 * and work-order generation consume.
 */
export type MaintenanceSequenceTemplate = BaseDoc & {
  /** Human-facing identifier, e.g. "PM-FLT-STD". */
  templateCode: string
  /** Display name (Arabic-friendly). */
  name: string
  /** Asset type/model this template applies to, e.g. "رافعة كوماتسو WA380-6". */
  assetTypeLabel?: string
  /** Ordered, cyclic list of service codes performed in turn. Must be non-empty. */
  sequence: MaintenanceServiceCode[]
  /** Meter/time delta between consecutive steps (e.g. 250 hours). */
  stepInterval: number
  /** Which meter drives the sequence (legacy; derived from triggerMode). */
  meterKind: MeterReadingKind
  /** Hours / km / calendar time trigger. */
  triggerMode?: MaintenanceTriggerMode
  /** Per-level execution checklists (A/B/C/D). */
  levels?: MaintenanceServiceLevel[]
  isActive: boolean
  description?: string
}

export type Notification = BaseDoc & {
  userId: string
  targetRole?: UserRole
  type: NotificationType
  channel: NotificationChannel
  priority: NotificationPriority
  eventPriority?: OperationalNotificationPriority
  eventType?: OperationalEventType
  eventKey?: string
  title: string
  body: string
  isRead: boolean
  readAt?: Timestamp
  isArchived?: boolean
  archivedAt?: Timestamp
  archiveReason?: string
  refPath?: string
  deliveryPayload?: Record<string, unknown>
}

export type MeterReading = BaseDoc & {
  assetId: string
  kind: MeterReadingKind
  value: number
  deltaFromPrevious?: number
  note?: string
  enteredByUid: string
  /** Soft validation flag — operator may override */
  anomalyFlag?: boolean
}

export type ActivityLogEntry = BaseDoc & {
  actorUid: string
  actionKey: string
  entityType: string
  entityId: string
  labelAr: string
}

export type AttachmentDoc = BaseDoc & {
  linkType: AttachmentLinkType
  linkId: string
  fileName: string
  storageUrl: string
  mimeType?: string
  uploadedByUid: string
}

export type CompanySettings = BaseDoc & {
  docKey: string
  companyNameAr: string
  timezone: string
  locale: string
  /** Company logo as a base64 data URL (Storage-free); shown on dashboard, reports, cards. */
  logoDataUrl?: string
  /** Site-code → city aliases for the fleet map, one per line: "VMM101=الرياض". */
  locationAliases?: string
  defaultPmReminderDays?: number
  meterAnomalyPct?: number
  maintenanceAnnualBudget?: number
  weekendDays?: number[]
  officialHolidays?: string[]
  shutdownPeriods?: Array<{ from: string; to: string; reason?: string }>
  quietHours?: { start: string; end: string }
  workshopOperatingHours?: { start: string; end: string }
}

export type SpmsCollectionMap = {
  users: SpmsUser
  assets: Asset
  workOrders: WorkOrder
  pmSchedules: PMSchedule
  maintenanceTemplates: MaintenanceSequenceTemplate
  notifications: Notification
  meterReadings: MeterReading
  activityLogs: ActivityLogEntry
  attachments: AttachmentDoc
  companySettings: CompanySettings
}

export type CollectionName = keyof SpmsCollectionMap
export type SpmsEntity = SpmsCollectionMap[CollectionName]

export type { UserRole }
