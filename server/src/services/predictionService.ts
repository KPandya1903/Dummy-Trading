// ── Prediction Service (re-export from stacked ensemble) ─
// The full ensemble implementation lives in ./prediction/
export { runEnsemble } from './prediction/index.js';
export type { OHLCV, PricePoint, ForecastPoint, PredictionResult, EnsembleConfig } from './prediction/index.js';
