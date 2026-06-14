import { FileSpreadsheet, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery } from "@/hooks/use-spms-data"
import { readSheetRows } from "@/lib/xlsx-import"
import type { Asset, AssetStatus } from "@/models/firestore"
import { bulkCreateAssets } from "@/services/firestore/spms-service"
import { canAccess } from "@/services/firestore/permissions"

type FieldKey =
  | "assetCode"
  | "plateNo"
  | "assetName"
  | "serialNo"
  | "equipmentClass"
  | "location"
  | "branch"
  | "businessUnit"
  | "brand"
  | "model"
  | "reading"

const FIELDS: { key: FieldKey; label: string; required?: boolean; keywords: string[] }[] = [
  { key: "assetCode", label: "رقم الأصل", required: true, keywords: ["asset number", "asset no", "assetnumber", "رقم الأصل", "رقم الاصل"] },
  { key: "plateNo", label: "رقم اللوحة / الوحدة", required: true, keywords: ["unit number", "plate", "plate no", "رقم اللوحة", "unit"] },
  { key: "assetName", label: "الوصف / الاسم", keywords: ["description", "name", "desc", "الوصف", "الاسم"] },
  { key: "serialNo", label: "الرقم التسلسلي", keywords: ["serial number", "serial", "تسلسل"] },
  { key: "equipmentClass", label: "فئة المعدة (Eqm Cls)", keywords: ["eqm cls", "equipment class", "eqm", "class", "cls"] },
  { key: "location", label: "الموقع (Location)", keywords: ["location", "الموقع", "site"] },
  { key: "branch", label: "الفرع (Branch)", keywords: ["branch", "الفرع"] },
  { key: "businessUnit", label: "وحدة العمل (Business Unit)", keywords: ["responsible business unit", "business unit", "الوحدة"] },
  { key: "brand", label: "الصانع (Mfg)", keywords: ["mfg desc", "mfg", "manufacturer", "الصانع", "brand"] },
  { key: "model", label: "الموديل", keywords: ["product model", "model", "الموديل"] },
  { key: "reading", label: "القراءة (ساعات/كم)", keywords: ["current reading", "reading", "hours", "hrs", "km", "القراءة"] },
]

const NONE = "__none__"

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

function autoMap(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const f of FIELDS) {
    const found = headers.find((h) => f.keywords.some((k) => norm(h) === norm(k) || norm(h).includes(norm(k))))
    if (found) m[f.key] = found
  }
  return m
}

type AssetPayload = Omit<Asset, "id" | "createdAt" | "updatedAt">

export default function AssetsImportPage() {
  const { spmsRole } = useAuth()
  const assets = useAssetsQuery()
  const queryClient = useQueryClient()

  const [sourceRows, setSourceRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [category, setCategory] = useState<"vehicles" | "equipment">("equipment")
  const [readingKind, setReadingKind] = useState<"hours" | "km" | "none">("none")
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const canCreate = spmsRole && canAccess(spmsRole, "assets", "create")

  const existingCodes = useMemo(
    () => new Set((assets.data ?? []).map((a) => a.assetCode.trim())),
    [assets.data]
  )

  async function onFile(file: File | null) {
    if (!file) return
    try {
      const parsed = await readSheetRows(file)
      if (parsed.length === 0) {
        toast.error("الملف فارغ أو غير مقروء")
        return
      }
      const cols = Array.from(new Set(parsed.flatMap((r) => Object.keys(r))))
      setSourceRows(parsed)
      setHeaders(cols)
      setFileName(file.name)
      setMapping(autoMap(cols))
      toast.success(`قُرئ ${parsed.length} صفاً · رُبطت الأعمدة تلقائياً — راجعها`)
    } catch {
      toast.error("تعذّر قراءة الملف")
    }
  }

  function get(src: Record<string, unknown>, key: FieldKey): string {
    const col = mapping[key]
    if (!col || col === NONE) return ""
    const v = src[col]
    return v == null ? "" : String(v).trim()
  }

  const built = useMemo<AssetPayload[]>(() => {
    return sourceRows.map((src) => {
      const code = get(src, "assetCode")
      const readingRaw = get(src, "reading").replace(/[^\d.]/g, "")
      const reading = Number(readingRaw) || 0
      return {
        assetCode: code,
        assetName: get(src, "assetName") || code,
        category,
        brand: get(src, "brand"),
        model: get(src, "model"),
        serialNo: get(src, "serialNo"),
        plateNo: get(src, "plateNo"),
        department: get(src, "businessUnit"),
        location: get(src, "location"),
        equipmentClass: get(src, "equipmentClass") || undefined,
        branch: get(src, "branch") || undefined,
        businessUnit: get(src, "businessUnit") || undefined,
        operatingHours: readingKind === "hours" ? reading : 0,
        odometer: readingKind === "km" ? reading : 0,
        status: "active" as AssetStatus,
        notes: "",
        imageUrl: "",
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRows, mapping, category, readingKind])

  const stats = useMemo(() => {
    const seen = new Map<string, number>()
    built.forEach((b) => seen.set(b.assetCode, (seen.get(b.assetCode) ?? 0) + 1))
    let valid = 0
    let missing = 0
    let dup = 0
    for (const b of built) {
      if (!b.assetCode.trim() || !b.plateNo.trim()) missing += 1
      else if (existingCodes.has(b.assetCode.trim()) || (seen.get(b.assetCode) ?? 0) > 1) dup += 1
      else valid += 1
    }
    return { valid, missing, dup }
  }, [built, existingCodes])

  const validPayloads = useMemo(() => {
    const seen = new Map<string, number>()
    built.forEach((b) => seen.set(b.assetCode, (seen.get(b.assetCode) ?? 0) + 1))
    const out: AssetPayload[] = []
    const used = new Set(existingCodes)
    for (const b of built) {
      const code = b.assetCode.trim()
      if (!code || !b.plateNo.trim() || used.has(code)) continue
      used.add(code)
      out.push(b)
    }
    return out
  }, [built, existingCodes])

  useEffect(() => {
    if (mapping.reading && readingKind === "none") setReadingKind("hours")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping.reading])

  async function runImport() {
    if (!spmsRole || validPayloads.length === 0) {
      toast.error("لا صفوف صالحة للاستيراد")
      return
    }
    setImporting(true)
    setProgress({ done: 0, total: validPayloads.length })
    try {
      const res = await bulkCreateAssets(spmsRole, validPayloads, (done, total) => setProgress({ done, total }))
      if (res.error) {
        toast.error(res.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["assets"] })
      toast.success(`تم استيراد ${res.data ?? 0} أصل`)
      setSourceRows([])
      setHeaders([])
      setFileName("")
      setMapping({})
    } finally {
      setImporting(false)
      setProgress(null)
    }
  }

  if (!canCreate) return <Navigate to="/dashboard/assets" replace />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">استيراد الأصول من Excel</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          ارفع ملف الأصول، اربط أعمدته بحقول النظام — يُستورد كما هو وفق رقم الأصل ورقم اللوحة، بلا اختراع أو فقدان بيانات.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">١) رفع الملف</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="max-w-sm cursor-pointer"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {fileName ? (
            <Badge variant="secondary" className="gap-1">
              <FileSpreadsheet className="size-3" aria-hidden />
              {sourceRows.length} صف · {fileName}
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {headers.length > 0 ? (
        <>
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">٢) ربط الأعمدة</CardTitle>
              <CardDescription>رُبطت تلقائياً — صحّح أي حقل. (رقم الأصل ورقم اللوحة إلزاميان.)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">
                    {f.label}
                    {f.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Select
                    value={mapping[f.key] ?? NONE}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? "" : v }))}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— لا شيء</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs">التصنيف الافتراضي</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment">معدات</SelectItem>
                    <SelectItem value="vehicles">مركبات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع القراءة</Label>
                <Select value={readingKind} onValueChange={(v) => setReadingKind(v as typeof readingKind)}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    <SelectItem value="hours">ساعات تشغيل</SelectItem>
                    <SelectItem value="km">كيلومترات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">٣) معاينة واستيراد</CardTitle>
                <CardDescription className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary">صالح {stats.valid}</Badge>
                  {stats.dup ? <Badge variant="destructive">مكرر/موجود {stats.dup}</Badge> : null}
                  {stats.missing ? <Badge variant="outline">ناقص رقم/لوحة {stats.missing}</Badge> : null}
                </CardDescription>
              </div>
              <Button onClick={() => void runImport()} disabled={importing || stats.valid === 0}>
                <Upload className="size-4" aria-hidden />
                {importing ? "يستورد…" : `استيراد ${stats.valid} أصل`}
              </Button>
            </CardHeader>
            <CardContent className="p-0 px-4 pb-6">
              {progress ? (
                <div className="space-y-1 pb-3">
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div className="bg-primary h-full transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
                  </div>
                  <p className="text-muted-foreground text-[11px]">{progress.done} / {progress.total}</p>
                </div>
              ) : null}
              <div className="-mx-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الأصل</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>اللوحة</TableHead>
                      <TableHead>التسلسلي</TableHead>
                      <TableHead>Eqm Cls</TableHead>
                      <TableHead>الموقع</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>الوحدة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {built.slice(0, 12).map((b, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium tabular-nums" dir="ltr">{b.assetCode || "—"}</TableCell>
                        <TableCell>{b.assetName || "—"}</TableCell>
                        <TableCell dir="ltr">{b.plateNo || "—"}</TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs">{b.serialNo || "—"}</TableCell>
                        <TableCell>{b.equipmentClass || "—"}</TableCell>
                        <TableCell className="text-xs">{b.location || "—"}</TableCell>
                        <TableCell className="text-xs">{b.branch || "—"}</TableCell>
                        <TableCell className="text-xs">{b.businessUnit || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {built.length > 12 ? (
                <p className="text-muted-foreground pt-2 text-center text-xs">…وعرض أول ١٢ من {built.length} صفاً</p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
