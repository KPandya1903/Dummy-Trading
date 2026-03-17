import YahooFinance from 'yahoo-finance2';
import { SP500_TICKERS, SP500_BY_TICKER } from '../data/sp500.js';

const yf = new YahooFinance();

const ALPACA_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET = process.env.ALPACA_API_SECRET || '';
const ALPACA_BASE = 'https://data.alpaca.markets/v2';

export interface MarketEntry {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketState: string;
  marketCap: number | null;
  volume: number | null;
  sector: string;
}

// ── Price cache (2s TTL — Alpaca real-time feed) ─────────────
let priceCache: { data: MarketEntry[]; fetchedAt: number } | null = null;
const PRICE_CACHE_TTL = 2 * 1000;

// ── Market cap cache (24h TTL — fetched from Yahoo once) ────
let marketCapCache: { data: Map<string, number>; fetchedAt: number } | null = null;
const MCAP_CACHE_TTL = 24 * 60 * 60 * 1000;

// ── Fundamentals cache (24h TTL) ────────────────────────────
export interface FundamentalsEntry {
  fiftyTwoWeekHigh: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
}
let fundamentalsCache: { data: Map<string, FundamentalsEntry>; fetchedAt: number } | null = null;
const FUND_CACHE_TTL = 24 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Alpaca snapshot types ───────────────────────────────────
interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface AlpacaSnapshot {
  latestTrade: { t: string; p: number; s: number };
  dailyBar: AlpacaBar;
  prevDailyBar: AlpacaBar;
  minuteBar: AlpacaBar;
}

// ── Fetch market caps from Yahoo (background, 24h cache) ────
export async function warmMarketCaps(): Promise<void> {
  if (marketCapCache && Date.now() - marketCapCache.fetchedAt < MCAP_CACHE_TTL) {
    return;
  }

  const caps = new Map<string, number>();
  const batches = chunk(SP500_TICKERS, 50);

  for (const batch of batches) {
    try {
      const quotes = await yf.quote(batch);
      const results = Array.isArray(quotes) ? quotes : [quotes];
      for (const q of results) {
        if (q.symbol && q.marketCap) {
          caps.set(q.symbol, round2(q.marketCap / 1e9));
        }
      }
    } catch (err) {
      console.error(`Market cap batch failed (${batch[0]}):`, err);
    }
  }

  marketCapCache = { data: caps, fetchedAt: Date.now() };
  console.log(`Market cap cache warmed: ${caps.size} tickers`);
}

// ── Fetch real-time prices from Alpaca ──────────────────────
async function fetchAlpacaPrices(): Promise<MarketEntry[]> {
  const entries: MarketEntry[] = [];
  const batches = chunk(SP500_TICKERS, 30);

  for (const batch of batches) {
    try {
      const symbols = batch.join(',');
      const res = await fetch(
        `${ALPACA_BASE}/stocks/snapshots?symbols=${symbols}&feed=iex`,
        {
          headers: {
            'APCA-API-KEY-ID': ALPACA_KEY,
            'APCA-API-SECRET-KEY': ALPACA_SECRET,
          },
        },
      );

      if (!res.ok) {
        console.error(`Alpaca batch failed (${res.status}): ${await res.text()}`);
        continue;
      }

      const data: Record<string, AlpacaSnapshot> = await res.json();

      for (const [symbol, snap] of Object.entries(data)) {
        const meta = SP500_BY_TICKER.get(symbol);
        const price = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
        const prevClose = snap.prevDailyBar?.c ?? price;
        const change = price - prevClose;
        const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;

        entries.push({
          ticker: symbol,
          name: meta?.name ?? symbol,
          price: round2(price),
          change: round2(change),
          changePct: round2(changePct),
          marketState: 'REGULAR', // Alpaca doesn't expose market state; assume open during trading hours
          marketCap: marketCapCache?.data.get(symbol) ?? null,
          volume: snap.dailyBar?.v ?? null,
          sector: meta?.sector ?? 'Other',
        });
      }
    } catch (err) {
      console.error(`Alpaca fetch failed for batch starting with ${batch[0]}:`, err);
    }
  }

  return entries;
}

// ── Fallback: fetch from Yahoo (if Alpaca keys not set) ─────
async function fetchYahooPrices(): Promise<MarketEntry[]> {
  const entries: MarketEntry[] = [];
  const batches = chunk(SP500_TICKERS, 50);

  for (const batch of batches) {
    try {
      const quotes = await yf.quote(batch);
      const results = Array.isArray(quotes) ? quotes : [quotes];

      for (const quote of results) {
        const symbol = quote.symbol;
        if (!symbol) continue;

        const meta = SP500_BY_TICKER.get(symbol);

        entries.push({
          ticker: symbol,
          name: meta?.name ?? String(quote.shortName ?? symbol),
          price: round2(quote.regularMarketPrice ?? 0),
          change: round2(quote.regularMarketChange ?? 0),
          changePct: round2(quote.regularMarketChangePercent ?? 0),
          marketState: quote.marketState ?? 'CLOSED',
          marketCap: quote.marketCap ? round2(quote.marketCap / 1e9) : null,
          volume: (quote as any).regularMarketVolume ?? null,
          sector: meta?.sector ?? 'Other',
        });
      }
    } catch (err) {
      console.error(`Yahoo batch failed (${batch[0]}):`, err);
    }
  }

  return entries;
}

// ── Fetch fundamentals from Yahoo (24h cache) ───────────────
export async function warmFundamentals(): Promise<void> {
  if (fundamentalsCache && Date.now() - fundamentalsCache.fetchedAt < FUND_CACHE_TTL) {
    return;
  }

  const data = new Map<string, FundamentalsEntry>();
  const batches = chunk(SP500_TICKERS, 50);

  for (const batch of batches) {
    try {
      const quotes = await yf.quote(batch);
      const results = Array.isArray(quotes) ? quotes : [quotes];
      for (const q of results) {
        if (!q.symbol) continue;
        data.set(q.symbol, {
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
          trailingPE: (q as any).trailingPE ?? null,
          dividendYield: (q as any).dividendYield != null ? round2((q as any).dividendYield) : null,
        });
      }
    } catch (err) {
      console.error(`Fundamentals batch failed (${batch[0]}):`, err);
    }
  }

  fundamentalsCache = { data, fetchedAt: Date.now() };
  console.log(`Fundamentals cache warmed: ${data.size} tickers`);
}

export function getFundamentals(): Map<string, FundamentalsEntry> {
  return fundamentalsCache?.data ?? new Map();
}

// ── Public API ──────────────────────────────────────────────
export async function getMarketData(): Promise<MarketEntry[]> {
  if (priceCache && Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL) {
    return priceCache.data;
  }

  const useAlpaca = !!(ALPACA_KEY && ALPACA_SECRET);
  const entries = useAlpaca ? await fetchAlpacaPrices() : await fetchYahooPrices();

  priceCache = { data: entries, fetchedAt: Date.now() };
  console.log(`Market cache warmed (${useAlpaca ? 'Alpaca' : 'Yahoo'}): ${entries.length} tickers`);
  return entries;
}
