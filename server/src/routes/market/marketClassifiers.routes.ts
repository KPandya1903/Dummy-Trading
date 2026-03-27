import { Router, Request, Response } from 'express';
import { getMarketData, getFundamentals, MarketEntry } from '../../services/market/marketService.js';

const router = Router();

interface ClassifierStock {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  metric: number | null;
  metricLabel: string;
}

interface Classifier {
  id: string;
  label: string;
  icon: string;
  stocks: ClassifierStock[];
}

function pick(entries: MarketEntry[], count: number): MarketEntry[] {
  return entries.slice(0, count);
}

function toStock(e: MarketEntry, metric: number | null, metricLabel: string): ClassifierStock {
  return {
    ticker: e.ticker,
    name: e.name,
    price: e.price,
    changePct: e.changePct,
    metric,
    metricLabel,
  };
}

// ── GET /api/market/classifiers ─────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await getMarketData();
    const fundamentals = await getFundamentals();

    const classifiers: Classifier[] = [];

    // 1. Top Gainers
    const gainers = [...data].sort((a, b) => b.changePct - a.changePct);
    classifiers.push({
      id: 'top_gainers',
      label: 'Top Gainers',
      icon: 'trending_up',
      stocks: pick(gainers, 5).map((e) => toStock(e, e.changePct, 'Change %')),
    });

    // 2. Top Losers
    const losers = [...data].sort((a, b) => a.changePct - b.changePct);
    classifiers.push({
      id: 'top_losers',
      label: 'Top Losers',
      icon: 'trending_down',
      stocks: pick(losers, 5).map((e) => toStock(e, e.changePct, 'Change %')),
    });

    // 3. Most Active (by volume)
    const byVolume = [...data]
      .filter((e) => e.volume != null)
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    classifiers.push({
      id: 'most_active',
      label: 'Most Active',
      icon: 'bar_chart',
      stocks: pick(byVolume, 5).map((e) => toStock(e, e.volume, 'Volume')),
    });

    // 4. Highest Market Cap
    const byMcap = [...data]
      .filter((e) => e.marketCap != null)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    classifiers.push({
      id: 'highest_market_cap',
      label: 'Highest Market Cap',
      icon: 'account_balance',
      stocks: pick(byMcap, 5).map((e) => toStock(e, e.marketCap, 'Mkt Cap ($B)')),
    });

    // 5. Most Volatile (largest absolute % change)
    const byVolatility = [...data].sort(
      (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct),
    );
    classifiers.push({
      id: 'most_volatile',
      label: 'Most Volatile',
      icon: 'flash_on',
      stocks: pick(byVolatility, 5).map((e) =>
        toStock(e, Math.abs(e.changePct), '|Change %|'),
      ),
    });

    // 6. Best Sector Performers (top stock from the top 3 performing sectors)
    const sectorAvg = new Map<string, { sum: number; count: number }>();
    for (const e of data) {
      const s = sectorAvg.get(e.sector) || { sum: 0, count: 0 };
      s.sum += e.changePct;
      s.count++;
      sectorAvg.set(e.sector, s);
    }
    const topSectors = [...sectorAvg.entries()]
      .map(([sector, { sum, count }]) => ({ sector, avg: sum / count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
    const sectorStocks: ClassifierStock[] = [];
    for (const { sector } of topSectors) {
      const best = data
        .filter((e) => e.sector === sector)
        .sort((a, b) => b.changePct - a.changePct)[0];
      if (best) {
        sectorStocks.push(toStock(best, best.changePct, sector));
      }
    }
    classifiers.push({
      id: 'sector_leaders',
      label: 'Sector Leaders',
      icon: 'category',
      stocks: sectorStocks,
    });

    // 7. 52-Week High Proximity
    const highProximity: { entry: MarketEntry; pct: number }[] = [];
    for (const e of data) {
      const fund = fundamentals.get(e.ticker);
      if (fund?.fiftyTwoWeekHigh && fund.fiftyTwoWeekHigh > 0) {
        const pct = (e.price / fund.fiftyTwoWeekHigh) * 100;
        highProximity.push({ entry: e, pct });
      }
    }
    highProximity.sort((a, b) => b.pct - a.pct);
    classifiers.push({
      id: '52w_high',
      label: 'Near 52W High',
      icon: 'arrow_upward',
      stocks: highProximity.slice(0, 5).map((h) =>
        toStock(h.entry, Math.round(h.pct * 100) / 100, '% of 52W High'),
      ),
    });

    // 8. Highest Dividend Yield
    const divStocks: { entry: MarketEntry; yield_: number }[] = [];
    for (const e of data) {
      const fund = fundamentals.get(e.ticker);
      if (fund?.dividendYield != null && fund.dividendYield > 0) {
        divStocks.push({ entry: e, yield_: fund.dividendYield });
      }
    }
    divStocks.sort((a, b) => b.yield_ - a.yield_);
    classifiers.push({
      id: 'highest_dividend',
      label: 'Highest Dividend',
      icon: 'payments',
      stocks: divStocks.slice(0, 5).map((d) =>
        toStock(d.entry, d.yield_, 'Div Yield %'),
      ),
    });

    // 9. Lowest P/E (Value Stocks)
    const peStocks: { entry: MarketEntry; pe: number }[] = [];
    for (const e of data) {
      const fund = fundamentals.get(e.ticker);
      if (fund?.trailingPE != null && fund.trailingPE > 0) {
        peStocks.push({ entry: e, pe: fund.trailingPE });
      }
    }
    peStocks.sort((a, b) => a.pe - b.pe);
    classifiers.push({
      id: 'value_stocks',
      label: 'Value Stocks (Low P/E)',
      icon: 'savings',
      stocks: peStocks.slice(0, 5).map((p) =>
        toStock(p.entry, Math.round(p.pe * 100) / 100, 'P/E Ratio'),
      ),
    });

    // 10. Momentum Leaders (highest changePct among high-volume stocks)
    const momentum = [...data]
      .filter((e) => (e.volume ?? 0) > 1_000_000)
      .sort((a, b) => b.changePct - a.changePct);
    classifiers.push({
      id: 'momentum',
      label: 'Momentum Leaders',
      icon: 'rocket_launch',
      stocks: pick(momentum, 5).map((e) => toStock(e, e.changePct, 'Change %')),
    });

    res.json({ classifiers });
  } catch (err) {
    console.error('Classifiers error:', err);
    res.status(500).json({ error: 'Failed to compute classifiers' });
  }
});

export default router;
