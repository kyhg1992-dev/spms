import { Check, Clock, UserCheck, UserCog, XCircle } from "lucide-react"
import { Fragment, useMemo } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { useUsersQuery } from "@/hooks/use-spms-data"
import { getWorkOrderLifecycleStatus } from "@/lib/work-order-lifecycle"
import { workOrderPendingOwner, type PendingStage } from "@/lib/work-order-pending"
import type { WorkOrder } from "@/models/firestore"

type Step = { key: string; labelAr: string }

const STEPS: Step[] = [
  { key: "open", labelAr: "مفتوح" },
  { key: "assign", labelAr: "إسناد" },
  { key: "execute", labelAr: "تنفيذ" },
  { key: "approve", labelAr: "اعتماد" },
  { key: "close", labelAr: "إغلاق" },
]

const STAGE_ICON: Record<PendingStage, typeof Clock> = {
  assign: UserCog,
  technician: UserCheck,
  approval: Clock,
  done: Check,
}

/** Active step index (where the work order currently sits). Closed → all done. */
function activeStepIndex(wo: WorkOrder & { id: string }): number {
  const status = getWorkOrderLifecycleStatus(wo)
  const hasAssignee = !!(wo.assignedTo?.trim() || wo.assigneeId?.trim())
  switch (status) {
    case "OPEN":
      return hasAssignee ? 2 : 1
    case "ASSIGNED":
    case "IN_PROGRESS":
    case "WAITING_PARTS":
      return 2
    case "WAITING_APPROVAL":
    case "COMPLETED":
      return 3
    case "CLOSED":
      return STEPS.length // all complete
    default:
      return 1
  }
}

/**
 * Horizontal progress stepper for a work order: shows how far it has advanced and,
 * at the active step, exactly whom it is waiting on («الطلب عالق عند …»).
 */
export function WorkOrderProgressStepper({ workOrder }: { workOrder: WorkOrder & { id: string } }) {
  const users = useUsersQuery()
  const status = getWorkOrderLifecycleStatus(workOrder)
  const cancelled = status === "CANCELLED"
  const closed = status === "CLOSED"
  const active = activeStepIndex(workOrder)

  const pending = workOrderPendingOwner(workOrder)
  const PendingIcon = STAGE_ICON[pending.stage]

  const pendingText = useMemo(() => {
    if (closed) return "مكتمل — تمّ الإغلاق"
    if (cancelled) return "أمر العمل ملغى"
    if (pending.userId) {
      const u = users.data?.find((x) => x.id === pending.userId)
      const name = u?.displayName || u?.email || pending.userId.slice(0, 6)
      return `${pending.labelAr}: ${name}`
    }
    return pending.labelAr
  }, [closed, cancelled, pending, users.data])

  if (cancelled) {
    return (
      <Card className="border-destructive/40 shadow-sm print:hidden">
        <CardContent className="flex items-center gap-2 py-3 text-sm font-medium text-destructive">
          <XCircle className="size-4" aria-hidden /> أمر العمل ملغى
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm print:hidden">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              closed
                ? "bg-emerald-100 text-emerald-700"
                : pending.stage === "approval"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-primary/10 text-primary",
            ].join(" ")}
          >
            <PendingIcon className="size-3.5" aria-hidden />
            {closed ? "مكتمل" : "عالق عند"}
          </span>
          <span className="font-medium">{pendingText}</span>
        </div>

        <div className="flex items-center overflow-x-auto pb-1">
          {STEPS.map((step, i) => {
            const done = closed || i < active
            const current = !closed && i === active
            const lineBefore = closed || i <= active
            return (
              <Fragment key={step.key}>
                {i > 0 ? (
                  <div
                    className={["h-0.5 min-w-6 flex-1", lineBefore ? "bg-primary" : "bg-border"].join(" ")}
                    aria-hidden
                  />
                ) : null}
                <div className="flex shrink-0 flex-col items-center gap-1.5 px-1">
                  <div
                    className={[
                      "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : current
                          ? "border-primary bg-background text-primary ring-4 ring-primary/15"
                          : "border-border bg-background text-muted-foreground",
                    ].join(" ")}
                  >
                    {done ? <Check className="size-4" aria-hidden /> : i + 1}
                  </div>
                  <span
                    className={[
                      "whitespace-nowrap text-[11px]",
                      done || current ? "font-medium text-foreground" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {step.labelAr}
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
