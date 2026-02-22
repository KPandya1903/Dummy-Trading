// ── Walk-Forward Backtesting ─────────────────────────────
// Evaluates ensemble quality: RMSE, MAPE, directional accuracy
// Train on first 80%, validate on last 20%

import type { FeatureMatrix, BacktestMetrics } from './types.js';
import { round2 } from './utils.js';

export function computeBacktestMetrics(
  matrix: FeatureMatrix,
  ensemblePredictions: number[], // normalized predictions for validation window
): BacktestMetrics {
  // Use last 20% of the feature matrix as validation
  const totalRows = matrix.rows.length;
  const splitIdx = Math.floor(totalRows * 0.8);
  const valRows = matrix.rows.slice(splitIdx);

  if (valRows.length === 0 || ensemblePredictions.length === 0) {
    return { rmse: 0, mape: 0, directionalAccuracy: 0.5 };
  }

  // Align predictions with actuals
  const len = Math.min(valRows.length, ensemblePredictions.length);
  const actuals = valRows.slice(0, len).map((r) => r.features[0]); // normalized close
  const preds = ensemblePredictions.slice(0, len);

  // RMSE (on normalized values, then scale to approximate price range)
  const mse = actuals.reduce((sum, a, i) => sum + (a - preds[i]) ** 2, 0) / len;
  const rmseNorm = Math.sqrt(mse);
  const priceRange = matrix.priceNorm.max - matrix.priceNorm.min || 1;
  const rmse = round2(rmseNorm * priceRange);

  // MAPE (on raw prices)
  const rawActuals = valRows.slice(0, len).map((r) => r.close);
  const rawPreds = preds.map(
    (p) => p * priceRange + matrix.priceNorm.min,
  );
  const mape =
    rawActuals.reduce((sum, a, i) => {
      return sum + (a > 0 ? Math.abs(a - rawPreds[i]) / a : 0);
    }, 0) / len;

  // Directional accuracy
  let correctDir = 0;
  for (let i = 1; i < len; i++) {
    const actualDir = actuals[i] > actuals[i - 1] ? 1 : -1;
    const predDir = preds[i] > preds[i - 1] ? 1 : -1;
    if (actualDir === predDir) correctDir++;
  }
  const directionalAccuracy = len > 1 ? round2(correctDir / (len - 1)) : 0.5;

  return {
    rmse,
    mape: round2(Math.min(mape, 1)), // cap at 100%
    directionalAccuracy,
  };
}

// ── Quick backtest using base learner residuals ──────────

export function quickBacktest(
  baseLearnerResiduals: number[][],
  weights: number[],
): BacktestMetrics {
  // Combine residuals using weights
  if (baseLearnerResiduals.length === 0 || baseLearnerResiduals[0].length === 0) {
    return { rmse: 0, mape: 0, directionalAccuracy: 0.5 };
  }

  const len = baseLearnerResiduals[0].length;
  const combinedResiduals: number[] = [];

  for (let i = 0; i < len; i++) {
    let combined = 0;
    for (let j = 0; j < baseLearnerResiduals.length; j++) {
      combined += (weights[j] ?? 0.25) * (baseLearnerResiduals[j][i] ?? 0);
    }
    combinedResiduals.push(combined);
  }

  const mse = combinedResiduals.reduce((s, r) => s + r * r, 0) / len;
  const rmse = round2(Math.sqrt(mse));

  return {
    rmse,
    mape: round2(rmse), // approximate
    directionalAccuracy: 0.5, // not computable from residuals alone
  };
}
