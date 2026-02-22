import { Router, Request, Response } from 'express';
import prisma from '../prisma.js';
import { authenticate } from '../middleware/auth.js';
import { computeSummary, TradeInput } from '../services/portfolioService.js';
import { getCurrentPrices } from '../services/priceService.js';
import { getMarketData, MarketEntry } from '../services/marketService.js';

const router = Router();
router.use(authenticate);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── GET /api/dashboard ───────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const portfolios = await prisma.portfolio.findMany({
      where: { userId, groupId: null },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    // Collect all unique tickers across all portfolios
    const allTickers = new Set<string>();
    for (const p of portfolios) {
      for (const t of p.trades) allTickers.add(t.ticker);
    }
    const currentPrices = await getCurrentPrices([...allTickers]);

    // Get market data for per-ticker change info + market status
    const marketData = await getMarketData();
    const marketMap = new Map<string, MarketEntry>(
      marketData.map((e) => [e.ticker, e]),
    );
    const marketStatus =
      marketData.length > 0 ? marketData[0].marketState : 'CLOSED';

    let totalValue = 0;
    let totalStartingCash = 0;
    let totalCashRemaining = 0;
    const allPositions: { ticker: string; value: number; pnl: number }[] = [];

    // Aggregated holdings: merge same-ticker across portfolios
    const holdingsMap = new Map<
      string,
      { shares: number; totalCost: number }
    >();

    const portfolioSummaries = portfolios.map((p) => {
      const trades: TradeInput[] = p.trades.map((t) => ({
        ticker: t.ticker,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
      }));

      const summary = computeSummary(trades, p.startingCash, currentPrices);
      totalValue += summary.totalValue;
      totalStartingCash += p.startingCash;
      totalCashRemaining += summary.cashRemaining;

      for (const pos of summary.positions) {
        const mktPrice = currentPrices[pos.ticker] ?? pos.avgCost;
        const value = pos.shares * mktPrice;
        const pnl = (mktPrice - pos.avgCost) * pos.shares;
        allPositions.push({ ticker: pos.ticker, value, pnl });

        // Merge into holdings
        const existing = holdingsMap.get(pos.ticker);
        if (existing) {
          existing.totalCost += pos.shares * pos.avgCost;
          existing.shares += pos.shares;
        } else {
          holdingsMap.set(pos.ticker, {
            shares: pos.shares,
            totalCost: pos.shares * pos.avgCost,
          });
        }
      }

      return {
        id: p.id,
        name: p.name,
        totalValue: summary.totalValue,
        returnPct:
          p.startingCash > 0
            ? Math.round(
                ((summary.totalValue - p.startingCash) / p.startingCash) *
                  10000,
              ) / 100
            : 0,
      };
    });

    const totalReturnPct =
      totalStartingCash > 0
        ? Math.round(
            ((totalValue - totalStartingCash) / totalStartingCash) * 10000,
          ) / 100
        : 0;

    // Today's change from market data
    let todaysChange = 0;
    for (const [ticker, h] of holdingsMap) {
      const me = marketMap.get(ticker);
      if (me) {
        todaysChange += h.shares * me.change;
      }
    }
    const yesterdayValue = totalValue - todaysChange;
    const todaysChangePct =
      yesterdayValue > 0 ? round2((todaysChange / yesterdayValue) * 100) : 0;

    // Build holdings array
    const holdings = [...holdingsMap.entries()].map(([ticker, h]) => {
      const me = marketMap.get(ticker);
      const price = currentPrices[ticker] ?? 0;
      const avgCost = h.shares > 0 ? h.totalCost / h.shares : 0;
      return {
        ticker,
        name: me?.name ?? ticker,
        shares: h.shares,
        avgCost: round2(avgCost),
        currentPrice: price,
        todayChange: me?.change ?? 0,
        todayChangePct: me?.changePct ?? 0,
        totalValue: round2(h.shares * price),
        totalGainLoss: round2((price - avgCost) * h.shares),
        totalGainLossPct:
          avgCost > 0 ? round2(((price - avgCost) / avgCost) * 100) : 0,
      };
    });

    // Top 3 gainers and losers
    const sorted = [...allPositions].sort((a, b) => b.pnl - a.pnl);
    const topGainers = sorted.filter((p) => p.pnl > 0).slice(0, 3);
    const topLosers = sorted.filter((p) => p.pnl < 0).slice(-3).reverse();

    // Recent 5 trades
    const recentTrades = await prisma.trade.findMany({
      where: { portfolio: { userId, groupId: null } },
      orderBy: { executedAt: 'desc' },
      take: 5,
      include: { portfolio: { select: { name: true } } },
    });

    // ── Leaderboard rank ──────────────────────────────────
    const allPortfolios = await prisma.portfolio.findMany({
      where: { groupId: null },
      include: {
        trades: { orderBy: { executedAt: 'asc' } },
        user: { select: { id: true, email: true } },
      },
    });

    const otherTickers = new Set<string>();
    for (const p of allPortfolios) {
      for (const t of p.trades) otherTickers.add(t.ticker);
    }
    const allPrices = await getCurrentPrices([...otherTickers]);

    const userTotals = new Map<
      number,
      { email: string; totalValue: number; startingCash: number }
    >();
    for (const p of allPortfolios) {
      const trades: TradeInput[] = p.trades.map((t) => ({
        ticker: t.ticker,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
      }));
      const summary = computeSummary(trades, p.startingCash, allPrices);
      const existing = userTotals.get(p.userId) || {
        email: p.user.email,
        totalValue: 0,
        startingCash: 0,
      };
      existing.totalValue += summary.totalValue;
      existing.startingCash += p.startingCash;
      userTotals.set(p.userId, existing);
    }

    const ranked = [...userTotals.entries()]
      .map(([uid, data]) => ({
        userId: uid,
        email: data.email,
        totalValue: round2(data.totalValue),
        returnPct:
          data.startingCash > 0
            ? round2(
                ((data.totalValue - data.startingCash) / data.startingCash) *
                  100,
              )
            : 0,
      }))
      .sort((a, b) => b.returnPct - a.returnPct);

    const userRankIndex = ranked.findIndex((r) => r.userId === userId);
    const rank = userRankIndex >= 0 ? userRankIndex + 1 : ranked.length + 1;
    const totalPlayers = ranked.length;
    const topPlayer =
      ranked.length > 0
        ? {
            email: ranked[0].email,
            totalValue: ranked[0].totalValue,
            returnPct: ranked[0].returnPct,
          }
        : null;

    res.json({
      totalValue: round2(totalValue),
      totalStartingCash,
      totalReturnPct,
      cashRemaining: round2(totalCashRemaining),
      todaysChange: round2(todaysChange),
      todaysChangePct,
      marketStatus,
      rank,
      totalPlayers,
      topPlayer,
      portfolios: portfolioSummaries,
      holdings,
      topGainers,
      topLosers,
      recentTrades: recentTrades.map((t) => ({
        id: t.id,
        ticker: t.ticker,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        executedAt: t.executedAt,
        portfolioName: t.portfolio.name,
      })),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
