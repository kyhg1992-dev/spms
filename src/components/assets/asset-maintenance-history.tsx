import type { Timestamp } from "firebase/firestore"
import { History } from "lucide-react"
import { useMemo } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUsersQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate } from "@/lib/format"
import { workOrderStatusAr } from "@/lib/labels-ar"
import { serviceLevelColor } from "@/lib/spms-colors"
import type { WorkOrder } from "@/models/firestore"

function ts(value: Timestamp | undefined): number {
  return value && typeof value.toMillis === "function" ? value.toMillis() : 0
}

/** Most relevant date for ordering/display: closed → completed → updated → created. */
function effectiveDate(wo: WorkOrder & { id: string }): Timestamp | undefined {
  return wo.closedAt ?? wo.executionCompletedAt ?? wo.updatedAt ?? wo.createdAt
}

/**
 * Cumulative maintenance log for a single asset: every work order ever raised on it,
 * with the action performed, the technician, the approver, and the originating request
 * number — so an asset's full history lives in one place.
 */
export function AssetMaintenanceHistory({ assetId }: { assetId: string }) {
  const { data, isLoading } = useWorkOrdersQuery()
  const users = useUsersQuery()

  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  const rows = useMemo(() => {
    return (data ?? [])
      .filter((wo) => wo.assetId === assetId)
      .sort((a, b) => ts(effectiveDate(b)) - ts(effectiveDate(a)))
  }, [data, assetId])

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" aria-hidden />
          سجل الصيانة التراكمي
        </CardTitle>
        <CardDescription>
          كل أوامر العمل على هذا الأصل: الإجراء، الفنّي، المعتمِد، ورقم الطلب المرجعي.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 px-4 pb-6">
        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground flex min-h-[120px] items-center justify-center text-sm">
            لا توجد أوامر عمل سابقة لهذا الأصل بعد.
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الإجراء / المستوى</TableHead>
                  <TableHead>الفنّي</TableHead>
                  <TableHead>المعتمِد</TableHead>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((wo) => {
                  const color = wo.serviceLevelCode ? serviceLevelColor(wo.serviceLevelCode) : null
                  return (
                    <TableRow key={wo.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm tabular-nums">
                        {formatArDate(effectiveDate(wo))}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <Link
                          to={`/dashboard/work-orders/${wo.id}`}
                          className="text-primary font-medium underline-offset-4 hover:underline"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {color ? (
                              <span
                                className="inline-flex size-5 items-center justify-center rounded text-[10px] font-bold text-white"
                                style={{ backgroundColor: color.solid }}
                              >
                                {wo.serviceLevelCode}
                              </span>
                            ) : null}
                            <span className="line-clamp-1">{wo.serviceLevelNameAr ?? wo.title}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{nameOf(wo.assignedTo ?? wo.assigneeId)}</TableCell>
                      <TableCell className="text-sm">{nameOf(wo.approvedByUid)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums" dir="ltr">
                        {wo.externalRequestNo?.trim() || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{workOrderStatusAr[String(wo.status)] ?? wo.status}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
