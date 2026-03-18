import {
  checkAllowedTicker,
  checkCompetitionWindow,
  checkDailyTradeLimit,
  checkSufficientShares,
  checkSufficientCash,
} from './tradeValidation.js';

describe('checkAllowedTicker', () => {
  it('returns null when there is no ticker restriction', () => {
    expect(checkAllowedTicker(null, 'AAPL')).toBeNull();
  });

  it('returns null when ticker is in the allowed list', () => {
    expect(checkAllowedTicker('AAPL,TSLA,GOOG', 'TSLA')).toBeNull();
  });

  it('returns an error message when ticker is not in the allowed list', () => {
    const result = checkAllowedTicker('AAPL,TSLA', 'MSFT');
    expect(result).not.toBeNull();
    expect(result).toContain('MSFT');
    expect(result).toContain('AAPL');
    expect(result).toContain('TSLA');
  });

  it('is case-insensitive for the incoming ticker', () => {
    expect(checkAllowedTicker('AAPL,TSLA', 'aapl')).toBeNull();
  });

  it('handles whitespace around tickers in the allowed list', () => {
    expect(checkAllowedTicker('AAPL, TSLA , GOOG', 'TSLA')).toBeNull();
  });
});

describe('checkCompetitionWindow', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('returns null when no start or end date is set', () => {
    expect(checkCompetitionWindow(null, null, now)).toBeNull();
  });

  it('returns null when now is between start and end', () => {
    const start = new Date('2024-06-01T00:00:00Z');
    const end   = new Date('2024-07-01T00:00:00Z');
    expect(checkCompetitionWindow(start, end, now)).toBeNull();
  });

  it('returns an error when now is before the start date', () => {
    const start = new Date('2024-07-01T00:00:00Z');
    const result = checkCompetitionWindow(start, null, now);
    expect(result).not.toBeNull();
    expect(result).toContain('2024-07-01');
  });

  it('returns null when now exactly equals the start date', () => {
    expect(checkCompetitionWindow(now, null, now)).toBeNull();
  });

  it('returns an error when now is after the end date', () => {
    const end = new Date('2024-06-01T00:00:00Z');
    const result = checkCompetitionWindow(null, end, now);
    expect(result).not.toBeNull();
    expect(result).toContain('2024-06-01');
  });

  it('returns null when now exactly equals the end date', () => {
    expect(checkCompetitionWindow(null, now, now)).toBeNull();
  });

  it('only checks start when end is null', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    expect(checkCompetitionWindow(start, null, now)).toBeNull();
  });

  it('only checks end when start is null', () => {
    const end = new Date('2024-12-31T00:00:00Z');
    expect(checkCompetitionWindow(null, end, now)).toBeNull();
  });
});

describe('checkDailyTradeLimit', () => {
  it('returns null when there is no daily limit', () => {
    expect(checkDailyTradeLimit(null, 999)).toBeNull();
  });

  it('returns null when todayCount is below the limit', () => {
    expect(checkDailyTradeLimit(5, 4)).toBeNull();
  });

  it('returns null when todayCount is zero', () => {
    expect(checkDailyTradeLimit(5, 0)).toBeNull();
  });

  it('returns an error when todayCount equals the limit', () => {
    const result = checkDailyTradeLimit(5, 5);
    expect(result).not.toBeNull();
    expect(result).toContain('5');
  });

  it('returns an error when todayCount exceeds the limit', () => {
    expect(checkDailyTradeLimit(5, 10)).not.toBeNull();
  });

  it('returns an error when maxTradesPerDay is 0 (no trades allowed)', () => {
    const result = checkDailyTradeLimit(0, 0);
    expect(result).not.toBeNull();
    expect(result).toContain('0');
  });
});

describe('checkSufficientShares', () => {
  const buyTrades = [
    { ticker: 'AAPL', side: 'BUY' as const, quantity: 50, price: 150 },
  ];

  it('returns null when selling <= owned shares', () => {
    expect(checkSufficientShares(buyTrades, 'AAPL', 50)).toBeNull();
    expect(checkSufficientShares(buyTrades, 'AAPL', 25)).toBeNull();
  });

  it('returns an error when selling more than owned shares', () => {
    const result = checkSufficientShares(buyTrades, 'AAPL', 500);
    expect(result).not.toBeNull();
    expect(result).toContain('50');
    expect(result).toContain('500');
  });

  it('returns an error when selling a stock not owned at all', () => {
    const result = checkSufficientShares(buyTrades, 'TSLA', 10);
    expect(result).not.toBeNull();
    expect(result).toContain('0');
  });

  it('accounts for prior sells reducing the position', () => {
    const trades = [
      { ticker: 'AAPL', side: 'BUY' as const, quantity: 50, price: 150 },
      { ticker: 'AAPL', side: 'SELL' as const, quantity: 30, price: 160 },
    ];
    expect(checkSufficientShares(trades, 'AAPL', 20)).toBeNull();
    expect(checkSufficientShares(trades, 'AAPL', 21)).not.toBeNull();
  });

  it('returns null when no trades exist and selling 0', () => {
    expect(checkSufficientShares([], 'AAPL', 0)).toBeNull();
  });
});

describe('checkSufficientCash', () => {
  const startingCash = 100_000;

  it('returns null when user has enough cash', () => {
    expect(checkSufficientCash([], startingCash, 150, 100)).toBeNull(); // $15,000
  });

  it('returns an error when order exceeds available cash', () => {
    const result = checkSufficientCash([], startingCash, 150, 1000); // $150,000
    expect(result).not.toBeNull();
    expect(result).toContain('150000');
    expect(result).toContain('100000');
  });

  it('accounts for cash already spent on prior buys', () => {
    const trades = [
      { ticker: 'AAPL', side: 'BUY' as const, quantity: 500, price: 150 }, // spent $75,000
    ];
    // $25,000 remaining
    expect(checkSufficientCash(trades, startingCash, 150, 100)).toBeNull(); // $15,000
    expect(checkSufficientCash(trades, startingCash, 150, 200)).not.toBeNull(); // $30,000
  });

  it('accounts for cash recovered from sells', () => {
    const trades = [
      { ticker: 'AAPL', side: 'BUY' as const, quantity: 500, price: 150 },  // -$75,000
      { ticker: 'AAPL', side: 'SELL' as const, quantity: 500, price: 160 }, // +$80,000
    ];
    // $100,000 - $75,000 + $80,000 = $105,000
    expect(checkSufficientCash(trades, startingCash, 150, 700)).toBeNull(); // $105,000
    expect(checkSufficientCash(trades, startingCash, 150, 701)).not.toBeNull();
  });

  it('returns null when cost is exactly available cash', () => {
    expect(checkSufficientCash([], startingCash, 100, 1000)).toBeNull(); // exactly $100,000
  });
});
