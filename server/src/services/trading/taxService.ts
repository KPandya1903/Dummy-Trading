// Pure functions — no DB or IO, only data in → data out.
// Parallel to portfolioService.ts but uses FIFO lot tracking for tax classification.

export interface TaxTradeInput {
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executedAt: Date;
}

export interface TaxLot {
  ticker: string;
  buyDate: Date;
  quantity: number;   // remaining shares in this lot
  costBasis: number;  // price per share when bought
}

export interface RealizedGain {
  ticker: string;
  buyDate: Date;
  sellDate: Date;
  quantity: number;
  costBasis: number;  // per share
  sellPrice: number;  // per share
  gain: number;       // total gain/loss
  holdingDays: number;
  isLongTerm: boolean; // >= 365 days
}

export interface WashSaleFlag {
  ticker: string;
  sellDate: Date;
  rebuyDate: Date;
  disallowedLoss: number;
}

export interface TaxProfile {
  shortTermRate: number;
  longTermRate: number;
}

export interface TaxSummary {
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  estimatedTax: number;
  effectiveRate: number;
  realizedGains: RealizedGain[];
  washSales: WashSaleFlag[];
  unrealizedTaxLots: TaxLot[];
}

const DEFAULT_TAX_PROFILE: TaxProfile = {
  shortTermRate: 0.32,
  longTermRate: 0.15,
};

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Replay trades using FIFO lot tracking.
 * Each BUY creates a new lot; each SELL consumes lots oldest-first.
 */
export function replayLotsAndGains(trades: TaxTradeInput[]): {
  lots: TaxLot[];
  gains: RealizedGain[];
} {
  const sorted = [...trades].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );

  // Lots per ticker, ordered oldest-first
  const lotsMap = new Map<string, TaxLot[]>();
  const gains: RealizedGain[] = [];

  for (const t of sorted) {
    if (!lotsMap.has(t.ticker)) lotsMap.set(t.ticker, []);
    const tickerLots = lotsMap.get(t.ticker)!;

    if (t.side === 'BUY') {
      tickerLots.push({
        ticker: t.ticker,
        buyDate: t.executedAt,
        quantity: t.quantity,
        costBasis: t.price,
      });
    } else {
      // SELL — consume lots FIFO
      let remaining = t.quantity;
      while (remaining > 0 && tickerLots.length > 0) {
        const lot = tickerLots[0];
        const consumed = Math.min(remaining, lot.quantity);
        const holdDays = daysBetween(lot.buyDate, t.executedAt);

        gains.push({
          ticker: t.ticker,
          buyDate: lot.buyDate,
          sellDate: t.executedAt,
          quantity: consumed,
          costBasis: lot.costBasis,
          sellPrice: t.price,
          gain: round2((t.price - lot.costBasis) * consumed),
          holdingDays: holdDays,
          isLongTerm: holdDays >= 365,
        });

        lot.quantity -= consumed;
        remaining -= consumed;

        if (lot.quantity <= 0) tickerLots.shift();
      }
    }
  }

  // Flatten remaining lots
  const allLots: TaxLot[] = [];
  for (const lots of lotsMap.values()) {
    for (const lot of lots) {
      if (lot.quantity > 0) allLots.push(lot);
    }
  }

  return { lots: allLots, gains };
}

/**
 * Detect wash sales: selling at a loss and rebuying within 30 days (before or after).
 */
export function detectWashSales(
  trades: TaxTradeInput[],
  gains: RealizedGain[],
): WashSaleFlag[] {
  const washSales: WashSaleFlag[] = [];

  const buys = trades
    .filter((t) => t.side === 'BUY')
    .sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());

  for (const g of gains) {
    if (g.gain >= 0) continue; // only losses

    // Check if same ticker was bought within 30 days before or after the sell
    for (const buy of buys) {
      if (buy.ticker !== g.ticker) continue;
      const daysDiff = daysBetween(buy.executedAt, g.sellDate);
      // Within 30 days before or after the sell date
      if (daysDiff <= 30 && buy.executedAt.getTime() !== g.buyDate.getTime()) {
        washSales.push({
          ticker: g.ticker,
          sellDate: g.sellDate,
          rebuyDate: buy.executedAt,
          disallowedLoss: round2(Math.abs(g.gain)),
        });
        break; // one wash sale flag per realized loss
      }
    }
  }

  return washSales;
}

/**
 * Estimate federal tax using flat rates.
 */
export function estimateTax(
  netShortTerm: number,
  netLongTerm: number,
  profile: TaxProfile = DEFAULT_TAX_PROFILE,
): number {
  let tax = 0;
  if (netShortTerm > 0) tax += netShortTerm * profile.shortTermRate;
  if (netLongTerm > 0) tax += netLongTerm * profile.longTermRate;
  return round2(tax);
}

/**
 * Full tax summary computed from trade history.
 */
export function computeTaxSummary(
  trades: TaxTradeInput[],
  profile: TaxProfile = DEFAULT_TAX_PROFILE,
): TaxSummary {
  const { lots, gains } = replayLotsAndGains(trades);
  const washSales = detectWashSales(trades, gains);

  let shortTermGains = 0;
  let longTermGains = 0;
  let shortTermLosses = 0;
  let longTermLosses = 0;

  for (const g of gains) {
    if (g.isLongTerm) {
      if (g.gain >= 0) longTermGains += g.gain;
      else longTermLosses += g.gain;
    } else {
      if (g.gain >= 0) shortTermGains += g.gain;
      else shortTermLosses += g.gain;
    }
  }

  const netShortTerm = round2(shortTermGains + shortTermLosses);
  const netLongTerm = round2(longTermGains + longTermLosses);
  const estimated = estimateTax(netShortTerm, netLongTerm, profile);

  const totalNet = netShortTerm + netLongTerm;
  const effectiveRate = totalNet > 0 ? round2((estimated / totalNet) * 100) : 0;

  return {
    shortTermGains: round2(shortTermGains),
    longTermGains: round2(longTermGains),
    shortTermLosses: round2(shortTermLosses),
    longTermLosses: round2(longTermLosses),
    netShortTerm,
    netLongTerm,
    estimatedTax: estimated,
    effectiveRate,
    realizedGains: gains,
    washSales,
    unrealizedTaxLots: lots,
  };
}
