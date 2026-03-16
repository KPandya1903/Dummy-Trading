import { computeIndicators, OHLCV } from './technicalAnalysisService.js';

// ── Helpers ─────────────────────────────────────────────────

function makeCandles(count: number, basePrice = 100, trend = 0): OHLCV[] {
  return Array.from({ length: count }, (_, i) => {
    const close = basePrice + i * trend;
    return {
      date: new Date(Date.UTC(2024, 0, i + 1)).toISOString().split('T')[0],
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000_000,
    };
  });
}

// ── RSI ─────────────────────────────────────────────────────

test('computes RSI values when at least 15 candles are provided', () => {
  const { indicators } = computeIndicators(makeCandles(50), ['rsi']);
  expect(indicators.rsi).toBeDefined();
  expect(indicators.rsi!.length).toBeGreaterThan(0);
});

test('RSI values are bounded between 0 and 100', () => {
  const { indicators } = computeIndicators(makeCandles(100, 100, 0.5), ['rsi']);
  for (const p of indicators.rsi!) {
    expect(p.value).toBeGreaterThanOrEqual(0);
    expect(p.value).toBeLessThanOrEqual(100);
  }
});

test('each RSI point has a date string', () => {
  const { indicators } = computeIndicators(makeCandles(30), ['rsi']);
  for (const p of indicators.rsi!) {
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
});

// ── MACD ────────────────────────────────────────────────────

test('computes MACD with macd, signal, and histogram fields', () => {
  const { indicators } = computeIndicators(makeCandles(60), ['macd']);
  expect(indicators.macd).toBeDefined();
  expect(indicators.macd!.length).toBeGreaterThan(0);
  const point = indicators.macd![0];
  expect(typeof point.macd).toBe('number');
  expect(typeof point.signal).toBe('number');
  expect(typeof point.histogram).toBe('number');
});

test('MACD histogram = macd - signal', () => {
  const { indicators } = computeIndicators(makeCandles(80, 100, 0.2), ['macd']);
  for (const p of indicators.macd!) {
    expect(p.histogram).toBeCloseTo(p.macd - p.signal, 1);
  }
});

// ── Bollinger Bands ─────────────────────────────────────────

test('Bollinger upper > middle > lower', () => {
  // Use a trend so prices vary within each 20-period window (non-zero stddev)
  const { indicators } = computeIndicators(makeCandles(40, 100, 0.5), ['bollinger']);
  expect(indicators.bollingerBands).toBeDefined();
  for (const p of indicators.bollingerBands!) {
    expect(p.upper).toBeGreaterThan(p.middle);
    expect(p.middle).toBeGreaterThan(p.lower);
  }
});

test('Bollinger middle approximates SMA20', () => {
  const candles = makeCandles(50, 100);
  const { indicators } = computeIndicators(candles, ['bollinger', 'sma']);
  const bb = indicators.bollingerBands!;
  const sma = indicators.sma20!;
  // Last Bollinger middle and last SMA20 should be very close
  const lastBBMiddle = bb[bb.length - 1].middle;
  const lastSma20 = sma[sma.length - 1].value;
  expect(lastBBMiddle).toBeCloseTo(lastSma20, 0);
});

// ── SMA ─────────────────────────────────────────────────────

test('SMA20 produces first value after 20 candles', () => {
  const { indicators } = computeIndicators(makeCandles(30), ['sma']);
  expect(indicators.sma20).toBeDefined();
  expect(indicators.sma20!.length).toBe(11); // 30 - 20 + 1
});

test('SMA50 not computed if fewer than 50 candles', () => {
  const { indicators } = computeIndicators(makeCandles(30), ['sma']);
  expect(indicators.sma50).toBeDefined();
  expect(indicators.sma50!.length).toBe(0);
});

test('SMA of flat prices equals that price', () => {
  const candles = makeCandles(30, 150, 0); // all close = 150
  const { indicators } = computeIndicators(candles, ['sma']);
  for (const p of indicators.sma20!) {
    expect(p.value).toBe(150);
  }
});

// ── EMA ─────────────────────────────────────────────────────

test('computes EMA12 values', () => {
  const { indicators } = computeIndicators(makeCandles(30), ['ema']);
  expect(indicators.ema12).toBeDefined();
  expect(indicators.ema12!.length).toBeGreaterThan(0);
});

test('EMA12 reacts faster than EMA26 to price changes', () => {
  // In an uptrend EMA12 should be above EMA26
  const candles = makeCandles(80, 100, 1);
  const { indicators } = computeIndicators(candles, ['ema']);
  const lastEma12 = indicators.ema12![indicators.ema12!.length - 1].value;
  const lastEma26 = indicators.ema26![indicators.ema26!.length - 1].value;
  expect(lastEma12).toBeGreaterThan(lastEma26);
});

// ── Summary ─────────────────────────────────────────────────

test('trend is bullish when SMA20 > SMA50', () => {
  // Uptrend: SMA20 will be higher than SMA50
  const { summary } = computeIndicators(makeCandles(100, 100, 1), ['sma']);
  expect(summary.trend).toBe('bullish');
});

test('trend is bearish when SMA20 < SMA50', () => {
  const { summary } = computeIndicators(makeCandles(100, 200, -1), ['sma']);
  expect(summary.trend).toBe('bearish');
});

test('RSI signal is overbought for flat price data (no losses → RSI=100)', () => {
  // With zero price changes, avg_loss=0 → RSI=100 → overbought
  const { summary } = computeIndicators(makeCandles(50, 100, 0), ['rsi']);
  expect(summary.rsiSignal).toBe('overbought');
});

test('RSI signal is overbought during strong uptrend', () => {
  const { summary } = computeIndicators(makeCandles(100, 100, 2), ['rsi']);
  expect(summary.rsiSignal).toBe('overbought');
});

test('RSI signal is oversold during strong downtrend', () => {
  const { summary } = computeIndicators(makeCandles(100, 200, -2), ['rsi']);
  expect(summary.rsiSignal).toBe('oversold');
});

// ── Weinstein Stage Analysis ─────────────────────────────────

test('returns null weinsteinStage for fewer than 20 candles', () => {
  const { summary } = computeIndicators(makeCandles(10), ['rsi']);
  expect(summary.weinsteinStage).toBeNull();
  expect(summary.weinsteinLabel).toBe('Insufficient data');
});

test('classifies Stage 2 (Advance) during strong uptrend', () => {
  // 200 candles rising +1 per bar: price well above rising SMA150
  const { summary } = computeIndicators(makeCandles(200, 100, 1), ['sma']);
  expect(summary.weinsteinStage).toBe('2');
  expect(summary.weinsteinLabel).toContain('Advance');
});

test('classifies Stage 4 (Decline) during strong downtrend', () => {
  // 200 candles falling -1 per bar: price well below falling SMA150
  const { summary } = computeIndicators(makeCandles(200, 300, -1), ['sma']);
  expect(summary.weinsteinStage).toBe('4');
  expect(summary.weinsteinLabel).toContain('Decline');
});

test('sma150Last is populated when enough candles exist', () => {
  const { summary } = computeIndicators(makeCandles(200, 100, 0.5), ['sma']);
  expect(summary.sma150Last).not.toBeNull();
  expect(typeof summary.sma150Last).toBe('number');
});

// ── Selective computation ─────────────────────────────────

test('does not compute unrequested indicators', () => {
  const { indicators } = computeIndicators(makeCandles(60), ['rsi']);
  expect(indicators.macd).toBeUndefined();
  expect(indicators.bollingerBands).toBeUndefined();
  expect(indicators.sma20).toBeUndefined();
  expect(indicators.ema12).toBeUndefined();
});

test('returns empty object when requested array is empty', () => {
  const { indicators } = computeIndicators(makeCandles(60), []);
  expect(indicators.rsi).toBeUndefined();
  expect(indicators.macd).toBeUndefined();
});

test('handles empty candle array gracefully', () => {
  const { indicators, summary } = computeIndicators([], ['rsi', 'macd', 'sma']);
  expect(indicators.rsi).toEqual([]);
  expect(summary.weinsteinStage).toBeNull();
});
