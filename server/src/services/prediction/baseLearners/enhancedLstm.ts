// ── Bidirectional 2-Layer LSTM ────────────────────────────
// Base learner #2: 23-feature input, 30-day window
// Architecture: Bidirectional(LSTM(48)) → Dropout → LSTM(32) → Dropout → Dense(16) → Dense(1)
// Maps to the "lstm" backward-compat slot

import * as tf from '@tensorflow/tfjs';
import type { FeatureMatrix, BaseLearnerOutput, ForecastPoint } from '../types.js';
import { getNextBusinessDay, denormalizePrice, round2 } from '../utils.js';

const WINDOW_SIZE = 30;

// ── Build sequences from feature matrix ──────────────────

function buildSequences(
  rows: number[][],
  windowSize: number,
): { xs: number[][][]; ys: number[] } {
  const xs: number[][][] = [];
  const ys: number[] = [];

  for (let i = windowSize; i < rows.length; i++) {
    xs.push(rows.slice(i - windowSize, i));
    ys.push(rows[i][0]); // target = normalized close (feature index 0)
  }

  return { xs, ys };
}

// ── Build bidirectional LSTM model ───────────────────────

function buildModel(windowSize: number, numFeatures: number): tf.LayersModel {
  const input = tf.input({ shape: [windowSize, numFeatures] });

  // Bidirectional LSTM layer 1 (simulated: forward + backward concatenated)
  const forward1 = tf.layers.lstm({
    units: 48,
    returnSequences: true,
  }).apply(input) as tf.SymbolicTensor;

  // Reverse input for backward pass
  const backward1 = tf.layers.lstm({
    units: 48,
    returnSequences: true,
    goBackwards: true,
  }).apply(input) as tf.SymbolicTensor;

  // Concatenate forward and backward
  const bidir = tf.layers.concatenate().apply([forward1, backward1]) as tf.SymbolicTensor;

  const drop1 = tf.layers.dropout({ rate: 0.2 }).apply(bidir) as tf.SymbolicTensor;

  // LSTM layer 2
  const lstm2 = tf.layers.lstm({
    units: 32,
    returnSequences: false,
  }).apply(drop1) as tf.SymbolicTensor;

  const drop2 = tf.layers.dropout({ rate: 0.2 }).apply(lstm2) as tf.SymbolicTensor;

  // Dense layers
  const dense1 = tf.layers.dense({ units: 16, activation: 'relu' }).apply(drop2) as tf.SymbolicTensor;
  const output = tf.layers.dense({ units: 1 }).apply(dense1) as tf.SymbolicTensor;

  const model = tf.model({ inputs: input, outputs: output });
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  return model;
}

// ── Public API ───────────────────────────────────────────

export async function runEnhancedLstm(
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

  // Build and train
  const model = buildModel(windowSize, features[0].length);

  const xTensor = tf.tensor3d(xs);
  const yTensor = tf.tensor2d(ys.map((v) => [v]));

  const history = await model.fit(xTensor, yTensor, {
    epochs: 25,
    batchSize: 32,
    validationSplit: 0.1,
    verbose: 0,
    callbacks: {
      onEpochEnd: () => {
        // Allow event loop to breathe
      },
    },
  });

  const trainLoss = (history.history.loss as number[]).slice(-1)[0] ?? -1;

  // Compute residuals on training set for confidence bands
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

    // Shift window: drop first row, add new row with predicted close
    const newRow = [...currentWindow[currentWindow.length - 1]];
    newRow[0] = val; // replace normalized close with prediction
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
    name: 'biLstm',
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
    name: 'biLstm',
    forecast: Array.from({ length: horizon }, (_, i) => ({
      date: getNextBusinessDay(lastDate, i + 1),
      predicted: round2(lastPrice),
    })),
    rawPredictions: new Array(horizon).fill(lastNorm),
    uncertainties: new Array(horizon).fill(0.1),
    metrics: { trainLoss: -1 },
  };
}
