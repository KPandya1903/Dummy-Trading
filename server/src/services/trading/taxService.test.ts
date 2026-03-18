import {
  replayLotsAndGains,
  detectWashSales,
  estimateTax,
  computeTaxSummary,
  type TaxTradeInput,
} from './taxService.js';

function d(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00Z');
}

describe('replayLotsAndGains', () => {
  it('creates a lot for a single BUY', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 50, price: 150, executedAt: d('2025-01-15') },
    ];
    const { lots, gains } = replayLotsAndGains(trades);
    expect(gains).toHaveLength(0);
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ ticker: 'AAPL', quantity: 50, costBasis: 150 });
  });

  it('records a short-term gain (< 365 days)', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 50, price: 150, executedAt: d('2025-01-15') },
      { ticker: 'AAPL', side: 'SELL', quantity: 50, price: 160, executedAt: d('2025-06-15') },
    ];
    const { lots, gains } = replayLotsAndGains(trades);
    expect(lots).toHaveLength(0);
    expect(gains).toHaveLength(1);
    expect(gains[0].isLongTerm).toBe(false);
    expect(gains[0].gain).toBe(500); // (160-150) * 50
    expect(gains[0].holdingDays).toBe(151);
  });

  it('records a long-term gain (>= 365 days)', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 200, executedAt: d('2025-03-01') },
    ];
    const { gains } = replayLotsAndGains(trades);
    expect(gains).toHaveLength(1);
    expect(gains[0].isLongTerm).toBe(true);
    expect(gains[0].gain).toBe(1000);
  });

  it('boundary: sell at exactly 365 days is long-term', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 120, executedAt: d('2024-12-31') },
    ];
    const { gains } = replayLotsAndGains(trades);
    expect(gains[0].holdingDays).toBe(365);
    expect(gains[0].isLongTerm).toBe(true);
  });

  it('consumes lots FIFO with multiple buys', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 20, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 30, price: 200, executedAt: d('2024-06-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 25, price: 150, executedAt: d('2025-03-01') },
    ];
    const { lots, gains } = replayLotsAndGains(trades);

    // First 20 from lot 1, then 5 from lot 2
    expect(gains).toHaveLength(2);
    expect(gains[0]).toMatchObject({ quantity: 20, costBasis: 100, isLongTerm: true });
    expect(gains[0].gain).toBe(1000); // (150-100)*20
    expect(gains[1]).toMatchObject({ quantity: 5, costBasis: 200, isLongTerm: false });
    expect(gains[1].gain).toBe(-250); // (150-200)*5

    // 25 shares remaining from lot 2
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ quantity: 25, costBasis: 200 });
  });

  it('handles full liquidation across multiple lots', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 120, executedAt: d('2024-02-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 140, executedAt: d('2024-03-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 30, price: 130, executedAt: d('2024-08-01') },
    ];
    const { lots, gains } = replayLotsAndGains(trades);
    expect(lots).toHaveLength(0);
    expect(gains).toHaveLength(3);
    expect(gains[0].gain).toBe(300);  // (130-100)*10
    expect(gains[1].gain).toBe(100);  // (130-120)*10
    expect(gains[2].gain).toBe(-100); // (130-140)*10
  });

  it('handles mixed tickers independently', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'TSLA', side: 'BUY', quantity: 5, price: 200, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 120, executedAt: d('2024-06-01') },
      { ticker: 'TSLA', side: 'SELL', quantity: 5, price: 180, executedAt: d('2024-06-01') },
    ];
    const { lots, gains } = replayLotsAndGains(trades);
    expect(lots).toHaveLength(0);
    expect(gains).toHaveLength(2);
    expect(gains.find((g) => g.ticker === 'AAPL')!.gain).toBe(200);
    expect(gains.find((g) => g.ticker === 'TSLA')!.gain).toBe(-100);
  });

  it('returns empty for no trades', () => {
    const { lots, gains } = replayLotsAndGains([]);
    expect(lots).toHaveLength(0);
    expect(gains).toHaveLength(0);
  });
});

describe('detectWashSales', () => {
  it('flags a wash sale when rebuy is within 30 days after sell', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 100, executedAt: d('2024-06-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 105, executedAt: d('2024-06-15') },
    ];
    const { gains } = replayLotsAndGains(trades);
    const washSales = detectWashSales(trades, gains);
    expect(washSales).toHaveLength(1);
    expect(washSales[0].disallowedLoss).toBe(500); // |(-50)*10|
  });

  it('flags a wash sale when rebuy is within 30 days before sell', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 5, price: 95, executedAt: d('2024-05-15') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 100, executedAt: d('2024-06-01') },
    ];
    const { gains } = replayLotsAndGains(trades);
    const washSales = detectWashSales(trades, gains);
    expect(washSales).toHaveLength(1);
  });

  it('does not flag when no rebuy within 30 days', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 100, executedAt: d('2024-06-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 105, executedAt: d('2024-08-01') },
    ];
    const { gains } = replayLotsAndGains(trades);
    const washSales = detectWashSales(trades, gains);
    expect(washSales).toHaveLength(0);
  });

  it('does not flag gains as wash sales', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 150, executedAt: d('2024-06-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 145, executedAt: d('2024-06-05') },
    ];
    const { gains } = replayLotsAndGains(trades);
    const washSales = detectWashSales(trades, gains);
    expect(washSales).toHaveLength(0);
  });

  it('does not flag different tickers', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 100, executedAt: d('2024-06-01') },
      { ticker: 'TSLA', side: 'BUY', quantity: 10, price: 200, executedAt: d('2024-06-05') },
    ];
    const { gains } = replayLotsAndGains(trades);
    const washSales = detectWashSales(trades, gains);
    expect(washSales).toHaveLength(0);
  });
});

describe('estimateTax', () => {
  it('applies 32% to short-term gains', () => {
    expect(estimateTax(1000, 0)).toBe(320);
  });

  it('applies 15% to long-term gains', () => {
    expect(estimateTax(0, 1000)).toBe(150);
  });

  it('applies both rates for mixed gains', () => {
    expect(estimateTax(1000, 2000)).toBe(620); // 320 + 300
  });

  it('does not tax losses (net negative)', () => {
    expect(estimateTax(-500, -200)).toBe(0);
  });

  it('only taxes positive net amounts', () => {
    expect(estimateTax(-500, 1000)).toBe(150); // only LT taxed
  });

  it('accepts custom tax profile', () => {
    expect(estimateTax(1000, 1000, { shortTermRate: 0.50, longTermRate: 0.20 })).toBe(700);
  });
});

describe('computeTaxSummary', () => {
  it('returns correct summary for mixed ST/LT gains', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: d('2025-01-01') },
      // Sell 20 shares — first 10 are long-term (>365 days), second 10 are short-term
      { ticker: 'AAPL', side: 'SELL', quantity: 20, price: 150, executedAt: d('2025-06-01') },
    ];
    const summary = computeTaxSummary(trades);

    expect(summary.longTermGains).toBe(500);  // (150-100)*10
    expect(summary.shortTermGains).toBe(500); // (150-100)*10
    expect(summary.netShortTerm).toBe(500);
    expect(summary.netLongTerm).toBe(500);
    expect(summary.estimatedTax).toBe(235);   // 500*0.32 + 500*0.15
    expect(summary.realizedGains).toHaveLength(2);
    expect(summary.unrealizedTaxLots).toHaveLength(0);
  });

  it('returns zero tax for no trades', () => {
    const summary = computeTaxSummary([]);
    expect(summary.estimatedTax).toBe(0);
    expect(summary.effectiveRate).toBe(0);
    expect(summary.realizedGains).toHaveLength(0);
  });

  it('shows unrealized lots for open positions', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 50, price: 150, executedAt: d('2025-01-15') },
    ];
    const summary = computeTaxSummary(trades);
    expect(summary.unrealizedTaxLots).toHaveLength(1);
    expect(summary.unrealizedTaxLots[0]).toMatchObject({ ticker: 'AAPL', quantity: 50 });
    expect(summary.estimatedTax).toBe(0);
  });

  it('includes wash sale flags', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 100, executedAt: d('2024-06-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 105, executedAt: d('2024-06-10') },
    ];
    const summary = computeTaxSummary(trades);
    expect(summary.washSales).toHaveLength(1);
    expect(summary.shortTermLosses).toBe(-500);
  });

  it('calculates effective rate correctly', () => {
    const trades: TaxTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 100, price: 100, executedAt: d('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 100, price: 200, executedAt: d('2025-06-01') },
    ];
    const summary = computeTaxSummary(trades);
    // All long-term: 10000 gain, 15% rate
    expect(summary.estimatedTax).toBe(1500);
    expect(summary.effectiveRate).toBe(15);
  });
});
