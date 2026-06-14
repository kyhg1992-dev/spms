import { Html5Qrcode } from "html5-qrcode"
import { Camera, QrCode, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAssetsQuery } from "@/hooks/use-spms-data"
import { useI18n } from "@/i18n/i18n"

const READER_ID = "qr-reader"

export default function ScanHomePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const assets = useAssetsQuery()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manual, setManual] = useState("")

  async function stop() {
    const h = scannerRef.current
    if (h) {
      try {
        await h.stop()
        await h.clear()
      } catch {
        // ignore
      }
      scannerRef.current = null
    }
    setScanning(false)
  }

  function handleDecoded(text: string) {
    const m = text.match(/\/scan\/([^/?#]+)/)
    const id = m ? m[1] : text.trim()
    void stop()
    navigate(`/scan/${id}`)
  }

  async function start() {
    try {
      const h = new Html5Qrcode(READER_ID)
      scannerRef.current = h
      await h.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handleDecoded,
        () => {}
      )
      setScanning(true)
    } catch {
      toast.error("تعذّر تشغيل الكاميرا — تأكّد من السماح بالوصول")
      scannerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      void stop()
    }
  }, [])

  function manualGo() {
    const q = manual.trim().toLowerCase()
    if (!q) return
    const list = assets.data ?? []
    // Match by asset code or plate number for the technician's convenience.
    const a =
      list.find((x) => x.assetCode.trim().toLowerCase() === q) ??
      list.find((x) => (x.plateNo ?? "").trim().toLowerCase() === q) ??
      list.find((x) => x.assetCode.trim().toLowerCase().includes(q) || (x.plateNo ?? "").trim().toLowerCase().includes(q))
    if (!a) {
      toast.error(t("scan.notFound"))
      return
    }
    navigate(`/scan/${a.id}`)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("scan.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("scan.subtitle")}</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="size-4" /> {t("scan.scanner")}
          </CardTitle>
          <CardDescription>{t("scan.aim")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div id={READER_ID} className="overflow-hidden rounded-lg border bg-muted/30" />
          {scanning ? (
            <Button variant="outline" className="w-full" onClick={() => void stop()}>
              {t("scan.stopCam")}
            </Button>
          ) : (
            <Button className="w-full" onClick={() => void start()}>
              <QrCode className="size-4" /> {t("scan.startCam")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("scan.manualUsb")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="code" className="text-xs">{t("scan.codeOrPlate")}</Label>
            <Input
              id="code"
              dir="ltr"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") manualGo()
              }}
              placeholder="مثل: 1419 أو 938G"
            />
          </div>
          <Button onClick={manualGo}>
            <Search className="size-4" /> {t("common.search")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
