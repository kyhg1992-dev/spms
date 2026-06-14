import { CheckCircle2, ClipboardCheck, FilePenLine, Play, RotateCcw, Send, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { WorkOrderReassignmentDialog } from "@/components/work-orders/work-order-reassignment-dialog"
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
import { useAuth } from "@/contexts/auth-context"
import { createOfflineExecutionDraft } from "@/lib/mobile-technician"
import { canCompleteExecution, canSaveExecutionDraft, canStartExecution } from "@/lib/technician-execution"
import {
  getWorkOrderLifecycleStatus,
  validateWorkOrderTransition,
} from "@/lib/work-order-lifecycle"
import type { WorkOrder } from "@/models/firestore"
import {
  approveWorkOrder,
  closeWorkOrder,
  completeTechnicianExecution,
  rejectWorkOrder,
  saveTechnicianExecutionDraft,
  startTechnicianExecution,
  transitionWorkOrder,
} from "@/services/firestore/spms-service"

type ActionDialog = "draft" | "complete" | "reject" | null

type WorkOrderOperationalActionsProps = {
  workOrder: WorkOrder & { id: string }
  dir?: "rtl" | "ltr"
  language?: "ar" | "en"
}

const text = {
  ar: {
    title: "إجراءات تشغيلية",
    missingAuth: "يتطلب الإجراء مستخدما نشطا وصلاحية SPMS.",
    managerOnly: "متاح للمدير أو مسؤول النظام فقط.",
    start: "بدء التنفيذ",
    draft: "حفظ مسودة",
    complete: "إكمال التنفيذ",
    sendApproval: "إرسال للاعتماد",
    approve: "اعتماد",
    reject: "رفض",
    close: "إغلاق",
    reassign: "إعادة إسناد",
    completionNotes: "ملاحظات الإكمال",
    technicianNotes: "ملاحظات الفني",
    laborHours: "ساعات العمل",
    downtimeHours: "ساعات التوقف",
    safetyNotes: "ملاحظات السلامة",
    partsNote: "ملاحظة قطع الغيار",
    rejectionReason: "سبب الرفض",
    executionDescription: "يتم حفظ بيانات التنفيذ على أمر العمل نفسه.",
    offlineReady: "جاهز لمسودة محلية",
    quickNote: "ملاحظة سريعة",
    cancel: "إلغاء",
    submit: "تنفيذ",
    saved: "تم تنفيذ الإجراء التشغيلي.",
  },
  en: {
    title: "Operational Actions",
    missingAuth: "A signed-in SPMS user and role are required.",
    managerOnly: "Available to manager or system admin only.",
    start: "Start Execution",
    draft: "Save Draft",
    complete: "Complete Execution",
    sendApproval: "Send to Approval",
    approve: "Approve",
    reject: "Reject",
    close: "Close",
    reassign: "Reassign",
    completionNotes: "Completion Notes",
    technicianNotes: "Technician Notes",
    laborHours: "Labor Hours",
    downtimeHours: "Downtime Hours",
    safetyNotes: "Safety Notes",
    partsNote: "Required Parts Note",
    rejectionReason: "Rejection Reason",
    executionDescription: "Execution data is saved directly on the work order.",
    offlineReady: "Local draft ready",
    quickNote: "Quick Note",
    cancel: "Cancel",
    submit: "Submit",
    saved: "Operational action completed.",
  },
}

function firstReason(errors: string[], fallback: string): string {
  return errors[0] ?? fallback
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function canManage(role: string | null): boolean {
  return role === "admin" || role === "manager"
}

export function WorkOrderOperationalActions({
  workOrder,
  dir = "rtl",
  language = "ar",
}: WorkOrderOperationalActionsProps) {
  const labels = text[language]
  const { spmsRole, user } = useAuth()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<ActionDialog>(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [technicianNotes, setTechnicianNotes] = useState(workOrder.technicianNotes ?? "")
  const [completionNotes, setCompletionNotes] = useState(workOrder.completionNotes ?? "")
  const [laborHours, setLaborHours] = useState(String(workOrder.actualLaborHours ?? workOrder.laborHours ?? ""))
  const [downtimeHours, setDowntimeHours] = useState(String(workOrder.actualDowntimeHours ?? workOrder.downtimeHours ?? ""))
  const [safetyNotes, setSafetyNotes] = useState(workOrder.safetyNotes ?? "")
  const [partsNote, setPartsNote] = useState(workOrder.requiredPartsNote ?? "")
  const [rejectionReason, setRejectionReason] = useState("")

  const lifecycleStatus = getWorkOrderLifecycleStatus(workOrder)
  const hasAuth = !!spmsRole && !!user?.uid
  const manager = canManage(spmsRole)

  const validation = useMemo(() => {
    const start = canStartExecution(workOrder)
    const draft = canSaveExecutionDraft(workOrder)
    const complete = canCompleteExecution(workOrder, {
      completionNotes: completionNotes.trim() || "ready",
      actualLaborHours: parseNumber(laborHours) ?? 0,
    })
    const approval = spmsRole
      ? validateWorkOrderTransition({
          workOrder,
          targetStatus: "WAITING_APPROVAL",
          actorRole: spmsRole,
          approvalRequired: true,
        })
      : { ok: false, errors: [labels.missingAuth] }
    const close = spmsRole
      ? validateWorkOrderTransition({
          workOrder,
          targetStatus: "CLOSED",
          actorRole: spmsRole,
        })
      : { ok: false, errors: [labels.missingAuth] }
    return { start, draft, complete, approval, close }
  }, [completionNotes, labels.missingAuth, laborHours, spmsRole, workOrder])

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  async function runAction(name: string, action: () => Promise<{ error: string | null }>) {
    if (!spmsRole || !user?.uid) {
      toast.error(labels.missingAuth)
      return
    }
    setBusyAction(name)
    try {
      const result = await action()
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(labels.saved)
      setDialog(null)
      await refresh()
    } finally {
      setBusyAction(null)
    }
  }

  const draftPayload = {
    technicianNotes,
    completionNotes,
    actualLaborHours: parseNumber(laborHours),
    actualDowntimeHours: parseNumber(downtimeHours),
    requiredPartsNote: partsNote,
    safetyNotes,
  }
  const offlineDraft =
    user?.uid
      ? createOfflineExecutionDraft({
          workOrderId: workOrder.id,
          technicianUid: user.uid,
          technicianNotes,
          completionNotes,
          actualLaborHours: parseNumber(laborHours),
          actualDowntimeHours: parseNumber(downtimeHours),
        })
      : null

  return (
    <div dir={dir} className="rounded-xl border border-border/70 bg-card p-3 sm:p-4 print:hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{labels.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          {offlineDraft ? (
            <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
              {labels.offlineReady}
            </span>
          ) : null}
          <span className="text-muted-foreground text-xs">{lifecycleStatus}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !validation.start.ok || busyAction !== null}
          title={!hasAuth ? labels.missingAuth : firstReason(validation.start.errors, "")}
          onClick={() =>
            void runAction(labels.start, () =>
              startTechnicianExecution(spmsRole!, workOrder.id, user!.uid)
            )
          }
        >
          <Play className="size-4" />
          {labels.start}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !validation.draft.ok || busyAction !== null}
          title={!hasAuth ? labels.missingAuth : firstReason(validation.draft.errors, "")}
          onClick={() => setDialog("draft")}
        >
          <FilePenLine className="size-4" />
          {labels.draft}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !validation.complete.ok || busyAction !== null}
          title={!hasAuth ? labels.missingAuth : firstReason(validation.complete.errors, "")}
          onClick={() => setDialog("complete")}
        >
          <ClipboardCheck className="size-4" />
          {labels.complete}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !validation.approval.ok || busyAction !== null}
          title={!hasAuth ? labels.missingAuth : firstReason(validation.approval.errors, "")}
          onClick={() =>
            void runAction(labels.sendApproval, () =>
              transitionWorkOrder(spmsRole!, {
                workOrderId: workOrder.id,
                actorUid: user!.uid,
                targetStatus: "WAITING_APPROVAL",
                approvalRequired: true,
              })
            )
          }
        >
          <Send className="size-4" />
          {labels.sendApproval}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !manager || lifecycleStatus !== "WAITING_APPROVAL" || busyAction !== null}
          title={!manager ? labels.managerOnly : undefined}
          onClick={() =>
            void runAction(labels.approve, () => approveWorkOrder(spmsRole!, workOrder.id, user!.uid))
          }
        >
          <CheckCircle2 className="size-4" />
          {labels.approve}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !manager || lifecycleStatus !== "WAITING_APPROVAL" || busyAction !== null}
          title={!manager ? labels.managerOnly : undefined}
          onClick={() => setDialog("reject")}
        >
          <XCircle className="size-4" />
          {labels.reject}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !manager || !validation.close.ok || busyAction !== null}
          title={!manager ? labels.managerOnly : firstReason(validation.close.errors, "")}
          onClick={() =>
            void runAction(labels.close, () => closeWorkOrder(spmsRole!, workOrder.id, user!.uid))
          }
        >
          <CheckCircle2 className="size-4" />
          {labels.close}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !manager || lifecycleStatus === "CLOSED" || lifecycleStatus === "CANCELLED"}
          title={!manager ? labels.managerOnly : undefined}
          onClick={() => setReassignOpen(true)}
        >
          <RotateCcw className="size-4" />
          {labels.reassign}
        </Button>
      </div>

      <ExecutionDialog
        open={dialog === "draft" || dialog === "complete"}
        title={dialog === "complete" ? labels.complete : labels.draft}
        labels={labels}
        busy={busyAction !== null}
        completionNotes={completionNotes}
        technicianNotes={technicianNotes}
        laborHours={laborHours}
        downtimeHours={downtimeHours}
        safetyNotes={safetyNotes}
        partsNote={partsNote}
        dir={dir}
        setCompletionNotes={setCompletionNotes}
        setTechnicianNotes={setTechnicianNotes}
        setLaborHours={setLaborHours}
        setDowntimeHours={setDowntimeHours}
        setSafetyNotes={setSafetyNotes}
        setPartsNote={setPartsNote}
        onOpenChange={(open) => setDialog(open ? dialog : null)}
        onSubmit={() =>
          void runAction(dialog === "complete" ? labels.complete : labels.draft, () =>
            dialog === "complete"
              ? completeTechnicianExecution(spmsRole!, {
                  workOrderId: workOrder.id,
                  technicianUid: user!.uid,
                  draft: draftPayload,
                })
              : saveTechnicianExecutionDraft(spmsRole!, {
                  workOrderId: workOrder.id,
                  technicianUid: user!.uid,
                  draft: draftPayload,
                })
          )
        }
      />

      <RejectDialog
        open={dialog === "reject"}
        labels={labels}
        busy={busyAction !== null}
        rejectionReason={rejectionReason}
        dir={dir}
        setRejectionReason={setRejectionReason}
        onOpenChange={(open) => setDialog(open ? "reject" : null)}
        onSubmit={() =>
          void runAction(labels.reject, () =>
            rejectWorkOrder(spmsRole!, {
              workOrderId: workOrder.id,
              actorUid: user!.uid,
              rejectionReason,
            })
          )
        }
      />

      <WorkOrderReassignmentDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        workOrder={workOrder}
        onReassigned={() => void refresh()}
        dir={dir}
      />
    </div>
  )
}

type Labels = typeof text.ar

function ExecutionDialog(props: {
  open: boolean
  title: string
  labels: Labels
  dir: "rtl" | "ltr"
  busy: boolean
  completionNotes: string
  technicianNotes: string
  laborHours: string
  downtimeHours: string
  safetyNotes: string
  partsNote: string
  setCompletionNotes: (value: string) => void
  setTechnicianNotes: (value: string) => void
  setLaborHours: (value: string) => void
  setDowntimeHours: (value: string) => void
  setSafetyNotes: (value: string) => void
  setPartsNote: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent dir={props.dir} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.labels.executionDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={props.labels.technicianNotes}>
            <Textarea
              rows={3}
              value={props.technicianNotes}
              placeholder={props.labels.quickNote}
              onChange={(event) => props.setTechnicianNotes(event.target.value)}
            />
          </Field>
          <Field label={props.labels.completionNotes}>
            <Textarea rows={3} value={props.completionNotes} onChange={(event) => props.setCompletionNotes(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={props.labels.laborHours}>
              <Input type="number" min="0" step="0.25" value={props.laborHours} onChange={(event) => props.setLaborHours(event.target.value)} />
            </Field>
            <Field label={props.labels.downtimeHours}>
              <Input type="number" min="0" step="0.25" value={props.downtimeHours} onChange={(event) => props.setDowntimeHours(event.target.value)} />
            </Field>
          </div>
          <Field label={props.labels.safetyNotes}>
            <Textarea value={props.safetyNotes} onChange={(event) => props.setSafetyNotes(event.target.value)} />
          </Field>
          <Field label={props.labels.partsNote}>
            <Textarea value={props.partsNote} onChange={(event) => props.setPartsNote(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={props.busy} onClick={() => props.onOpenChange(false)}>
            {props.labels.cancel}
          </Button>
          <Button type="button" disabled={props.busy} onClick={props.onSubmit}>
            {props.labels.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog(props: {
  open: boolean
  labels: Labels
  dir: "rtl" | "ltr"
  busy: boolean
  rejectionReason: string
  setRejectionReason: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent dir={props.dir} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.labels.reject}</DialogTitle>
          <DialogDescription>{props.labels.rejectionReason}</DialogDescription>
        </DialogHeader>
        <Field label={props.labels.rejectionReason}>
          <Textarea
            rows={4}
            value={props.rejectionReason}
            onChange={(event) => props.setRejectionReason(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={props.busy} onClick={() => props.onOpenChange(false)}>
            {props.labels.cancel}
          </Button>
          <Button type="button" variant="destructive" disabled={props.busy} onClick={props.onSubmit}>
            {props.labels.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
