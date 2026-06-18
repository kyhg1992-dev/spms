/**
 * Equipment-class code → Arabic label. Codes come from the imported fleet sheet
 * (Eqm Cls). Extend freely — unknown codes simply display as-is.
 */
export const EQUIPMENT_CLASS_LABELS: Record<string, string> = {
  FORKLIFT: "رافعة شوكية",
  FLT: "رافعة شوكية",
  PIC: "بيك أب",
  PICKUP: "بيك أب",
  LDR: "لودر",
  LOADER: "لودر",
  VDT: "داينا",
  DYNA: "داينا",
  TRU: "شاحنة",
  TRUCK: "شاحنة",
  GNR: "مولّد كهرباء",
  VAN: "فان",
  BUS: "حافلة",
  CRN: "رافعة (كرين)",
  EXC: "حفّارة",
  TRL: "مقطورة",
}

/** "LDR — لودر" when known, else the bare code. */
export function equipmentClassLabel(code?: string): string {
  if (!code?.trim()) return ""
  const key = code.trim().toUpperCase()
  const ar = EQUIPMENT_CLASS_LABELS[key]
  return ar ? `${key} — ${ar}` : key
}
