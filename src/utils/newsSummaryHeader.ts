/** Separate thresholds prevent header-height changes from toggling the state repeatedly. */
export function getNewsSummaryHeaderCompact(scrollY: number, compact: boolean): boolean {
  return compact ? scrollY > 24 : scrollY > 128;
}
