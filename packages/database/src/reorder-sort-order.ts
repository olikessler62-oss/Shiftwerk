export function validateReorderPermutation(
  existingIds: readonly string[],
  orderedIds: readonly string[]
): void {
  const known = new Set(existingIds);
  if (orderedIds.length !== existingIds.length) {
    throw new Error("Ungültige Reihenfolge");
  }
  if (!orderedIds.every((id) => known.has(id))) {
    throw new Error("Ungültige Reihenfolge");
  }
}

type SortOrderUpdateResult = { error: { message: string } | null };

export async function applySortOrderBatch(
  updates: Array<PromiseLike<SortOrderUpdateResult>>
): Promise<void> {
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}
