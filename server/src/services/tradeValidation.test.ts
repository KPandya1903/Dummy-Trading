import {
  checkAllowedTicker,
  checkCompetitionWindow,
  checkDailyTradeLimit,
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
