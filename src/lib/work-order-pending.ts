import type { WorkOrder } from "@/models/firestore"

/** Which step of the workflow a work order is currently waiting on. */
export type PendingStage = "assign" | "technician" | "approval" | "done"

export type PendingOwner = {
  stage: PendingStage
  /** UID of the user the work order is waiting on, when it is a specific person. */
  userId?: string
  /** Arabic description of where the request is stuck. */
  labelAr: string
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
    return { stage: "done", labelAr: "مكتمل — لا شيء معلّق" }
  }
  if (status === "WAITING_APPROVAL" || status === "COMPLETED") {
    return { stage: "approval", labelAr: "بانتظار اعتماد المدير" }
  }
  if (status === "WAITING_PARTS") {
    return assignee
      ? { stage: "technician", userId: assignee, labelAr: "عند الفنّي (بانتظار قطع غيار)" }
      : { stage: "approval", labelAr: "بانتظار قطع الغيار" }
  }
  if (assignee && (status === "ASSIGNED" || status === "IN_PROGRESS")) {
    return { stage: "technician", userId: assignee, labelAr: "عند الفنّي المُسنَد" }
  }
  if (assignee) {
    return { stage: "technician", userId: assignee, labelAr: "عند الفنّي المُسنَد" }
  }
  return { stage: "assign", labelAr: "بانتظار الإسناد من المدير" }
}
