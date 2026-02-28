import { getNextBusinessDay, round2 } from './utils.js';

// ── Types ─────────────────────────────────────────────────

export interface MonteCarloStats {
  date: string;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

export interface MonteCarloSummary {
  expectedPrice: number;
  probAboveCurrentPrice: number;
  maxSimulated: number;
  minSimulated: number;
}

export interface MonteCarloResult {
  numSimulations: number;
  dailyStats: MonteCarloStats[];
  summary: MonteCarloSummary;
  /** 50 sampled paths (each is an array of `horizon` prices) for charting */
  samplePaths: number[][];
}

// ── Box-Muller transform ───────────────────────────────────
// Produces one N(0,1) variate from two uniform samples.

function boxMullerRand(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Percentile ────────────────────────────────────────────
// `sorted` must be pre-sorted ascending. `p` is in [0, 100].

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Main simulation ────────────────────────────────────────
/**
 * Runs a Monte Carlo simulation using Geometric Brownian Motion.
 *
 * @param historicalCloses  Sorted ascending close prices (use all available history)
 * @param currentPrice      Starting price for the simulation
 * @param horizon           Number of trading days to simulate
 * @param lastDate          Date string (YYYY-MM-DD) of the last historical close
 * @param numSimulations    Number of paths to simulate (default 1000)
 *
 * NOTE: Math.min/max via spread is safe up to ~100k elements.
 * If numSimulations is raised significantly, switch to reduce loops.
 */
export function runMonteCarlo(
  historicalCloses: number[],
  currentPrice: number,
  horizon: number,
  lastDate: string,
  numSimulations = 1000,
): MonteCarloResult {
  // 1. Compute daily log returns
  const logReturns: number[] = [];
  for (let i = 1; i < historicalCloses.length; i++) {
    const prev = historicalCloses[i - 1];
    const curr = historicalCloses[i];
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  if (logReturns.length < 2) {
    // Fallback: flat prediction if insufficient data
    const flat: MonteCarloStats[] = Array.from({ length: horizon }, (_, i) => ({
      date: getNextBusinessDay(lastDate, i + 1),
      p5: currentPrice,
      p25: currentPrice,
      median: currentPrice,
      p75: currentPrice,
      p95: currentPrice,
    }));
    return {
      numSimulations: 0,
      dailyStats: flat,
      summary: {
        expectedPrice: currentPrice,
        probAboveCurrentPrice: 0.5,
        maxSimulated: currentPrice,
        minSimulated: currentPrice,
      },
      samplePaths: [],
    };
  }

  // 2. Mean (μ) and standard deviation (σ) of log returns
  const mu = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((a, b) => a + (b - mu) ** 2, 0) / (logReturns.length - 1);
  const sigma = Math.sqrt(variance);

  // 3. GBM drift adjustment: (μ - σ²/2) × dt, where dt = 1 (daily)
  const drift = mu - 0.5 * variance;

  // 4. Simulate N paths — paths[sim][day]
  const paths: number[][] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = new Array(horizon);
    let price = currentPrice;
    for (let day = 0; day < horizon; day++) {
      price = price * Math.exp(drift + sigma * boxMullerRand());
      path[day] = price;
    }
    paths.push(path);
  }

  // 5. Per-day percentile statistics across all paths
  const dailyStats: MonteCarloStats[] = [];
  for (let day = 0; day < horizon; day++) {
    const dayPrices = paths.map((p) => p[day]).sort((a, b) => a - b);
    dailyStats.push({
      date: getNextBusinessDay(lastDate, day + 1),
      p5: round2(percentile(dayPrices, 5)),
      p25: round2(percentile(dayPrices, 25)),
      median: round2(percentile(dayPrices, 50)),
      p75: round2(percentile(dayPrices, 75)),
      p95: round2(percentile(dayPrices, 95)),
    });
  }

  // 6. Summary from final-day prices
  const finalPrices = paths.map((p) => p[horizon - 1]);
  const expectedPrice = round2(
    finalPrices.reduce((a, b) => a + b, 0) / numSimulations,
  );
  const probAboveCurrentPrice = round2(
    finalPrices.filter((p) => p > currentPrice).length / numSimulations,
  );

  let maxSimulated = finalPrices[0];
  let minSimulated = finalPrices[0];
  for (const p of finalPrices) {
    if (p > maxSimulated) maxSimulated = p;
    if (p < minSimulated) minSimulated = p;
  }

  // 7. Sample 50 paths evenly for the chart (avoids large payloads)
  const sampleStep = Math.max(1, Math.floor(numSimulations / 50));
  const samplePaths = paths
    .filter((_, i) => i % sampleStep === 0)
    .slice(0, 50)
    .map((path) => path.map((p) => round2(p)));

  return {
    numSimulations,
    dailyStats,
    summary: {
      expectedPrice,
      probAboveCurrentPrice,
      maxSimulated: round2(maxSimulated),
      minSimulated: round2(minSimulated),
    },
    samplePaths,
  };
}
