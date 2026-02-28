// ── Shared Types for Stacked Ensemble Prediction ─────────

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  upper?: number;
  lower?: number;
}

export interface FeatureRow {
  date: string;
  close: number; // raw (pre-normalization) for denormalization
  features: number[]; // normalized feature vector
}

export interface FeatureMatrix {
  rows: FeatureRow[];
  featureNames: string[];
  normParams: { min: number[]; max: number[] }; // per-feature
  priceNorm: { min: number; max: number }; // for denormalizing predictions
}

export interface BaseLearnerOutput {
  name: string;
  forecast: ForecastPoint[];
  rawPredictions: number[]; // normalized predictions (for meta-learner)
  uncertainties: number[]; // per-step uncertainty width
  metrics: Record<string, number>;
}

export interface BacktestMetrics {
  rmse: number;
  mape: number;
  directionalAccuracy: number;
}

export interface PredictionResult {
  linearRegression: {
    forecast: ForecastPoint[];
    r2: number;
    trend: 'up' | 'down' | 'flat';
  };
  movingAverage: {
    forecast: ForecastPoint[];
  };
  lstm: {
    forecast: ForecastPoint[];
    trainLoss: number;
  };
  ensemble: {
    forecast: ForecastPoint[];
    confidence: number;
    baseModelWeights: Record<string, number>;
    backtestMetrics: BacktestMetrics;
  };
}

// ── Model Builder Config ──────────────────────────────────

export interface EnabledModels {
  holtWinters?: boolean;
  lstm?: boolean;
  gru?: boolean;
  dense?: boolean;
}

export interface CustomWeights {
  holtWinters: number;
  lstm: number;
  gru: number;
  dense: number;
}

export interface EnsembleConfig {
  enabledModels?: EnabledModels;
  customWeights?: CustomWeights;
}
