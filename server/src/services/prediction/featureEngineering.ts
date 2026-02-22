// ── Feature Engineering Pipeline ─────────────────────────
// Transforms raw OHLCV data into a 23-feature normalized matrix
// using trading-signals indicators (same API as technicalAnalysisService.ts)

import { RSI, MACD, BollingerBands, SMA, EMA } from 'trading-signals';
import type { OHLCV, FeatureMatrix, FeatureRow } from './types.js';
import { minMaxNormalize } from './utils.js';

export const FEATURE_NAMES = [
  'close', 'open', 'high', 'low', 'volume',
  'rsi14', 'macd_hist', 'bb_pctb', 'sma20_50_ratio', 'ema12_26_ratio',
  'momentum_5d', 'momentum_10d', 'momentum_20d',
  'volatility_20d', 'sentiment',
  'dow_mon', 'dow_tue', 'dow_wed', 'dow_thu', 'dow_fri',
  'volume_ratio', 'hl_range', 'close_position',
];

export const NUM_FEATURES = FEATURE_NAMES.length; // 23

export function buildFeatureMatrix(
  candles: OHLCV[],
  sentimentScore: number = 0.5,
): FeatureMatrix {
  if (candles.length < 50) {
    return buildMinimalFeatureMatrix(candles, sentimentScore);
  }

  // ── Compute all indicators ─────────────────────────────
  const rsi = new RSI(14);
  const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
  const bb = new BollingerBands(20, 2);
  const sma20 = new SMA(20);
  const sma50 = new SMA(50);
  const ema12 = new EMA(12);
  const ema26 = new EMA(26);
  const volSma20 = new SMA(20);

  // Store per-candle indicator values
  const rsiVals: (number | null)[] = [];
  const macdVals: (number | null)[] = [];
  const bbVals: ({ upper: number; lower: number } | null)[] = [];
  const sma20Vals: (number | null)[] = [];
  const sma50Vals: (number | null)[] = [];
  const ema12Vals: (number | null)[] = [];
  const ema26Vals: (number | null)[] = [];
  const volSma20Vals: (number | null)[] = [];

  for (const c of candles) {
    rsi.update(c.close, false);
    rsiVals.push(rsi.getResult() ?? null);

    const macdResult = macd.update(c.close, false);
    macdVals.push(macdResult != null ? macdResult.histogram : null);

    const bbResult = bb.update(c.close, false);
    bbVals.push(bbResult != null ? { upper: bbResult.upper, lower: bbResult.lower } : null);

    sma20.update(c.close, false);
    sma20Vals.push(sma20.getResult() ?? null);

    sma50.update(c.close, false);
    sma50Vals.push(sma50.getResult() ?? null);

    ema12.update(c.close, false);
    ema12Vals.push(ema12.isStable ? (ema12.getResult() ?? null) : null);

    ema26.update(c.close, false);
    ema26Vals.push(ema26.isStable ? (ema26.getResult() ?? null) : null);

    volSma20.update(c.volume, false);
    volSma20Vals.push(volSma20.getResult() ?? null);
  }

  // ── Compute rolling returns for volatility ─────────────
  const returns: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      returns.push(0);
    } else {
      returns.push(
        candles[i - 1].close > 0
          ? (candles[i].close - candles[i - 1].close) / candles[i - 1].close
          : 0,
      );
    }
  }

  // ── Build feature rows (skip first 50 for indicator warmup) ──
  const startIdx = Math.max(50, candles.length - 200); // use at most 200 rows after warmup
  const rawFeatures: number[][] = [];
  const rows: { date: string; close: number }[] = [];

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];

    // Skip rows where critical indicators aren't ready
    if (sma50Vals[i] == null || rsiVals[i] == null) continue;

    const dayOfWeek = new Date(c.date).getDay(); // 0=Sun ... 6=Sat

    // Momentum
    const mom5 = i >= 5 && candles[i - 5].close > 0
      ? (c.close - candles[i - 5].close) / candles[i - 5].close : 0;
    const mom10 = i >= 10 && candles[i - 10].close > 0
      ? (c.close - candles[i - 10].close) / candles[i - 10].close : 0;
    const mom20 = i >= 20 && candles[i - 20].close > 0
      ? (c.close - candles[i - 20].close) / candles[i - 20].close : 0;

    // 20-day rolling volatility
    let vol20 = 0;
    if (i >= 20) {
      const windowReturns = returns.slice(i - 19, i + 1);
      const mean = windowReturns.reduce((a, b) => a + b, 0) / windowReturns.length;
      vol20 = Math.sqrt(
        windowReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / windowReturns.length,
      );
    }

    // Bollinger %B
    const bbVal = bbVals[i];
    const bbPctB =
      bbVal && bbVal.upper !== bbVal.lower
        ? (c.close - bbVal.lower) / (bbVal.upper - bbVal.lower)
        : 0.5;

    // Ratios
    const sma20_50Ratio =
      sma20Vals[i] != null && sma50Vals[i] != null && sma50Vals[i]! > 0
        ? sma20Vals[i]! / sma50Vals[i]!
        : 1;
    const ema12_26Ratio =
      ema12Vals[i] != null && ema26Vals[i] != null && ema26Vals[i]! > 0
        ? ema12Vals[i]! / ema26Vals[i]!
        : 1;

    // Volume ratio
    const volRatio =
      volSma20Vals[i] != null && volSma20Vals[i]! > 0
        ? c.volume / volSma20Vals[i]!
        : 1;

    // High-low range and close position
    const hlRange = c.close > 0 ? (c.high - c.low) / c.close : 0;
    const closePos = c.high !== c.low ? (c.close - c.low) / (c.high - c.low) : 0.5;

    rawFeatures.push([
      c.close, c.open, c.high, c.low, c.volume,                // 0-4
      (rsiVals[i] ?? 50) / 100,                                 // 5: RSI scaled to 0-1
      macdVals[i] ?? 0,                                          // 6: MACD histogram
      bbPctB,                                                    // 7: Bollinger %B
      sma20_50Ratio,                                             // 8
      ema12_26Ratio,                                             // 9
      mom5, mom10, mom20,                                        // 10-12
      vol20,                                                     // 13
      sentimentScore,                                            // 14
      dayOfWeek === 1 ? 1 : 0,                                  // 15: Monday
      dayOfWeek === 2 ? 1 : 0,                                  // 16: Tuesday
      dayOfWeek === 3 ? 1 : 0,                                  // 17: Wednesday
      dayOfWeek === 4 ? 1 : 0,                                  // 18: Thursday
      dayOfWeek === 5 ? 1 : 0,                                  // 19: Friday
      volRatio,                                                  // 20
      hlRange,                                                   // 21
      closePos,                                                  // 22
    ]);

    rows.push({ date: c.date, close: c.close });
  }

  if (rawFeatures.length === 0) {
    return buildMinimalFeatureMatrix(candles, sentimentScore);
  }

  // ── Normalize ──────────────────────────────────────────
  const { normalized, min, max } = minMaxNormalize(rawFeatures);

  // Price normalization params (close price column = index 0)
  const priceMin = min[0];
  const priceMax = max[0];

  const featureRows: FeatureRow[] = normalized.map((features, idx) => ({
    date: rows[idx].date,
    close: rows[idx].close,
    features,
  }));

  return {
    rows: featureRows,
    featureNames: FEATURE_NAMES,
    normParams: { min, max },
    priceNorm: { min: priceMin, max: priceMax },
  };
}

// ── Minimal Feature Matrix (for limited data) ────────────

function buildMinimalFeatureMatrix(
  candles: OHLCV[],
  sentimentScore: number,
): FeatureMatrix {
  // For tickers with < 50 data points, use only price features
  const rawFeatures: number[][] = [];
  const rows: { date: string; close: number }[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const dayOfWeek = new Date(c.date).getDay();
    const mom5 = i >= 5 && candles[i - 5].close > 0
      ? (c.close - candles[i - 5].close) / candles[i - 5].close : 0;

    rawFeatures.push([
      c.close, c.open, c.high, c.low, c.volume,
      0.5, 0, 0.5, 1, 1,    // neutral indicator defaults
      mom5, 0, 0,            // only 5d momentum
      0, sentimentScore,
      dayOfWeek === 1 ? 1 : 0, dayOfWeek === 2 ? 1 : 0,
      dayOfWeek === 3 ? 1 : 0, dayOfWeek === 4 ? 1 : 0,
      dayOfWeek === 5 ? 1 : 0,
      1, 0, 0.5,
    ]);
    rows.push({ date: c.date, close: c.close });
  }

  const { normalized, min, max } = minMaxNormalize(rawFeatures);

  return {
    rows: normalized.map((features, idx) => ({
      date: rows[idx].date,
      close: rows[idx].close,
      features,
    })),
    featureNames: FEATURE_NAMES,
    normParams: { min, max },
    priceNorm: { min: min[0], max: max[0] },
  };
}
