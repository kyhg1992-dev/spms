import { ChevronLeft, ChevronRight, Download, X } from "lucide-react"
import { useEffect, useState } from "react"

import { useI18n } from "@/i18n/i18n"

/** Full-screen in-app photo viewer with prev/next and a download button. */
export function PhotoLightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[]
  index: number
  onClose: () => void
}) {
  const { t } = useI18n()
  const [i, setI] = useState(index)

  useEffect(() => setI(index), [index])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") setI((x) => (x + 1) % photos.length)
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + photos.length) % photos.length)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [photos.length, onClose])

  if (i < 0 || i >= photos.length) return null
  const src = photos[i]

  function download() {
    const a = document.createElement("a")
    a.href = src
    a.download = `photo-${i + 1}.jpg`
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute end-4 top-4 flex gap-2">
        <button
          type="button"
          className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          aria-label={t("exec.download")}
          onClick={(e) => {
            e.stopPropagation()
            download()
          }}
        >
          <Download className="size-5" />
        </button>
        <button
          type="button"
          className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          aria-label={t("common.cancel")}
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </div>

      {photos.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute start-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="prev"
            onClick={(e) => {
              e.stopPropagation()
              setI((x) => (x - 1 + photos.length) % photos.length)
            }}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </button>
          <button
            type="button"
            className="absolute end-4 bottom-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="next"
            onClick={(e) => {
              e.stopPropagation()
              setI((x) => (x + 1) % photos.length)
            }}
          >
            <ChevronRight className="size-6 rtl:rotate-180" />
          </button>
        </>
      ) : null}

      <img
        src={src}
        alt=""
        className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {photos.length > 1 ? (
        <span className="absolute bottom-5 rounded-full bg-white/15 px-3 py-1 text-xs text-white tabular-nums">
          {i + 1} / {photos.length}
        </span>
      ) : null}
    </div>
  )
}
