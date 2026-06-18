import { History, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import type { Timestamp } from "firebase/firestore"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAssetsQuery, useUsersQuery, useWorkOrdersQuery } from "@/hooks/use-spms-data"
import { formatArDate } from "@/lib/format"
import { workOrderStatusAr } from "@/lib/labels-ar"
import { serviceLevelColor } from "@/lib/spms-colors"
import type { WorkOrder } from "@/models/firestore"

function ts(value: Timestamp | undefined): number {
  return value && typeof value.toMillis === "function" ? value.toMillis() : 0
}

function effectiveDate(wo: WorkOrder & { id: string }): Timestamp | undefined {
  return wo.closedAt ?? wo.executionCompletedAt ?? wo.updatedAt ?? wo.createdAt
}

/** Local YYYY-MM-DD for a timestamp, to compare against an <input type="date">. */
function dayKey(value: Timestamp | undefined): string {
  if (!value || typeof value.toDate !== "function") return ""
  const d = value.toDate()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * Fleet-wide maintenance log: every work order across all assets, searchable by
 * day, asset number, or plate. The durable record lives in the work-order docs.
 */
export default function MaintenanceLogPage() {
  const { data, isLoading } = useWorkOrdersQuery()
  const assets = useAssetsQuery()
  const users = useUsersQuery()

  const [search, setSearch] = useState("")
  const [day, setDay] = useState("")

  const assetById = useMemo(
    () => new Map((assets.data ?? []).map((a) => [a.id, a])),
    [assets.data]
  )
  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.displayName || u.email]))
    return (uid?: string) => (uid ? map.get(uid) ?? "—" : "—")
  }, [users.data])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? [])
      .filter((wo) => {
        if (day && dayKey(effectiveDate(wo)) !== day) return false
        if (!q) return true
        const a = assetById.get(wo.assetId)
        return (
          (a?.assetCode ?? "").toLowerCase().includes(q) ||
          (a?.plateNo ?? "").toLowerCase().includes(q) ||
          (a?.assetName ?? "").toLowerCase().includes(q) ||
          (wo.externalRequestNo ?? "").toLowerCase().includes(q) ||
          wo.title.toLowerCase().includes(q)
        )
      })
      .sort((x, y) => ts(effectiveDate(y)) - ts(effectiveDate(x)))
  }, [data, search, day, assetById])

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
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
              <Label htmlFor="day" className="text-xs">اليوم</Label>
              <Input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            {(search || day) ? (
              <Button variant="outline" onClick={() => { setSearch(""); setDay("") }}>مسح</Button>
            ) : null}
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
                    <TableHead>الفنّي</TableHead>
                    <TableHead>المعتمِد</TableHead>
                    <TableHead>رقم الطلب</TableHead>
                    <TableHead>الحالة</TableHead>
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

          <p className="text-muted-foreground text-xs">إجمالي النتائج: {rows.length}</p>
        </CardContent>
      </Card>
    </div>
  )
}
