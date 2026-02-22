// ── Dense Feature Combiner ───────────────────────────────
// Base learner #4: wide dense network capturing non-linear feature interactions
// Architecture: Dense(128, relu) → BN → Dropout(0.3) → Dense(64, relu) → BN → Dropout(0.2) → Dense(32, relu) → Dense(1)
// Input: 5-day lookback × 23 features = 115 flattened inputs

import * as tf from '@tensorflow/tfjs';
import type { FeatureMatrix, BaseLearnerOutput, ForecastPoint } from '../types.js';
import { getNextBusinessDay, denormalizePrice, round2 } from '../utils.js';

const LOOKBACK = 5;

// ── Build dense model ────────────────────────────────────

function buildModel(inputDim: number): tf.LayersModel {
  const model = tf.sequential();

  model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [inputDim] }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.3 }));

  model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.2 }));

  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({
    optimizer: tf.train.adam(0.005),
    loss: 'meanSquaredError',
  });

  return model;
}

// ── Build flattened samples ──────────────────────────────

function buildSamples(
  rows: number[][],
  lookback: number,
): { xs: number[][]; ys: number[] } {
  const xs: number[][] = [];
  const ys: number[] = [];

  for (let i = lookback; i < rows.length; i++) {
    // Flatten lookback window into single vector
    const flat: number[] = [];
    for (let j = i - lookback; j < i; j++) {
      flat.push(...rows[j]);
    }
    xs.push(flat);
    ys.push(rows[i][0]); // normalized close
  }

  return { xs, ys };
}

// ── Public API ───────────────────────────────────────────

export async function runFeatureCombiner(
  matrix: FeatureMatrix,
  horizon: number,
): Promise<BaseLearnerOutput> {
  const features = matrix.rows.map((r) => r.features);
  const lastDate = matrix.rows[matrix.rows.length - 1].date;
  const lookback = Math.min(LOOKBACK, Math.floor(features.length / 3));

  if (features.length < lookback + 10) {
    return emptyOutput(lastDate, horizon, matrix);
  }

  const { xs, ys } = buildSamples(features, lookback);

  if (xs.length < 10) {
    return emptyOutput(lastDate, horizon, matrix);
  }

  const inputDim = xs[0].length;
  const model = buildModel(inputDim);

  const xTensor = tf.tensor2d(xs);
  const yTensor = tf.tensor2d(ys.map((v) => [v]));

  const history = await model.fit(xTensor, yTensor, {
    epochs: 30,
    batchSize: 32,
    validationSplit: 0.1,
    verbose: 0,
  });

  const trainLoss = (history.history.loss as number[]).slice(-1)[0] ?? -1;

  // Residuals for confidence bands
  const trainPreds = model.predict(xTensor) as tf.Tensor;
  const trainPredValues = await trainPreds.data();
  const residuals = ys.map((actual, i) => actual - trainPredValues[i]);
  const residualStd = Math.sqrt(
    residuals.reduce((s, r) => s + r * r, 0) / residuals.length,
  );
  trainPreds.dispose();

  // Autoregressive forecast
  let recentRows = features.slice(-lookback).map((row) => [...row]);
  const normalizedPreds: number[] = [];

  for (let step = 0; step < horizon; step++) {
    const flat: number[] = [];
    for (const row of recentRows) {
      flat.push(...row);
    }

    const input = tf.tensor2d([flat]);
    const pred = model.predict(input) as tf.Tensor;
    const val = (await pred.data())[0];
    normalizedPreds.push(val);

    // Shift window
    const newRow = [...recentRows[recentRows.length - 1]];
    newRow[0] = val;
    recentRows = [...recentRows.slice(1), newRow];

    input.dispose();
    pred.dispose();
  }

  // Build forecast points
  const forecast: ForecastPoint[] = normalizedPreds.map((normPred, i) => {
    const price = denormalizePrice(normPred, matrix.priceNorm);
    const bandWidth = denormalizePrice(normPred + residualStd * 1.96 * Math.sqrt(i + 1), matrix.priceNorm) - price;
    return {
      date: getNextBusinessDay(lastDate, i + 1),
      predicted: round2(price),
      upper: round2(price + bandWidth),
      lower: round2(price - bandWidth),
    };
  });

  const uncertainties = normalizedPreds.map((_, i) =>
    residualStd * 1.96 * Math.sqrt(i + 1),
  );

  // Cleanup
  xTensor.dispose();
  yTensor.dispose();
  model.dispose();

  return {
    name: 'featureCombiner',
    forecast,
    rawPredictions: normalizedPreds,
    uncertainties,
    metrics: { trainLoss: round2(trainLoss) },
  };
}

// ── Empty fallback ───────────────────────────────────────

function emptyOutput(
  lastDate: string,
  horizon: number,
  matrix: FeatureMatrix,
): BaseLearnerOutput {
  const lastNorm = matrix.rows[matrix.rows.length - 1].features[0];
  const lastPrice = matrix.rows[matrix.rows.length - 1].close;

  return {
    name: 'featureCombiner',
    forecast: Array.from({ length: horizon }, (_, i) => ({
      date: getNextBusinessDay(lastDate, i + 1),
      predicted: round2(lastPrice),
    })),
    rawPredictions: new Array(horizon).fill(lastNorm),
    uncertainties: new Array(horizon).fill(0.1),
    metrics: { trainLoss: -1 },
  };
}
