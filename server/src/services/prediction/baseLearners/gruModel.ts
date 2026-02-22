// ── 2-Layer GRU Model ────────────────────────────────────
// Base learner #3: 23-feature input, 20-day window
// Architecture: GRU(40) → Dropout(0.15) → GRU(20) → Dense(8, relu) → Dense(1)
// Uses Huber loss (robust to outliers)
// Maps to the "movingAverage" backward-compat slot

import * as tf from '@tensorflow/tfjs';
import type { FeatureMatrix, BaseLearnerOutput, ForecastPoint } from '../types.js';
import { getNextBusinessDay, denormalizePrice, round2 } from '../utils.js';

const WINDOW_SIZE = 20;

// ── Build GRU model ──────────────────────────────────────

function buildModel(windowSize: number, numFeatures: number): tf.LayersModel {
  const model = tf.sequential();

  model.add(
    tf.layers.gru({
      units: 40,
      returnSequences: true,
      inputShape: [windowSize, numFeatures],
    }),
  );
  model.add(tf.layers.dropout({ rate: 0.15 }));
  model.add(
    tf.layers.gru({
      units: 20,
      returnSequences: false,
    }),
  );
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 }));

  // Huber loss — robust to outliers
  model.compile({
    optimizer: tf.train.adam(0.002),
    loss: tf.losses.huberLoss,
  });

  return model;
}

// ── Build sequences ──────────────────────────────────────

function buildSequences(
  rows: number[][],
  windowSize: number,
): { xs: number[][][]; ys: number[] } {
  const xs: number[][][] = [];
  const ys: number[] = [];

  for (let i = windowSize; i < rows.length; i++) {
    xs.push(rows.slice(i - windowSize, i));
    ys.push(rows[i][0]); // normalized close
  }

  return { xs, ys };
}

// ── Public API ───────────────────────────────────────────

export async function runGruModel(
  matrix: FeatureMatrix,
  horizon: number,
): Promise<BaseLearnerOutput> {
  const features = matrix.rows.map((r) => r.features);
  const lastDate = matrix.rows[matrix.rows.length - 1].date;
  const windowSize = Math.min(WINDOW_SIZE, Math.floor(features.length / 3));

  if (features.length < windowSize + 10) {
    return emptyOutput(lastDate, horizon, matrix);
  }

  const { xs, ys } = buildSequences(features, windowSize);

  if (xs.length < 10) {
    return emptyOutput(lastDate, horizon, matrix);
  }

  const model = buildModel(windowSize, features[0].length);

  const xTensor = tf.tensor3d(xs);
  const yTensor = tf.tensor2d(ys.map((v) => [v]));

  const history = await model.fit(xTensor, yTensor, {
    epochs: 20,
    batchSize: 16,
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
  let currentWindow = features.slice(-windowSize).map((row) => [...row]);
  const normalizedPreds: number[] = [];

  for (let step = 0; step < horizon; step++) {
    const input = tf.tensor3d([currentWindow]);
    const pred = model.predict(input) as tf.Tensor;
    const val = (await pred.data())[0];
    normalizedPreds.push(val);

    const newRow = [...currentWindow[currentWindow.length - 1]];
    newRow[0] = val;
    currentWindow = [...currentWindow.slice(1), newRow];

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
    name: 'gru',
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
    name: 'gru',
    forecast: Array.from({ length: horizon }, (_, i) => ({
      date: getNextBusinessDay(lastDate, i + 1),
      predicted: round2(lastPrice),
    })),
    rawPredictions: new Array(horizon).fill(lastNorm),
    uncertainties: new Array(horizon).fill(0.1),
    metrics: { trainLoss: -1 },
  };
}
