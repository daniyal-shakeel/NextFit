export function getCommonProductTagsForFilters(
  products: { tags?: string[] }[],
): { value: string; label: string }[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const p of products) {
    for (const raw of p.tags ?? []) {
      const t = raw.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { label: t, count: 1 });
    }
  }

  const entries = [...counts.entries()]
    .map(([value, v]) => ({ value, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const shared = entries.filter((e) => e.count >= 2);
  const source = shared.length > 0 ? shared : entries.slice(0, 15);
  return source.map(({ value, label }) => ({ value, label }));
}

export function productMatchesTagFilters(
  productTags: string[] | undefined,
  selectedLowercaseValues: string[],
): boolean {
  if (selectedLowercaseValues.length === 0) return true;
  const set = new Set((productTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean));
  return selectedLowercaseValues.some((v) => set.has(v));
}
