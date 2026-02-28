// ── Ensemble Orchestrator ────────────────────────────────
// Runs all 4 base learners in parallel, feeds into meta-learner
// Handles timeouts and graceful degradation

import type {
  OHLCV,
  ForecastPoint,
  BaseLearnerOutput,
  PredictionResult,
  EnsembleConfig,
} from './types.js';
import { buildFeatureMatrix } from './featureEngineering.js';
import { denormalizePrice, getNextBusinessDay, round2 } from './utils.js';
import { runExponentialSmoothing } from './baseLearners/exponentialSmoothing.js';

// TF-based models are lazily imported to avoid loading TensorFlow (~272MB)
// on serverless cold starts when only Holt-Winters is needed.
async function lazyLstm(matrix: any, horizon: number) {
  const { runEnhancedLstm } = await import('./baseLearners/enhancedLstm.js');
  return runEnhancedLstm(matrix, horizon);
}
async function lazyGru(matrix: any, horizon: number) {
  const { runGruModel } = await import('./baseLearners/gruModel.js');
  return runGruModel(matrix, horizon);
}
async function lazyFeatureCombiner(matrix: any, horizon: number) {
  const { runFeatureCombiner } = await import('./baseLearners/featureCombiner.js');
  return runFeatureCombiner(matrix, horizon);
}
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
  config?: EnsembleConfig,
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

  // Resolve enabled flags — default all true for backwards compatibility
  const enabled = {
    holtWinters: config?.enabledModels?.holtWinters ?? true,
    lstm:        config?.enabledModels?.lstm        ?? true,
    gru:         config?.enabledModels?.gru         ?? true,
    dense:       config?.enabledModels?.dense       ?? true,
  };

  const [hw, lstm, gru, fc] = await Promise.all([
    enabled.holtWinters
      ? Promise.resolve().then(() => runExponentialSmoothing(matrix, horizon))
      : Promise.resolve(emptyBL('holtWinters')),
    enabled.lstm
      ? withTimeout(lazyLstm(matrix, horizon), BASE_LEARNER_TIMEOUT, emptyBL('biLstm'))
      : Promise.resolve(emptyBL('biLstm')),
    enabled.gru
      ? withTimeout(lazyGru(matrix, horizon), BASE_LEARNER_TIMEOUT, emptyBL('gru'))
      : Promise.resolve(emptyBL('gru')),
    enabled.dense
      ? withTimeout(lazyFeatureCombiner(matrix, horizon), BASE_LEARNER_TIMEOUT, emptyBL('featureCombiner'))
      : Promise.resolve(emptyBL('featureCombiner')),
  ]);

  console.log(`[Ensemble] Base learners done in ${Date.now() - startTime}ms`);
  console.log(`  HW: r2=${hw.metrics.r2}, LSTM loss=${lstm.metrics.trainLoss}, GRU loss=${gru.metrics.trainLoss}, FC loss=${fc.metrics.trainLoss}`);

  // ── Step 3: Meta-Learner ─────────────────────────────
  const baseLearners = [hw, lstm, gru, fc];

  // Count how many models are actually enabled (not just fallback stubs)
  const enabledCount = [enabled.holtWinters, enabled.lstm, enabled.gru, enabled.dense]
    .filter(Boolean).length;

  // If only one model is active, skip meta-learner (avoids loading TensorFlow)
  let metaResult;
  if (enabledCount <= 1) {
    const active = baseLearners.find((bl) => bl.metrics.trainLoss !== -1) ?? hw;
    metaResult = {
      combinedPredictions: active.rawPredictions,
      combinedUncertainties: active.uncertainties,
      weights: { [active.name]: 1 } as Record<string, number>,
    };
  } else {
    const { trainMetaLearner } = await import('./metaLearner.js');
    metaResult = await trainMetaLearner(baseLearners, matrix, horizon, config?.customWeights);
  }

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
