import { BarChart3, Boxes, CalendarCheck, Eye, EyeOff, Lock, Shield, User } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"

import { LanguageToggle } from "@/components/language-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { useI18n } from "@/i18n/i18n"

const FEATURES = [
  { icon: CalendarCheck, title: "صيانة وقائية ذكية", sub: "تسلسل A/B/C/D تلقائي" },
  { icon: Boxes, title: "إدارة الأصول والمخزون", sub: "تتبّع كامل للمعدات" },
  { icon: BarChart3, title: "تقارير ومؤشرات", sub: "قرارات مبنية على البيانات" },
]

export default function LoginPage() {
  const { user, spmsRole, loading, login } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user && loading) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center text-muted-foreground">
        جاري مزامنة الحساب...
      </main>
    )
  }

  if (user && spmsRole) {
    const from = typeof location.state?.from === "string" ? (location.state.from as string) : undefined
    return <Navigate to={from ?? "/dashboard"} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await login(email, password)
      const from = typeof location.state?.from === "string" ? (location.state.from as string) : undefined
      navigate(from ?? "/", { replace: true })
    } catch {
      setError(t("login.error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen w-full">
      {/* Form side */}
      <div className="bg-background flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-start justify-between">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                <Shield className="size-5" aria-hidden />
              </div>
              <div>
                <div className="text-lg font-bold tracking-[2px]">SPMS</div>
                <div className="text-muted-foreground text-[11px]">نظام الصيانة الوقائية</div>
              </div>
            </div>
            <div className="ms-auto">
              <LanguageToggle />
            </div>
          </div>

          <h1 className="text-2xl font-bold">{t("login.welcome")}</h1>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">{t("login.subtitle")}</p>

          {error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm">
              <span className="bg-destructive size-1.5 rounded-full" />
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">{t("login.email")}</Label>
              <div className="relative flex items-center">
                <User className="text-muted-foreground pointer-events-none absolute start-3 size-4" aria-hidden />
                <Input
                  id="login-email"
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="ps-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-pass">{t("login.password")}</Label>
              <div className="relative flex items-center">
                <Lock className="text-muted-foreground pointer-events-none absolute start-3 size-4" aria-hidden />
                <Input
                  id="login-pass"
                  type={showPass ? "text" : "password"}
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="px-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="text-muted-foreground hover:text-foreground absolute end-3 flex"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
        </div>
      </div>

      {/* Brand side — uses the app primary gradient (consistent with the dashboard). */}
      <div className="from-primary to-primary/80 hidden flex-1 flex-col justify-center bg-gradient-to-bl p-12 text-white lg:flex">
        <div className="mb-9 flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <Shield className="size-6" aria-hidden />
          </div>
          <div>
            <div className="text-3xl font-black tracking-[3px]">SPMS</div>
            <div className="text-[12px] text-white/60">نظام الصيانة الوقائية الذكي</div>
          </div>
        </div>

        <h2 className="mb-2 text-[26px] font-extrabold leading-snug">{t("login.heroTitle")}</h2>
        <p className="mb-9 max-w-md text-sm leading-relaxed text-white/60">{t("login.heroSub")}</p>

        <div className="flex flex-col gap-3.5">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div>
                  <strong className="block text-sm font-bold">{f.title}</strong>
                  <span className="block text-[11px] text-white/50">{f.sub}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
