// ── Shared Utilities ─────────────────────────────────────

export function getNextBusinessDay(dateStr: string, offset: number): string {
  const d = new Date(dateStr);
  let count = 0;
  while (count < offset) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d.toISOString().split('T')[0];
}

export function minMaxNormalize(
  data: number[][],
): { normalized: number[][]; min: number[]; max: number[] } {
  if (data.length === 0) return { normalized: [], min: [], max: [] };

  const numFeatures = data[0].length;
  const min = new Array(numFeatures).fill(Infinity);
  const max = new Array(numFeatures).fill(-Infinity);

  for (const row of data) {
    for (let j = 0; j < numFeatures; j++) {
      if (row[j] < min[j]) min[j] = row[j];
      if (row[j] > max[j]) max[j] = row[j];
    }
  }

  const normalized = data.map((row) =>
    row.map((val, j) => {
      const range = max[j] - min[j];
      return range > 0 ? (val - min[j]) / range : 0.5;
    }),
  );

  return { normalized, min, max };
}

export function denormalizePrice(
  normalized: number,
  priceNorm: { min: number; max: number },
): number {
  const range = priceNorm.max - priceNorm.min;
  return range > 0 ? normalized * range + priceNorm.min : priceNorm.min;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
