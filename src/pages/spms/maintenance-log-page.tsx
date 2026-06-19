import { Download, History, Printer, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery, useUsersQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate } from "@/lib/format"
import { workOrderStatusAr } from "@/lib/labels-ar"
import {
  TERMINAL_STATUSES as TERMINAL,
  filterMaintenanceLog,
  woEffectiveDate as effectiveDate,
} from "@/lib/maintenance-log"
import { serviceLevelColor } from "@/lib/spms-colors"
import { exportRowsToExcel, fileDateStamp } from "@/lib/xlsx-export"
import { deleteWorkOrder } from "@/services/firestore/spms-service"

/**
 * Fleet-wide maintenance log: every work order across all assets, searchable by
 * day, asset number, or plate. The durable record lives in the work-order docs.
 */
export default function MaintenanceLogPage() {
  const { data, isLoading } = useWorkOrdersQuery()
  const assets = useAssetsQuery()
  const users = useUsersQuery()
  const { spmsRole } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = spmsRole === "admin"

  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [status, setStatus] = useState<"all" | "closed" | "active">("all")
  const [busyId, setBusyId] = useState<string | null>(null)

  async function remove(id: string) {
    if (!isAdmin) return
    if (!window.confirm("حذف هذا السجل نهائياً؟ لا يمكن التراجع.")) return
    setBusyId(id)
    try {
      const res = await deleteWorkOrder("admin", id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("تم حذف السجل")
      await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
    } finally {
      setBusyId(null)
    }
  }

  const assetById = useMemo(
    () => new Map((assets.data ?? []).map((a) => [a.id, a])),
    [assets.data]
  )
  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  const rows = useMemo(
    () => filterMaintenanceLog(data ?? [], assetById, { q: search, from, to, status }),
    [data, search, from, to, status, assetById]
  )

  function exportExcel() {
    if (rows.length === 0) {
      toast.error("لا نتائج للتصدير")
      return
    }
    exportRowsToExcel(
      `سجل-الصيانة-${fileDateStamp()}`,
      rows.map((wo) => {
        const a = assetById.get(wo.assetId)
        return {
          "التاريخ": formatArDate(effectiveDate(wo)),
          "الأصل": a?.assetName ?? "",
          "رقم الأصل": a?.assetCode ?? "",
          "اللوحة": a?.plateNo ?? "",
          "الإجراء": wo.serviceLevelNameAr ?? wo.title,
          "المستوى": wo.serviceLevelCode ?? "",
          "الفنّي": nameOf(wo.assignedTo ?? wo.assigneeId),
          "المعتمِد": nameOf(wo.approvedByUid),
          "رقم الطلب": wo.externalRequestNo ?? "",
          "الحالة": workOrderStatusAr[String(wo.status)] ?? String(wo.status),
        }
      }),
      "Maintenance Log"
    )
    toast.success(`تم تصدير ${rows.length} سجلاً`)
  }

  function openPrint() {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (status !== "all") params.set("status", status)
    window.open(`/print/maintenance-log?${params.toString()}`, "_blank", "noreferrer")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
          <History className="size-6" style={{ color: "#0f766e" }} aria-hidden />
          سجل الصيانة
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          كل أوامر الصيانة على مستوى الأسطول — بحث باليوم أو رقم الأصل أو اللوحة.
        </p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle>السجل التراكمي</CardTitle>
          <CardDescription>التاريخ، الأصل، الإجراء، الفنّي، المعتمِد، رقم الطلب، والحالة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <Label htmlFor="q" className="text-xs">بحث برقم الأصل أو اللوحة</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute inset-inline-start-2.5 top-2.5 size-4" aria-hidden />
                <Input
                  id="q"
                  className="ps-8"
                  placeholder="مثل: 1419 أو 938G"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">من</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">إلى</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الحالة</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">قيد المعالجة</SelectItem>
                  <SelectItem value="closed">مغلقة/ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(search || from || to || status !== "all") ? (
              <Button variant="outline" onClick={() => { setSearch(""); setFrom(""); setTo(""); setStatus("all") }}>مسح</Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="size-4" /> تصدير Excel
            </Button>
            <Button variant="outline" size="sm" onClick={openPrint}>
              <Printer className="size-4" /> طباعة التقرير
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground flex min-h-[140px] items-center justify-center text-sm">
              لا توجد نتائج مطابقة.
            </div>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الأصل</TableHead>
                    <TableHead>الإجراء</TableHead>
                    <TableHead className="hidden md:table-cell">الفنّي</TableHead>
                    <TableHead className="hidden lg:table-cell">المعتمِد</TableHead>
                    <TableHead className="hidden sm:table-cell">رقم الطلب</TableHead>
                    <TableHead>الحالة</TableHead>
                    {isAdmin ? <TableHead className="w-10" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((wo) => {
                    const a = assetById.get(wo.assetId)
                    const color = wo.serviceLevelCode ? serviceLevelColor(wo.serviceLevelCode) : null
                    return (
                      <TableRow key={wo.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap text-sm tabular-nums">
                          {formatArDate(effectiveDate(wo))}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {a ? (
                            <Link to={`/dashboard/assets/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                              <span className="line-clamp-1">{a.assetName}</span>
                              <span className="text-muted-foreground text-xs" dir="ltr">{a.assetCode} · {a.plateNo}</span>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">{wo.assetId.slice(0, 8)}…</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <Link to={`/dashboard/work-orders/${wo.id}`} className="text-primary font-medium underline-offset-4 hover:underline">
                            <span className="inline-flex items-center gap-1.5">
                              {color ? (
                                <span className="inline-flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: color.solid }}>
                                  {wo.serviceLevelCode}
                                </span>
                              ) : null}
                              <span className="line-clamp-1">{wo.serviceLevelNameAr ?? wo.title}</span>
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-sm md:table-cell">{nameOf(wo.assignedTo ?? wo.assigneeId)}</TableCell>
                        <TableCell className="hidden text-sm lg:table-cell">{nameOf(wo.approvedByUid)}</TableCell>
                        <TableCell className="hidden text-muted-foreground text-sm tabular-nums sm:table-cell" dir="ltr">
                          {wo.externalRequestNo?.trim() || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{workOrderStatusAr[String(wo.status)] ?? wo.status}</Badge>
                        </TableCell>
                        {isAdmin ? (
                          <TableCell>
                            {TERMINAL.has(String(wo.status)) ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive"
                                aria-label="حذف السجل"
                                disabled={busyId === wo.id}
                                onClick={() => void remove(wo.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-muted-foreground text-xs">إجمالي النتائج: {rows.length}</p>
        </CardContent>
      </Card>
    </div>
  )
}
