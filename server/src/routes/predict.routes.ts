import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import type { OHLCV, EnsembleConfig } from '../services/predictionService.js';
import { runMonteCarlo } from '../services/prediction/monteCarlo.js';

// Lazy-load the ensemble runner to avoid loading TensorFlow on every cold start.
// TensorFlow.js is ~272MB and only needed for prediction endpoints.
let _runEnsemble: typeof import('../services/predictionService.js').runEnsemble | null = null;
async function getRunEnsemble() {
  if (!_runEnsemble) {
    const mod = await import('../services/predictionService.js');
    _runEnsemble = mod.runEnsemble;
  }
  return _runEnsemble;
}
import { PrismaClient } from '@prisma/client';

const yf = new YahooFinance();
const prisma = new PrismaClient();
const router = Router();

// On Vercel serverless, disable TF models to stay within 60s timeout.
// Holt-Winters + Monte Carlo run in <2s and provide solid predictions.
const IS_SERVERLESS = !!process.env.VERCEL;
const SERVERLESS_CONFIG: EnsembleConfig = {
  enabledModels: { holtWinters: true, lstm: false, gru: false, dense: false },
};

// ── Sentiment mapping ────────────────────────────────────

const SENTIMENT_MAP: Record<string, number> = {
  bullish: 0.8,
  positive: 0.7,
  bearish: 0.2,
  negative: 0.3,
  neutral: 0.5,
  mixed: 0.5,
};

async function getSentimentScore(ticker: string): Promise<number> {
  try {
    const research = await prisma.research.findFirst({
      where: { ticker, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { overallSentiment: true, confidenceScore: true },
    });

    if (research?.overallSentiment) {
      const baseSentiment = SENTIMENT_MAP[research.overallSentiment.toLowerCase()] ?? 0.5;
      const confidence = research.confidenceScore ?? 0.5;
      // Blend toward 0.5 based on confidence
      return 0.5 + (baseSentiment - 0.5) * confidence;
    }
  } catch {
    // No research data available
  }
  return 0.5; // neutral default
}

// ── Weight normalization helper ───────────────────────────
// Zeroes disabled models, normalizes remaining weights to sum=1.0.

function normalizeWeights(
  raw: Record<string, number>,
  enabled: Record<string, boolean>,
): { holtWinters: number; lstm: number; gru: number; dense: number } {
  const hw    = enabled.holtWinters ? Math.max(0, raw.holtWinters ?? 0) : 0;
  const lstm  = enabled.lstm        ? Math.max(0, raw.lstm        ?? 0) : 0;
  const gru   = enabled.gru         ? Math.max(0, raw.gru         ?? 0) : 0;
  const dense = enabled.dense       ? Math.max(0, raw.dense       ?? 0) : 0;
  const total = hw + lstm + gru + dense;

  if (total === 0) {
    const count = Object.values(enabled).filter(Boolean).length || 1;
    const eq = 1 / count;
    return {
      holtWinters: enabled.holtWinters ? eq : 0,
      lstm:        enabled.lstm        ? eq : 0,
      gru:         enabled.gru         ? eq : 0,
      dense:       enabled.dense       ? eq : 0,
    };
  }

  return { holtWinters: hw / total, lstm: lstm / total, gru: gru / total, dense: dense / total };
}

// ── Shared OHLCV fetcher ──────────────────────────────────

async function fetchCandles(ticker: string): Promise<OHLCV[] | null> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);

  const history = await yf.historical(ticker, {
    period1: startDate.toISOString().split('T')[0],
    period2: new Date().toISOString().split('T')[0],
  });

  if (!history || history.length < 30) return null;

  return (history as any[])
    .map((h) => ({
      date:   new Date(h.date).toISOString().split('T')[0],
      open:   h.open   ?? 0,
      high:   h.high   ?? 0,
      low:    h.low    ?? 0,
      close:  h.close  ?? 0,
      volume: h.volume ?? 0,
    }))
    .filter((c) => c.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── GET /api/predict/:ticker?horizon=7 ──────────────────────

router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const horizon = Math.min(30, Math.max(1, parseInt(req.query.horizon as string) || 7));

    // Fetch 1 year of OHLCV history
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    const history = await yf.historical(ticker, {
      period1: startDate.toISOString().split('T')[0],
      period2: new Date().toISOString().split('T')[0],
    });

    if (!history || history.length < 30) {
      res.status(404).json({ error: `Insufficient data for ${ticker}` });
      return;
    }

    // Build OHLCV candles
    const candles: OHLCV[] = (history as any[])
      .map((h) => ({
        date: new Date(h.date).toISOString().split('T')[0],
        open: h.open ?? 0,
        high: h.high ?? 0,
        low: h.low ?? 0,
        close: h.close ?? 0,
        volume: h.volume ?? 0,
      }))
      .filter((c) => c.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    const currentPrice = candles[candles.length - 1].close;

    // Get sentiment from latest research
    const sentimentScore = await getSentimentScore(ticker);

    // Run stacked ensemble (lazy-loaded to avoid TensorFlow cold start penalty)
    const runEnsemble = await getRunEnsemble();
    const predictions = await runEnsemble(
      candles, horizon, sentimentScore,
      IS_SERVERLESS ? SERVERLESS_CONFIG : undefined,
    );

    // Run Monte Carlo simulation (~10-30ms, synchronous)
    const historicalCloses = candles.map((c) => c.close);
    const lastDate = candles[candles.length - 1].date;
    const monteCarlo = runMonteCarlo(historicalCloses, currentPrice, horizon, lastDate, 1000);

    // Return last 90 days of history for the chart
    const displayHistory = candles.slice(-90).map((c) => ({
      date: c.date,
      close: Math.round(c.close * 100) / 100,
    }));

    res.json({
      ticker,
      currentPrice: Math.round(currentPrice * 100) / 100,
      historical: displayHistory,
      predictions,
      monteCarlo,
      disclaimer:
        'Predictions are for educational purposes only. They do not constitute financial advice. Past performance does not guarantee future results.',
    });
  } catch (err) {
    console.error(`Prediction error for ${req.params.ticker}:`, err);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// ── POST /api/predict/:ticker/custom ─────────────────────
// Accepts a custom model config from the Model Builder UI.
// Returns the same JSON shape as GET /:ticker.

router.post('/:ticker/custom', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const body   = req.body ?? {};

    const horizon        = Math.min(30, Math.max(1, Number(body.horizon) || 7));
    const numSimulations = Math.min(5000, Math.max(100, Number(body.numSimulations) || 1000));
    const sentimentOverride = body.sentimentOverride != null
      ? Math.min(1, Math.max(0, Number(body.sentimentOverride)))
      : null;

    const enabledModels = {
      holtWinters: body.enabledModels?.holtWinters !== false,
      lstm:        IS_SERVERLESS ? false : body.enabledModels?.lstm        !== false,
      gru:         IS_SERVERLESS ? false : body.enabledModels?.gru         !== false,
      dense:       IS_SERVERLESS ? false : body.enabledModels?.dense       !== false,
    };

    // Fetch OHLCV candles
    const candles = await fetchCandles(ticker);
    if (!candles) {
      res.status(404).json({ error: `Insufficient data for ${ticker}` });
      return;
    }

    const currentPrice = candles[candles.length - 1].close;

    // Sentiment: use override if provided, else fall back to DB lookup
    const sentimentScore = sentimentOverride !== null
      ? sentimentOverride
      : await getSentimentScore(ticker);

    // Build EnsembleConfig
    const config: EnsembleConfig = { enabledModels };
    if (body.customWeights) {
      config.customWeights = normalizeWeights(body.customWeights, enabledModels);
    }

    const runEnsemble = await getRunEnsemble();
    const predictions = await runEnsemble(candles, horizon, sentimentScore, config);

    const historicalCloses = candles.map((c) => c.close);
    const lastDate = candles[candles.length - 1].date;
    const monteCarlo = runMonteCarlo(historicalCloses, currentPrice, horizon, lastDate, numSimulations);

    const displayHistory = candles.slice(-90).map((c) => ({
      date:  c.date,
      close: Math.round(c.close * 100) / 100,
    }));

    res.json({
      ticker,
      currentPrice: Math.round(currentPrice * 100) / 100,
      historical:   displayHistory,
      predictions,
      monteCarlo,
      disclaimer:
        'Predictions are for educational purposes only. They do not constitute financial advice. Past performance does not guarantee future results.',
    });
  } catch (err) {
    console.error(`Custom prediction error for ${req.params.ticker}:`, err);
    res.status(500).json({ error: 'Failed to generate custom predictions' });
  }
});

export default router;
