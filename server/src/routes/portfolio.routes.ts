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
