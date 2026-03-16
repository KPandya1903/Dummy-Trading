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
