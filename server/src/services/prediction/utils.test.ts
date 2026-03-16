import { getNextBusinessDay, minMaxNormalize, denormalizePrice, round2 } from './utils.js';

// ── round2 ──────────────────────────────────────────────────

test('rounds 3.14159 to 3.14', () => {
  expect(round2(3.14159)).toBe(3.14);
});

test('rounds up when third decimal is 6', () => {
  expect(round2(1.236)).toBe(1.24);
});

test('leaves whole numbers unchanged', () => {
  expect(round2(100)).toBe(100);
  expect(round2(0)).toBe(0);
});

test('rounds negative numbers correctly', () => {
  expect(round2(-3.14159)).toBe(-3.14);
});

// ── getNextBusinessDay ──────────────────────────────────────

test('advances 1 business day from a Monday', () => {
  // 2025-03-10 is Monday → next biz day = Tuesday 2025-03-11
  expect(getNextBusinessDay('2025-03-10', 1)).toBe('2025-03-11');
});

test('advances 1 business day from a Thursday', () => {
  // 2025-03-13 Thu → Friday 2025-03-14
  expect(getNextBusinessDay('2025-03-13', 1)).toBe('2025-03-14');
});

test('skips weekend when advancing 1 day from a Friday', () => {
  // 2025-03-14 Fri → Monday 2025-03-17 (skips Sat/Sun)
  expect(getNextBusinessDay('2025-03-14', 1)).toBe('2025-03-17');
});

test('skips weekend when advancing 1 day from a Saturday', () => {
  // 2025-03-15 Sat → Monday 2025-03-17
  expect(getNextBusinessDay('2025-03-15', 1)).toBe('2025-03-17');
});

test('advances 2 business days from a Thursday, skipping weekend', () => {
  // 2025-03-13 Thu + 2 biz = Fri 14 → Mon 17
  expect(getNextBusinessDay('2025-03-13', 2)).toBe('2025-03-17');
});

test('advances 5 business days from a Monday equals following Monday', () => {
  // 2025-03-10 Mon + 5 biz = Mon 2025-03-17
  expect(getNextBusinessDay('2025-03-10', 5)).toBe('2025-03-17');
});

// ── minMaxNormalize ─────────────────────────────────────────

test('normalizes min value to 0', () => {
  const { normalized } = minMaxNormalize([[1], [3], [5]]);
  expect(normalized[0][0]).toBe(0);
});

test('normalizes max value to 1', () => {
  const { normalized } = minMaxNormalize([[1], [3], [5]]);
  expect(normalized[2][0]).toBe(1);
});

test('normalizes midpoint value to 0.5', () => {
  const { normalized } = minMaxNormalize([[0], [1], [2]]);
  expect(normalized[1][0]).toBe(0.5);
});

test('returns 0.5 for constant feature (zero range)', () => {
  const { normalized } = minMaxNormalize([[5], [5], [5]]);
  expect(normalized.every((row) => row[0] === 0.5)).toBe(true);
});

test('returns correct min and max per feature', () => {
  const { min, max } = minMaxNormalize([[1, 10], [2, 20], [3, 30]]);
  expect(min).toEqual([1, 10]);
  expect(max).toEqual([3, 30]);
});

test('handles multi-feature matrix', () => {
  const { normalized } = minMaxNormalize([[0, 100], [1, 200]]);
  expect(normalized[0]).toEqual([0, 0]);
  expect(normalized[1]).toEqual([1, 1]);
});

test('returns empty arrays for empty input', () => {
  const { normalized, min, max } = minMaxNormalize([]);
  expect(normalized).toEqual([]);
  expect(min).toEqual([]);
  expect(max).toEqual([]);
});

// ── denormalizePrice ────────────────────────────────────────

test('denormalizes 0 to min price', () => {
  expect(denormalizePrice(0, { min: 100, max: 200 })).toBe(100);
});

test('denormalizes 1 to max price', () => {
  expect(denormalizePrice(1, { min: 100, max: 200 })).toBe(200);
});

test('denormalizes 0.5 to midpoint', () => {
  expect(denormalizePrice(0.5, { min: 100, max: 200 })).toBe(150);
});

test('returns min when range is zero', () => {
  expect(denormalizePrice(0.5, { min: 150, max: 150 })).toBe(150);
});

test('round-trips through normalize and denormalize', () => {
  const prices = [[80], [100], [120], [160], [200]];
  const { normalized, min, max } = minMaxNormalize(prices);
  const reconstructed = normalized.map((row) => denormalizePrice(row[0], { min: min[0], max: max[0] }));
  prices.forEach(([p], i) => {
    expect(reconstructed[i]).toBeCloseTo(p, 5);
  });
});
