import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useAssetsQuery,
  useCompanySettingsQuery,
  usePMSchedulesQuery,
  useWorkOrdersQuery,
} from "@/hooks/use-spms-data"
import { useI18n, useLabels } from "@/i18n/i18n"
import { calculateMaintenanceKpis } from "@/lib/kpi-engine"
import { prepareReport, toExcelReadyReport, toPdfReadyReport } from "@/lib/report-export"
import { countBy, filterReportingDataset } from "@/lib/reporting-query"
import { exportRowsToExcel, fileDateStamp } from "@/lib/xlsx-export"

export default function ReportsPage() {
  const { t } = useI18n()
  const L = useLabels()
  const assets = useAssetsQuery()
  const wos = useWorkOrdersQuery()
  const pm = usePMSchedulesQuery()
  const company = useCompanySettingsQuery()

  const filtered = filterReportingDataset(
    {
      assets: assets.data ?? [],
      workOrders: wos.data ?? [],
      pmSchedules: pm.data ?? [],
    },
    {}
  )
  const kpis = calculateMaintenanceKpis({
    assets: filtered.assets,
    workOrders: filtered.workOrders,
    pmSchedules: filtered.pmSchedules,
  })
  const exportReport = prepareReport({
    title: "SPMS Work Order Status Overview",
    columns: [
      { key: "status", label: "الحالة" },
      { key: "count", label: "العدد" },
    ],
    rows: countBy(filtered.workOrders, (workOrder) => String(workOrder.status)).map((row) => ({
      status: L.woStatus(row.key),
      count: row.count,
    })),
  })
  const pdfReady = toPdfReadyReport(exportReport, [
    `PM Compliance: ${kpis.pmCompliancePct ?? "N/A"}`,
    `Overdue PM: ${kpis.overduePmCount}`,
  ])
  const excelReady = toExcelReadyReport(exportReport, "WO Status")

  function exportAssets() {
    const list = assets.data ?? []
    if (list.length === 0) return toast.error("لا أصول للتصدير")
    exportRowsToExcel(
      `تقرير-الأصول-${fileDateStamp()}`,
      list.map((a) => ({
        "رقم الأصل": a.assetCode,
        "الاسم": a.assetName,
        "اللوحة": a.plateNo,
        "التصنيف": a.equipmentClass ?? "",
        "الموقع": a.location,
        "الفرع": a.branch ?? "",
        "الحالة": a.status,
        "ساعات التشغيل": a.operatingHours,
        "كم": a.odometer,
      })),
      "Assets"
    )
    toast.success(`تم تصدير ${list.length} أصل`)
  }

  function exportWorkOrders() {
    const list = wos.data ?? []
    if (list.length === 0) return toast.error("لا أوامر للتصدير")
    const nameAsset = new Map((assets.data ?? []).map((a) => [a.id, a.assetCode]))
    exportRowsToExcel(
      `تقرير-أوامر-العمل-${fileDateStamp()}`,
      list.map((w) => ({
        "العنوان": w.title,
        "رقم الأصل": nameAsset.get(w.assetId) ?? "",
        "المستوى": w.serviceLevelCode ?? "",
        "الأولوية": w.priority,
        "الحالة": L.woStatus(String(w.status)),
        "رقم الطلب": w.externalRequestNo ?? "",
      })),
      "Work Orders"
    )
    toast.success(`تم تصدير ${list.length} أمر`)
  }

  function exportPm() {
    const list = pm.data ?? []
    if (list.length === 0) return toast.error("لا مخططات للتصدير")
    exportRowsToExcel(
      `تقرير-الصيانة-الوقائية-${fileDateStamp()}`,
      list.map((p) => ({
        "العنوان": p.title,
        "النوع": p.serviceType,
        "الحالة": p.pmStatus ?? "",
        "نشط": p.isActive ? "نعم" : "لا",
      })),
      "PM"
    )
    toast.success(`تم تصدير ${list.length} مخطط`)
  }

  const rows = [
    { name: t("rep.assetsReport"), hint: `${(assets.data ?? []).length.toLocaleString("en-US")} ${t("rep.assetCount")}`, done: !!assets.data, action: exportAssets },
    { name: t("rep.pmReport"), hint: `${(pm.data ?? []).length.toLocaleString("en-US")} ${t("rep.pmCount")}`, done: !!pm.data, action: exportPm },
    { name: t("rep.woReport"), hint: `${(wos.data ?? []).length.toLocaleString("en-US")} ${t("rep.woCount")}`, done: !!wos.data, action: exportWorkOrders },
  ]

  function distributionRows(): [string, number][] {
    return exportReport.rows.map((row) => [String(row.status ?? ""), Number(row.count ?? 0)])
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-4">
        {company.data?.logoDataUrl ? (
          <img
            src={company.data.logoDataUrl}
            alt="لوجو الشركة"
            className="size-14 shrink-0 rounded-lg border bg-white object-contain p-1"
          />
        ) : null}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("rep.title")}</h1>
          {company.data?.companyNameAr ? (
            <p className="text-muted-foreground mt-1 text-sm font-medium">{company.data.companyNameAr}</p>
          ) : null}
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm">{t("rep.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.name} className="rounded-xl border-border/70">
            <CardHeader>
              <CardTitle className="text-base">{r.name}</CardTitle>
              <CardDescription>{r.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" disabled={!r.done} onClick={r.action}>
                <Download className="size-4" />
                {t("rep.exportExcel")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-border/70">
        <CardHeader>
          <CardTitle>{t("rep.kpisTitle")}</CardTitle>
          <CardDescription>
            CSV / PDF / Excel data shapes are prepared from the same reporting foundation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <Metric label="PM Compliance" value={kpis.pmCompliancePct !== null ? `${kpis.pmCompliancePct}%` : "—"} />
          <Metric label="MTTR" value={kpis.mttrHours !== null ? `${kpis.mttrHours.toFixed(1)} h` : "—"} />
          <Metric label="PDF Rows" value={String(pdfReady.rows.length)} />
          <Metric label="Excel Sheet" value={excelReady.sheetName} />
          <Metric label="Overdue WO" value={String(kpis.overdueWorkOrderCount)} />
          <Metric label="Downtime Hours" value={kpis.downtimeHours.toFixed(1)} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/70 shadow-md">
        <CardHeader>
          <CardTitle>{t("rep.woSummary")}</CardTitle>
          <CardDescription>{t("rep.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rep.statusCol")}</TableHead>
                <TableHead className="text-end tabular-nums">{t("rep.count")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributionRows().length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground text-center text-sm">
                    {t("rep.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                distributionRows().map(([label, cnt]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="text-end tabular-nums">{cnt}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  )
}
