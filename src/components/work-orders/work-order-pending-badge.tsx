import { CheckCircle2, Clock, UserCheck, UserCog } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useUsersQuery } from "@/hooks/use-spms-data"
import { workOrderPendingOwner, type PendingStage } from "@/lib/work-order-pending"
import type { WorkOrder } from "@/models/firestore"

const STAGE_ICON: Record<PendingStage, typeof Clock> = {
  assign: UserCog,
  technician: UserCheck,
  approval: Clock,
  done: CheckCircle2,
}

/**
 * Shows where a work order is currently waiting — «الطلب عالق عند …» — resolving
 * the assigned technician's name when the request sits with a specific person.
 */
export function WorkOrderPendingBadge({
  workOrder,
  className,
}: {
  workOrder: Pick<WorkOrder, "status" | "lifecycleStatus" | "assignedTo" | "assigneeId">
  className?: string
}) {
  const users = useUsersQuery()
  const pending = workOrderPendingOwner(workOrder)
  const Icon = STAGE_ICON[pending.stage]

  let label = pending.labelAr
  if (pending.userId) {
    const u = users.data?.find((x) => x.id === pending.userId)
    const name = u?.displayName || u?.email || pending.userId.slice(0, 6)
    label = `${pending.labelAr}: ${name}`
  }

  const variant =
    pending.stage === "done" ? "secondary" : pending.stage === "approval" ? "default" : "outline"

  return (
    <Badge variant={variant} className={["gap-1", className].filter(Boolean).join(" ")}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Badge>
  )
}
