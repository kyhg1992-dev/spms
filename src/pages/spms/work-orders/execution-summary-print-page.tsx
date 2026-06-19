import { Printer } from "lucide-react"
import { useMemo } from "react"
import { Navigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/i18n/i18n"
import {
  useAssetsQuery,
  useCompanySettingsQuery,
  useUsersQuery,
  useWorkOrdersQuery,
} from "@/hooks/use-spms-data"
import { formatArDateTime, formatDuration } from "@/lib/format"

export default function ExecutionSummaryPrintPage() {
  const { workOrderId } = useParams<{ workOrderId: string }>()
  const { t } = useI18n()
  const workOrders = useWorkOrdersQuery()
  const assets = useAssetsQuery()
  const users = useUsersQuery()
  const company = useCompanySettingsQuery()

  const wo = workOrders.data?.find((w) => w.id === workOrderId)
  const asset = wo ? assets.data?.find((a) => a.id === wo.assetId) : undefined
  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  if (!workOrderId) return <Navigate to="/dashboard/work-orders" replace />
  if (workOrders.isLoading || !workOrders.data) {
    return <div className="mx-auto max-w-[800px] p-6"><Skeleton className="h-[500px] w-full rounded-xl" /></div>
  }
  if (!wo) return <div className="p-10 text-center text-sm text-muted-foreground">—</div>

  const checklist = wo.executionChecklist ?? []
  const extras = wo.extraItems ?? []
  const photos = wo.executionPhotos ?? []
  const duration = formatDuration(wo.actualLaborHours ?? wo.laborHours, { d: t("dur.d"), h: t("dur.h"), m: t("dur.m") })

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[800px] justify-end px-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> {t("exec.print")}
        </Button>
      </div>

      <div dir="rtl" className="print-area mx-auto max-w-[800px] bg-white p-8 text-slate-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-5 flex items-center justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {company.data?.logoDataUrl ? (
              <img src={company.data.logoDataUrl} alt="" className="size-14 rounded border bg-white object-contain p-1" />
            ) : null}
            <div>
              <div className="text-lg font-bold">{company.data?.companyNameAr || "SPMS"}</div>
              <div className="text-xs text-slate-500">{t("exec.summary")}</div>
            </div>
          </div>
          <div className="text-left text-xs text-slate-500" dir="ltr">{formatArDateTime(wo.closedAt ?? wo.updatedAt)}</div>
        </div>

        <h1 className="mb-1 text-lg font-bold">{wo.title}</h1>
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <Meta k={t("col.asset")} v={`${asset?.assetName ?? ""} ${asset?.assetCode ?? ""}`} />
          <Meta k={t("col.technician")} v={nameOf(wo.assignedTo ?? wo.assigneeId)} />
          <Meta k={t("col.approver")} v={nameOf(wo.approvedByUid)} />
          <Meta k={t("wod.execDuration")} v={duration} />
          <Meta k={t("col.requestNo")} v={wo.externalRequestNo || "—"} />
        </div>

        {checklist.length > 0 ? (
          <Block title={t("exec.checklist")}>
            <table className="w-full border-collapse text-[12px]">
              <thead><tr className="bg-slate-100 text-right">
                <th className="border border-slate-300 p-1.5 w-8">✓</th>
                <th className="border border-slate-300 p-1.5">{t("exec.itemDesc")}</th>
                <th className="border border-slate-300 p-1.5 w-28">{t("exec.qtyUsed")}</th>
              </tr></thead>
              <tbody>
                {checklist.map((c) => (
                  <tr key={c.id}>
                    <td className="border border-slate-300 p-1.5 text-center">{c.isDone ? "✓" : "—"}</td>
                    <td className="border border-slate-300 p-1.5">{c.labelAr}</td>
                    <td className="border border-slate-300 p-1.5 tabular-nums">{c.qtyUsed || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        ) : null}

        {extras.length > 0 ? (
          <Block title={t("exec.extraItems")}>
            <ul className="text-sm">
              {extras.map((e, i) => (
                <li key={i} className="flex justify-between border-b border-dashed py-1">
                  <span>{e.desc}</span><span className="tabular-nums">{e.qty ?? "—"}</span>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        {wo.observationNotes?.trim() ? <Block title={t("exec.observation")}><p className="whitespace-pre-wrap text-sm">{wo.observationNotes}</p></Block> : null}
        {wo.completionNotes?.trim() ? <Block title={t("exec.completionNotes")}><p className="whitespace-pre-wrap text-sm">{wo.completionNotes}</p></Block> : null}
        {wo.requiredPartsNote?.trim() ? <Block title={t("exec.partsNote")}><p className="whitespace-pre-wrap text-sm">{wo.requiredPartsNote}</p></Block> : null}
        {wo.safetyNotes?.trim() ? <Block title={t("exec.safetyNotes")}><p className="whitespace-pre-wrap text-sm">{wo.safetyNotes}</p></Block> : null}

        {photos.length > 0 ? (
          <Block title={t("exec.photos")}>
            <div className="flex flex-wrap gap-2">
              {photos.map((src, i) => <img key={i} src={src} alt="" className="h-40 rounded border object-cover" />)}
            </div>
          </Block>
        ) : null}

        <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-300 pt-6 text-[12px]">
          <div>{t("col.technician")}: ____________________</div>
          <div>{t("col.approver")}: ____________________</div>
        </div>
      </div>
    </div>
  )
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-dashed border-slate-200 pb-1">
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="mb-1.5 border-b border-slate-300 pb-1 text-sm font-bold">{title}</h2>
      {children}
    </div>
  )
}
