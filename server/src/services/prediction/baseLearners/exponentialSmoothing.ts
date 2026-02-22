// ── Holt-Winters Triple Exponential Smoothing ────────────
// Base learner #1: captures level + trend + weekly seasonality
// Grid-searches α/β/γ over a small set for best in-sample fit
// Maps to the "linearRegression" backward-compat slot

import type { FeatureMatrix, BaseLearnerOutput, ForecastPoint } from '../types.js';
import { getNextBusinessDay, round2 } from '../utils.js';

const SEASON_PERIOD = 5; // 5 trading days per week

// ── Holt-Winters core ────────────────────────────────────

interface HWParams {
  alpha: number; // level smoothing
  beta: number;  // trend smoothing
  gamma: number; // seasonal smoothing
}

interface HWState {
  level: number;
  trend: number;
  seasonal: number[];
  residuals: number[];
}

function fitHoltWinters(series: number[], params: HWParams): HWState {
  const { alpha, beta, gamma } = params;
  const m = SEASON_PERIOD;

  // Initialize: level = mean of first season, trend = avg diff
  let level = series.slice(0, m).reduce((a, b) => a + b, 0) / m;
  let trend = 0;
  if (series.length >= 2 * m) {
    const firstSeason = series.slice(0, m).reduce((a, b) => a + b, 0) / m;
    const secondSeason = series.slice(m, 2 * m).reduce((a, b) => a + b, 0) / m;
    trend = (secondSeason - firstSeason) / m;
  }

  // Initialize seasonal indices
  const seasonal = new Array(m).fill(0);
  if (series.length >= m) {
    const firstMean = series.slice(0, m).reduce((a, b) => a + b, 0) / m;
    for (let i = 0; i < m; i++) {
      seasonal[i] = series[i] - firstMean;
    }
  }

  const residuals: number[] = [];

  // Additive Holt-Winters update
  for (let t = 0; t < series.length; t++) {
    const y = series[t];
    const seasonIdx = t % m;
    const forecast = level + trend + seasonal[seasonIdx];
    residuals.push(y - forecast);

    const prevLevel = level;
    level = alpha * (y - seasonal[seasonIdx]) + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[seasonIdx] = gamma * (y - level) + (1 - gamma) * seasonal[seasonIdx];
  }

  return { level, trend, seasonal, residuals };
}

function hwForecast(state: HWState, steps: number): number[] {
  const { level, trend, seasonal } = state;
  const m = SEASON_PERIOD;
  const preds: number[] = [];

  for (let h = 1; h <= steps; h++) {
    const seasonIdx = (state.residuals.length + h - 1) % m;
    preds.push(level + trend * h + seasonal[seasonIdx]);
  }

  return preds;
}

// ── Grid search ──────────────────────────────────────────

function gridSearchHW(series: number[]): { params: HWParams; state: HWState } {
  const alphas = [0.1, 0.3, 0.5, 0.7];
  const betas = [0.1, 0.3, 0.5, 0.7];
  const gammas = [0.1, 0.3, 0.5, 0.7];

  let bestSSE = Infinity;
  let bestParams: HWParams = { alpha: 0.3, beta: 0.1, gamma: 0.1 };
  let bestState: HWState = fitHoltWinters(series, bestParams);

  for (const alpha of alphas) {
    for (const beta of betas) {
      for (const gamma of gammas) {
        const params = { alpha, beta, gamma };
        const state = fitHoltWinters(series, params);
        // Skip first season for SSE (initialization period)
        const skip = SEASON_PERIOD;
        const sse = state.residuals
          .slice(skip)
          .reduce((sum, r) => sum + r * r, 0);

        if (sse < bestSSE) {
          bestSSE = sse;
          bestParams = params;
          bestState = state;
        }
      }
    }
  }

  return { params: bestParams, state: bestState };
}

// ── Public API ───────────────────────────────────────────

export function runExponentialSmoothing(
  matrix: FeatureMatrix,
  horizon: number,
): BaseLearnerOutput {
  const closes = matrix.rows.map((r) => r.close);
  const lastDate = matrix.rows[matrix.rows.length - 1].date;

  if (closes.length < SEASON_PERIOD * 2) {
    // Too little data — flat forecast from last price
    return flatFallback(closes, lastDate, horizon, matrix);
  }

  // Grid search for best parameters
  const { params, state } = gridSearchHW(closes);

  // Generate forecast
  const rawForecast = hwForecast(state, horizon);

  // Confidence bands from residual std
  const skip = SEASON_PERIOD;
  const usableResiduals = state.residuals.slice(skip);
  const residualStd = Math.sqrt(
    usableResiduals.reduce((s, r) => s + r * r, 0) / usableResiduals.length,
  );

  // R² calculation
  const mean = closes.slice(skip).reduce((a, b) => a + b, 0) / (closes.length - skip);
  const ssTot = closes.slice(skip).reduce((s, v) => s + (v - mean) ** 2, 0);
  const ssRes = usableResiduals.reduce((s, r) => s + r * r, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Trend direction from last trend component
  const trend: 'up' | 'down' | 'flat' =
    state.trend > 0.1 ? 'up' : state.trend < -0.1 ? 'down' : 'flat';

  // Build forecast points
  const forecast: ForecastPoint[] = rawForecast.map((pred, i) => ({
    date: getNextBusinessDay(lastDate, i + 1),
    predicted: round2(pred),
    upper: round2(pred + 1.96 * residualStd * Math.sqrt(i + 1)),
    lower: round2(pred - 1.96 * residualStd * Math.sqrt(i + 1)),
  }));

  // Normalized predictions for meta-learner
  const { min: priceMin, max: priceMax } = matrix.priceNorm;
  const range = priceMax - priceMin || 1;
  const rawPredictions = rawForecast.map((p) => (p - priceMin) / range);
  const uncertainties = rawForecast.map((_, i) =>
    (1.96 * residualStd * Math.sqrt(i + 1)) / range,
  );

  return {
    name: 'holtWinters',
    forecast,
    rawPredictions,
    uncertainties,
    metrics: {
      r2: round2(Math.max(0, r2)),
      trend: trend === 'up' ? 1 : trend === 'down' ? -1 : 0,
      alpha: params.alpha,
      beta: params.beta,
      gamma: params.gamma,
    },
  };
}

// ── Flat fallback ────────────────────────────────────────

function flatFallback(
  closes: number[],
  lastDate: string,
  horizon: number,
  matrix: FeatureMatrix,
): BaseLearnerOutput {
  const lastPrice = closes[closes.length - 1];
  const forecast: ForecastPoint[] = [];
  const rawPredictions: number[] = [];
  const uncertainties: number[] = [];
  const { min: priceMin, max: priceMax } = matrix.priceNorm;
  const range = priceMax - priceMin || 1;

  for (let i = 0; i < horizon; i++) {
    forecast.push({
      date: getNextBusinessDay(lastDate, i + 1),
      predicted: round2(lastPrice),
    });
    rawPredictions.push((lastPrice - priceMin) / range);
    uncertainties.push(0.1);
  }

  return {
    name: 'holtWinters',
    forecast,
    rawPredictions,
    uncertainties,
    metrics: { r2: 0, trend: 0 },
  };
}
