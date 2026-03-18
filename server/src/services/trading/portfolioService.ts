// Pure functions — no DB or IO, only data in → data out.

export type Side = 'BUY' | 'SELL';

export interface TradeInput {
  ticker: string;
  side: Side;
  quantity: number;
  price: number;
}

export interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
}

export interface PortfolioSummary {
  cashRemaining: number;
  positions: Position[];
  realizedPnL: number;
  unrealizedPnL: number;
  positionsValue: number;
  totalValue: number;
}

/**
 * Replay a list of trades and return current positions.
 *
 * For BUYs:  weighted-average cost basis is recalculated.
 * For SELLs: realized PnL is booked at (sellPrice - avgCost) * qty.
 */
export function buildPositions(trades: TradeInput[]): {
  positions: Map<string, { shares: number; avgCost: number }>;
  cashSpent: number;
  realizedPnL: number;
} {
  const positions = new Map<string, { shares: number; avgCost: number }>();
  let cashSpent = 0;
  let realizedPnL = 0;

  for (const t of trades) {
    if (!positions.has(t.ticker)) {
      positions.set(t.ticker, { shares: 0, avgCost: 0 });
    }
    const pos = positions.get(t.ticker)!;

    if (t.side === 'BUY') {
      const prevTotal = pos.shares * pos.avgCost;
      pos.shares += t.quantity;
      pos.avgCost = pos.shares > 0 ? (prevTotal + t.quantity * t.price) / pos.shares : 0;
      cashSpent += t.quantity * t.price;
    } else {
      // SELL — realize profit/loss against avg cost
      realizedPnL += (t.price - pos.avgCost) * t.quantity;
      pos.shares -= t.quantity;
      cashSpent -= t.quantity * t.price;
      // avgCost stays the same for remaining shares
    }
  }

  return { positions, cashSpent, realizedPnL };
}

/**
 * Full portfolio summary given trades, starting cash, and live prices.
 *
 * @param trades      — ordered list of executed trades
 * @param startingCash — initial paper cash (e.g. 100 000)
 * @param currentPrices — map of ticker → current market price
 */
export function computeSummary(
  trades: TradeInput[],
  startingCash: number,
  currentPrices: Record<string, number>,
): PortfolioSummary {
  const { positions, cashSpent, realizedPnL } = buildPositions(trades);

  const cashRemaining = startingCash - cashSpent;

  // Build output positions list (only tickers with shares > 0)
  const openPositions: Position[] = [];
  let positionsValue = 0;
  let unrealizedPnL = 0;

  for (const [ticker, pos] of positions) {
    if (pos.shares <= 0) continue;

    const marketPrice = currentPrices[ticker] ?? pos.avgCost;
    const mktValue = pos.shares * marketPrice;

    positionsValue += mktValue;
    unrealizedPnL += (marketPrice - pos.avgCost) * pos.shares;

    openPositions.push({
      ticker,
      shares: pos.shares,
      avgCost: round2(pos.avgCost),
    });
  }

  return {
    cashRemaining: round2(cashRemaining),
    positions: openPositions,
    realizedPnL: round2(realizedPnL),
    unrealizedPnL: round2(unrealizedPnL),
    positionsValue: round2(positionsValue),
    totalValue: round2(cashRemaining + positionsValue),
  };
}

export interface HistoryTradeInput extends TradeInput {
  executedAt: Date;
}

export interface HistoryPoint {
  date: string;
  totalValue: number;
}

/**
 * Replay trades chronologically and compute portfolio value at each trade date.
 * Uses the trade price as a proxy for current market price at that point in time.
 */
export function computeHistory(
  trades: HistoryTradeInput[],
  startingCash: number,
): HistoryPoint[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );

  const points: HistoryPoint[] = [];
  const tradesSoFar: TradeInput[] = [];
  const latestPrices: Record<string, number> = {};

  for (const t of sorted) {
    tradesSoFar.push(t);
    latestPrices[t.ticker] = t.price;

    const summary = computeSummary(tradesSoFar, startingCash, latestPrices);
    const dateStr = t.executedAt.toISOString().slice(0, 10);

    // If same date, replace the previous point
    if (points.length > 0 && points[points.length - 1].date === dateStr) {
      points[points.length - 1].totalValue = summary.totalValue;
    } else {
      points.push({ date: dateStr, totalValue: summary.totalValue });
    }
  }

  return points;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
