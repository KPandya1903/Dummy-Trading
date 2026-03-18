import {
  blackScholes,
  calculateGreeks,
  calculateOptionPnL,
  calculatePnLAtExpiry,
  calculateBreakeven,
  moneyness,
  timeToExpiryYears,
} from './optionsService.js';

describe('blackScholes', () => {
  // Reference values from standard BS calculators
  const S = 100, K = 100, T = 1, sigma = 0.20, r = 0.05;

  it('prices an ATM call in reasonable range', () => {
    const price = blackScholes(S, K, T, sigma, r, 'CALL');
    expect(price).toBeGreaterThan(10);
    expect(price).toBeLessThan(13);
  });

  it('prices an ATM put in reasonable range', () => {
    const price = blackScholes(S, K, T, sigma, r, 'PUT');
    expect(price).toBeGreaterThan(5);
    expect(price).toBeLessThan(8);
  });

  it('obeys put-call parity: C - P ≈ S - K*e^(-rT)', () => {
    const call = blackScholes(S, K, T, sigma, r, 'CALL');
    const put = blackScholes(S, K, T, sigma, r, 'PUT');
    const parity = S - K * Math.exp(-r * T);
    expect(Math.abs((call - put) - parity)).toBeLessThan(0.01);
  });

  it('deep ITM call ≈ intrinsic value', () => {
    const price = blackScholes(150, 100, 0.01, 0.20, 0.05, 'CALL');
    expect(price).toBeCloseTo(50, 0);
  });

  it('deep OTM call ≈ 0', () => {
    const price = blackScholes(50, 100, 0.1, 0.20, 0.05, 'CALL');
    expect(price).toBeLessThan(0.01);
  });

  it('at expiration returns intrinsic value', () => {
    expect(blackScholes(110, 100, 0, 0.20, 0.05, 'CALL')).toBe(10);
    expect(blackScholes(90, 100, 0, 0.20, 0.05, 'CALL')).toBe(0);
    expect(blackScholes(90, 100, 0, 0.20, 0.05, 'PUT')).toBe(10);
    expect(blackScholes(110, 100, 0, 0.20, 0.05, 'PUT')).toBe(0);
  });

  it('higher IV increases price', () => {
    const lowVol = blackScholes(S, K, T, 0.15, r, 'CALL');
    const highVol = blackScholes(S, K, T, 0.40, r, 'CALL');
    expect(highVol).toBeGreaterThan(lowVol);
  });

  it('more time increases price', () => {
    const shortTime = blackScholes(S, K, 0.25, sigma, r, 'CALL');
    const longTime = blackScholes(S, K, 2, sigma, r, 'CALL');
    expect(longTime).toBeGreaterThan(shortTime);
  });
});

describe('calculateGreeks', () => {
  const S = 100, K = 100, T = 1, sigma = 0.20, r = 0.05;

  it('ATM call delta ≈ 0.5-0.65', () => {
    const greeks = calculateGreeks(S, K, T, sigma, r, 'CALL');
    expect(greeks.delta).toBeGreaterThan(0.5);
    expect(greeks.delta).toBeLessThan(0.7);
  });

  it('ATM put delta ≈ -0.35 to -0.5', () => {
    const greeks = calculateGreeks(S, K, T, sigma, r, 'PUT');
    expect(greeks.delta).toBeLessThan(-0.3);
    expect(greeks.delta).toBeGreaterThan(-0.5);
  });

  it('call delta + |put delta| ≈ 1', () => {
    const callG = calculateGreeks(S, K, T, sigma, r, 'CALL');
    const putG = calculateGreeks(S, K, T, sigma, r, 'PUT');
    expect(Math.abs(callG.delta + Math.abs(putG.delta) - 1)).toBeLessThan(0.02);
  });

  it('gamma is positive and same for call/put', () => {
    const callG = calculateGreeks(S, K, T, sigma, r, 'CALL');
    const putG = calculateGreeks(S, K, T, sigma, r, 'PUT');
    expect(callG.gamma).toBeGreaterThan(0);
    expect(callG.gamma).toBeCloseTo(putG.gamma, 3);
  });

  it('theta is negative (time decay)', () => {
    const greeks = calculateGreeks(S, K, T, sigma, r, 'CALL');
    expect(greeks.theta).toBeLessThan(0);
  });

  it('vega is positive', () => {
    const greeks = calculateGreeks(S, K, T, sigma, r, 'CALL');
    expect(greeks.vega).toBeGreaterThan(0);
  });

  it('at expiry: ITM call delta = 1, OTM = 0', () => {
    const itm = calculateGreeks(110, 100, 0, sigma, r, 'CALL');
    expect(itm.delta).toBe(1);
    const otm = calculateGreeks(90, 100, 0, sigma, r, 'CALL');
    expect(otm.delta).toBe(0);
  });
});

describe('calculateOptionPnL', () => {
  it('long call profit when premium rises', () => {
    const pnl = calculateOptionPnL('BUY', 1, 5, 8);
    expect(pnl.totalCost).toBe(500);
    expect(pnl.currentValue).toBe(800);
    expect(pnl.unrealizedPnL).toBe(300);
  });

  it('long call loss when premium drops', () => {
    const pnl = calculateOptionPnL('BUY', 1, 5, 2);
    expect(pnl.unrealizedPnL).toBe(-300);
  });

  it('short call profit when premium drops', () => {
    const pnl = calculateOptionPnL('SELL', 1, 5, 2);
    expect(pnl.totalCost).toBe(-500);     // received premium
    expect(pnl.currentValue).toBe(-200);   // would cost 200 to buy back
    expect(pnl.unrealizedPnL).toBe(300);   // net profit
  });

  it('handles multiple contracts', () => {
    const pnl = calculateOptionPnL('BUY', 5, 3, 5);
    expect(pnl.totalCost).toBe(1500);
    expect(pnl.currentValue).toBe(2500);
    expect(pnl.unrealizedPnL).toBe(1000);
  });
});

describe('calculatePnLAtExpiry', () => {
  it('long call breakeven and max loss', () => {
    const results = calculatePnLAtExpiry('CALL', 'BUY', 100, 5, 1, [90, 100, 105, 110, 120]);
    // Below strike: lose premium
    expect(results[0].pnl).toBe(-500);
    expect(results[1].pnl).toBe(-500);
    // At breakeven (105): zero
    expect(results[2].pnl).toBe(0);
    // Above breakeven: profit
    expect(results[3].pnl).toBe(500);
    expect(results[4].pnl).toBe(1500);
  });

  it('long put breakeven and max loss', () => {
    const results = calculatePnLAtExpiry('PUT', 'BUY', 100, 5, 1, [80, 90, 95, 100, 110]);
    expect(results[0].pnl).toBe(1500);  // stock at 80, intrinsic 20 - 5 premium
    expect(results[2].pnl).toBe(0);     // breakeven at 95
    expect(results[3].pnl).toBe(-500);  // at strike, lose premium
    expect(results[4].pnl).toBe(-500);  // above strike, lose premium
  });

  it('short call profit capped at premium', () => {
    const results = calculatePnLAtExpiry('CALL', 'SELL', 100, 5, 1, [90, 100, 110]);
    expect(results[0].pnl).toBe(500);   // keep full premium
    expect(results[1].pnl).toBe(500);   // keep full premium
    expect(results[2].pnl).toBe(-500);  // stock above strike + premium
  });
});

describe('calculateBreakeven', () => {
  it('long call breakeven = strike + premium', () => {
    expect(calculateBreakeven('CALL', 'BUY', 100, 5)).toBe(105);
  });

  it('long put breakeven = strike - premium', () => {
    expect(calculateBreakeven('PUT', 'BUY', 100, 5)).toBe(95);
  });
});

describe('moneyness', () => {
  it('call ITM when spot > strike', () => {
    expect(moneyness('CALL', 100, 110)).toBe('ITM');
  });

  it('call OTM when spot < strike', () => {
    expect(moneyness('CALL', 100, 90)).toBe('OTM');
  });

  it('put ITM when spot < strike', () => {
    expect(moneyness('PUT', 100, 90)).toBe('ITM');
  });

  it('put OTM when spot > strike', () => {
    expect(moneyness('PUT', 100, 110)).toBe('OTM');
  });

  it('ATM when within 0.5% of strike', () => {
    expect(moneyness('CALL', 100, 100.3)).toBe('ATM');
    expect(moneyness('PUT', 100, 99.7)).toBe('ATM');
  });
});

describe('timeToExpiryYears', () => {
  it('returns positive for future dates', () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const result = timeToExpiryYears(future);
    expect(result).toBeGreaterThan(0.99);
    expect(result).toBeLessThan(1.01);
  });

  it('returns 0 for past dates', () => {
    const past = new Date(Date.now() - 1000);
    expect(timeToExpiryYears(past)).toBe(0);
  });
});
