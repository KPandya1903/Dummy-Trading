import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const router = Router();

// ── Per-ticker cache (5-min TTL) ──────────────────────────
interface CachedQuote {
  data: QuoteDetail;
  fetchedAt: number;
}

interface QuoteDetail {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  pe: number | null;
  dividendYield: number | null;
  high52w: number | null;
  low52w: number | null;
  volume: number | null;
  sector: string | null;
  industry: string | null;
  history: { date: string; close: number }[];
}

const cache = new Map<string, CachedQuote>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function round2(n: number | undefined | null): number | null {
  if (n == null || isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

// ── GET /api/quotes/:ticker ───────────────────────────────
router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const cached = cache.get(ticker);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.json(cached.data);
      return;
    }

    // Fetch quote + summary in parallel
    const [quote, history] = await Promise.all([
      yf.quote(ticker),
      yf.chart(ticker, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        interval: '1d' as const,
      }).then((r: any) => r.quotes.filter((q: any) => q.close !== null)).catch(() => [] as any[]),
    ]);

    // Try to get sector/industry from quoteSummary
    let sector: string | null = null;
    let industry: string | null = null;
    try {
      const summary = await yf.quoteSummary(ticker, { modules: ['assetProfile'] });
      sector = summary.assetProfile?.sector ?? null;
      industry = summary.assetProfile?.industry ?? null;
    } catch { /* optional data */ }

    const detail: QuoteDetail = {
      ticker,
      name: quote.shortName || quote.longName || ticker,
      price: round2(quote.regularMarketPrice) ?? 0,
      change: round2(quote.regularMarketChange) ?? 0,
      changePct: round2(quote.regularMarketChangePercent) ?? 0,
      marketCap: round2((quote.marketCap ?? 0) / 1e9), // in billions
      pe: round2(quote.trailingPE as number),
      dividendYield: round2((quote as any).dividendYield ?? 0),
      high52w: round2(quote.fiftyTwoWeekHigh),
      low52w: round2(quote.fiftyTwoWeekLow),
      volume: quote.regularMarketVolume ?? null,
      sector,
      industry,
      history: (history || []).map((h: any) => ({
        date: new Date(h.date).toISOString().split('T')[0],
        close: round2(h.close) ?? 0,
      })),
    };

    cache.set(ticker, { data: detail, fetchedAt: Date.now() });
    res.json(detail);
  } catch (err) {
    console.error(`Quote fetch failed for ${req.params.ticker}:`, err);
    res.status(404).json({ error: `Could not fetch data for ${req.params.ticker}` });
  }
});

export default router;
