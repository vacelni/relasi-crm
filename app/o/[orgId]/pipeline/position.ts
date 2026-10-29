/**
 * Fractional ordering for Kanban cards: a card dropped between two others gets the midpoint
 * of their positions, so a move rewrites one row instead of renumbering the column.
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return 1;
}
