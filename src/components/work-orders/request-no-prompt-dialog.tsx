import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

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
import { useAuth } from "@/contexts/auth-context"
import { useI18n } from "@/i18n/i18n"
import { updateWorkOrder } from "@/services/firestore/spms-service"

/**
 * Prompts the manager for the originating request (CAM) number right after a work
 * order is generated. Saving or skipping calls onDone so the caller can navigate.
 */
export function RequestNoPromptDialog({
  workOrderId,
  open,
  onDone,
}: {
  workOrderId: string | null
  open: boolean
  onDone: () => void
}) {
  const { t } = useI18n()
  const { spmsRole } = useAuth()
  const queryClient = useQueryClient()
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setValue("")
  }, [open])

  async function save() {
    if (!spmsRole || !workOrderId) return onDone()
    setBusy(true)
    try {
      const res = await updateWorkOrder(spmsRole, workOrderId, {
        externalRequestNo: value.trim() || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDone() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reqp.title")}</DialogTitle>
          <DialogDescription>{t("reqp.hint")}</DialogDescription>
        </DialogHeader>
        <Input
          dir="ltr"
          autoFocus
          placeholder="REQ-2026-014532"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void save() }}
        />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onDone}>{t("reqp.later")}</Button>
          <Button disabled={busy} onClick={() => void save()}>{t("reqp.saveGo")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
