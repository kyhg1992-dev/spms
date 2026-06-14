import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"

import { parseLocationAliases, resolveSite, type GeoSite } from "@/lib/saudi-locations"
import type { Asset } from "@/models/firestore"

type SiteGroup = { site: GeoSite; count: number; samples: string[] }

function countIcon(count: number): L.DivIcon {
  const size = count >= 100 ? 46 : count >= 10 ? 40 : 34
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1e40af;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function FleetMap({
  assets,
  aliasText,
}: {
  assets: (Asset & { id: string })[]
  aliasText?: string
}) {
  const aliases = parseLocationAliases(aliasText)
  const groups = new Map<string, SiteGroup>()
  for (const a of assets) {
    const site = resolveSite(a.location, aliases)
    if (!site) continue
    const g = groups.get(site.labelAr) ?? { site, count: 0, samples: [] }
    g.count += 1
    if (g.samples.length < 6) g.samples.push(`${a.assetName} (${a.assetCode})`)
    groups.set(site.labelAr, g)
  }
  const list = [...groups.values()]
  const center: [number, number] = list.length ? [list[0].site.lat, list[0].site.lng] : [24.0, 45.0]

  return (
    <div className="h-[380px] w-full overflow-hidden rounded-lg border">
      <MapContainer center={center} zoom={5} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {list.map((g) => (
          <Marker key={g.site.labelAr} position={[g.site.lat, g.site.lng]} icon={countIcon(g.count)}>
            <Popup>
              <div dir="rtl" style={{ minWidth: 160 }}>
                <strong>{g.site.labelAr}</strong>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{g.count} أصل</div>
                <ul style={{ margin: 0, paddingInlineStart: 16, fontSize: 12 }}>
                  {g.samples.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                  {g.count > g.samples.length ? <li>…والمزيد</li> : null}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
