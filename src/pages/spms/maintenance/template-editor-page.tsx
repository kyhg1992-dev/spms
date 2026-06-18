import { Plus, Sparkles, Trash2, Wand2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
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
import { useAuth } from "@/contexts/auth-context"
import { useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import { suggestServiceLevelsWithGemini } from "@/lib/gemini-client"
import {
  blankTemplateDraft,
  DEFAULT_LEVEL_NAMES,
  TEMPLATE_LIBRARY,
  type TemplateDraft,
} from "@/lib/maintenance-template-library"
import { ALL_SERVICE_CODES, serviceLevelColor, actionColor } from "@/lib/spms-colors"
import { sequenceOccurrenceLabels } from "@/lib/maintenance-sequence"
import type {
  MaintenanceActionCode,
  MaintenanceServiceCode,
  MaintenanceServiceTask,
  MeterReadingKind,
} from "@/models/firestore"
import { createMaintenanceTemplate, updateMaintenanceTemplate } from "@/services/firestore/spms-service"

const ACTIONS: { code: MaintenanceActionCode; ar: string }[] = [
  { code: "REPLACE", ar: "استبدال" },
  { code: "CLEAN", ar: "تنظيف" },
  { code: "CHECK", ar: "فحص" },
  { code: "DRAIN", ar: "تصريف" },
  { code: "GREASE", ar: "تشحيم" },
  { code: "ADJUST", ar: "ضبط" },
  { code: "WASH", ar: "غسيل" },
  { code: "REFILL", ar: "تعبئة" },
]

const KEY_STORAGE = "spms.geminiKey"
const TRIGGER_UNIT: Record<string, string> = { hours: "ساعة", km: "كم", time: "يوم" }

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const isEdit = !!templateId && templateId !== "new"
  const { spmsRole } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const templates = useMaintenanceTemplatesQuery()

  const [draft, setDraft] = useState<TemplateDraft>(() => blankTemplateDraft())
  const [apiKey, setApiKey] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const canManage = spmsRole === "admin" || spmsRole === "manager"

  useEffect(() => {
    try {
      const k = localStorage.getItem(KEY_STORAGE)
      if (k) setApiKey(k)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!isEdit || loaded) return
    const found = templates.data?.find((t) => t.id === templateId)
    if (found) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = found
      setDraft({ ...blankTemplateDraft(), ...rest, levels: rest.levels ?? blankTemplateDraft().levels })
      setLoaded(true)
    }
  }, [isEdit, loaded, templateId, templates.data])

  const levels = draft.levels ?? []

  function update(patch: Partial<TemplateDraft>) {
    setDraft((d) => ({ ...d, ...patch }))
  }
  function updateLevelTasks(code: string, tasks: MaintenanceServiceTask[]) {
    setDraft((d) => ({
      ...d,
      levels: (d.levels ?? []).map((l) => (l.code === code ? { ...l, tasks } : l)),
    }))
  }
  function updateLevelName(code: string, nameAr: string) {
    setDraft((d) => ({
      ...d,
      levels: (d.levels ?? []).map((l) => (l.code === code ? { ...l, nameAr } : l)),
    }))
  }
  function addTask(code: string) {
    const l = levels.find((x) => x.code === code)
    updateLevelTasks(code, [...(l?.tasks ?? []), { descAr: "", action: "CHECK", qty: "", itemCode: "", partNo: "" }])
  }
  function patchTask(code: string, idx: number, patch: Partial<MaintenanceServiceTask>) {
    const l = levels.find((x) => x.code === code)
    if (!l) return
    updateLevelTasks(code, l.tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }
  function removeTask(code: string, idx: number) {
    const l = levels.find((x) => x.code === code)
    if (!l) return
    updateLevelTasks(code, l.tasks.filter((_, i) => i !== idx))
  }
  function addLevel(code: string) {
    if (!code || levels.some((l) => l.code === code)) return
    setDraft((d) => ({
      ...d,
      levels: [
        ...(d.levels ?? []),
        { code: code as MaintenanceServiceCode, nameAr: DEFAULT_LEVEL_NAMES[code] ?? code, tasks: [] },
      ],
    }))
  }
  function updateLevelCode(oldCode: string, newCode: string) {
    if (oldCode === newCode || levels.some((l) => l.code === newCode)) return
    setDraft((d) => ({
      ...d,
      levels: (d.levels ?? []).map((l) =>
        l.code === oldCode ? { ...l, code: newCode as MaintenanceServiceCode } : l
      ),
      sequence: (d.sequence ?? []).map((c) => (c === oldCode ? (newCode as MaintenanceServiceCode) : c)),
    }))
  }
  function removeLevel(code: string) {
    setDraft((d) => ({
      ...d,
      levels: (d.levels ?? []).filter((l) => l.code !== code),
      sequence: (d.sequence ?? []).filter((c) => c !== code),
    }))
  }

  function applyLibrary(key: string) {
    const lib = TEMPLATE_LIBRARY.find((t) => t.key === key)
    if (lib) {
      setDraft({ ...lib.draft })
      toast.success("تم تحميل القالب الجاهز — عدّله كما تشاء")
    }
  }

  function setTrigger(mode: "hours" | "km" | "time") {
    const meterKind: MeterReadingKind = mode === "km" ? "odometer" : "operating_hours"
    update({ triggerMode: mode, meterKind })
  }

  async function aiSuggest() {
    if (!draft.assetTypeLabel?.trim() && !draft.name.trim()) {
      toast.error("اكتب نوع المعدة أولاً")
      return
    }
    setAiBusy(true)
    try {
      const res = await suggestServiceLevelsWithGemini(apiKey, draft.assetTypeLabel || draft.name)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const valid = res.levels
        .filter((l) => ["A", "B", "C", "D"].includes(l.code))
        .map((l) => ({
          code: l.code,
          nameAr: l.nameAr || l.code,
          nameEn: l.nameEn,
          tasks: (l.tasks ?? []).map((t) => ({
            descAr: t.descAr || t.descEn || "",
            descEn: t.descEn,
            itemCode: t.itemCode || undefined,
            qty: t.qty || undefined,
            action: (ACTIONS.find((a) => a.code === String(t.action).toUpperCase())?.code ?? "CHECK") as MaintenanceActionCode,
            partNo: t.partNo || undefined,
          })),
        }))
      if (valid.length) {
        update({ levels: valid })
        toast.success("اقترح Gemini المستويات والمهام — راجعها")
      } else {
        toast.error("لم يُقترح أي مستوى صالح")
      }
    } finally {
      setAiBusy(false)
    }
  }

  const preview = useMemo(() => {
    const seq = draft.sequence ?? []
    const step = draft.stepInterval || 0
    const labels = sequenceOccurrenceLabels(seq)
    return seq.map((code, i) => ({ at: step * (i + 1), code, label: labels[i] }))
  }, [draft.sequence, draft.stepInterval])

  async function save() {
    if (!spmsRole) return
    if (!draft.name.trim() || !draft.templateCode.trim()) {
      toast.error("أكمل اسم القالب ورمزه")
      return
    }
    if ((draft.sequence ?? []).length === 0) {
      toast.error("حدّد تسلسل التناوب")
      return
    }
    setSaving(true)
    try {
      const payload = { ...draft, name: draft.name.trim(), templateCode: draft.templateCode.trim() }
      const res = isEdit
        ? await updateMaintenanceTemplate(spmsRole, templateId!, payload)
        : await createMaintenanceTemplate(spmsRole, payload)
      if (res.error) {
        toast.error(res.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["maintenanceTemplates"] })
      toast.success(isEdit ? "تم حفظ القالب" : "تم إنشاء القالب")
      navigate("/dashboard/maintenance-templates")
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) return <Navigate to="/dashboard" replace />

  const unit = TRIGGER_UNIT[draft.triggerMode ?? "hours"]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">{isEdit ? "تعديل قالب الصيانة" : "قالب صيانة جديد"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">عرّف المستويات ومهامها وتسلسل التناوب — يرثها أمر العمل تلقائياً.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/maintenance-templates")}>إلغاء</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "يحفظ…" : "حفظ القالب"}</Button>
        </div>
      </div>

      {!isEdit && TEMPLATE_LIBRARY.length ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ابدأ من قالب جاهز</CardTitle>
            <CardDescription>اختر قالباً معدّاً ثم عدّله، أو ابنِ من الصفر بالأسفل.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {TEMPLATE_LIBRARY.map((t) => (
              <Button key={t.key} variant="outline" size="sm" onClick={() => applyLibrary(t.key)}>
                <Wand2 className="size-4" aria-hidden />
                {t.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">١) البيانات الأساسية</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">اسم القالب</Label>
            <Input id="name" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">رمز القالب</Label>
            <Input id="code" dir="ltr" value={draft.templateCode} onChange={(e) => update({ templateCode: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">نوع/موديل المعدة المطبّق</Label>
            <Input id="type" value={draft.assetTypeLabel ?? ""} onChange={(e) => update({ assetTypeLabel: e.target.value })} placeholder="مثل: رافعة كوماتسو WA380-6" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>المحفّز</Label>
              <Select value={draft.triggerMode ?? "hours"} onValueChange={(v) => setTrigger(v as "hours" | "km" | "time")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">ساعات تشغيل</SelectItem>
                  <SelectItem value="km">كيلومترات</SelectItem>
                  <SelectItem value="time">زمن (أيام)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="step">الفاصل ({unit})</Label>
              <Input id="step" type="number" min={1} value={draft.stepInterval} onChange={(e) => update({ stepInterval: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">٢) المستويات ومهامها</CardTitle>
            <CardDescription>كل مهمة: وصف + كود مخزون + كمية + إجراء + رقم قطعة.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              dir="ltr"
              placeholder="مفتاح Gemini"
              className="h-9 w-40"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                try { localStorage.setItem(KEY_STORAGE, e.target.value.trim()) } catch { /* ignore */ }
              }}
            />
            <Button variant="outline" size="sm" onClick={() => void aiSuggest()} disabled={aiBusy}>
              <Sparkles className="size-4" aria-hidden />
              {aiBusy ? "يقترح…" : "اقترح بالذكاء الاصطناعي"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {levels.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
              لا مستويات بعد. أضف الأكواد التي تناسب هذه المعدة من الأزرار الملوّنة بالأسفل — أي حروف A–Z، وليس بالضرورة A/B/C/D.
            </p>
          ) : null}
          {levels.map((lvl) => {
            const c = serviceLevelColor(lvl.code)
            return (
              <div key={lvl.code} className="rounded-lg border p-3" style={{ borderInlineStartWidth: 4, borderInlineStartColor: c.solid }}>
                <div className="mb-3 flex items-center gap-2">
                  <select
                    className="rounded-md px-2 py-1 text-sm font-bold text-white"
                    style={{ backgroundColor: c.solid }}
                    value={lvl.code}
                    onChange={(e) => updateLevelCode(lvl.code, e.target.value)}
                    aria-label="كود المستوى"
                  >
                    <option value={lvl.code}>{lvl.code}</option>
                    {ALL_SERVICE_CODES.filter((x) => !levels.some((l) => l.code === x)).map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                  <Input className="h-8 max-w-[200px]" value={lvl.nameAr} placeholder="اسم المستوى" onChange={(e) => updateLevelName(lvl.code, e.target.value)} />
                  <span className="text-muted-foreground text-xs">{lvl.tasks.length} مهمة</span>
                  <Button variant="outline" size="sm" className="ms-auto h-8 gap-1 text-destructive" onClick={() => removeLevel(lvl.code)}>
                    <Trash2 className="size-3.5" /> حذف المستوى
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground text-[11px]">
                        <th className="p-1 text-start">الوصف</th>
                        <th className="p-1 text-start">Item Code</th>
                        <th className="p-1 text-start w-14">كمية</th>
                        <th className="p-1 text-start w-28">إجراء</th>
                        <th className="p-1 text-start">رقم القطعة</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lvl.tasks.map((t, i) => (
                        <tr key={i}>
                          <td className="p-1"><Input className="h-8 min-w-[150px]" value={t.descAr} onChange={(e) => patchTask(lvl.code, i, { descAr: e.target.value })} /></td>
                          <td className="p-1"><Input className="h-8 min-w-[100px]" dir="ltr" value={t.itemCode ?? ""} onChange={(e) => patchTask(lvl.code, i, { itemCode: e.target.value })} /></td>
                          <td className="p-1"><Input className="h-8 w-14" value={t.qty ?? ""} onChange={(e) => patchTask(lvl.code, i, { qty: e.target.value })} /></td>
                          <td className="p-1">
                            <Select value={t.action} onValueChange={(v) => patchTask(lvl.code, i, { action: v as MaintenanceActionCode })}>
                              <SelectTrigger size="sm" className="min-w-[96px]">
                                <span style={{ color: actionColor(t.action).fg }}>{ACTIONS.find((a) => a.code === t.action)?.ar ?? t.action}</span>
                              </SelectTrigger>
                              <SelectContent>
                                {ACTIONS.map((a) => <SelectItem key={a.code} value={a.code}>{a.ar}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1"><Input className="h-8 min-w-[100px]" dir="ltr" value={t.partNo ?? ""} onChange={(e) => patchTask(lvl.code, i, { partNo: e.target.value })} /></td>
                          <td className="p-1">
                            <Button variant="ghost" size="icon" className="size-7" aria-label="حذف" onClick={() => removeTask(lvl.code, i)}><Trash2 className="size-3.5" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => addTask(lvl.code)}>
                  <Plus className="size-4" aria-hidden /> إضافة مهمة
                </Button>
              </div>
            )
          })}

          <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="text-muted-foreground text-xs">إضافة مستوى بكود:</span>
            {ALL_SERVICE_CODES.filter((c) => !levels.some((l) => l.code === c)).map((c) => {
              const cc = serviceLevelColor(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => addLevel(c)}
                  className="size-7 rounded-md text-xs font-bold transition hover:opacity-80"
                  style={{ backgroundColor: cc.bg, color: cc.fg }}
                  aria-label={`إضافة مستوى ${c}`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">٣) التناوب والمعاينة</CardTitle>
          <CardDescription>رتّب الأكواد المتكرّرة؛ تظهر المعاينة الزمنية فوراً.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>تسلسل التناوب</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {(draft.sequence ?? []).map((code, i) => {
                const c = serviceLevelColor(code)
                return (
                  <span key={i} className="inline-flex flex-col items-center gap-0.5">
                    <span className="inline-flex items-center gap-1">
                      <select
                        className="rounded-md border px-2 py-1 text-xs font-bold"
                        style={{ color: c.fg, backgroundColor: c.bg }}
                        value={code}
                        onChange={(e) => {
                          const next = [...(draft.sequence ?? [])]
                          next[i] = e.target.value as typeof code
                          update({ sequence: next })
                        }}
                      >
                        {levels.map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
                      </select>
                      <button className="text-muted-foreground hover:text-destructive text-xs" aria-label="حذف خطوة" onClick={() => update({ sequence: (draft.sequence ?? []).filter((_, j) => j !== i) })}>×</button>
                    </span>
                    <span className="text-muted-foreground text-[9px] font-medium tabular-nums">{preview[i]?.label ?? code}</span>
                  </span>
                )
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={levels.length === 0}
                onClick={() => {
                  const first = levels[0]?.code
                  if (first) update({ sequence: [...(draft.sequence ?? []), first] })
                }}
              >
                <Plus className="size-3.5" aria-hidden /> خطوة
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">يلتفّ بعد آخر خطوة. الطول الحالي: {(draft.sequence ?? []).length} خطوة.</p>
          </div>
          <div className="space-y-2">
            <Label>المعاينة الزمنية (دورة واحدة)</Label>
            <div className="rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {preview.map((p, i) => {
                  const c = serviceLevelColor(p.code)
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground tabular-nums">{p.at} {unit}</span>
                      <Badge className="text-[11px]" style={{ backgroundColor: c.bg, color: c.fg }}>{p.label}</Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
