import type { AssetStatus } from "@/models/firestore"

/**
 * Browser-side Gemini client for AI-assisted asset import.
 *
 * The API key is supplied by the admin at runtime (kept in component memory only)
 * — it is never bundled, persisted, or sent to Firestore — so the public app does
 * not leak a key. For a hardened production setup this call belongs behind a Cloud
 * Function; this in-app path keeps the pilot self-contained.
 */

export type ParsedAssetDraft = {
  assetCode: string
  assetName: string
  category: "vehicles" | "equipment"
  plateNo: string
  brand: string
  model: string
  serialNo: string
  department: string
  location: string
  operatingHours: number
  odometer: number
  status: AssetStatus
  notes: string
  /** Short Arabic note on what the AI inferred/guessed for this row (audit aid). */
  inferenceNote: string
}

// Fastest available first. flash-lite is quickest for structured extraction; for
// every 2.5 model we disable "thinking" (see genConfig) which was the main latency.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"]

/** Build generationConfig, disabling thinking on 2.5-family models for speed. */
function genConfig(model: string, base: Record<string, unknown>): Record<string, unknown> {
  if (model.includes("2.5")) return { ...base, thinkingConfig: { thinkingBudget: 0 } }
  return base
}

const SYSTEM_PROMPT = `أنت مساعد لاستيراد بيانات أصول الصيانة. ستصلك بيانات خام (نص ملصوق من Excel أو CSV أو وصف حر) لأصول/معدات/مركبات.
حلّلها واستنبط الحقول، وأعد JSON فقط: مصفوفة كائنات، كل كائن بالحقول التالية حصراً:
- assetCode (نص، رمز الأصل؛ إن لم يوجد فاستنبط رمزاً منطقياً من النوع مثل "EQP-001")
- assetName (نص، اسم/تسمية الأصل بالعربية إن أمكن)
- category ("vehicles" للمركبات أو "equipment" للمعدات — استنبطها من الاسم)
- plateNo (نص، رقم اللوحة؛ للمعدات بلا لوحة استخدم "—")
- brand, model, serialNo (نصوص، فارغة إن لم تتوفر)
- department, location (نصوص)
- operatingHours, odometer (أرقام؛ 0 إن لم تتوفر)
- status ("active" أو "maintenance" أو "retired"؛ افتراضي "active")
- notes (نص)
- inferenceNote (نص عربي قصير يوضّح ما استُنبط أو خُمّن في هذا الصف؛ "—" إن كان كل شيء صريحاً)
أعد JSON صرفاً بلا أي شرح أو علامات code fence.`

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf("[")
  const end = body.lastIndexOf("]")
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

function coerceRow(raw: Record<string, unknown>): ParsedAssetDraft {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v))
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const category = str(raw.category) === "vehicles" ? "vehicles" : "equipment"
  const statusRaw = str(raw.status)
  const status: AssetStatus =
    statusRaw === "maintenance" || statusRaw === "retired" ? statusRaw : "active"
  return {
    assetCode: str(raw.assetCode),
    assetName: str(raw.assetName),
    category,
    plateNo: str(raw.plateNo) || "—",
    brand: str(raw.brand),
    model: str(raw.model),
    serialNo: str(raw.serialNo),
    department: str(raw.department),
    location: str(raw.location),
    operatingHours: num(raw.operatingHours),
    odometer: num(raw.odometer),
    status,
    notes: str(raw.notes),
    inferenceNote: str(raw.inferenceNote) || "—",
  }
}

/* -------------------------------------------------------------------------- */
/* Maintenance template suggestion                                            */
/* -------------------------------------------------------------------------- */

export type SuggestedTask = {
  descAr: string
  descEn?: string
  itemCode?: string
  qty?: string
  action: string
  partNo?: string
}
export type SuggestedLevel = { code: "A" | "B" | "C" | "D"; nameAr: string; nameEn?: string; tasks: SuggestedTask[] }

const TEMPLATE_PROMPT = `أنت خبير صيانة معدات ثقيلة. سيصلك وصف نوع معدة/مركبة.
اقترح قالب صيانة وقائية بأربعة مستويات A/B/C/D حيث:
A=شاملة Comprehensive، B=كبيرة Major، C=متوسطة Intermediate، D=صغرى Minor.
كل مستوى له قائمة مهام؛ كل مهمة: descAr (عربي)، descEn (إنجليزي)، itemCode (كود مخزون مقترح أو "")، qty (كمية كنص)، action (واحد من: REPLACE,CLEAN,CHECK,DRAIN,GREASE,ADJUST,WASH,REFILL)، partNo (رقم قطعة أو "").
المستوى الأعلى يشمل مهام الأدنى ويزيد. أعد JSON فقط: مصفوفة من 4 كائنات بالحقول { code, nameAr, nameEn, tasks:[...] } بترتيب A,B,C,D. بلا أي شرح أو code fence.`

export async function suggestServiceLevelsWithGemini(
  apiKey: string,
  assetTypeDescription: string
): Promise<{ ok: true; levels: SuggestedLevel[] } | { ok: false; error: string }> {
  if (!apiKey.trim()) return { ok: false, error: "أدخل مفتاح Gemini" }
  if (!assetTypeDescription.trim()) return { ok: false, error: "اكتب وصف نوع المعدة أولاً" }

  let lastError = "تعذّر الاتصال بـ Gemini"
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey.trim() },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${TEMPLATE_PROMPT}\n\nنوع المعدة:\n${assetTypeDescription}` }] }],
            generationConfig: genConfig(model, { temperature: 0.3, maxOutputTokens: 8192 }),
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        lastError = json?.error?.message ?? `HTTP ${res.status}`
        continue
      }
      const text: string =
        json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? ""
      const parsed = JSON.parse(extractJson(text)) as unknown
      if (!Array.isArray(parsed)) return { ok: false, error: "رد غير متوقّع من Gemini" }
      return { ok: true, levels: parsed as SuggestedLevel[] }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, error: lastError }
}

export async function analyzeAssetsWithGemini(
  apiKey: string,
  rawText: string
): Promise<{ ok: true; rows: ParsedAssetDraft[] } | { ok: false; error: string }> {
  if (!apiKey.trim()) return { ok: false, error: "أدخل مفتاح Gemini" }
  if (!rawText.trim()) return { ok: false, error: "ألصق بيانات الأصول أولاً" }

  let lastError = "تعذّر الاتصال بـ Gemini"
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey.trim() },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nالبيانات:\n${rawText}` }] }],
            generationConfig: genConfig(model, { temperature: 0.2, maxOutputTokens: 8192 }),
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        lastError = json?.error?.message ?? `HTTP ${res.status}`
        continue
      }
      const text: string =
        json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? ""
      const parsed = JSON.parse(extractJson(text)) as unknown
      if (!Array.isArray(parsed)) return { ok: false, error: "رد غير متوقّع من Gemini" }
      return { ok: true, rows: parsed.map((r) => coerceRow(r as Record<string, unknown>)) }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, error: lastError }
}
