import { Inbox } from "lucide-react"
import { useMemo } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useI18n, useLabels } from "@/i18n/i18n"
import { useUsersQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { MODULE_COLOR } from "@/lib/spms-colors"
import { workOrderPendingOwner } from "@/lib/work-order-pending"
import type { UserRole, WorkOrder } from "@/models/firestore"

function isPendingForMe(wo: WorkOrder, role: UserRole, uid: string): boolean {
  const p = workOrderPendingOwner(wo)
  if (p.stage === "done") return false
  if (role === "technician") return p.stage === "technician" && p.userId === uid
  if (role === "admin" || role === "manager") return p.stage === "assign" || p.stage === "approval"
  if (role === "requester") return wo.requesterId === uid
  return false
}

/** Each user's own queue: work orders currently waiting on their action. */
export function MyPendingCard() {
  const { t } = useI18n()
  const L = useLabels()
  const { spmsRole, user } = useAuth()
  const { data } = useWorkOrdersQuery()
  const users = useUsersQuery()

  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  const mine = useMemo(() => {
    if (!spmsRole || !user?.uid) return []
    return (data ?? []).filter((wo) => isPendingForMe(wo, spmsRole, user.uid))
  }, [data, spmsRole, user?.uid])

  return (
    <Card className="overflow-hidden rounded-xl border border-border/80 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <span
              className="flex size-7 items-center justify-center rounded-md"
              style={{ color: MODULE_COLOR.workOrders, backgroundColor: `${MODULE_COLOR.workOrders}1a` }}
            >
              <Inbox className="size-4" aria-hidden />
            </span>
            {t("dash.myPending")}
          </CardTitle>
          <CardDescription className="mt-1">{t("dash.myPendingHint")}</CardDescription>
        </div>
        <Badge variant="secondary" className="text-base tabular-nums">{mine.length}</Badge>
      </CardHeader>
      <CardContent>
        {mine.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{t("dash.noPending")}</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((wo) => {
              const p = workOrderPendingOwner(wo)
              return (
                <li key={wo.id}>
                  <Link
                    to={`/dashboard/work-orders/${wo.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-medium">{wo.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {t(p.labelKey)}
                        {p.userId ? `: ${nameOf(p.userId)}` : ""}
                      </span>
                    </span>
                    <Badge variant="outline" className="shrink-0">{L.woStatus(String(wo.status))}</Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
