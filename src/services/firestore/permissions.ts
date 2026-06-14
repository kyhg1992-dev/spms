import type { CollectionName, UserRole } from "@/models/firestore"

type PermissionAction = "create" | "read" | "update" | "delete"
type PermissionSet = Record<PermissionAction, boolean>

type RoleMatrix = Record<CollectionName, PermissionSet>

const fullAccess: PermissionSet = {
  create: true,
  read: true,
  update: true,
  delete: true,
}

const readOnly: PermissionSet = {
  create: false,
  read: true,
  update: false,
  delete: false,
}

/** Create/update/read, no destructive delete — typical manager pattern */
const curator: PermissionSet = {
  create: true,
  read: true,
  update: true,
  delete: false,
}

/** Technicians mutate operational data they execute */
const fieldOps: PermissionSet = {
  create: true,
  read: true,
  update: true,
  delete: false,
}

const woRequesterOps: PermissionSet = {
  create: true,
  read: true,
  update: false,
  delete: false,
}

const rolePermissions: Record<UserRole, RoleMatrix> = {
  admin: {
    users: fullAccess,
    assets: fullAccess,
    workOrders: fullAccess,
    pmSchedules: fullAccess,
    maintenanceTemplates: fullAccess,
    notifications: fullAccess,
    meterReadings: fullAccess,
    activityLogs: curator,
    attachments: fullAccess,
    companySettings: fullAccess,
  },
  manager: {
    users: readOnly,
    assets: curator,
    workOrders: curator,
    pmSchedules: curator,
    maintenanceTemplates: curator,
    notifications: curator,
    meterReadings: curator,
    activityLogs: readOnly,
    attachments: curator,
    companySettings: curator,
  },
  technician: {
    users: readOnly,
    assets: readOnly,
    workOrders: fieldOps,
    pmSchedules: readOnly,
    maintenanceTemplates: readOnly,
    notifications: fieldOps,
    meterReadings: fieldOps,
    activityLogs: { create: true, read: true, update: false, delete: false },
    attachments: fieldOps,
    companySettings: readOnly,
  },
  requester: {
    users: readOnly,
    assets: readOnly,
    workOrders: woRequesterOps,
    pmSchedules: readOnly,
    maintenanceTemplates: readOnly,
    notifications: curator,
    meterReadings: readOnly,
    activityLogs: { create: false, read: false, update: false, delete: false },
    attachments: { create: true, read: true, update: false, delete: false },
    companySettings: readOnly,
  },
}

export function canAccess(
  role: UserRole,
  collection: CollectionName,
  action: PermissionAction
): boolean {
  return rolePermissions[role][collection][action]
}

export { rolePermissions }
export type { PermissionAction, PermissionSet }
