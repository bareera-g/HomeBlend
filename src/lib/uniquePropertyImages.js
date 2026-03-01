/**
 * Assigns each property a unique image URL (no duplicates across the list).
 * 1) Prefer each property's own images when unused.
 * 2) For properties with no unused image in their set, assign any remaining unused image from the global pool.
 * Every property gets exactly one unique image; Discovery and Map stay in sync.
 */
export function computeUniquePropertyImages(properties) {
  const used = new Set();
  const out = {};
  const pool = [];
  const sorted = [...properties].sort((a, b) => (a.images?.length ?? 0) - (b.images?.length ?? 0));

  for (const p of sorted) {
    const imgs = p.images || [];
    for (const url of imgs) pool.push({ url, pid: p.id });
  }

  for (const p of sorted) {
    const imgs = p.images || [];
    for (const url of imgs) {
      if (!used.has(url)) {
        used.add(url);
        out[p.id] = url;
        break;
      }
    }
  }

  const unassigned = sorted.filter(p => !out[p.id]);
  const available = pool.filter(({ url }) => !used.has(url));
  for (const p of unassigned) {
    const idx = available.findIndex(({ url }) => !used.has(url));
    if (idx >= 0) {
      const { url } = available[idx];
      used.add(url);
      out[p.id] = url;
      available.splice(idx, 1);
    }
  }

  return out;
}
