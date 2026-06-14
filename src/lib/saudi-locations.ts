/**
 * Named-site geolocation: maps an asset's textual location (the site it is
 * registered at — e.g. "رابغ", "جدة", "تبوك") to map coordinates, so the fleet
 * map shows how many assets sit at each site. This is NOT GPS — it is the
 * defined operating location on the system.
 */

export type GeoSite = { lat: number; lng: number; labelAr: string }

type SiteDef = { keys: string[]; lat: number; lng: number; labelAr: string }

const SITES: SiteDef[] = [
  { keys: ["الرياض", "riyadh"], lat: 24.7136, lng: 46.6753, labelAr: "الرياض" },
  { keys: ["جدة", "جده", "jeddah", "jed"], lat: 21.4858, lng: 39.1925, labelAr: "جدة" },
  { keys: ["مكة", "مكه", "makkah", "mecca"], lat: 21.3891, lng: 39.8579, labelAr: "مكة المكرمة" },
  { keys: ["المدينة", "المدينه", "madinah", "medina"], lat: 24.5247, lng: 39.5692, labelAr: "المدينة المنورة" },
  { keys: ["الدمام", "dammam"], lat: 26.4207, lng: 50.0888, labelAr: "الدمام" },
  { keys: ["الخبر", "khobar"], lat: 26.2794, lng: 50.2083, labelAr: "الخبر" },
  { keys: ["الظهران", "dhahran"], lat: 26.2361, lng: 50.0393, labelAr: "الظهران" },
  { keys: ["الجبيل", "jubail"], lat: 27.0046, lng: 49.6606, labelAr: "الجبيل" },
  { keys: ["الأحساء", "الاحساء", "الهفوف", "hofuf", "ahsa"], lat: 25.3833, lng: 49.5869, labelAr: "الأحساء" },
  { keys: ["الطائف", "taif"], lat: 21.2703, lng: 40.4158, labelAr: "الطائف" },
  { keys: ["تبوك", "tabuk"], lat: 28.3838, lng: 36.555, labelAr: "تبوك" },
  { keys: ["أبها", "ابها", "abha"], lat: 18.2169, lng: 42.5053, labelAr: "أبها" },
  { keys: ["خميس مشيط", "خميس", "khamis"], lat: 18.3, lng: 42.7333, labelAr: "خميس مشيط" },
  { keys: ["نجران", "najran"], lat: 17.4924, lng: 44.1277, labelAr: "نجران" },
  { keys: ["جازان", "جيزان", "jazan", "jizan"], lat: 16.8892, lng: 42.5706, labelAr: "جازان" },
  { keys: ["حائل", "hail"], lat: 27.5114, lng: 41.7208, labelAr: "حائل" },
  { keys: ["بريدة", "buraidah"], lat: 26.326, lng: 43.975, labelAr: "بريدة" },
  { keys: ["عنيزة", "unaizah"], lat: 26.0843, lng: 43.9935, labelAr: "عنيزة" },
  { keys: ["ينبع", "yanbu"], lat: 24.0895, lng: 38.0618, labelAr: "ينبع" },
  { keys: ["رابغ", "rabigh"], lat: 22.7986, lng: 39.0349, labelAr: "رابغ" },
  { keys: ["الخرج", "kharj"], lat: 24.1554, lng: 47.3346, labelAr: "الخرج" },
  { keys: ["حفر الباطن", "hafr"], lat: 28.4327, lng: 45.9636, labelAr: "حفر الباطن" },
  { keys: ["عرعر", "arar"], lat: 30.9753, lng: 41.0381, labelAr: "عرعر" },
  { keys: ["سكاكا", "sakaka", "الجوف"], lat: 29.9697, lng: 40.2064, labelAr: "سكاكا / الجوف" },
  { keys: ["القريات", "qurayyat"], lat: 31.33, lng: 37.3428, labelAr: "القريات" },
  { keys: ["الباحة", "baha"], lat: 20.0129, lng: 41.4677, labelAr: "الباحة" },
  { keys: ["بيشة", "bisha"], lat: 19.9764, lng: 42.6009, labelAr: "بيشة" },
  { keys: ["وادي الدواسر", "dawasir"], lat: 20.46, lng: 44.74, labelAr: "وادي الدواسر" },
  { keys: ["شرورة", "sharurah"], lat: 17.4833, lng: 47.1167, labelAr: "شرورة" },
  { keys: ["القنفذة", "qunfudhah"], lat: 19.1264, lng: 41.0789, labelAr: "القنفذة" },
  { keys: ["الليث", "lith"], lat: 20.15, lng: 40.27, labelAr: "الليث" },
  { keys: ["المجمعة", "majmaah"], lat: 25.9, lng: 45.35, labelAr: "المجمعة" },
  { keys: ["الدوادمي", "dawadmi"], lat: 24.5, lng: 44.4, labelAr: "الدوادمي" },
  { keys: ["الزلفي", "zulfi"], lat: 26.2833, lng: 44.8, labelAr: "الزلفي" },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function lookupSite(location: string | undefined): GeoSite | null {
  const n = normalize(location ?? "")
  if (!n) return null
  for (const s of SITES) {
    if (s.keys.some((k) => n.includes(normalize(k)))) {
      return { lat: s.lat, lng: s.lng, labelAr: s.labelAr }
    }
  }
  return null
}

/** Suggested site names for the asset-location datalist. */
export const KNOWN_SITE_NAMES: string[] = SITES.map((s) => s.labelAr)

/**
 * Parse the company "location aliases" text (one "code=city" per line) into a
 * lookup map. Lets imported assets whose location is a site code (e.g. VMM101)
 * resolve to a mappable city for the fleet map.
 */
export function parseLocationAliases(text: string | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (!text) return map
  for (const line of text.split(/\r?\n/)) {
    const [code, city] = line.split("=")
    if (code?.trim() && city?.trim()) map.set(normalize(code), city.trim())
  }
  return map
}

/** Resolve an asset location to a site, applying code→city aliases first. */
export function resolveSite(location: string | undefined, aliases?: Map<string, string>): GeoSite | null {
  const direct = lookupSite(location)
  if (direct) return direct
  if (aliases && location) {
    const n = normalize(location)
    for (const [code, city] of aliases) {
      if (n.includes(code)) {
        const viaCity = lookupSite(city)
        if (viaCity) return viaCity
      }
    }
  }
  return null
}
