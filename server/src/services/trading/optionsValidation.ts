import { buildPositions, type TradeInput } from './portfolioService.js';

/**
 * Validate a BUY option order — requires sufficient cash for the premium.
 * Cost = premium × quantity × 100
 */
export function checkOptionBuyCash(
  trades: TradeInput[],
  startingCash: number,
  premium: number,
  quantity: number,
): string | null {
  const { cashSpent } = buildPositions(trades);
  const cashRemaining = startingCash - cashSpent;
  const cost = premium * quantity * 100;
  if (cost > cashRemaining) {
    return `Insufficient cash: option costs $${cost.toFixed(2)} but only $${cashRemaining.toFixed(2)} available`;
  }
  return null;
}

/**
 * Validate a covered call write — requires 100 shares per contract.
 */
export function checkCoveredCall(
  trades: TradeInput[],
  ticker: string,
  quantity: number,
): string | null {
  const { positions } = buildPositions(trades);
  const pos = positions.get(ticker);
  const owned = pos ? pos.shares : 0;
  const required = quantity * 100;
  if (owned < required) {
    return `Covered call requires ${required} shares of ${ticker} but you only own ${owned}`;
  }
  return null;
}

/**
 * Validate a cash-secured put write — requires strike × quantity × 100 cash reserved.
 */
export function checkCashSecuredPut(
  trades: TradeInput[],
  startingCash: number,
  strikePrice: number,
  quantity: number,
): string | null {
  const { cashSpent } = buildPositions(trades);
  const cashRemaining = startingCash - cashSpent;
  const required = strikePrice * quantity * 100;
  if (required > cashRemaining) {
    return `Cash-secured put requires $${required.toFixed(2)} reserved but only $${cashRemaining.toFixed(2)} available`;
  }
  return null;
}
