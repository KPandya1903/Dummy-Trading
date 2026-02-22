import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import { computeIndicators, OHLCV } from '../services/technicalAnalysisService.js';

const yf = new YahooFinance();
const router = Router();

const PERIOD_DAYS: Record<string, number> = {
  '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825,
};

// ── GET /api/analysis/:ticker ───────────────────────────────
router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const period = (req.query.period as string) || '1Y';
    const days = PERIOD_DAYS[period] || 365;
    const indicatorList = ((req.query.indicators as string) || 'rsi,macd,bollinger,sma,ema')
      .split(',')
      .map((s) => s.trim().toLowerCase());

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await yf.historical(ticker, {
      period1: startDate.toISOString().split('T')[0],
      period2: new Date().toISOString().split('T')[0],
    });

    if (!history || history.length === 0) {
      res.status(404).json({ error: `No historical data for ${ticker}` });
      return;
    }

    const candles: OHLCV[] = (history as any[])
      .map((h) => ({
        date: new Date(h.date).toISOString().split('T')[0],
        open: h.open ?? 0,
        high: h.high ?? 0,
        low: h.low ?? 0,
        close: h.close ?? 0,
        volume: h.volume ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const { indicators, summary } = computeIndicators(candles, indicatorList);

    res.json({ ticker, candles, indicators, summary });
  } catch (err) {
    console.error(`Analysis error for ${req.params.ticker}:`, err);
    res.status(500).json({ error: 'Failed to compute analysis' });
  }
});

export default router;
