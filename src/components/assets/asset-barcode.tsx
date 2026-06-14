import JsBarcode from "jsbarcode"
import { useEffect, useRef } from "react"

type AssetBarcodeProps = {
  /** Encoded value — typically the asset code. */
  value: string
  height?: number
  className?: string
}

/**
 * Renders a CODE128 1D barcode for an asset. Always drawn on a white surface
 * (barcodes must scan reliably and print cleanly) so it is readable in both
 * light and dark modes and ready for the maintenance card.
 */
export function AssetBarcode({ value, height = 48, className }: AssetBarcodeProps) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width: 1.6,
        displayValue: true,
        fontSize: 13,
        margin: 6,
        lineColor: "#0f172a",
        background: "#ffffff",
      })
    } catch {
      // Unencodable value — leave the SVG empty rather than throw.
    }
  }, [value, height])

  if (!value) return null
  return (
    <div className={`inline-flex rounded-md bg-white p-2 ${className ?? ""}`}>
      <svg ref={ref} className="max-w-full" role="img" aria-label={`باركود الأصل ${value}`} />
    </div>
  )
}
