import prisma from '../../prisma.js';
import { Badge } from '@prisma/client';
import { computeSummary, TradeInput } from '../trading/portfolioService.js';
import { getCurrentPrices } from '../market/priceService.js';

const BADGE_DESCRIPTIONS: Record<Badge, string> = {
  FIRST_TRADE: 'Execute your first trade',
  DIVERSIFIER: 'Hold 5 or more different stocks',
  TEN_PERCENT: 'Achieve 10% return on any portfolio',
  BEAT_MARKET: 'Outperform the S&P 500',
  DAY_TRADER: 'Execute 10+ trades in a single day',
  DIAMOND_HANDS: 'Hold a position for 30+ days',
  FULL_PORTFOLIO: 'Be fully invested (cash < 10% of total)',
};

export { BADGE_DESCRIPTIONS };

/**
 * Checks and awards badges for a user. Returns newly unlocked badges.
 */
export async function checkBadges(userId: number): Promise<Badge[]> {
  const existing = await prisma.userBadge.findMany({
    where: { userId },
    select: { badge: true },
  });
  const earned = new Set(existing.map((b) => b.badge));
  const newBadges: Badge[] = [];

  const portfolios = await prisma.portfolio.findMany({
    where: { userId, groupId: null },
    include: { trades: { orderBy: { executedAt: 'asc' } } },
  });

  const allTrades = portfolios.flatMap((p) => p.trades);

  // FIRST_TRADE: has at least 1 trade
  if (!earned.has('FIRST_TRADE') && allTrades.length >= 1) {
    newBadges.push('FIRST_TRADE');
  }

  // DAY_TRADER: 10+ trades in a single day
  if (!earned.has('DAY_TRADER')) {
    const dateCounts = new Map<string, number>();
    for (const t of allTrades) {
      const d = t.executedAt.toISOString().slice(0, 10);
      dateCounts.set(d, (dateCounts.get(d) || 0) + 1);
    }
    for (const count of dateCounts.values()) {
      if (count >= 10) {
        newBadges.push('DAY_TRADER');
        break;
      }
    }
  }

  // Portfolio-level badges
  const allTickers = new Set<string>();
  for (const p of portfolios) {
    for (const t of p.trades) allTickers.add(t.ticker);
  }
  const currentPrices = allTickers.size > 0 ? await getCurrentPrices([...allTickers]) : {};

  for (const p of portfolios) {
    const trades: TradeInput[] = p.trades.map((t) => ({
      ticker: t.ticker,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
    }));

    if (trades.length === 0) continue;

    const summary = computeSummary(trades, p.startingCash, currentPrices);

    // DIVERSIFIER: 5+ different tickers
    if (!earned.has('DIVERSIFIER') && summary.positions.length >= 5) {
      newBadges.push('DIVERSIFIER');
    }

    // TEN_PERCENT: 10%+ return
    if (!earned.has('TEN_PERCENT')) {
      const returnPct = ((summary.totalValue - p.startingCash) / p.startingCash) * 100;
      if (returnPct >= 10) {
        newBadges.push('TEN_PERCENT');
      }
    }

    // FULL_PORTFOLIO: cash < 10% of total
    if (!earned.has('FULL_PORTFOLIO')) {
      if (summary.totalValue > 0 && summary.cashRemaining / summary.totalValue < 0.1) {
        newBadges.push('FULL_PORTFOLIO');
      }
    }
  }

  // DIAMOND_HANDS: held a position for 30+ days
  if (!earned.has('DIAMOND_HANDS')) {
    for (const p of portfolios) {
      if (p.trades.length === 0) continue;
      const firstBuyDates = new Map<string, Date>();
      for (const t of p.trades) {
        if (t.side === 'BUY' && !firstBuyDates.has(t.ticker)) {
          firstBuyDates.set(t.ticker, t.executedAt);
        }
      }
      const trades: TradeInput[] = p.trades.map((t) => ({
        ticker: t.ticker, side: t.side, quantity: t.quantity, price: t.price,
      }));
      const summary = computeSummary(trades, p.startingCash, currentPrices);
      const now = Date.now();
      for (const pos of summary.positions) {
        const buyDate = firstBuyDates.get(pos.ticker);
        if (buyDate && now - buyDate.getTime() >= 30 * 24 * 60 * 60 * 1000) {
          newBadges.push('DIAMOND_HANDS');
          break;
        }
      }
      if (newBadges.includes('DIAMOND_HANDS')) break;
    }
  }

  // Deduplicate and save
  const uniqueNew = [...new Set(newBadges)].filter((b) => !earned.has(b));
  if (uniqueNew.length > 0) {
    await prisma.userBadge.createMany({
      data: uniqueNew.map((badge) => ({ userId, badge })),
      skipDuplicates: true,
    });
  }

  return uniqueNew;
}
