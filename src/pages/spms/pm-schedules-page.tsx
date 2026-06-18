import { Wrench } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery, useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import { deriveNextServiceForAsset, type NextServiceView } from "@/lib/maintenance-next-service"
import { serviceLevelColor } from "@/lib/spms-colors"
import { pmServiceTypeAr } from "@/lib/labels-ar"
import type { Asset, MaintenanceSequenceTemplate } from "@/models/firestore"
import { generateAssetServiceWorkOrder } from "@/services/firestore/spms-service"
import { canAccess } from "@/services/firestore/permissions"

type Row = { asset: Asset & { id: string }; next: NextServiceView }

function dueStatus(n: NextServiceView): { label: string; bg: string; fg: string; rank: number } {
  if (n.isDue && n.overdueBy > n.stepInterval) return { label: "حرج", bg: "#FCEBEB", fg: "#A32D2D", rank: 0 }
  if (n.isDue) return { label: "مستحق", bg: "#FFF1E0", fg: "#9A4F06", rank: 1 }
  if (n.remainingUntilDue <= n.stepInterval * 0.15) return { label: "قريب", bg: "#FAEEDA", fg: "#854F0B", rank: 2 }
  return { label: "سليم", bg: "#E9F7EC", fg: "#15803D", rank: 3 }
}

export default function PMSchedulesPage() {
  const assets = useAssetsQuery()
  const templates = useMaintenanceTemplatesQuery()
  const { spmsRole, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<"all" | "due">("all")
  const [busyId, setBusyId] = useState<string | null>(null)

  const canGenerate = spmsRole && canAccess(spmsRole, "workOrders", "create")

  const templatesById = useMemo(
    () =>
      new Map<string, MaintenanceSequenceTemplate & { id: string }>(
        (templates.data ?? []).map((t) => [t.id, t])
      ),
    [templates.data]
  )

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const asset of assets.data ?? []) {
      const next = deriveNextServiceForAsset({ asset, templatesById })
      if (next) out.push({ asset, next })
    }
    out.sort((a, b) => dueStatus(a.next).rank - dueStatus(b.next).rank)
    return out
  }, [assets.data, templatesById])

  const filtered = filter === "due" ? rows.filter((r) => r.next.isDue) : rows
  const dueCount = rows.filter((r) => r.next.isDue).length
  const isLoading = assets.isLoading || templates.isLoading

  async function generate(assetId: string) {
    if (!spmsRole || !user?.uid) return
    setBusyId(assetId)
    try {
      const res = await generateAssetServiceWorkOrder(spmsRole, { assetId, actorUid: user.uid })
      if (res.error || !res.data) {
        toast.error(res.error ?? "تعذّر التوليد")
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
      toast.success("تم توليد أمر العمل")
      navigate(`/dashboard/work-orders/${res.data.workOrderId}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">الصيانة الوقائية</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            استحقاق الصيانة لكل الأسطول — محسوب من قالب كل أصل وموضعه في التناوب. {dueCount} مستحقة الآن.
          </p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأصول</SelectItem>
            <SelectItem value="due">المستحقة فقط</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle>لوحة الاستحقاق</CardTitle>
          <CardDescription>الأصول المرتبطة بقوالب صيانة. ولّد أمر العمل بنقرة.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="font-medium">
                {rows.length === 0 ? "لا أصول مرتبطة بقوالب صيانة بعد" : "لا استحقاقات مطابقة"}
              </p>
              <p className="text-muted-foreground max-w-sm text-sm">
                اربط الأصول بقوالب من «قوالب الصيانة» أو من صفحة كل أصل.
              </p>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الأصل</TableHead>
                    <TableHead>القالب</TableHead>
                    <TableHead>الخدمة القادمة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>القراءة</TableHead>
                    {canGenerate ? <TableHead className="text-end">إجراء</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(({ asset, next }) => {
                    const st = dueStatus(next)
                    const c = serviceLevelColor(next.nextCode)
                    return (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <button
                            className="text-primary text-start underline-offset-2 hover:underline"
                            onClick={() => navigate(`/dashboard/assets/${asset.id}`)}
                          >
                            <span className="font-medium">{asset.assetName}</span>
                            <span className="text-muted-foreground"> · {asset.assetCode}</span>
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{next.templateName}</TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: c.bg, color: c.fg }}
                          >
                            {next.nextLabel} · {pmServiceTypeAr[next.nextCode] ?? ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: st.bg, color: st.fg }}
                          >
                            {st.label}
                            {next.isDue
                              ? ` (+${String(Math.round(next.overdueBy))})`
                              : ` (بعد ${String(Math.round(next.remainingUntilDue))})`}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm tabular-nums">
                          {Math.round(next.currentReading)}
                        </TableCell>
                        {canGenerate ? (
                          <TableCell className="text-end">
                            <Button
                              size="sm"
                              variant={next.isDue ? "default" : "outline"}
                              disabled={busyId === asset.id}
                              onClick={() => void generate(asset.id)}
                            >
                              <Wrench className="size-4" aria-hidden />
                              {busyId === asset.id ? "…" : "توليد أمر عمل"}
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
