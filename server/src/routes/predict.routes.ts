import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import { runEnsemble } from '../services/predictionService.js';
import type { OHLCV } from '../services/predictionService.js';
import { PrismaClient } from '@prisma/client';

const yf = new YahooFinance();
const prisma = new PrismaClient();
const router = Router();

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

    // Run stacked ensemble
    const predictions = await runEnsemble(candles, horizon, sentimentScore);

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
      disclaimer:
        'Predictions are for educational purposes only. They do not constitute financial advice. Past performance does not guarantee future results.',
    });
  } catch (err) {
    console.error(`Prediction error for ${req.params.ticker}:`, err);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

export default router;
