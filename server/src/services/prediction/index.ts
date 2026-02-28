// ── Stacked Ensemble Prediction — Public API ─────────────
// Drop-in replacement for the old predictionService.ts

export { runEnsemble } from './ensemble.js';
export type { OHLCV, PricePoint, ForecastPoint, PredictionResult, BacktestMetrics, EnsembleConfig } from './types.js';
export { NUM_FEATURES, FEATURE_NAMES } from './featureEngineering.js';
