import { Pencil, Printer, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { WorkOrderOperationalActions } from "@/components/work-orders/work-order-operational-actions"
import { WorkOrderProgressStepper } from "@/components/work-orders/work-order-progress-stepper"
import { WorkOrderExecutionSummary } from "@/components/work-orders/work-order-execution-summary"
import { WorkOrderEditDialog } from "@/components/work-orders/work-order-edit-dialog"
import { ServiceTaskTable } from "@/components/work-orders/service-task-table"
import { WorkOrderTimeline } from "@/components/work-orders/work-order-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { useI18n, useLabels } from "@/i18n/i18n"
import { useActivityLogsQuery, useAssetsQuery, useCompanySettingsQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate, formatArDateTime, formatDuration } from "@/lib/format"
import { buildWorkOrderTimeline } from "@/lib/work-order-timeline"
import type { WorkOrder } from "@/models/firestore"
import { isBypassCode } from "@/lib/request-bypass"
import { updateWorkOrder } from "@/services/firestore/spms-service"
import { requestNoTaken } from "@/services/firestore/work-order-request-no"

export default function WorkOrderDetailPage() {
  const { workOrderId } = useParams<{ workOrderId: string }>()
  const { t, lang } = useI18n()
  const L = useLabels()
  const { spmsRole } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const { data, isLoading } = useWorkOrdersQuery()
  const assets = useAssetsQuery()
  const activityLogs = useActivityLogsQuery()
  const canEdit = spmsRole === "admin" || spmsRole === "manager"

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
          <CardTitle>{t("wod.notFound")}</CardTitle>
          <CardDescription>{t("wod.notFoundHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/dashboard/work-orders">{t("wod.back")}</Link>
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
            <Link to="/dashboard/work-orders">{t("wod.allWO")}</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-2xl">{wo.title}</h1>
            <Badge variant="outline">{L.woStatus(String(wo.status))}</Badge>
            <Badge variant="secondary">{L.priority(wo.priority)}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{assetName ?? wo.assetId}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          {canEdit ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              {t("woedit.edit")}
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to={`/print/work-order/${wo.id}`} target="_blank" rel="noreferrer">
              <Printer className="size-4" />
              {t("wod.card")}
            </Link>
          </Button>
        </div>
      </div>

      <WorkOrderEditDialog workOrder={wo} open={editOpen} onOpenChange={setEditOpen} />

      <WorkOrderProgressStepper workOrder={wo} />

      <WorkOrderOperationalActions workOrder={wo} language={lang} dir={lang === "ar" ? "rtl" : "ltr"} />

      <RequestRefCard workOrder={wo} />

      <ServiceTaskTable workOrder={wo} />

      <WorkOrderExecutionSummary workOrder={wo} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-border/70 shadow-md">
          <CardHeader>
            <CardTitle>{t("wod.dates")}</CardTitle>
            <CardDescription>{t("wod.datesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <TimelineRow title={t("wod.created")} value={formatArDateTime(wo.createdAt)} />
            <TimelineRow title={t("wod.lastUpdate")} value={formatArDateTime(wo.updatedAt)} />
            <TimelineRow title={t("wod.dueExpected")} value={formatArDate(wo.dueDate)} />
            <TimelineRow title={t("wod.closedActual")} value={wo.closedAt ? formatArDateTime(wo.closedAt) : "—"} />
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/70 shadow-md">
          <CardHeader>
            <CardTitle>{t("wod.measures")}</CardTitle>
            <CardDescription>{t("wod.measuresHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KV
              k={t("wod.execDuration")}
              v={formatDuration(wo.actualLaborHours ?? wo.laborHours, { d: t("dur.d"), h: t("dur.h"), m: t("dur.m") })}
            />
            <KV k={t("wod.approvalRequired")} v={wo.approvalRequired ? t("common.yes") : t("common.no")} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border/70 shadow-md">
        <CardHeader>
          <CardTitle>{t("wod.taskDesc")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{wo.description}</p>
          <Separator />
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">{t("wod.internalNotes")}</p>
            <p className="whitespace-pre-wrap">{wo.internalNotes ?? t("wod.noInternalNotes")}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70 shadow-md">
        <CardHeader>
          <CardTitle>{t("wod.activityLog")}</CardTitle>
          <CardDescription>{t("wod.activityHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkOrderTimeline entries={timelineEntries} />
        </CardContent>
      </Card>
    </div>
  )
}

function RequestRefCard({ workOrder }: { workOrder: WorkOrder & { id: string } }) {
  const { spmsRole } = useAuth()
  const { t } = useI18n()
  const company = useCompanySettingsQuery()
  const queryClient = useQueryClient()
  const canEdit = spmsRole === "admin" || spmsRole === "manager"
  const [value, setValue] = useState(workOrder.externalRequestNo ?? "")
  const [busy, setBusy] = useState(false)

  const dirty = value.trim() !== (workOrder.externalRequestNo ?? "").trim()

  async function save() {
    if (!spmsRole) return
    setBusy(true)
    try {
      if (isBypassCode(value, company.data)) {
        const res = await updateWorkOrder(spmsRole, workOrder.id, {
          requestNoBypassed: true,
          externalRequestNo: undefined,
        })
        if (res.error) { toast.error(res.error); return }
        toast.success(t("reqp.bypassed"))
        await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
        return
      }
      if (value.trim() && (await requestNoTaken(value, workOrder.id))) {
        toast.error(t("reqp.duplicate"))
        return
      }
      const res = await updateWorkOrder(spmsRole, workOrder.id, {
        externalRequestNo: value.trim() || undefined,
        requestNoBypassed: false,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t("wod.requestSaved"))
      await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rounded-xl border-border/70 shadow-sm print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {t("wod.requestRef")}
          {workOrder.requestNoBypassed && !workOrder.externalRequestNo?.trim() ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">{t("wo.requestPending")}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{t("wod.requestRefHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Input
            dir="ltr"
            placeholder="REQ-2026-014532"
            value={value}
            disabled={!canEdit || busy}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {canEdit ? (
          <Button type="button" disabled={!dirty || busy} onClick={() => void save()}>
            <Save className="size-4" /> {t("common.save")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
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
