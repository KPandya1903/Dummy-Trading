import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import { SP500_BY_TICKER } from '../data/sp500.js';

const yf = new YahooFinance();
const router = Router();

// ── GET /api/compare?tickers=AAPL,MSFT,GOOGL&period=3M ─────
router.get('/', async (req: Request, res: Response) => {
  try {
    const tickerParam = (req.query.tickers as string) || '';
    const tickers = tickerParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 5);

    if (tickers.length < 2) {
      res.status(400).json({ error: 'Provide at least 2 tickers (comma-separated)' });
      return;
    }

    const periodDays: Record<string, number> = {
      '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365,
    };
    const period = (req.query.period as string) || '3M';
    const days = periodDays[period] || 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const period1 = startDate.toISOString().split('T')[0];
    const period2 = new Date().toISOString().split('T')[0];

    // Fetch historical data + quotes in parallel
    const [histories, quotes] = await Promise.all([
      Promise.all(
        tickers.map((t) =>
          yf
            .historical(t, { period1, period2 })
            .then((h) =>
              (h || [])
                .map((p: any) => ({
                  date: new Date(p.date).toISOString().split('T')[0],
                  close: p.close ?? 0,
                }))
                .sort((a: any, b: any) => a.date.localeCompare(b.date)),
            )
            .catch(() => []),
        ),
      ),
      Promise.all(
        tickers.map((t) =>
          yf
            .quote(t)
            .then((q: any) => ({
              ticker: t,
              name: SP500_BY_TICKER.get(t)?.name ?? q.shortName ?? t,
              price: Math.round((q.regularMarketPrice ?? 0) * 100) / 100,
              marketCap: q.marketCap ? Math.round((q.marketCap / 1e9) * 100) / 100 : null,
              pe: q.trailingPE ? Math.round(q.trailingPE * 100) / 100 : null,
              dividendYield: q.dividendYield != null ? Math.round(q.dividendYield * 10000) / 100 : null,
              high52w: q.fiftyTwoWeekHigh ? Math.round(q.fiftyTwoWeekHigh * 100) / 100 : null,
              low52w: q.fiftyTwoWeekLow ? Math.round(q.fiftyTwoWeekLow * 100) / 100 : null,
              sector: SP500_BY_TICKER.get(t)?.sector ?? null,
            }))
            .catch(() => ({
              ticker: t,
              name: t,
              price: 0,
              marketCap: null,
              pe: null,
              dividendYield: null,
              high52w: null,
              low52w: null,
              sector: null,
            })),
        ),
      ),
    ]);

    // Normalize each series to % return from first data point
    const series = tickers.map((ticker, i) => {
      const hist = histories[i];
      if (hist.length === 0) return { ticker, data: [] };
      const basePrice = hist[0].close;
      return {
        ticker,
        data: hist.map((p: { date: string; close: number }) => ({
          date: p.date,
          returnPct:
            basePrice > 0
              ? Math.round(((p.close - basePrice) / basePrice) * 10000) / 100
              : 0,
        })),
      };
    });

    res.json({ tickers, series, fundamentals: quotes });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ error: 'Failed to compare stocks' });
  }
});

export default router;
