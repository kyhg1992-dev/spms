// Calls Google Gemini to generate a design + icon system proposal for SPMS.
// Usage:
//   1) Get an API key: https://aistudio.google.com/apikey  (project gen-lang-client-0661525918)
//   2) Put it in a local file `.env.gemini` as:  GEMINI_API_KEY=your_key_here
//      (this file is git-ignored — the key never enters the chat or the repo)
//   3) Run:  node scripts/gemini-design.mjs
//
// Optional: set GEMINI_MODEL (default: gemini-2.5-pro). Output is written to GEMINI_DESIGN_OUTPUT.md
import fs from "node:fs"
import path from "node:path"

function readKey() {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim()
  const p = path.join(process.cwd(), ".env.gemini")
  if (fs.existsSync(p)) {
    const m = fs.readFileSync(p, "utf8").match(/GEMINI_API_KEY\s*=\s*(.+)/)
    if (m) return m[1].trim().replace(/^["']|["']$/g, "")
  }
  throw new Error(
    "No GEMINI_API_KEY. Get one at https://aistudio.google.com/apikey and put GEMINI_API_KEY=... in .env.gemini"
  )
}

const MODELS = process.env.GEMINI_MODEL?.trim()
  ? [process.env.GEMINI_MODEL.trim()]
  : ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-flash-latest"]

const PROMPT = `أنت مصمم منتجات أول ومتخصص في أنظمة إدارة الصيانة (CMMS) باللغة العربية واتجاه RTL.

السياق: نظام اسمه SPMS (نظام صيانة وقائية). React + Tailwind + shadcn/ui، يستخدم أيقونات lucide-react. الوحدات: لوحة المعلومات، الأصول، أوامر العمل، الصيانة الوقائية (محرك تسلسل A/B/C/D)، الإشعارات، التقارير، المستخدمون، الإعدادات. الأدوار: مدير، مسؤول، فني، طالب خدمة. حالات المعدات: نشط/صيانة/متوقف. حالات PM: سليم/قريب الاستحقاق/متأخر/حرج.

المطلوب منك تسليم مقترح متكامل بالعربية يتضمن:

1) نظام أيقونات موحّد (icon system): لكل وحدة وكل حالة وكل إجراء رئيسي، حدّد اسم أيقونة lucide-react المناسب بالضبط (kebab-case، مثل clipboard-list)، مع جدول: العنصر | اسم الأيقونة | السبب. غطِّ: الوحدات الثمانية، حالات المعدات الثلاث، حالات PM الأربع، رموز الخدمة A/B/C/D، وإجراءات (إضافة، تعديل، حذف، بدء تنفيذ، إكمال، تفويض، اعتماد، رفض، بحث، تصفية، تصدير).

2) هوية بصرية ونظام تصميم: لوحة ألوان (مع رموز hex) للوضعين الفاتح والداكن، خط عربي مقترح، مقاسات الخطوط، نصف القطر، التباعد، وأسلوب المكوّنات (بطاقات، شارات حالة، أزرار، جداول).

3) إرشادات RTL: قواعد لتفادي تداخل الأيقونات مع النص، ومواضع زر الإغلاق في النوافذ، واتجاه الأسهم.

4) توصية نهائية موجزة: أي اتجاه بصري هو الأمثل لنظام صيانة مؤسسي عربي ولماذا.

اكتب ردّاً منظّماً بعناوين Markdown واضحة. كن دقيقاً وعملياً وقابلاً للتطبيق المباشر على الكود.`

async function callModel(key, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  })
  const json = await res.json()
  return { ok: res.ok, status: res.status, json }
}

async function main() {
  const key = readKey()
  let used = ""
  let result = null
  for (const model of MODELS) {
    const r = await callModel(key, model)
    if (r.ok) {
      used = model
      result = r.json
      break
    }
    console.error(`• ${model} → HTTP ${r.status}: ${r.json?.error?.message ?? "failed"}`)
  }
  if (!result) {
    console.error("All candidate models failed.")
    process.exit(1)
  }
  const text =
    result.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "(no text returned)"
  fs.writeFileSync(path.join(process.cwd(), "GEMINI_DESIGN_OUTPUT.md"), text, "utf8")
  console.log(`\n=== Gemini (${used}) design proposal ===\n`)
  console.log(text)
  console.log(`\n\n(saved to GEMINI_DESIGN_OUTPUT.md)`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
