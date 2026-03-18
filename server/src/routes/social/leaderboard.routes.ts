import { Router, Request, Response } from 'express';
import prisma from '../../prisma.js';
import { computeSummary, TradeInput } from '../../services/trading/portfolioService.js';
import { getCurrentPrices } from '../../services/market/priceService.js';

const router = Router();

// ── GET /api/leaderboard ─────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const portfolios = await prisma.portfolio.findMany({
      where: { groupId: null },
      include: {
        trades: { orderBy: { executedAt: 'asc' } },
        user: { select: { email: true } },
      },
    });

    // Collect all unique tickers across all portfolios
    const allTickers = new Set<string>();
    for (const p of portfolios) {
      for (const t of p.trades) {
        allTickers.add(t.ticker);
      }
    }

    const currentPrices = await getCurrentPrices([...allTickers]);

    const entries = portfolios.map((p) => {
      const trades: TradeInput[] = p.trades.map((t) => ({
        ticker: t.ticker,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
      }));

      const summary = computeSummary(trades, p.startingCash, currentPrices);
      const returnPct =
        ((summary.totalValue - p.startingCash) / p.startingCash) * 100;

      return {
        portfolioId: p.id,
        portfolioName: p.name,
        userEmail: p.user.email,
        totalValue: summary.totalValue,
        startingCash: p.startingCash,
        returnPct: Math.round(returnPct * 100) / 100,
      };
    });

    // Sort by return % descending
    entries.sort((a, b) => b.returnPct - a.returnPct);

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute leaderboard' });
  }
});

export default router;
