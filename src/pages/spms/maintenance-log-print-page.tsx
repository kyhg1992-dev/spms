import { Printer } from "lucide-react"
import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssetsQuery, useCompanySettingsQuery, useUsersQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate, formatArDateTime } from "@/lib/format"
import { workOrderStatusAr } from "@/lib/labels-ar"
import { filterMaintenanceLog, woEffectiveDate } from "@/lib/maintenance-log"

export default function MaintenanceLogPrintPage() {
  const [params] = useSearchParams()
  const assets = useAssetsQuery()
  const users = useUsersQuery()
  const workOrders = useWorkOrdersQuery()
  const company = useCompanySettingsQuery()

  const q = params.get("q") ?? ""
  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""
  const assetId = params.get("asset") ?? undefined
  const status = (params.get("status") as "all" | "active" | "closed") ?? "all"

  const assetById = useMemo(() => new Map((assets.data ?? []).map((a) => [a.id, a])), [assets.data])
  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  const rows = useMemo(
    () => filterMaintenanceLog(workOrders.data ?? [], assetById, { q, from, to, status: status || "all", assetId }),
    [workOrders.data, assetById, q, from, to, status, assetId]
  )

  if (workOrders.isLoading || !workOrders.data || assets.isLoading) {
    return <div className="mx-auto max-w-[900px] p-6"><Skeleton className="h-[500px] w-full rounded-xl" /></div>
  }

  const focusAsset = assetId ? assetById.get(assetId) : undefined
  const period =
    from || to ? `الفترة: ${from || "البداية"} — ${to || "الآن"}` : "كل الفترات"

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[900px] justify-end px-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> طباعة
        </Button>
      </div>

      <div dir="rtl" className="print-area mx-auto max-w-[900px] bg-white p-8 text-slate-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-5 flex items-center justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {company.data?.logoDataUrl ? (
              <img src={company.data.logoDataUrl} alt="" className="size-14 rounded border bg-white object-contain p-1" />
            ) : null}
            <div>
              <div className="text-lg font-bold">{company.data?.companyNameAr || "نظام الصيانة الوقائية"}</div>
              <div className="text-xs text-slate-500">تقرير سجل الصيانة</div>
            </div>
          </div>
          <div className="text-left text-xs text-slate-500" dir="ltr">{formatArDateTime(undefined)}</div>
        </div>

        <div className="mb-4 text-sm">
          {focusAsset ? (
            <div className="font-bold">
              الأصل: {focusAsset.assetName} <span className="text-slate-500" dir="ltr">({focusAsset.assetCode} · {focusAsset.plateNo})</span>
            </div>
          ) : null}
          <div className="text-slate-600">{period} · عدد السجلات: {rows.length}</div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد سجلات مطابقة.</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-right">
                <th className="border border-slate-300 p-1.5">التاريخ</th>
                {!focusAsset ? <th className="border border-slate-300 p-1.5">الأصل</th> : null}
                <th className="border border-slate-300 p-1.5">الإجراء / المستوى</th>
                <th className="border border-slate-300 p-1.5">الفنّي</th>
                <th className="border border-slate-300 p-1.5">المعتمِد</th>
                <th className="border border-slate-300 p-1.5">رقم الطلب</th>
                <th className="border border-slate-300 p-1.5">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((wo) => {
                const a = assetById.get(wo.assetId)
                return (
                  <tr key={wo.id}>
                    <td className="border border-slate-300 p-1.5 tabular-nums">{formatArDate(woEffectiveDate(wo))}</td>
                    {!focusAsset ? (
                      <td className="border border-slate-300 p-1.5">
                        {a?.assetName ?? "—"} <span className="text-slate-500" dir="ltr">{a?.assetCode ?? ""}</span>
                      </td>
                    ) : null}
                    <td className="border border-slate-300 p-1.5">{wo.serviceLevelNameAr ?? wo.serviceLevelCode ?? wo.title}</td>
                    <td className="border border-slate-300 p-1.5">{nameOf(wo.assignedTo ?? wo.assigneeId)}</td>
                    <td className="border border-slate-300 p-1.5">{nameOf(wo.approvedByUid)}</td>
                    <td className="border border-slate-300 p-1.5 tabular-nums" dir="ltr">{wo.externalRequestNo || "—"}</td>
                    <td className="border border-slate-300 p-1.5">{workOrderStatusAr[String(wo.status)] ?? wo.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <div className="mt-8 border-t border-slate-300 pt-2 text-center text-[10px] text-slate-400">
          صُدِّر من نظام الصيانة الوقائية الذكي — SPMS
        </div>
      </div>
    </div>
  )
}
