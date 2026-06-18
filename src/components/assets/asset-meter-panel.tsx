import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useMeterReadingsQuery } from "@/hooks/use-spms-data"
import { formatArDateTime } from "@/lib/format"
import type { MeterReadingKind } from "@/models/firestore"
import { createMeterReadingWithPMEngine, deleteMeterReading } from "@/services/firestore/spms-service"
import { canAccess } from "@/services/firestore/permissions"
import { useQueryClient } from "@tanstack/react-query"

const KIND_AR: Record<MeterReadingKind, string> = {
  operating_hours: "عداد ساعات",
  odometer: "عداد كيلومتر",
}

export function AssetMeterPanel({ assetId }: { assetId: string }) {
  const { spmsRole, user } = useAuth()
  const qc = useQueryClient()
  const readings = useMeterReadingsQuery(assetId)
  const [kind, setKind] = useState<MeterReadingKind>("operating_hours")
  const [value, setValue] = useState<number>(0)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const mayCreate =
    !!spmsRole && canAccess(spmsRole, "meterReadings", "create") && !!user?.uid
  const isAdmin = spmsRole === "admin"
  const [delBusy, setDelBusy] = useState<string | null>(null)

  async function removeReading(id: string) {
    if (!isAdmin) return
    if (!window.confirm("حذف هذه القراءة نهائياً؟")) return
    setDelBusy(id)
    try {
      const res = await deleteMeterReading("admin", id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("تم حذف القراءة")
      await qc.invalidateQueries({ queryKey: ["meterReadings", assetId] })
    } finally {
      setDelBusy(null)
    }
  }

  const latestSameKind =
    readings.data?.find((r) => r.kind === kind) ?? undefined

  async function submit() {
    if (!spmsRole || !user?.uid || !mayCreate) {
      toast.error("لا توجد صلاحية لتسجيل القراءة.")
      return
    }
    if (typeof value !== "number" || value < 0 || Number.isNaN(value)) {
      toast.error("يرجى إدخال قيمة عددية صحيحة.")
      return
    }

    let deltaFromPrevious: number | undefined
    if (latestSameKind && typeof latestSameKind.value === "number") {
      deltaFromPrevious = value - latestSameKind.value
      if (deltaFromPrevious < 0) {
        toast.error("القيمة أقل من آخر قراءة — تحقّق قبل الحفظ.")
        return
      }
    }

    setBusy(true)
    try {
      const res = await createMeterReadingWithPMEngine(spmsRole, {
        assetId,
        kind,
        value,
        deltaFromPrevious,
        note: note.trim() || undefined,
        enteredByUid: user.uid,
        anomalyFlag: false,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      qc.invalidateQueries({ queryKey: ["meterReadings", assetId] })
      qc.invalidateQueries({ queryKey: ["assets"] })
      qc.invalidateQueries({ queryKey: ["pmSchedules"] })
      if (res.data?.anomalyFlag) {
        toast.warning("سُجلت القراءة مع تنبيه شذوذ للمراجعة.")
      } else {
        toast.success("سُجلت قراءة العداد بنجاح")
      }
      setNote("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rounded-xl border border-border/70 bg-card/80 shadow-lg shadow-black/[0.04] backdrop-blur-sm dark:shadow-black/30">
      <CardHeader>
        <CardTitle className="text-base">عداد التشغيل والمسافة</CardTitle>
        <CardDescription>سجل الزيادات وحسّاب دلتا الزمن الفاصل بين كل إدخال.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {readings.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <>
            {mayCreate ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>نوع القراءة</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as MeterReadingKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_AR) as MeterReadingKind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_AR[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>القراءة الحالية</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={Number.isFinite(value) ? value : ""}
                    onChange={(e) => setValue(Number(e.target.value))}
                  />
                  {latestSameKind ? (
                    <p className="text-muted-foreground text-xs">
                      الإدخال الأخير: {latestSameKind.value.toLocaleString("en-US")} —
                      التاريخ{" "}
                      {formatArDateTime(latestSameKind.updatedAt)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>ملاحظة ميدانية</Label>
                  <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="flex items-end lg:col-span-4">
                  <Button type="button" className="w-full sm:w-auto" disabled={busy} onClick={() => void submit()}>
                    {busy ? "جاري التسجيل…" : "تسجيل القراءة"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">قراءات العداد تعرض للاطلاع الصرف.</p>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>القيمة</TableHead>
                    <TableHead>الفرق عن السابق</TableHead>
                    <TableHead>الوقت</TableHead>
                    {isAdmin ? <TableHead className="w-10" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(readings.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="text-muted-foreground text-center">
                        لم تُدرج أي قراءات بعد.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (readings.data ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{KIND_AR[r.kind]}</TableCell>
                        <TableCell className="tabular-nums">{r.value.toLocaleString("en-US")}</TableCell>
                        <TableCell className="tabular-nums">{r.deltaFromPrevious ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatArDateTime(r.updatedAt)}</TableCell>
                        {isAdmin ? (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              aria-label="حذف القراءة"
                              disabled={delBusy === r.id}
                              onClick={() => void removeReading(r.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
