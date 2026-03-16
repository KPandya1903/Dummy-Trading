import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import { getMarketData, MarketEntry } from '../services/marketService.js';
import { SP500_SECTORS } from '../data/sp500.js';

const yf = new YahooFinance();

const router = Router();

// ── GET /api/market — paginated, filterable, sortable ──────
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await getMarketData();

    // Filter by sector
    const sector = req.query.sector as string | undefined;
    let filtered = sector
      ? data.filter((e) => e.sector === sector)
      : data;

    // Search by ticker or name (prefix match)
    const q = ((req.query.q as string) || '').trim().toUpperCase();
    if (q) {
      filtered = filtered.filter(
        (e) =>
          e.ticker.startsWith(q) ||
          e.name.toUpperCase().startsWith(q),
      );
    }

    // Sort
    const sortField = (req.query.sort as string) || 'marketCap';
    const sortOrder = (req.query.order as string) || 'desc';
    const dir = sortOrder === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      const av = getSortValue(a, sortField);
      const bv = getSortValue(b, sortField);
      // Push null/zero market caps to the bottom regardless of sort direction
      if (sortField === 'marketCap' || sortField === 'volume') {
        const an = av as number;
        const bn = bv as number;
        if (an === 0 && bn !== 0) return 1;
        if (bn === 0 && an !== 0) return -1;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      // Tiebreak alphabetically so result order is consistent across sectors
      return a.ticker.localeCompare(b.ticker);
    });

    // Paginate
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const pageData = filtered.slice(start, start + limit);

    res.json({
      data: pageData,
      pagination: { page, limit, total, totalPages },
      sectors: SP500_SECTORS,
    });
  } catch (err) {
    console.error('Market data fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// ── GET /api/market/search?q=... ────────────────────────────
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim().toUpperCase();
    if (!q) {
      res.json([]);
      return;
    }

    const data = await getMarketData();
    const matches = data
      .filter(
        (e) =>
          e.ticker.startsWith(q) ||
          e.name.toUpperCase().startsWith(q),
      )
      .slice(0, 20);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── GET /api/market/top?by=marketCap|changePct&limit=20 ─────
router.get('/top', async (req: Request, res: Response) => {
  try {
    const data = await getMarketData();
    const by = (req.query.by as string) || 'marketCap';
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    let sorted: MarketEntry[];
    if (by === 'changePct') {
      sorted = [...data].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    } else {
      sorted = [...data].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    }

    res.json(sorted.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top market data' });
  }
});

// ── GET /api/market/sp500-chart?period=1M ────────────────────
let sp500ChartCache: { data: any; period: string; fetchedAt: number } | null = null;
const SP500_CHART_TTL = 5 * 60 * 1000;

const PERIOD_DAYS: Record<string, number> = {
  '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825,
};

router.get('/sp500-chart', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '1M';
    const days = PERIOD_DAYS[period] || 30;

    if (
      sp500ChartCache &&
      sp500ChartCache.period === period &&
      Date.now() - sp500ChartCache.fetchedAt < SP500_CHART_TTL
    ) {
      res.json(sp500ChartCache.data);
      return;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await yf.historical('^GSPC', {
      period1: startDate.toISOString().split('T')[0],
      period2: new Date().toISOString().split('T')[0],
    });

    const points = (history || [])
      .map((h: any) => ({
        date: new Date(h.date).toISOString().split('T')[0],
        value: Math.round((h.close ?? 0) * 100) / 100,
      }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    const result = { points, period };
    sp500ChartCache = { data: result, period, fetchedAt: Date.now() };

    res.json(result);
  } catch (err) {
    console.error('S&P 500 chart error:', err);
    res.status(500).json({ error: 'Failed to fetch S&P 500 chart data' });
  }
});

function getSortValue(entry: MarketEntry, field: string): number | string {
  switch (field) {
    case 'ticker': return entry.ticker;
    case 'name': return entry.name;
    case 'price': return entry.price;
    case 'change': return entry.change;
    case 'changePct': return entry.changePct;
    case 'marketCap': return entry.marketCap ?? 0;
    case 'volume': return entry.volume ?? 0;
    case 'sector': return entry.sector;
    default: return entry.marketCap ?? 0;
  }
}

export default router;
