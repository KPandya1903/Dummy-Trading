// ── Ensemble Orchestrator ────────────────────────────────
// Runs all 4 base learners in parallel, feeds into meta-learner
// Handles timeouts and graceful degradation

import type {
  OHLCV,
  ForecastPoint,
  BaseLearnerOutput,
  PredictionResult,
} from './types.js';
import { buildFeatureMatrix } from './featureEngineering.js';
import { denormalizePrice, getNextBusinessDay, round2 } from './utils.js';
import { runExponentialSmoothing } from './baseLearners/exponentialSmoothing.js';
import { runEnhancedLstm } from './baseLearners/enhancedLstm.js';
import { runGruModel } from './baseLearners/gruModel.js';
import { runFeatureCombiner } from './baseLearners/featureCombiner.js';
import { trainMetaLearner } from './metaLearner.js';
import { computeBacktestMetrics } from './backtesting.js';

const BASE_LEARNER_TIMEOUT = 30_000; // 30s per model

// ── Timeout wrapper ──────────────────────────────────────

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

// ── Main Ensemble Runner ─────────────────────────────────

export async function runEnsemble(
  candles: OHLCV[],
  horizon: number,
  sentimentScore: number = 0.5,
): Promise<PredictionResult> {
  console.log(`[Ensemble] Starting prediction for ${candles.length} candles, horizon=${horizon}`);
  const startTime = Date.now();

  // ── Step 1: Feature Engineering ──────────────────────
  const matrix = buildFeatureMatrix(candles, sentimentScore);
  console.log(`[Ensemble] Feature matrix: ${matrix.rows.length} rows × ${matrix.featureNames.length} features`);

  if (matrix.rows.length < 10) {
    console.log('[Ensemble] Insufficient data, using fallback predictions');
    return buildFallbackResult(candles, horizon);
  }

  const lastDate = matrix.rows[matrix.rows.length - 1].date;
  const lastPrice = matrix.rows[matrix.rows.length - 1].close;

  // ── Step 2: Run base learners in parallel ────────────
  const emptyBL = (name: string): BaseLearnerOutput => ({
    name,
    forecast: Array.from({ length: horizon }, (_, i) => ({
      date: getNextBusinessDay(lastDate, i + 1),
      predicted: round2(lastPrice),
    })),
    rawPredictions: new Array(horizon).fill(
      (lastPrice - matrix.priceNorm.min) / (matrix.priceNorm.max - matrix.priceNorm.min || 1),
    ),
    uncertainties: new Array(horizon).fill(0.1),
    metrics: { trainLoss: -1 },
  });

  const [hw, lstm, gru, fc] = await Promise.all([
    // Holt-Winters is synchronous but we wrap it
    Promise.resolve().then(() => runExponentialSmoothing(matrix, horizon)),
    withTimeout(runEnhancedLstm(matrix, horizon), BASE_LEARNER_TIMEOUT, emptyBL('biLstm')),
    withTimeout(runGruModel(matrix, horizon), BASE_LEARNER_TIMEOUT, emptyBL('gru')),
    withTimeout(runFeatureCombiner(matrix, horizon), BASE_LEARNER_TIMEOUT, emptyBL('featureCombiner')),
  ]);

  console.log(`[Ensemble] Base learners done in ${Date.now() - startTime}ms`);
  console.log(`  HW: r2=${hw.metrics.r2}, LSTM loss=${lstm.metrics.trainLoss}, GRU loss=${gru.metrics.trainLoss}, FC loss=${fc.metrics.trainLoss}`);

  // ── Step 3: Meta-Learner ─────────────────────────────
  const baseLearners = [hw, lstm, gru, fc];
  const metaResult = await trainMetaLearner(baseLearners, matrix, horizon);

  console.log(`[Ensemble] Meta-learner weights:`, metaResult.weights);

  // ── Step 4: Build ensemble forecast ──────────────────
  const ensembleForecast: ForecastPoint[] = metaResult.combinedPredictions.map(
    (normPred, i) => {
      const price = denormalizePrice(normPred, matrix.priceNorm);
      const uncertPrice =
        denormalizePrice(normPred + metaResult.combinedUncertainties[i], matrix.priceNorm) -
        price;
      return {
        date: getNextBusinessDay(lastDate, i + 1),
        predicted: round2(price),
        upper: round2(price + uncertPrice),
        lower: round2(price - uncertPrice),
      };
    },
  );

  // ── Step 5: Backtest metrics ─────────────────────────
  const backtestMetrics = computeBacktestMetrics(
    matrix,
    metaResult.combinedPredictions,
  );

  // Confidence = directional accuracy × (1 - normalized MAPE)
  const confidence = round2(
    Math.max(0, Math.min(1,
      backtestMetrics.directionalAccuracy * (1 - backtestMetrics.mape),
    )),
  );

  console.log(`[Ensemble] Backtest: RMSE=${backtestMetrics.rmse}, MAPE=${backtestMetrics.mape}, DirAcc=${backtestMetrics.directionalAccuracy}`);
  console.log(`[Ensemble] Total time: ${Date.now() - startTime}ms`);

  // ── Step 6: Build backward-compatible result ─────────
  return {
    linearRegression: {
      forecast: hw.forecast,
      r2: (hw.metrics.r2 as number) ?? 0,
      trend: (hw.metrics.trend === 1 ? 'up' : hw.metrics.trend === -1 ? 'down' : 'flat') as 'up' | 'down' | 'flat',
    },
    movingAverage: {
      forecast: gru.forecast,
    },
    lstm: {
      forecast: lstm.forecast,
      trainLoss: (lstm.metrics.trainLoss as number) ?? -1,
    },
    ensemble: {
      forecast: ensembleForecast,
      confidence,
      baseModelWeights: metaResult.weights,
      backtestMetrics,
    },
  };
}

// ── Fallback for insufficient data ───────────────────────

function buildFallbackResult(
  candles: OHLCV[],
  horizon: number,
): PredictionResult {
  const lastCandle = candles[candles.length - 1];
  const lastPrice = lastCandle.close;
  const lastDate = lastCandle.date;

  const flatForecast: ForecastPoint[] = Array.from({ length: horizon }, (_, i) => ({
    date: getNextBusinessDay(lastDate, i + 1),
    predicted: round2(lastPrice),
  }));

  return {
    linearRegression: { forecast: flatForecast, r2: 0, trend: 'flat' },
    movingAverage: { forecast: flatForecast },
    lstm: { forecast: flatForecast, trainLoss: -1 },
    ensemble: {
      forecast: flatForecast,
      confidence: 0,
      baseModelWeights: { holtWinters: 0.25, biLstm: 0.25, gru: 0.25, featureCombiner: 0.25 },
      backtestMetrics: { rmse: 0, mape: 0, directionalAccuracy: 0.5 },
    },
  };
}
