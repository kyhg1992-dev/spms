import { Plus } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WorkOrderPendingBadge } from "@/components/work-orders/work-order-pending-badge"
import { useAssetsQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate } from "@/lib/format"
import { workOrderPriorityAr, workOrderStatusAr } from "@/lib/labels-ar"

export default function WorkOrdersListPage() {
  const { data, isLoading, error } = useWorkOrdersQuery()
  const assets = useAssetsQuery()

  const assetNameById = new Map((assets.data ?? []).map((a) => [a.id, a.assetName]))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight md:text-3xl">أوامر العمل التنفيذية</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            منسّقة لسير عمل مؤسسي — تتبّع الحالات، الإسناد، والجوانب المالية.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" disabled>
          <Plus className="size-4" aria-hidden />
          إنشاء WO (قريباً)
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm">تعذر تحميل أوامر العمل.</p> : null}

      <Card className="overflow-hidden rounded-xl border-border/80 shadow-md">
        <CardHeader>
          <CardTitle>سجل الأعمال</CardTitle>
          <CardDescription>تحديث لحظي عبر اشتراك Firestore</CardDescription>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-2 py-14 text-center">
              <p className="font-medium">لم تُنشأ أي أوامر عمل بعد.</p>
              <p className="text-muted-foreground max-w-sm text-sm">ابدأ بإجراء تجريبي من البذرة أو من شاشات الأصول.</p>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الأصل</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>عالق عند</TableHead>
                    <TableHead>الأولوية</TableHead>
                    <TableHead>الاستحقاق</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="max-w-[220px]">
                        <Link
                          to={`/dashboard/work-orders/${wo.id}`}
                          className="text-primary font-semibold underline-offset-4 hover:underline"
                        >
                          {wo.title}
                        </Link>
                        <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{wo.description}</p>
                      </TableCell>
                      <TableCell>{assetNameById.get(wo.assetId) ?? wo.assetId.slice(0, 8)}…</TableCell>
                      <TableCell>
                        <Badge variant="outline">{workOrderStatusAr[String(wo.status)] ?? wo.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <WorkOrderPendingBadge workOrder={wo} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            wo.priority === "critical"
                              ? "destructive"
                              : wo.priority === "high"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {workOrderPriorityAr[wo.priority] ?? wo.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatArDate(wo.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
