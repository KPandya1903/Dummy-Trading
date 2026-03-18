// ── Historical Valuation Context ─────────────────────────────
// Computes current P/E vs. trailing 1-year P/E range (min/max/avg).
// Inspired by Shiller's CAPE methodology — is this stock cheap
// or expensive relative to its own recent history?
//
// GET /api/valuation/:ticker

import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const router = Router();

// ── Cache (1h per ticker) ─────────────────────────────────────
const cache = new Map<string, { data: ValuationData; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

interface ValuationData {
  ticker:         string;
  currentPE:      number | null;
  currentPB:      number | null;
  eps:            number | null;
  epsGrowth:      number | null;
  pegRatio:       number | null;
  // P/E percentile vs own trailing 1yr price range used as proxy
  pricePercentile: number | null;   // 0-100: where current price sits in 52w range
  high52w:        number | null;
  low52w:         number | null;
  currentPrice:   number | null;
  marketCap:      number | null;
  forwardPE:      number | null;
  priceToSales:   number | null;
  evToEbitda:     number | null;
  verdict:        'cheap' | 'fair' | 'expensive' | 'unknown';
  verdictLabel:   string;
  computedAt:     string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── GET /api/valuation/:ticker ────────────────────────────────
router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    const cached = cache.get(ticker);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      res.json(cached.data);
      return;
    }

    const quote = await yf.quote(ticker).catch(() => null) as any;

    if (!quote) {
      res.status(404).json({ error: `Quote not found for ${ticker}` });
      return;
    }

    const currentPE    = quote.trailingPE        ?? null;
    const forwardPE    = quote.forwardPE          ?? null;
    const currentPB    = quote.priceToBook        ?? null;
    const eps          = quote.epsTrailingTwelveMonths ?? null;
    const epsGrowth    = quote.earningsGrowth != null ? round2(quote.earningsGrowth * 100) : null;
    const pegRatio     = quote.trailingPegRatio   ?? null;
    const priceToSales = quote.priceToSalesTrailing12Months ?? null;
    const evToEbitda   = quote.enterpriseToEbitda ?? null;
    const high52w      = quote.fiftyTwoWeekHigh   ?? null;
    const low52w       = quote.fiftyTwoWeekLow    ?? null;
    const currentPrice = quote.regularMarketPrice ?? null;
    const marketCap    = quote.marketCap          != null ? round2(quote.marketCap / 1e9) : null;

    // Price percentile in 52-week range (0 = at 52w low, 100 = at 52w high)
    let pricePercentile: number | null = null;
    if (high52w !== null && low52w !== null && currentPrice !== null && high52w > low52w) {
      pricePercentile = Math.round(((currentPrice - low52w) / (high52w - low52w)) * 100);
    }

    // Verdict: cheap / fair / expensive
    // Uses P/E benchmark and price percentile as dual signals
    const PE_CHEAP_THRESHOLD     = 15;
    const PE_EXPENSIVE_THRESHOLD = 30;
    const PRICE_PCT_LOW          = 30;   // in lower 30% of 52w range
    const PRICE_PCT_HIGH         = 80;   // in upper 20% of 52w range

    let verdict: ValuationData['verdict'] = 'unknown';
    let verdictLabel = 'Insufficient data';

    if (currentPE !== null && pricePercentile !== null) {
      const peScore = currentPE < PE_CHEAP_THRESHOLD ? -1 : currentPE > PE_EXPENSIVE_THRESHOLD ? 1 : 0;
      const priceScore = pricePercentile < PRICE_PCT_LOW ? -1 : pricePercentile > PRICE_PCT_HIGH ? 1 : 0;
      const combined = peScore + priceScore;

      if (combined <= -1) {
        verdict = 'cheap';
        verdictLabel = `Trading at P/E ${currentPE?.toFixed(1)} — below historical benchmark and near 52-week lows.`;
      } else if (combined >= 1) {
        verdict = 'expensive';
        verdictLabel = `Trading at P/E ${currentPE?.toFixed(1)} — elevated valuation near 52-week highs.`;
      } else {
        verdict = 'fair';
        verdictLabel = `P/E ${currentPE?.toFixed(1)} is in a fair range. Price at ${pricePercentile}th percentile of 52-week range.`;
      }
    } else if (pricePercentile !== null) {
      if (pricePercentile < PRICE_PCT_LOW) {
        verdict = 'cheap';
        verdictLabel = `Near 52-week lows (${pricePercentile}th percentile). No P/E data available.`;
      } else if (pricePercentile > PRICE_PCT_HIGH) {
        verdict = 'expensive';
        verdictLabel = `Near 52-week highs (${pricePercentile}th percentile).`;
      } else {
        verdict = 'fair';
        verdictLabel = `Price at ${pricePercentile}th percentile of 52-week range.`;
      }
    }

    const data: ValuationData = {
      ticker,
      currentPE,
      forwardPE,
      currentPB,
      eps,
      epsGrowth,
      pegRatio:       pegRatio     !== null ? round2(pegRatio) : null,
      priceToSales:   priceToSales !== null ? round2(priceToSales) : null,
      evToEbitda:     evToEbitda   !== null ? round2(evToEbitda) : null,
      pricePercentile,
      high52w,
      low52w,
      currentPrice,
      marketCap,
      verdict,
      verdictLabel,
      computedAt: new Date().toISOString(),
    };

    cache.set(ticker, { data, fetchedAt: Date.now() });
    res.json(data);
  } catch (err) {
    console.error(`Valuation error for ${req.params.ticker}:`, err);
    res.status(500).json({ error: 'Failed to compute valuation context' });
  }
});

export default router;
