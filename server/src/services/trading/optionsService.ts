// Pure functions — Black-Scholes pricing, Greeks, P&L calculations.
// No DB or IO, only data in → data out.

export type OptionSide = 'BUY' | 'SELL';
export type OptionKind = 'CALL' | 'PUT';

export interface GreeksResult {
  delta: number;
  gamma: number;
  theta: number; // per day
  vega: number;  // per 1% IV change
  rho: number;   // per 1% rate change
}

export interface OptionPnL {
  totalCost: number;       // premium × qty × 100
  currentValue: number;    // current premium × qty × 100
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

// ── Standard Normal Distribution helpers ──────────────────

function normCdf(x: number): number {
  // Abramowitz & Stegun approximation 26.2.17
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1.0 + sign * y);
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Black-Scholes Pricing ─────────────────────────────────

/**
 * Calculate d1 and d2 for Black-Scholes.
 * @param S — spot price
 * @param K — strike price
 * @param T — time to expiration in years
 * @param sigma — implied volatility (annualized, e.g. 0.30 = 30%)
 * @param r — risk-free rate (annualized, e.g. 0.05 = 5%)
 */
function d1d2(S: number, K: number, T: number, sigma: number, r: number) {
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

/**
 * Black-Scholes theoretical option price.
 */
export function blackScholes(
  spot: number,
  strike: number,
  timeToExpiry: number, // years
  iv: number,           // annualized (0.30 = 30%)
  riskFreeRate: number,
  type: OptionKind,
): number {
  if (timeToExpiry <= 0) {
    // At expiration — intrinsic value only
    if (type === 'CALL') return Math.max(spot - strike, 0);
    return Math.max(strike - spot, 0);
  }

  const { d1, d2 } = d1d2(spot, strike, timeToExpiry, iv, riskFreeRate);

  if (type === 'CALL') {
    return round4(
      spot * normCdf(d1) - strike * Math.exp(-riskFreeRate * timeToExpiry) * normCdf(d2),
    );
  }
  // PUT
  return round4(
    strike * Math.exp(-riskFreeRate * timeToExpiry) * normCdf(-d2) - spot * normCdf(-d1),
  );
}

// ── Greeks ────────────────────────────────────────────────

/**
 * Calculate all five Greeks for an option.
 */
export function calculateGreeks(
  spot: number,
  strike: number,
  timeToExpiry: number,
  iv: number,
  riskFreeRate: number,
  type: OptionKind,
): GreeksResult {
  if (timeToExpiry <= 0) {
    const itm = type === 'CALL' ? spot > strike : spot < strike;
    return {
      delta: itm ? (type === 'CALL' ? 1 : -1) : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    };
  }

  const { d1, d2 } = d1d2(spot, strike, timeToExpiry, iv, riskFreeRate);
  const sqrtT = Math.sqrt(timeToExpiry);
  const expRT = Math.exp(-riskFreeRate * timeToExpiry);

  // Delta
  const delta = type === 'CALL' ? normCdf(d1) : normCdf(d1) - 1;

  // Gamma (same for calls and puts)
  const gamma = normPdf(d1) / (spot * iv * sqrtT);

  // Theta (per day)
  const thetaCommon = -(spot * normPdf(d1) * iv) / (2 * sqrtT);
  let theta: number;
  if (type === 'CALL') {
    theta = (thetaCommon - riskFreeRate * strike * expRT * normCdf(d2)) / 365;
  } else {
    theta = (thetaCommon + riskFreeRate * strike * expRT * normCdf(-d2)) / 365;
  }

  // Vega (per 1% IV change)
  const vega = (spot * normPdf(d1) * sqrtT) / 100;

  // Rho (per 1% rate change)
  let rho: number;
  if (type === 'CALL') {
    rho = (strike * timeToExpiry * expRT * normCdf(d2)) / 100;
  } else {
    rho = -(strike * timeToExpiry * expRT * normCdf(-d2)) / 100;
  }

  return {
    delta: round4(delta),
    gamma: round4(gamma),
    theta: round4(theta),
    vega: round4(vega),
    rho: round4(rho),
  };
}

// ── P&L Calculations ─────────────────────────────────────

/**
 * Calculate P&L for an option position.
 */
export function calculateOptionPnL(
  side: OptionSide,
  quantity: number,
  entryPremium: number,
  currentPremium: number,
): OptionPnL {
  const multiplier = side === 'BUY' ? 1 : -1;
  const totalCost = round2(entryPremium * quantity * 100 * multiplier);
  const currentValue = round2(currentPremium * quantity * 100 * multiplier);
  const unrealizedPnL = round2(currentValue - totalCost);
  const unrealizedPnLPct = totalCost !== 0 ? round2((unrealizedPnL / Math.abs(totalCost)) * 100) : 0;

  return { totalCost, currentValue, unrealizedPnL, unrealizedPnLPct };
}

/**
 * Calculate P&L at expiration for a range of stock prices (for P&L chart).
 */
export function calculatePnLAtExpiry(
  type: OptionKind,
  side: OptionSide,
  strike: number,
  premium: number,
  quantity: number,
  priceRange: number[], // array of stock prices to evaluate
): { price: number; pnl: number }[] {
  return priceRange.map((price) => {
    let intrinsic: number;
    if (type === 'CALL') {
      intrinsic = Math.max(price - strike, 0);
    } else {
      intrinsic = Math.max(strike - price, 0);
    }

    let pnl: number;
    if (side === 'BUY') {
      pnl = (intrinsic - premium) * quantity * 100;
    } else {
      pnl = (premium - intrinsic) * quantity * 100;
    }

    return { price, pnl: round2(pnl) };
  });
}

/**
 * Calculate breakeven price for a single-leg option.
 */
export function calculateBreakeven(
  type: OptionKind,
  side: OptionSide,
  strike: number,
  premium: number,
): number {
  if (side === 'BUY') {
    return type === 'CALL' ? round2(strike + premium) : round2(strike - premium);
  }
  // SELL (writer)
  return type === 'CALL' ? round2(strike + premium) : round2(strike - premium);
}

/**
 * Determine if an option is ITM, ATM, or OTM.
 */
export function moneyness(
  type: OptionKind,
  strike: number,
  spotPrice: number,
): 'ITM' | 'ATM' | 'OTM' {
  const diff = Math.abs(spotPrice - strike);
  const threshold = spotPrice * 0.005; // within 0.5% = ATM

  if (diff <= threshold) return 'ATM';
  if (type === 'CALL') return spotPrice > strike ? 'ITM' : 'OTM';
  return spotPrice < strike ? 'ITM' : 'OTM';
}

/**
 * Time to expiration in years from now.
 */
export function timeToExpiryYears(expirationDate: Date, now: Date = new Date()): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return Math.max(0, (expirationDate.getTime() - now.getTime()) / msPerYear);
}
