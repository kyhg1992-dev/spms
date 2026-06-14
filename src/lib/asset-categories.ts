/** Selectable asset categories (stored as ASCII slugs; Arabic labels at display time). */
export const ASSET_CATEGORY_IDS = ["vehicles", "equipment"] as const
export type AssetCategoryId = (typeof ASSET_CATEGORY_IDS)[number]

/** Default category for new/legacy assets that don't match a selectable id. */
export const DEFAULT_ASSET_CATEGORY: AssetCategoryId = "equipment"

export function assetCategoryAr(id: string): string {
  const map: Record<string, string> = {
    vehicles: "مركبات",
    equipment: "معدات",
    // Legacy slugs kept so previously-saved assets still display sensibly.
    hvac: "معدات",
    electrical: "معدات",
    mechanical: "معدات",
    fleet: "مركبات",
    it: "معدات",
    plumbing: "معدات",
    other: "معدات",
  }
  return map[id] ?? id
}
