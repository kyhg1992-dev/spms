import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { useAssetsQuery } from "@/hooks/use-spms-data"
import { assetCategoryAr } from "@/lib/asset-categories"
import { updateAsset } from "@/services/firestore/spms-service"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string
  templateName: string
}

export function TemplateApplyDialog({ open, onOpenChange, templateId, templateName }: Props) {
  const { spmsRole } = useAuth()
  const queryClient = useQueryClient()
  const assets = useAssetsQuery()
  const [category, setCategory] = useState<"all" | "vehicles" | "equipment">("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const rows = useMemo(
    () => (assets.data ?? []).filter((a) => category === "all" || a.category === category),
    [assets.data, category]
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(rows.map((r) => r.id)))
  }
  function clearAll() {
    setSelected(new Set())
  }

  async function apply() {
    if (!spmsRole || selected.size === 0) return
    setBusy(true)
    let ok = 0
    try {
      for (const id of selected) {
        const res = await updateAsset(spmsRole, id, { maintenanceTemplateId: templateId })
        if (!res.error) ok += 1
      }
      await queryClient.invalidateQueries({ queryKey: ["assets"] })
      toast.success(`تم تطبيق القالب على ${ok} أصل`)
      onOpenChange(false)
      setSelected(new Set())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تطبيق القالب على أصول</DialogTitle>
          <DialogDescription>
            «{templateName}» — اختر الأصول. (قراءة «آخر خدمة» تُحدَّد لكل أصل من صفحته لاحقاً.)
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              <SelectItem value="vehicles">مركبات</SelectItem>
              <SelectItem value="equipment">معدات</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>تحديد الكل</Button>
            <Button variant="outline" size="sm" onClick={clearAll}>مسح</Button>
          </div>
        </div>

        <div className="max-h-[320px] space-y-1 overflow-y-auto pe-1">
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">لا أصول في هذه الفئة.</p>
          ) : (
            rows.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                <span className="flex-1">
                  <span className="font-medium">{a.assetName}</span>
                  <span className="text-muted-foreground"> · {a.assetCode}</span>
                </span>
                <Badge variant="outline" className="text-[11px]">{assetCategoryAr(a.category)}</Badge>
                {a.maintenanceTemplateId === templateId ? (
                  <Badge variant="secondary" className="text-[11px]">مطبّق</Badge>
                ) : null}
              </label>
            ))
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button disabled={busy || selected.size === 0} onClick={() => void apply()}>
            {busy ? "يطبّق…" : `تطبيق على المحدّد (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
