import type { WorkOrder } from "@/models/firestore"

/** Which step of the workflow a work order is currently waiting on. */
export type PendingStage = "assign" | "technician" | "approval" | "done"

export type PendingOwner = {
  stage: PendingStage
  /** UID of the user the work order is waiting on, when it is a specific person. */
  userId?: string
  /** Arabic description of where the request is stuck. */
  labelAr: string
  /** i18n key for the label (use with t()). */
  labelKey: string
}

/**
 * Resolve the user/role a work order is currently "stuck" at, so the UI can show
 * «الطلب عالق عند …». Driven by status (lifecycleStatus when present, else status):
 *  - open & unassigned        → waiting for a manager to assign
 *  - assigned/in progress/...  → waiting on the assigned technician
 *  - waiting approval/done     → waiting on a manager to approve
 *  - closed/cancelled          → nothing pending
 */
export function workOrderPendingOwner(wo: Pick<
  WorkOrder,
  "status" | "lifecycleStatus" | "assignedTo" | "assigneeId"
>): PendingOwner {
  const status = String(wo.lifecycleStatus ?? wo.status ?? "").toUpperCase()
  const assignee = wo.assignedTo ?? wo.assigneeId

  if (status === "CLOSED" || status === "CANCELLED") {
    return { stage: "done", labelAr: "مكتمل — لا شيء معلّق", labelKey: "pending.done" }
  }
  if (status === "WAITING_APPROVAL" || status === "COMPLETED") {
    return { stage: "approval", labelAr: "بانتظار اعتماد المدير", labelKey: "pending.approval" }
  }
  if (status === "WAITING_PARTS") {
    return assignee
      ? { stage: "technician", userId: assignee, labelAr: "عند الفنّي (بانتظار قطع غيار)", labelKey: "pending.waitingPartsTech" }
      : { stage: "approval", labelAr: "بانتظار قطع الغيار", labelKey: "pending.waitingParts" }
  }
  if (assignee) {
    return { stage: "technician", userId: assignee, labelAr: "عند الفنّي المُسنَد", labelKey: "pending.technician" }
  }
  return { stage: "assign", labelAr: "بانتظار الإسناد من المدير", labelKey: "pending.assign" }
}
