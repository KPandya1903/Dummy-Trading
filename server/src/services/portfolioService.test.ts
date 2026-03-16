import { buildPositions, computeSummary, computeHistory, TradeInput, HistoryTradeInput } from './portfolioService.js';

describe('buildPositions', () => {
  it('handles a single BUY', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150 },
    ];
    const { positions, cashSpent, realizedPnL } = buildPositions(trades);

    expect(positions.get('AAPL')).toEqual({ shares: 10, avgCost: 150 });
    expect(cashSpent).toBe(1500);
    expect(realizedPnL).toBe(0);
  });

  it('computes weighted average cost on multiple BUYs', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100 },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 200 },
    ];
    const { positions, cashSpent } = buildPositions(trades);

    // (10*100 + 10*200) / 20 = 150
    expect(positions.get('AAPL')).toEqual({ shares: 20, avgCost: 150 });
    expect(cashSpent).toBe(3000);
  });

  it('books realized PnL on SELL', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100 },
      { ticker: 'AAPL', side: 'SELL', quantity: 5, price: 120 },
    ];
    const { positions, realizedPnL, cashSpent } = buildPositions(trades);

    expect(positions.get('AAPL')!.shares).toBe(5);
    expect(positions.get('AAPL')!.avgCost).toBe(100);
    // realized = (120 - 100) * 5 = 100
    expect(realizedPnL).toBe(100);
    // cashSpent = 10*100 (buy) - 5*120 (sell proceeds) = 400
    expect(cashSpent).toBe(400);
  });

  it('handles full liquidation', () => {
    const trades: TradeInput[] = [
      { ticker: 'TSLA', side: 'BUY', quantity: 5, price: 200 },
      { ticker: 'TSLA', side: 'SELL', quantity: 5, price: 250 },
    ];
    const { positions, realizedPnL } = buildPositions(trades);

    expect(positions.get('TSLA')!.shares).toBe(0);
    // realized = (250 - 200) * 5 = 250
    expect(realizedPnL).toBe(250);
  });

  it('tracks multiple tickers independently', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150 },
      { ticker: 'GOOG', side: 'BUY', quantity: 5, price: 2800 },
    ];
    const { positions } = buildPositions(trades);

    expect(positions.get('AAPL')).toEqual({ shares: 10, avgCost: 150 });
    expect(positions.get('GOOG')).toEqual({ shares: 5, avgCost: 2800 });
  });
});

describe('computeSummary', () => {
  const STARTING_CASH = 100_000;

  it('returns starting cash when there are no trades', () => {
    const summary = computeSummary([], STARTING_CASH, {});

    expect(summary.cashRemaining).toBe(100_000);
    expect(summary.positions).toEqual([]);
    expect(summary.realizedPnL).toBe(0);
    expect(summary.unrealizedPnL).toBe(0);
    expect(summary.positionsValue).toBe(0);
    expect(summary.totalValue).toBe(100_000);
  });

  it('computes unrealized PnL from current prices', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150 },
    ];
    const prices = { AAPL: 170 };

    const summary = computeSummary(trades, STARTING_CASH, prices);

    // cash = 100000 - 1500 = 98500
    expect(summary.cashRemaining).toBe(98_500);
    // unrealized = (170 - 150) * 10 = 200
    expect(summary.unrealizedPnL).toBe(200);
    // positions value = 10 * 170 = 1700
    expect(summary.positionsValue).toBe(1700);
    // total = 98500 + 1700 = 100200
    expect(summary.totalValue).toBe(100_200);
    expect(summary.realizedPnL).toBe(0);
  });

  it('computes both realized and unrealized PnL', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 20, price: 100 },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 130 },
    ];
    const prices = { AAPL: 140 };

    const summary = computeSummary(trades, STARTING_CASH, prices);

    // cash = 100000 - (20*100 - 10*130) = 100000 - 700 = 99300
    expect(summary.cashRemaining).toBe(99_300);
    // realized = (130 - 100) * 10 = 300
    expect(summary.realizedPnL).toBe(300);
    // remaining 10 shares at avg 100, mkt 140 → unrealized = 400
    expect(summary.unrealizedPnL).toBe(400);
    // positions value = 10 * 140 = 1400
    expect(summary.positionsValue).toBe(1400);
    // total = 99300 + 1400 = 100700
    expect(summary.totalValue).toBe(100_700);
  });

  it('excludes fully liquidated positions from output', () => {
    const trades: TradeInput[] = [
      { ticker: 'TSLA', side: 'BUY', quantity: 5, price: 200 },
      { ticker: 'TSLA', side: 'SELL', quantity: 5, price: 250 },
    ];

    const summary = computeSummary(trades, STARTING_CASH, { TSLA: 260 });

    expect(summary.positions).toEqual([]);
    expect(summary.realizedPnL).toBe(250);
    expect(summary.unrealizedPnL).toBe(0);
  });

  it('falls back to avgCost when current price is missing', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150 },
    ];
    // no AAPL in prices map
    const summary = computeSummary(trades, STARTING_CASH, {});

    // falls back to avgCost → unrealized = 0
    expect(summary.unrealizedPnL).toBe(0);
    expect(summary.positionsValue).toBe(1500);
    expect(summary.totalValue).toBe(100_000);
  });

  it('handles a multi-ticker portfolio', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150 },
      { ticker: 'GOOG', side: 'BUY', quantity: 2, price: 2800 },
      { ticker: 'AAPL', side: 'SELL', quantity: 5, price: 160 },
    ];
    const prices = { AAPL: 170, GOOG: 2900 };

    const summary = computeSummary(trades, STARTING_CASH, prices);

    // cash = 100000 - (10*150 + 2*2800 - 5*160) = 100000 - 6300 = 93700
    expect(summary.cashRemaining).toBe(93_700);
    // realized AAPL = (160 - 150) * 5 = 50
    expect(summary.realizedPnL).toBe(50);
    // unrealized AAPL = (170 - 150) * 5 = 100
    // unrealized GOOG = (2900 - 2800) * 2 = 200
    expect(summary.unrealizedPnL).toBe(300);
    expect(summary.positions).toHaveLength(2);
  });

  it('rounds values to 2 decimal places', () => {
    const trades: TradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 3, price: 151.33 },
    ];
    const prices = { AAPL: 155.77 };

    const summary = computeSummary(trades, STARTING_CASH, prices);

    // avgCost = 151.33, cashRemaining = 100000 - 453.99 = 99546.01
    expect(summary.cashRemaining).toBe(99_546.01);
    // unrealized = (155.77 - 151.33) * 3 = 13.32
    expect(summary.unrealizedPnL).toBe(13.32);
  });
});

describe('computeHistory', () => {
  const STARTING_CASH = 100_000;

  it('returns empty array for no trades', () => {
    expect(computeHistory([], STARTING_CASH)).toEqual([]);
  });

  it('creates a single point for a single trade', () => {
    const trades: HistoryTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 150, executedAt: new Date('2024-01-15') },
    ];
    const points = computeHistory(trades, STARTING_CASH);

    expect(points).toHaveLength(1);
    expect(points[0].date).toBe('2024-01-15');
    // cash = 100000 - 1500 = 98500; positions = 10*150 = 1500; total = 100000
    expect(points[0].totalValue).toBe(100_000);
  });

  it('collapses multiple trades on the same date into one point', () => {
    const day = new Date('2024-01-15');
    const trades: HistoryTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: day },
      { ticker: 'GOOG', side: 'BUY', quantity: 5,  price: 200, executedAt: day },
    ];
    const points = computeHistory(trades, STARTING_CASH);

    expect(points).toHaveLength(1);
    expect(points[0].date).toBe('2024-01-15');
    // cash = 100000 - 1000 - 1000 = 98000; positions = 1000 + 1000 = 2000; total = 100000
    expect(points[0].totalValue).toBe(100_000);
  });

  it('creates separate points for trades on different dates', () => {
    const trades: HistoryTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY',  quantity: 10, price: 100, executedAt: new Date('2024-01-10') },
      { ticker: 'AAPL', side: 'SELL', quantity: 5,  price: 130, executedAt: new Date('2024-01-20') },
    ];
    const points = computeHistory(trades, STARTING_CASH);

    expect(points).toHaveLength(2);
    expect(points[0].date).toBe('2024-01-10');
    expect(points[1].date).toBe('2024-01-20');
  });

  it('returns points in ascending date order regardless of input order', () => {
    const trades: HistoryTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 5, price: 100, executedAt: new Date('2024-02-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 5, price: 100, executedAt: new Date('2024-01-01') },
    ];
    const points = computeHistory(trades, STARTING_CASH);

    expect(points[0].date < points[1].date).toBe(true);
  });

  it('reflects realized gain after a full sell above cost', () => {
    const trades: HistoryTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY',  quantity: 10, price: 100, executedAt: new Date('2024-01-01') },
      { ticker: 'AAPL', side: 'SELL', quantity: 10, price: 150, executedAt: new Date('2024-02-01') },
    ];
    const points = computeHistory(trades, STARTING_CASH);
    const sellPoint = points.find((p) => p.date === '2024-02-01')!;

    // cash = 100000 - 1000 + 1500 = 100500; no positions remaining
    expect(sellPoint.totalValue).toBe(100_500);
  });

  it('uses the latest trade price as market price for open positions', () => {
    const trades: HistoryTradeInput[] = [
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 100, executedAt: new Date('2024-01-01') },
      { ticker: 'AAPL', side: 'BUY', quantity: 10, price: 200, executedAt: new Date('2024-02-01') },
    ];
    const points = computeHistory(trades, STARTING_CASH);
    const secondPoint = points.find((p) => p.date === '2024-02-01')!;

    // After second trade: latestPrices = { AAPL: 200 }
    // cash = 100000 - 1000 - 2000 = 97000; positions = 20 * 200 = 4000; total = 101000
    expect(secondPoint.totalValue).toBe(101_000);
  });
});
