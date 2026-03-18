import { getCurrentPrices } from './priceService.js';
import { blackScholes, calculateGreeks, type OptionKind } from '../trading/optionsService.js';

export interface OptionChainEntry {
  strike: number;
  expiration: string; // ISO date
  type: OptionKind;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionChain {
  ticker: string;
  spotPrice: number;
  expirations: string[];
  chain: OptionChainEntry[];
}

const RISK_FREE_RATE = 0.045; // ~4.5% 2026 approximation

/**
 * Generate a simulated options chain for a ticker.
 * Uses real spot price from Alpaca/Yahoo + Black-Scholes pricing with synthetic IV.
 */
export async function getOptionsChain(
  ticker: string,
  expiration?: string,
): Promise<OptionChain> {
  const prices = await getCurrentPrices([ticker]);
  const spotPrice = prices[ticker];

  if (!spotPrice) {
    throw new Error(`Could not fetch price for ${ticker}`);
  }

  // Generate expiration dates: weekly for 4 weeks, then monthly for 6 months
  const expirations = generateExpirations();
  const targetExpiry = expiration || expirations[2]; // default ~2 weeks out

  // Generate strikes around current price (±20%, $5 increments for <$100, $10 for >$100)
  const strikes = generateStrikes(spotPrice);

  const targetDate = new Date(targetExpiry + 'T16:00:00Z');
  const now = new Date();
  const T = Math.max(0.001, (targetDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  const chain: OptionChainEntry[] = [];

  for (const strike of strikes) {
    for (const type of ['CALL', 'PUT'] as OptionKind[]) {
      // Synthetic IV: higher for OTM options (volatility smile)
      const moneyRatio = strike / spotPrice;
      const baseIV = 0.25 + Math.abs(1 - moneyRatio) * 0.3; // smile effect
      const iv = baseIV + (Math.random() * 0.04 - 0.02); // small jitter

      const theoretical = blackScholes(spotPrice, strike, T, iv, RISK_FREE_RATE, type);
      const greeks = calculateGreeks(spotPrice, strike, T, iv, RISK_FREE_RATE, type);

      // Bid-ask spread: tighter for ATM, wider for OTM
      const spreadPct = 0.02 + Math.abs(1 - moneyRatio) * 0.05;
      const spread = Math.max(0.01, theoretical * spreadPct);

      const bid = Math.max(0.01, round2(theoretical - spread / 2));
      const ask = round2(theoretical + spread / 2);
      const last = round2(bid + Math.random() * (ask - bid));

      // Synthetic volume/OI: higher for ATM
      const atmFactor = Math.max(0.1, 1 - Math.abs(1 - moneyRatio) * 3);
      const volume = Math.floor(atmFactor * (500 + Math.random() * 2000));
      const openInterest = Math.floor(atmFactor * (2000 + Math.random() * 10000));

      chain.push({
        strike,
        expiration: targetExpiry,
        type,
        bid,
        ask,
        last,
        volume,
        openInterest,
        iv: round4(iv),
        delta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega,
      });
    }
  }

  return {
    ticker: ticker.toUpperCase(),
    spotPrice,
    expirations,
    chain,
  };
}

function generateExpirations(): string[] {
  const dates: string[] = [];
  const now = new Date();

  // Weekly for next 4 weeks (Fridays)
  for (let i = 1; i <= 4; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i * 7 - d.getDay() + 5); // next Friday
    if (d.getDay() !== 5) d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    dates.push(d.toISOString().slice(0, 10));
  }

  // Monthly for next 6 months (3rd Friday of each month)
  for (let m = 1; m <= 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
    // Find 3rd Friday
    const firstDay = d.getDay();
    const firstFriday = firstDay <= 5 ? 5 - firstDay + 1 : 13 - firstDay;
    d.setDate(firstFriday + 14); // 3rd Friday
    const iso = d.toISOString().slice(0, 10);
    if (!dates.includes(iso)) dates.push(iso);
  }

  return dates.sort();
}

function generateStrikes(spotPrice: number): number[] {
  const strikes: number[] = [];
  const increment = spotPrice < 50 ? 2.5 : spotPrice < 200 ? 5 : 10;
  const range = spotPrice * 0.20;

  const minStrike = Math.floor((spotPrice - range) / increment) * increment;
  const maxStrike = Math.ceil((spotPrice + range) / increment) * increment;

  for (let s = minStrike; s <= maxStrike; s += increment) {
    if (s > 0) strikes.push(round2(s));
  }

  return strikes;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
