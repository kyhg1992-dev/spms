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
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery } from "@/hooks/use-spms-data"
import { useI18n } from "@/i18n/i18n"
import type { Asset, MeterReadingKind } from "@/models/firestore"
import { createMeterReadingWithPMEngine } from "@/services/firestore/spms-service"

export default function MeterUpdatePage() {
  const { t } = useI18n()
  const { spmsRole, user } = useAuth()
  const assets = useAssetsQuery()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<(Asset & { id: string }) | null>(null)
  const [kind, setKind] = useState<MeterReadingKind>("odometer")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return (assets.data ?? [])
      .filter(
        (a) =>
          a.assetCode.toLowerCase().includes(q) ||
          (a.plateNo ?? "").toLowerCase().includes(q) ||
          a.assetName.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [assets.data, search])

  async function save() {
    if (!spmsRole || !user?.uid || !selected) return
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) {
      toast.error(t("meter.invalid"))
      return
    }
    setBusy(true)
    try {
      const res = await createMeterReadingWithPMEngine(spmsRole, {
        assetId: selected.id,
        kind,
        value: num,
        enteredByUid: user.uid,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["assets"] })
      toast.success(t("meter.saved"))
      setValue("")
      setSelected(null)
      setSearch("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Gauge className="size-6 text-primary" aria-hidden />
          {t("meter.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("meter.subtitle")}</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-3 py-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute inset-inline-start-2.5 top-2.5 size-4" aria-hidden />
            <Input
              className="ps-8"
              dir="ltr"
              placeholder={t("meter.search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelected(null)
              }}
            />
          </div>

          {!selected && search.trim() ? (
            matches.length === 0 ? (
              <p className="text-muted-foreground py-2 text-center text-sm">{t("meter.noResults")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {matches.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-muted/50"
                      onClick={() => {
                        setSelected(a)
                        setKind(a.odometer >= a.operatingHours ? "odometer" : "operating_hours")
                      }}
                    >
                      <span className="font-medium">{a.assetName}</span>
                      <span className="text-muted-foreground text-xs" dir="ltr">{a.assetCode} · {a.plateNo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </CardContent>
      </Card>

      {selected ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{selected.assetName}</CardTitle>
            <CardDescription dir="ltr">{selected.assetCode} · {selected.plateNo}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("meter.current")}: {Math.round(selected.operatingHours).toLocaleString("en-US")} {t("meter.hours")} ·{" "}
              {Math.round(selected.odometer).toLocaleString("en-US")} {t("meter.km")}
            </p>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("scan.type")}</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as MeterReadingKind)}>
                  <SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="odometer">{t("meter.km")}</SelectItem>
                    <SelectItem value="operating_hours">{t("meter.hours")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="reading" className="text-xs">{t("meter.newReading")}</Label>
                <Input id="reading" type="number" min={0} dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <Button disabled={busy} onClick={() => void save()}>{t("meter.save")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
