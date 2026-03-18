import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import { SP500_BY_TICKER } from '../../services/data/sp500.js';

const yf = new YahooFinance();
const router = Router();

// ── GET /api/search?q=... — universal stock search via Yahoo Finance ──
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      res.json([]);
      return;
    }

    const result = await yf.search(q, { quotesCount: 15, newsCount: 0 });
    const quotes = (result.quotes || [])
      .filter((r: any) => r.quoteType === 'EQUITY' && r.exchange && r.symbol)
      .slice(0, 15)
      .map((r: any) => {
        const sp500 = SP500_BY_TICKER.get(r.symbol);
        return {
          ticker: r.symbol,
          name: sp500?.name || r.shortname || r.longname || r.symbol,
          exchange: r.exchange,
          sector: sp500?.sector || null,
          isSP500: !!sp500,
        };
      });

    res.json(quotes);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
