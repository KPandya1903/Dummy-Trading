/**
 * Price-fetching service for stock tickers.
 *
 * Uses the market data cache for S&P 500 tickers (real yahoo-finance2 data).
 * Falls back to Yahoo Finance quote for any other tickers.
 */
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

// ── Public API ───────────────────────────────────────────
export async function getCurrentPrices(
  tickers: string[],
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  // Try to use real market data from the S&P 500 cache first
  let realPrices = new Map<string, number>();
  try {
    const { getMarketData } = await import('./marketService.js');
    const marketData = await getMarketData();
    realPrices = new Map(marketData.map((e) => [e.ticker, e.price]));
  } catch { /* proceed without cache */ }

  const missing: string[] = [];
  for (const ticker of tickers) {
    const cached = realPrices.get(ticker);
    if (cached) {
      prices[ticker] = cached;
    } else {
      missing.push(ticker);
    }
  }

  // Fetch real prices from Yahoo Finance for non-S&P 500 tickers
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (ticker) => {
        try {
          const quote = await yf.quote(ticker);
          if (quote.regularMarketPrice) {
            prices[ticker] = Math.round(quote.regularMarketPrice * 100) / 100;
          }
        } catch { /* ticker not found — will be missing from result */ }
      }),
    );
  }

  return prices;
}
