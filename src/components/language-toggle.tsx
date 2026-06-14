import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/i18n"

export function LanguageToggle() {
  const { lang, toggle, t } = useI18n()
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10 gap-2 px-3"
      onClick={toggle}
      aria-label={t("common.language")}
      title={t("common.language")}
    >
      <Languages className="size-4" aria-hidden />
      <span className="text-xs font-semibold">{lang === "ar" ? "EN" : "ع"}</span>
    </Button>
  )
}
