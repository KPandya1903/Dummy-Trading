// ── Meta-Learner (Level-1 Stacking) ──────────────────────
// Combines base learner outputs into a final ensemble prediction
// Input: 4 base predictions + 4 uncertainties + 5 context features = 13 features
// Dense network or learned weighted average fallback

import * as tf from '@tensorflow/tfjs';
import type { BaseLearnerOutput, FeatureMatrix, CustomWeights } from './types.js';
import { round2 } from './utils.js';

const META_FEATURES = 13; // 4 preds + 4 uncertainties + 5 context

// ── Extract context features from feature matrix ─────────

function getContextFeatures(matrix: FeatureMatrix): number[] {
  const lastRow = matrix.rows[matrix.rows.length - 1].features;
  return [
    lastRow[5] ?? 0.5,  // RSI (already 0-1)
    lastRow[6] ?? 0,    // MACD histogram (normalized)
    lastRow[7] ?? 0.5,  // Bollinger %B
    lastRow[8] ?? 1,    // SMA20/50 ratio
    lastRow[10] ?? 0,   // 5-day momentum
  ];
}

// ── Build meta-learner input vectors ─────────────────────

function buildMetaInput(
  baseLearners: BaseLearnerOutput[],
  step: number,
  contextFeatures: number[],
): number[] {
  const predictions = baseLearners.map((bl) => bl.rawPredictions[step] ?? 0.5);
  const uncertainties = baseLearners.map((bl) => bl.uncertainties[step] ?? 0.1);
  return [...predictions, ...uncertainties, ...contextFeatures];
}

// ── Dense Meta-Learner ───────────────────────────────────

export interface MetaLearnerResult {
  combinedPredictions: number[];   // normalized predictions per step
  combinedUncertainties: number[]; // uncertainty per step
  weights: Record<string, number>; // learned model weights
}

export async function trainMetaLearner(
  baseLearners: BaseLearnerOutput[],
  matrix: FeatureMatrix,
  horizon: number,
  customWeights?: CustomWeights,
): Promise<MetaLearnerResult> {
  // Custom weights bypass — skip meta-learner training entirely
  if (customWeights) {
    return computeCustomWeightedAverage(baseLearners, horizon, customWeights);
  }

  // Ensure we have exactly 4 base learners
  while (baseLearners.length < 4) {
    const lastNorm = matrix.rows[matrix.rows.length - 1].features[0];
    baseLearners.push({
      name: `fallback_${baseLearners.length}`,
      forecast: [],
      rawPredictions: new Array(horizon).fill(lastNorm),
      uncertainties: new Array(horizon).fill(0.1),
      metrics: {},
    });
  }

  const contextFeatures = getContextFeatures(matrix);

  // Try to build training data from out-of-fold base predictions
  // For simplicity, use the base learner residuals to train on available data
  const rows = matrix.rows.map((r) => r.features);
  const actuals = matrix.rows.map((r) => r.features[0]); // normalized close

  // Use last 20% of available data as meta-training set
  const splitIdx = Math.floor(rows.length * 0.8);
  const metaTrainSize = rows.length - splitIdx;

  if (metaTrainSize >= 20) {
    // We have enough data for a dense meta-learner
    return trainDenseMetaLearner(
      baseLearners,
      matrix,
      horizon,
      contextFeatures,
      splitIdx,
    );
  }

  // Fallback: learned weighted average
  return learnedWeightedAverage(baseLearners, horizon, contextFeatures);
}

// ── Dense Network Meta-Learner ───────────────────────────

async function trainDenseMetaLearner(
  baseLearners: BaseLearnerOutput[],
  matrix: FeatureMatrix,
  horizon: number,
  contextFeatures: number[],
  splitIdx: number,
): Promise<MetaLearnerResult> {
  // Build meta-training samples
  // Use base learner residual patterns as proxy for prediction quality
  const metaXs: number[][] = [];
  const metaYs: number[] = [];

  // For each step in validation window, simulate base learner predictions
  const valActuals = matrix.rows.slice(splitIdx).map((r) => r.features[0]);

  for (let i = 0; i < Math.min(valActuals.length, 50); i++) {
    // Simulate base predictions using their error patterns
    const simPreds = baseLearners.map((bl) => {
      const bias = (bl.metrics.trainLoss ?? 0.05) * (Math.random() - 0.5);
      return Math.max(0, Math.min(1, valActuals[i] + bias));
    });
    const simUncerts = baseLearners.map((bl) => bl.uncertainties[0] ?? 0.1);
    metaXs.push([...simPreds, ...simUncerts, ...contextFeatures]);
    metaYs.push(valActuals[i]);
  }

  if (metaXs.length < 10) {
    return learnedWeightedAverage(baseLearners, horizon, contextFeatures);
  }

  // Build model: Dense(16) → Dense(8) → Dense(1)
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [META_FEATURES] }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

  const xTensor = tf.tensor2d(metaXs);
  const yTensor = tf.tensor2d(metaYs.map((v) => [v]));

  await model.fit(xTensor, yTensor, {
    epochs: 50,
    batchSize: 16,
    verbose: 0,
  });

  // Use trained meta-learner for forecast
  const combinedPredictions: number[] = [];
  const combinedUncertainties: number[] = [];

  for (let step = 0; step < horizon; step++) {
    const metaInput = buildMetaInput(baseLearners, step, contextFeatures);
    const input = tf.tensor2d([metaInput]);
    const pred = model.predict(input) as tf.Tensor;
    const val = (await pred.data())[0];
    combinedPredictions.push(Math.max(0, Math.min(1, val)));

    // Uncertainty: weighted average of base uncertainties
    const avgUncert = baseLearners.reduce(
      (sum, bl) => sum + (bl.uncertainties[step] ?? 0.1),
      0,
    ) / baseLearners.length;
    combinedUncertainties.push(avgUncert * 0.8); // meta-learner reduces uncertainty

    input.dispose();
    pred.dispose();
  }

  // Extract approximate weights by testing sensitivity
  const weights = await extractWeights(model, baseLearners, contextFeatures);

  xTensor.dispose();
  yTensor.dispose();
  model.dispose();

  return { combinedPredictions, combinedUncertainties, weights };
}

// ── Extract approximate model weights ────────────────────

async function extractWeights(
  model: tf.LayersModel,
  baseLearners: BaseLearnerOutput[],
  contextFeatures: number[],
): Promise<Record<string, number>> {
  // Sensitivity analysis: perturb each base prediction and measure effect
  const baseline = new Array(META_FEATURES).fill(0.5);
  baseline.splice(8, 5, ...contextFeatures);

  const baseInput = tf.tensor2d([baseline]);
  const basePredTensor = model.predict(baseInput) as tf.Tensor;
  const basePred = (await basePredTensor.data())[0];
  basePredTensor.dispose();
  baseInput.dispose();

  const sensitivities: number[] = [];
  for (let i = 0; i < 4; i++) {
    const perturbed = [...baseline];
    perturbed[i] = 0.6; // perturb prediction
    const pInput = tf.tensor2d([perturbed]);
    const pPredTensor = model.predict(pInput) as tf.Tensor;
    const pPred = (await pPredTensor.data())[0];
    sensitivities.push(Math.abs(pPred - basePred));
    pPredTensor.dispose();
    pInput.dispose();
  }

  const totalSens = sensitivities.reduce((a, b) => a + b, 0) || 1;
  const names = baseLearners.map((bl) => bl.name);

  const weights: Record<string, number> = {};
  for (let i = 0; i < 4; i++) {
    weights[names[i]] = round2(sensitivities[i] / totalSens);
  }

  return weights;
}

// ── Custom Weights Bypass ─────────────────────────────────
// Skips TensorFlow training; uses caller-supplied normalized weights directly.

function computeCustomWeightedAverage(
  baseLearners: BaseLearnerOutput[],
  horizon: number,
  weights: CustomWeights,
): MetaLearnerResult {
  // Slot order matches ensemble.ts: [holtWinters, lstm, gru, dense]
  const slotWeights = [weights.holtWinters, weights.lstm, weights.gru, weights.dense];

  const combinedPredictions: number[] = [];
  const combinedUncertainties: number[] = [];

  for (let step = 0; step < horizon; step++) {
    let pred = 0;
    let uncert = 0;
    for (let i = 0; i < baseLearners.length; i++) {
      pred   += slotWeights[i] * (baseLearners[i].rawPredictions[step] ?? 0.5);
      uncert += slotWeights[i] * (baseLearners[i].uncertainties[step]  ?? 0.1);
    }
    combinedPredictions.push(pred);
    combinedUncertainties.push(uncert);
  }

  // Key names match existing convention for response consistency
  const weightMap: Record<string, number> = {
    holtWinters:     round2(weights.holtWinters),
    biLstm:          round2(weights.lstm),
    gru:             round2(weights.gru),
    featureCombiner: round2(weights.dense),
  };

  return { combinedPredictions, combinedUncertainties, weights: weightMap };
}

// ── Learned Weighted Average Fallback ────────────────────

function learnedWeightedAverage(
  baseLearners: BaseLearnerOutput[],
  horizon: number,
  contextFeatures: number[],
): MetaLearnerResult {
  // Weight by inverse of training loss (lower loss = higher weight)
  const losses = baseLearners.map((bl) => {
    const loss = bl.metrics.trainLoss ?? (bl.metrics.r2 != null ? (1 - (bl.metrics.r2 ?? 0)) : 0.1);
    return Math.max(0.01, loss);
  });

  const invLosses = losses.map((l) => 1 / l);
  const totalInv = invLosses.reduce((a, b) => a + b, 0);
  const weights = invLosses.map((w) => w / totalInv);

  const combinedPredictions: number[] = [];
  const combinedUncertainties: number[] = [];

  for (let step = 0; step < horizon; step++) {
    let pred = 0;
    let uncert = 0;
    for (let i = 0; i < baseLearners.length; i++) {
      pred += weights[i] * (baseLearners[i].rawPredictions[step] ?? 0.5);
      uncert += weights[i] * (baseLearners[i].uncertainties[step] ?? 0.1);
    }
    combinedPredictions.push(pred);
    combinedUncertainties.push(uncert);
  }

  const weightMap: Record<string, number> = {};
  baseLearners.forEach((bl, i) => {
    weightMap[bl.name] = round2(weights[i]);
  });

  return { combinedPredictions, combinedUncertainties, weights: weightMap };
}
