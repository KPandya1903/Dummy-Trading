// ── Stock Screener ────────────────────────────────────────────
// Filters S&P 500 universe using cached market data + fundamentals.
// No extra API calls — reuses existing 30s / 24h caches.
//
// GET /api/screener?sector=Technology&minPE=0&maxPE=25&sortBy=marketCap&sortDir=desc

import { Router, Request, Response } from 'express';
import { getMarketData, getFundamentals } from '../../services/market/marketService.js';

const router = Router();

// ── Unique sectors list ───────────────────────────────────────
router.get('/sectors', async (_req: Request, res: Response) => {
  try {
    const data = await getMarketData();
    const sectors = [...new Set(data.map((e) => e.sector).filter(Boolean))].sort();
    res.json(sectors);
  } catch {
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// ── Main screener endpoint ────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      sector,
      minPE,
      maxPE,
      minMarketCap,
      maxMarketCap,
      minChangePct,
      maxChangePct,
      minDividendYield,
      maxDividendYield,
      sortBy = 'marketCap',
      sortDir = 'desc',
      limit = '100',
    } = req.query as Record<string, string>;

    const data       = await getMarketData();
    const fundMap    = getFundamentals();

    // ── Merge market data with fundamentals ───────────────────
    const merged = data.map((e) => {
      const f = fundMap.get(e.ticker);
      return {
        ticker:        e.ticker,
        name:          e.name,
        sector:        e.sector,
        price:         e.price,
        change:        e.change,
        changePct:     e.changePct,
        marketCap:     e.marketCap,          // billions
        volume:        e.volume,
        trailingPE:    f?.trailingPE    ?? null,
        dividendYield: f?.dividendYield ?? null, // already as %
        high52w:       f?.fiftyTwoWeekHigh ?? null,
      };
    });

    // ── Apply filters ─────────────────────────────────────────
    let results = merged.filter((s) => {
      if (sector && s.sector.toLowerCase() !== sector.toLowerCase()) return false;

      if (minPE !== undefined && s.trailingPE !== null && s.trailingPE < Number(minPE)) return false;
      if (maxPE !== undefined && s.trailingPE !== null && s.trailingPE > Number(maxPE)) return false;
      // If PE filter is active but trailingPE is null, exclude
      if ((minPE !== undefined || maxPE !== undefined) && s.trailingPE === null) return false;

      if (minMarketCap !== undefined && s.marketCap !== null && s.marketCap < Number(minMarketCap)) return false;
      if (maxMarketCap !== undefined && s.marketCap !== null && s.marketCap > Number(maxMarketCap)) return false;

      if (minChangePct !== undefined && s.changePct < Number(minChangePct)) return false;
      if (maxChangePct !== undefined && s.changePct > Number(maxChangePct)) return false;

      if (minDividendYield !== undefined && s.dividendYield !== null && s.dividendYield < Number(minDividendYield)) return false;
      if (maxDividendYield !== undefined && s.dividendYield !== null && s.dividendYield > Number(maxDividendYield)) return false;
      if (minDividendYield !== undefined && s.dividendYield === null) return false;

      return true;
    });

    // ── Sort ──────────────────────────────────────────────────
    const dir = sortDir === 'asc' ? 1 : -1;
    results.sort((a, b) => {
      let aVal: number | null = null;
      let bVal: number | null = null;

      if (sortBy === 'marketCap')      { aVal = a.marketCap;     bVal = b.marketCap;     }
      else if (sortBy === 'changePct') { aVal = a.changePct;     bVal = b.changePct;     }
      else if (sortBy === 'trailingPE'){ aVal = a.trailingPE;    bVal = b.trailingPE;    }
      else if (sortBy === 'dividendYield') { aVal = a.dividendYield; bVal = b.dividendYield; }
      else if (sortBy === 'price')     { aVal = a.price;         bVal = b.price;         }
      else if (sortBy === 'volume')    { aVal = a.volume;        bVal = b.volume;        }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;   // nulls go last
      if (bVal === null) return -1;
      return (aVal - bVal) * dir;
    });

    // ── Limit ─────────────────────────────────────────────────
    const maxResults = Math.min(Math.max(1, Number(limit) || 100), 200);
    results = results.slice(0, maxResults);

    res.json({
      count:   results.length,
      results,
    });
  } catch (err) {
    console.error('Screener error:', err);
    res.status(500).json({ error: 'Screener failed' });
  }
});

export default router;
