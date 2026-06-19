import { Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/i18n/i18n"
import type { TechnicianExecutionDraft } from "@/lib/technician-execution"
import type { WorkOrder } from "@/models/firestore"

type CheckRow = { id: string; labelAr: string; isDone: boolean; qtyUsed: string }
type ExtraRow = { desc: string; qty: string }

const MAX_PHOTOS = 4

/** Compress an image file to a small JPEG data URL (max 1000px, ~q0.6). */
function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("read"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("img"))
      img.onload = () => {
        const max = 1000
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("ctx"))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.6))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function initialChecklist(wo: WorkOrder): CheckRow[] {
  if (wo.executionChecklist?.length) {
    return wo.executionChecklist.map((c) => ({
      id: c.id,
      labelAr: c.labelAr,
      isDone: c.isDone,
      qtyUsed: c.qtyUsed ?? "",
    }))
  }
  return (wo.serviceTasks ?? []).map((task, i) => ({
    id: `task-${i}`,
    labelAr: task.descAr,
    isDone: false,
    qtyUsed: task.qty ?? "",
  }))
}

export function WorkOrderExecutionDialog({
  workOrder,
  open,
  mode,
  busy,
  onOpenChange,
  onSubmit,
}: {
  workOrder: WorkOrder
  open: boolean
  mode: "draft" | "complete"
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: TechnicianExecutionDraft) => void
}) {
  const { t, dir } = useI18n()
  const [checklist, setChecklist] = useState<CheckRow[]>(() => initialChecklist(workOrder))
  const [extras, setExtras] = useState<ExtraRow[]>(workOrder.extraItems?.map((e) => ({ desc: e.desc, qty: e.qty ?? "" })) ?? [])
  const [completionNotes, setCompletionNotes] = useState(workOrder.completionNotes ?? "")
  const [observationNotes, setObservationNotes] = useState(workOrder.observationNotes ?? "")
  const [partsNote, setPartsNote] = useState(workOrder.requiredPartsNote ?? "")
  const [safetyNotes, setSafetyNotes] = useState(workOrder.safetyNotes ?? "")
  const [photos, setPhotos] = useState<string[]>(workOrder.executionPhotos ?? [])

  useEffect(() => {
    if (!open) return
    setChecklist(initialChecklist(workOrder))
    setExtras(workOrder.extraItems?.map((e) => ({ desc: e.desc, qty: e.qty ?? "" })) ?? [])
    setCompletionNotes(workOrder.completionNotes ?? "")
    setObservationNotes(workOrder.observationNotes ?? "")
    setPartsNote(workOrder.requiredPartsNote ?? "")
    setSafetyNotes(workOrder.safetyNotes ?? "")
    setPhotos(workOrder.executionPhotos ?? [])
  }, [open, workOrder])

  async function addPhotos(files: FileList | null) {
    if (!files) return
    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files).slice(0, Math.max(0, room))
    for (const f of picked) {
      try {
        const url = await fileToCompressedDataUrl(f)
        setPhotos((p) => (p.length >= MAX_PHOTOS ? p : [...p, url]))
      } catch {
        toast.error("تعذّر معالجة الصورة")
      }
    }
  }

  function submit() {
    onSubmit({
      completionNotes,
      observationNotes,
      requiredPartsNote: partsNote,
      safetyNotes,
      executionPhotos: photos,
      executionChecklist: checklist.map((c) => ({
        id: c.id,
        labelAr: c.labelAr,
        isDone: c.isDone,
        qtyUsed: c.qtyUsed.trim() || undefined,
      })),
      extraItems: extras.filter((e) => e.desc.trim()).map((e) => ({ desc: e.desc.trim(), qty: e.qty.trim() || undefined })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "complete" ? t("exec.summary") : t("exec.checklist")}</DialogTitle>
          <DialogDescription>{t("exec.summaryHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {checklist.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs">{t("exec.checklist")}</Label>
              <div className="space-y-1.5">
                {checklist.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                    <input
                      type="checkbox"
                      checked={c.isDone}
                      onChange={(e) =>
                        setChecklist((list) => list.map((x, i) => (i === idx ? { ...x, isDone: e.target.checked } : x)))
                      }
                      aria-label={c.labelAr}
                    />
                    <span className={`flex-1 text-sm ${c.isDone ? "" : "text-muted-foreground"}`}>{c.labelAr}</span>
                    <Input
                      className="h-8 w-24"
                      placeholder={t("exec.qtyUsed")}
                      value={c.qtyUsed}
                      onChange={(e) =>
                        setChecklist((list) => list.map((x, i) => (i === idx ? { ...x, qtyUsed: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("exec.extraItems")}</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1" onClick={() => setExtras((e) => [...e, { desc: "", qty: "" }])}>
                <Plus className="size-3.5" /> {t("exec.addItem")}
              </Button>
            </div>
            {extras.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="h-8 flex-1"
                  placeholder={t("exec.itemDesc")}
                  value={row.desc}
                  onChange={(e) => setExtras((list) => list.map((x, i) => (i === idx ? { ...x, desc: e.target.value } : x)))}
                />
                <Input
                  className="h-8 w-24"
                  placeholder={t("exec.qtyUsed")}
                  value={row.qty}
                  onChange={(e) => setExtras((list) => list.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
                />
                <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setExtras((list) => list.filter((_, i) => i !== idx))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Field label={t("exec.completionNotes")}>
            <Textarea rows={2} value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} />
          </Field>
          <Field label={t("exec.observation")}>
            <Textarea rows={2} value={observationNotes} onChange={(e) => setObservationNotes(e.target.value)} />
          </Field>
          <Field label={t("exec.partsNote")}>
            <Textarea rows={2} value={partsNote} onChange={(e) => setPartsNote(e.target.value)} />
          </Field>
          <Field label={t("exec.safetyNotes")}>
            <Textarea rows={2} value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)} />
          </Field>

          <div className="space-y-2">
            <Label className="text-xs">{t("exec.photos")} ({photos.length}/{MAX_PHOTOS})</Label>
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="size-16 rounded-md border object-cover" />
                  <button
                    type="button"
                    aria-label="حذف"
                    className="absolute -end-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"
                    onClick={() => setPhotos((p) => p.filter((_, x) => x !== i))}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <label className="flex size-16 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/40">
                  <Plus className="size-5" />
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void addPhotos(e.target.files)} />
                </label>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={busy} onClick={submit}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
