import { Printer } from "lucide-react"
import { useMemo } from "react"
import { Link, Navigate, useParams } from "react-router-dom"

import { WorkOrderOperationalActions } from "@/components/work-orders/work-order-operational-actions"
import { ServiceTaskTable } from "@/components/work-orders/service-task-table"
import { WorkOrderTimeline } from "@/components/work-orders/work-order-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivityLogsQuery, useAssetsQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate, formatArDateTime } from "@/lib/format"
import { workOrderPriorityAr, workOrderStatusAr } from "@/lib/labels-ar"
import { buildWorkOrderTimeline } from "@/lib/work-order-timeline"
import type { WorkOrder } from "@/models/firestore"

export default function WorkOrderDetailPage() {
  const { workOrderId } = useParams<{ workOrderId: string }>()
  const { data, isLoading } = useWorkOrdersQuery()
  const assets = useAssetsQuery()
  const activityLogs = useActivityLogsQuery()

  const wo = data?.find((w) => w.id === workOrderId) as (WorkOrder & { id: string }) | undefined
  const assetName = wo ? assets.data?.find((a) => a.id === wo.assetId)?.assetName : undefined
  const timelineEntries = useMemo(
    () => (wo ? buildWorkOrderTimeline({ workOrder: wo, auditLogs: activityLogs.data }) : []),
    [activityLogs.data, wo]
  )

  if (!workOrderId) return <Navigate to="/dashboard/work-orders" replace />

  if (isLoading || !data || assets.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  if (!wo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>أمر عمل غير موجود</CardTitle>
          <CardDescription>ربما تم حذف المعرف أو المسار خاطئ.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/dashboard/work-orders">العودة لقائمة الأوامر</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div id="wo-print-root" className="flex flex-col gap-8 print:text-black">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ms-3 mb-1 px-2">
            <Link to="/dashboard/work-orders">كل أوامر العمل</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-2xl">{wo.title}</h1>
            <Badge variant="outline">{workOrderStatusAr[String(wo.status)] ?? wo.status}</Badge>
            <Badge variant="secondary">{workOrderPriorityAr[wo.priority] ?? wo.priority}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{assetName ?? wo.assetId}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 print:hidden">
          <Link to={`/print/work-order/${wo.id}`} target="_blank" rel="noreferrer">
            <Printer className="size-4" />
            كرت أمر العمل
          </Link>
        </Button>
      </div>

      <WorkOrderOperationalActions workOrder={wo} />

      <ServiceTaskTable workOrder={wo} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-border/70 shadow-md">
          <CardHeader>
            <CardTitle>التاريخ التشغيلي</CardTitle>
            <CardDescription>جاهز لمطابقة تدفقات SAP PM / IBM Maximo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <TimelineRow title="التسجيل" value={formatArDateTime(wo.createdAt)} />
            <TimelineRow title="آخر تحديث" value={formatArDateTime(wo.updatedAt)} />
            <TimelineRow title="متوقّع الإغلاق" value={formatArDate(wo.dueDate)} />
            <TimelineRow title="الإغلاق الفعلي" value={wo.closedAt ? formatArDateTime(wo.closedAt) : "—"} />
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/70 shadow-md">
          <CardHeader>
            <CardTitle>القياسات التشغيلية</CardTitle>
            <CardDescription>ساعات العمل وزمن التوقّف وحالة الاعتماد.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KV k="الساعات العمالية الفعلية" v={wo.laborHours !== undefined ? String(wo.laborHours) : "—"} />
            <KV k="زمن التوقف (بالدقيقة)" v={wo.downtimeMinutes !== undefined ? String(wo.downtimeMinutes) : "—"} />
            <KV k="مطلوب اعتماد" v={wo.approvalRequired ? "نعم" : "لا"} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border/70 shadow-md">
        <CardHeader>
          <CardTitle>وصف مهمة تنفيذية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{wo.description}</p>
          <Separator />
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">ملاحظات داخلية</p>
            <p className="whitespace-pre-wrap">{wo.internalNotes ?? "لا توجد ملاحظات داخلية."}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70 shadow-md">
        <CardHeader>
          <CardTitle>سجل الحركة التشغيلي</CardTitle>
          <CardDescription>ملخص قابل لإعادة الاستخدام لحالة الأمر، التنفيذ، التفويض، الاعتماد، والأثر التدقيقي.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkOrderTimeline entries={timelineEntries} />
        </CardContent>
      </Card>
    </div>
  )
}

function TimelineRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-muted-foreground text-xs">{title}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-dashed border-border pb-3 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  )
}
