import { Router, Request, Response } from 'express';
import prisma from '../prisma.js';
import { computeSummary, computeHistory, TradeInput, HistoryTradeInput } from '../services/portfolioService.js';
import { getCurrentPrices } from '../services/priceService.js';
import { authenticate } from '../middleware/auth.js';
import { getSector } from '../services/tickerMetadata.js';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const router = Router();
router.use(authenticate);

// ── GET /api/portfolios ──────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const portfolios = await prisma.portfolio.findMany({
      where: { userId, groupId: null },
      orderBy: { createdAt: 'desc' },
    });

    res.json(portfolios);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list portfolios' });
  }
});

// ── POST /api/portfolios ─────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, startingCash } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const portfolio = await prisma.portfolio.create({
      data: {
        userId,
        name,
        ...(startingCash != null && { startingCash: Number(startingCash) }),
      },
    });

    res.status(201).json(portfolio);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

// ── GET /api/portfolios/:id/summary ──────────────────────
router.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    // Map DB trades → pure TradeInput[]
    const trades: TradeInput[] = portfolio.trades.map((t) => ({
      ticker: t.ticker,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
    }));

    // Collect unique tickers that have open positions or any trades
    const tickers = [...new Set(portfolio.trades.map((t) => t.ticker))];
    const currentPrices = await getCurrentPrices(tickers);

    const summary = computeSummary(trades, portfolio.startingCash, currentPrices);

    // Enrich positions with sector data
    const positionsWithSector = summary.positions.map((p) => ({
      ...p,
      sector: getSector(p.ticker),
    }));

    res.json({
      portfolioId: id,
      name: portfolio.name,
      startingCash: portfolio.startingCash,
      currentPrices,
      ...summary,
      positions: positionsWithSector,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

// ── GET /api/portfolios/:id/history ───────────────────────
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    const trades: HistoryTradeInput[] = portfolio.trades.map((t) => ({
      ticker: t.ticker,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
      executedAt: t.executedAt,
    }));

    const history = computeHistory(trades, portfolio.startingCash);

    // Fetch S&P 500 benchmark for the same date range
    let benchmark: { date: string; value: number }[] = [];
    if (history.length > 0) {
      try {
        const startDate = history[0].date;
        const spData = await yf.historical('^GSPC', { period1: startDate });
        if (spData.length >= 2) {
          // Normalize to same starting value as portfolio
          const startValue = portfolio.startingCash;
          const spStart = (spData[0] as any).close;
          benchmark = spData.map((d: any) => ({
            date: new Date(d.date).toISOString().slice(0, 10),
            value: Math.round((d.close / spStart) * startValue * 100) / 100,
          }));
        }
      } catch {
        // S&P data optional — continue without it
      }
    }

    res.json({
      portfolioId: id,
      startingCash: portfolio.startingCash,
      history,
      benchmark,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute history' });
  }
});

// ── GET /api/portfolios/:id/risk ─────────────────────────
// Sharpe Ratio, Max Drawdown, Beta vs S&P 500, Win Rate

router.get('/:id/risk', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }
    if (portfolio.userId !== userId) { res.status(403).json({ error: 'Not your portfolio' }); return; }

    // No trades → return all nulls
    if (portfolio.trades.length === 0) {
      res.json({
        sharpeRatio: null, maxDrawdownPct: null, beta: null, winRatePct: null,
        tradeCount: 0, dataPointCount: 0,
        note: 'No trades recorded yet.',
      });
      return;
    }

    const histTrades: HistoryTradeInput[] = portfolio.trades.map((t) => ({
      ticker: t.ticker, side: t.side, quantity: t.quantity, price: t.price, executedAt: t.executedAt,
    }));

    const history = computeHistory(histTrades, portfolio.startingCash);

    // ── Sharpe Ratio ───────────────────────────────────────
    let sharpeRatio: number | null = null;
    if (history.length >= 2) {
      const rets: number[] = [];
      for (let i = 1; i < history.length; i++) {
        if (history[i - 1].totalValue > 0) {
          rets.push((history[i].totalValue - history[i - 1].totalValue) / history[i - 1].totalValue);
        }
      }
      if (rets.length >= 2) {
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
        const sd = Math.sqrt(variance);
        sharpeRatio = sd > 0 ? Math.round((mean / sd) * Math.sqrt(252) * 100) / 100 : null;
      }
    }

    // ── Max Drawdown ───────────────────────────────────────
    let maxDrawdownPct: number | null = null;
    {
      let peak = portfolio.startingCash;
      let maxDD = 0;
      for (const pt of history) {
        if (pt.totalValue > peak) peak = pt.totalValue;
        const dd = peak > 0 ? (peak - pt.totalValue) / peak : 0;
        if (dd > maxDD) maxDD = dd;
      }
      maxDrawdownPct = Math.round(maxDD * 10000) / 100; // percentage, 2dp
    }

    // ── Beta vs S&P 500 ────────────────────────────────────
    let beta: number | null = null;
    if (history.length >= 2) {
      try {
        const startDate = history[0].date;
        const spData = await yf.historical('^GSPC', { period1: startDate });
        const spMap = new Map<string, number>();
        for (let i = 1; i < (spData as any[]).length; i++) {
          const prev = (spData as any[])[i - 1];
          const cur  = (spData as any[])[i];
          const date = new Date(cur.date).toISOString().slice(0, 10);
          if (prev.close > 0) spMap.set(date, (cur.close - prev.close) / prev.close);
        }

        const pairs: Array<[number, number]> = [];
        for (let i = 1; i < history.length; i++) {
          const date = history[i].date;
          const spRet = spMap.get(date);
          if (spRet != null && history[i - 1].totalValue > 0) {
            const portRet = (history[i].totalValue - history[i - 1].totalValue) / history[i - 1].totalValue;
            pairs.push([portRet, spRet]);
          }
        }

        if (pairs.length >= 5) {
          const meanP = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
          const meanM = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
          let cov = 0, varM = 0;
          for (const [p, m] of pairs) {
            cov  += (p - meanP) * (m - meanM);
            varM += (m - meanM) ** 2;
          }
          cov  /= pairs.length;
          varM /= pairs.length;
          if (varM > 0) {
            beta = Math.round(Math.max(-3, Math.min(3, cov / varM)) * 100) / 100;
          }
        }
      } catch {
        // S&P data optional — beta stays null
      }
    }

    // ── Win Rate ───────────────────────────────────────────
    // Replay trades chronologically, tracking avgCost per ticker.
    // A SELL is a win if sellPrice > avgCost at time of sale.
    let winRatePct: number | null = null;
    let wins = 0;
    let sellCount = 0;
    {
      const positions = new Map<string, { shares: number; avgCost: number }>();
      for (const t of portfolio.trades) {
        const pos = positions.get(t.ticker) ?? { shares: 0, avgCost: 0 };
        if (t.side === 'BUY') {
          const newShares = pos.shares + t.quantity;
          pos.avgCost = newShares > 0
            ? (pos.avgCost * pos.shares + t.price * t.quantity) / newShares
            : t.price;
          pos.shares = newShares;
        } else {
          if (t.price > pos.avgCost) wins++;
          sellCount++;
          pos.shares = Math.max(0, pos.shares - t.quantity);
        }
        positions.set(t.ticker, pos);
      }
      winRatePct = sellCount > 0
        ? Math.round((wins / sellCount) * 1000) / 10
        : null;
    }

    res.json({
      sharpeRatio,
      maxDrawdownPct,
      beta,
      winRatePct,
      tradeCount:     sellCount,
      dataPointCount: history.length,
      note: `Metrics based on ${history.length} trade-date equity point${history.length !== 1 ? 's' : ''}. Sharpe annualized (risk-free = 0).`,
    });
  } catch (err) {
    console.error(`Portfolio risk error for ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to compute risk metrics' });
  }
});

// ── DELETE /api/portfolios/:id ────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({ where: { id } });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    if (portfolio.groupId) {
      res.status(403).json({ error: 'Cannot delete a group portfolio' });
      return;
    }

    await prisma.portfolio.delete({ where: { id } });
    res.json({ message: 'Portfolio deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete portfolio' });
  }
});

export default router;
