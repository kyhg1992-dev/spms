import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useI18n, useLabels } from "@/i18n/i18n"
import type { WorkOrder, WorkOrderPriority } from "@/models/firestore"
import { updateWorkOrder } from "@/services/firestore/spms-service"

const PRIORITIES: WorkOrderPriority[] = ["low", "medium", "high", "critical"]

export function WorkOrderEditDialog({
  workOrder,
  open,
  onOpenChange,
}: {
  workOrder: WorkOrder & { id: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const L = useLabels()
  const { spmsRole } = useAuth()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(workOrder.title)
  const [description, setDescription] = useState(workOrder.description)
  const [priority, setPriority] = useState<WorkOrderPriority>(workOrder.priority)
  const [internalNotes, setInternalNotes] = useState(workOrder.internalNotes ?? "")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(workOrder.title)
    setDescription(workOrder.description)
    setPriority(workOrder.priority)
    setInternalNotes(workOrder.internalNotes ?? "")
  }, [open, workOrder])

  async function save() {
    if (!spmsRole) return
    setBusy(true)
    try {
      const res = await updateWorkOrder(spmsRole, workOrder.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        internalNotes: internalNotes.trim() || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t("woedit.saved"))
      await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("woedit.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="wo-title">{t("woedit.titleField")}</Label>
            <Input id="wo-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-desc">{t("woedit.desc")}</Label>
            <Textarea id="wo-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("woedit.priority")}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as WorkOrderPriority)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{L.priority(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-internal">{t("woedit.internalNotes")}</Label>
            <Textarea id="wo-internal" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={busy || !title.trim()} onClick={() => void save()}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
