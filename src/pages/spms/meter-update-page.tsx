import { Gauge, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

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
import { useI18n } from "@/i18n/i18n"
import type { Asset, MeterReadingKind } from "@/models/firestore"
import { createMeterReadingWithPMEngine } from "@/services/firestore/spms-service"

type Row = Asset & { id: string }

function matchesQuery(a: Row, q: string): boolean {
  if (!q) return true
  return [a.assetCode, a.plateNo, a.assetName, a.branch, a.businessUnit, a.equipmentClass, a.location, a.department]
    .filter(Boolean)
    .some((f) => String(f).toLowerCase().includes(q))
}

export default function MeterUpdatePage() {
  const { t } = useI18n()
  const { spmsRole, user } = useAuth()
  const assets = useAssetsQuery()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<"single" | "bulk">("single")
  const [search, setSearch] = useState("")
  const [branch, setBranch] = useState("all")
  const [selected, setSelected] = useState<Row | null>(null)
  const [kind, setKind] = useState<MeterReadingKind>("odometer")
  const [value, setValue] = useState("")
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const branches = useMemo(() => {
    const set = new Set<string>()
    for (const a of assets.data ?? []) if (a.branch?.trim()) set.add(a.branch.trim())
    return Array.from(set).sort()
  }, [assets.data])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (assets.data ?? []).filter(
      (a) => matchesQuery(a, q) && (branch === "all" || (a.branch ?? "") === branch)
    )
  }, [assets.data, search, branch])

  const singleMatches = useMemo(() => (search.trim() ? matches.slice(0, 8) : []), [matches, search])
  const bulkRows = useMemo(() => matches.slice(0, 100), [matches])

  async function saveSingle() {
    if (!spmsRole || !user?.uid || !selected) return
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) return toast.error(t("meter.invalid"))
    setBusy(true)
    try {
      const res = await createMeterReadingWithPMEngine(spmsRole, { assetId: selected.id, kind, value: num, enteredByUid: user.uid })
      if (res.error) return toast.error(res.error)
      await queryClient.invalidateQueries({ queryKey: ["assets"] })
      toast.success(t("meter.saved"))
      setValue(""); setSelected(null); setSearch("")
    } finally {
      setBusy(false)
    }
  }

  async function saveBulk() {
    if (!spmsRole || !user?.uid) return
    const entries = Object.entries(bulkValues)
      .map(([id, v]) => ({ id, num: Number(v) }))
      .filter((e) => e.num > 0 && Number.isFinite(e.num))
    if (entries.length === 0) return toast.error(t("meter.invalid"))
    setBusy(true)
    let ok = 0
    const failed: string[] = []
    try {
      for (const e of entries) {
        const res = await createMeterReadingWithPMEngine(spmsRole, { assetId: e.id, kind, value: e.num, enteredByUid: user.uid })
        if (res.error) failed.push(e.id)
        else ok += 1
      }
      await queryClient.invalidateQueries({ queryKey: ["assets"] })
      if (ok > 0) toast.success(t("meter.savedN").replace("{n}", String(ok)))
      if (failed.length > 0) toast.error(t("meter.bulkRejected").replace("{n}", String(failed.length)))
      // Keep only the rejected rows so they can be corrected.
      setBulkValues((m) => Object.fromEntries(Object.entries(m).filter(([id]) => failed.includes(id))))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gauge className="size-6 text-primary" aria-hidden />
            {t("meter.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("meter.subtitle")}</p>
        </div>
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          <Button size="sm" variant={mode === "single" ? "default" : "ghost"} className="h-8" onClick={() => setMode("single")}>{t("meter.modeSingle")}</Button>
          <Button size="sm" variant={mode === "bulk" ? "default" : "ghost"} className="h-8" onClick={() => setMode("bulk")}>{t("meter.modeBulk")}</Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute inset-inline-start-2.5 top-2.5 size-4" aria-hidden />
              <Input
                className="ps-8"
                placeholder={t("meter.searchAny")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelected(null) }}
              />
            </div>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={t("meter.branch")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("meter.allBranches")}</SelectItem>
                {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={(v) => setKind(v as MeterReadingKind)}>
              <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="odometer">{t("meter.km")}</SelectItem>
                <SelectItem value="operating_hours">{t("meter.hours")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "single" ? (
            !selected && search.trim() ? (
              singleMatches.length === 0 ? (
                <p className="text-muted-foreground py-2 text-center text-sm">{t("meter.noResults")}</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {singleMatches.map((a) => (
                    <li key={a.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-muted/50" onClick={() => setSelected(a)}>
                        <span className="font-medium">{a.assetName}</span>
                        <span className="text-muted-foreground text-xs" dir="ltr">{a.assetCode} · {a.plateNo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null
          ) : (
            <p className="text-muted-foreground text-xs">{t("meter.bulkHint")}</p>
          )}
        </CardContent>
      </Card>

      {mode === "single" && selected ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{selected.assetName}</CardTitle>
            <CardDescription dir="ltr">{selected.assetCode} · {selected.plateNo}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("meter.current")}: {Math.round(selected.operatingHours).toLocaleString("en-US")} {t("meter.hours")} · {Math.round(selected.odometer).toLocaleString("en-US")} {t("meter.km")}
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="reading" className="text-xs">{t("meter.newReading")}</Label>
                <Input id="reading" type="number" min={0} dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <Button disabled={busy} onClick={() => void saveSingle()}>{t("meter.save")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "bulk" ? (
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-0 px-4 pb-4">
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("col.asset")}</TableHead>
                    <TableHead>{t("meter.branch")}</TableHead>
                    <TableHead>{t("meter.current")}</TableHead>
                    <TableHead className="w-36">{t("meter.newReading")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkRows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.assetName}</div>
                        <div className="text-muted-foreground text-xs" dir="ltr">{a.assetCode} · {a.plateNo}</div>
                      </TableCell>
                      <TableCell className="text-sm">{a.branch ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {Math.round(kind === "odometer" ? a.odometer : a.operatingHours).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          dir="ltr"
                          className="h-8"
                          value={bulkValues[a.id] ?? ""}
                          onChange={(e) => setBulkValues((m) => ({ ...m, [a.id]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end pt-3">
              <Button disabled={busy} onClick={() => void saveBulk()}>{busy ? "…" : t("meter.saveAll")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
