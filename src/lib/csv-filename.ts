/** Built outside React components — avoids purity lint on `Date.now()`. */
export function buildWoOverviewCsvFilename(): string {
  return `spms-wo-overview-${Date.now().toString(10)}.csv`
}
