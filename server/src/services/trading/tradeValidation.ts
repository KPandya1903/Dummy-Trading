import { buildPositions, type TradeInput } from './portfolioService.js';

/**
 * Returns an error message if a SELL would exceed the shares the user owns,
 * or null if the trade is permitted.
 */
export function checkSufficientShares(
  trades: TradeInput[],
  ticker: string,
  quantity: number,
): string | null {
  const { positions } = buildPositions(trades);
  const pos = positions.get(ticker);
  const owned = pos ? pos.shares : 0;
  if (quantity > owned) {
    return `Insufficient shares: you own ${owned} of ${ticker} but tried to sell ${quantity}`;
  }
  return null;
}

/**
 * Returns an error message if a BUY would exceed the portfolio's available cash,
 * or null if the trade is permitted.
 */
export function checkSufficientCash(
  trades: TradeInput[],
  startingCash: number,
  price: number,
  quantity: number,
): string | null {
  const { cashSpent } = buildPositions(trades);
  const cashRemaining = startingCash - cashSpent;
  const cost = price * quantity;
  if (cost > cashRemaining) {
    return `Insufficient cash: order costs $${cost.toFixed(2)} but only $${cashRemaining.toFixed(2)} available`;
  }
  return null;
}

/**
 * Returns an error message if the ticker is not in the group's allowed list,
 * or null if the trade is permitted.
 */
export function checkAllowedTicker(
  allowedTickers: string | null,
  ticker: string,
): string | null {
  if (!allowedTickers) return null;
  const allowed = allowedTickers.split(',').map((t) => t.trim().toUpperCase());
  const upper = ticker.toUpperCase();
  if (!allowed.includes(upper)) {
    return `${upper} is not allowed in this group. Allowed: ${allowed.join(', ')}`;
  }
  return null;
}

/**
 * Returns an error message if the current time is outside the competition window,
 * or null if the trade is permitted.
 */
export function checkCompetitionWindow(
  startDate: Date | null,
  endDate: Date | null,
  now: Date,
): string | null {
  if (startDate && now < startDate) {
    return `Competition hasn't started yet (starts ${startDate.toISOString().split('T')[0]})`;
  }
  if (endDate && now > endDate) {
    return `Competition has ended (ended ${endDate.toISOString().split('T')[0]})`;
  }
  return null;
}

/**
 * Returns an error message if the portfolio has reached its daily trade limit,
 * or null if the trade is permitted.
 */
export function checkDailyTradeLimit(
  maxTradesPerDay: number | null,
  todayCount: number,
): string | null {
  if (maxTradesPerDay == null) return null;
  if (todayCount >= maxTradesPerDay) {
    return `Daily trade limit reached (${maxTradesPerDay} trades/day)`;
  }
  return null;
}
