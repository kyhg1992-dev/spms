import { Download, History, Printer } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUsersQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate } from "@/lib/format"
import { workOrderStatusAr } from "@/lib/labels-ar"
import { woDayKey, woEffectiveDate as effectiveDate, woMillis } from "@/lib/maintenance-log"
import { serviceLevelColor } from "@/lib/spms-colors"
import { exportRowsToExcel, fileDateStamp } from "@/lib/xlsx-export"

/**
 * Cumulative maintenance log for a single asset: every work order ever raised on it,
 * with the action performed, the technician, the approver, and the originating request
 * number. Filterable by period, printable, and exportable to Excel.
 */
export function AssetMaintenanceHistory({ assetId }: { assetId: string }) {
  const { data, isLoading } = useWorkOrdersQuery()
  const users = useUsersQuery()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  const rows = useMemo(() => {
    return (data ?? [])
      .filter((wo) => {
        if (wo.assetId !== assetId) return false
        const dk = woDayKey(effectiveDate(wo))
        if (from && (!dk || dk < from)) return false
        if (to && (!dk || dk > to)) return false
        return true
      })
      .sort((a, b) => woMillis(effectiveDate(b)) - woMillis(effectiveDate(a)))
  }, [data, assetId, from, to])

  function exportExcel() {
    if (rows.length === 0) return toast.error("لا سجلات للتصدير")
    exportRowsToExcel(
      `سجل-صيانة-${assetId}-${fileDateStamp()}`,
      rows.map((wo) => ({
        "التاريخ": formatArDate(effectiveDate(wo)),
        "الإجراء": wo.serviceLevelNameAr ?? wo.title,
        "المستوى": wo.serviceLevelCode ?? "",
        "الفنّي": nameOf(wo.assignedTo ?? wo.assigneeId),
        "المعتمِد": nameOf(wo.approvedByUid),
        "رقم الطلب": wo.externalRequestNo ?? "",
        "الحالة": workOrderStatusAr[String(wo.status)] ?? String(wo.status),
      })),
      "Asset Log"
    )
    toast.success(`تم تصدير ${rows.length} سجلاً`)
  }

  function openPrint() {
    const params = new URLSearchParams({ asset: assetId })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    window.open(`/print/maintenance-log?${params.toString()}`, "_blank", "noreferrer")
  }

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
      <CardContent className="space-y-4 px-4 pb-6">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="h-from" className="text-xs">من</Label>
            <Input id="h-from" type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-to" className="text-xs">إلى</Label>
            <Input id="h-to" type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) ? (
            <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo("") }}>مسح</Button>
          ) : null}
          <div className="ms-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="size-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={openPrint}>
              <Printer className="size-4" /> طباعة
            </Button>
          </div>
        </div>
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
