import { RSI, MACD, BollingerBands, SMA, EMA } from 'trading-signals';

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPoint {
  date: string;
  value: number;
}

export interface MACDPoint {
  date: string;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerPoint {
  date: string;
  upper: number;
  middle: number;
  lower: number;
}

export interface AnalysisSummary {
  trend: 'bullish' | 'bearish' | 'neutral';
  rsiSignal: 'overbought' | 'oversold' | 'neutral';
  macdSignal: 'bullish' | 'bearish';
  bollingerPosition: 'upper' | 'middle' | 'lower';
}

export interface AnalysisResult {
  rsi?: IndicatorPoint[];
  macd?: MACDPoint[];
  bollingerBands?: BollingerPoint[];
  sma20?: IndicatorPoint[];
  sma50?: IndicatorPoint[];
  sma200?: IndicatorPoint[];
  ema12?: IndicatorPoint[];
  ema26?: IndicatorPoint[];
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeIndicators(
  candles: OHLCV[],
  requested: string[],
): { indicators: AnalysisResult; summary: AnalysisSummary } {
  const indicators: AnalysisResult = {};

  // RSI (14-period)
  if (requested.includes('rsi')) {
    const rsi = new RSI(14);
    const points: IndicatorPoint[] = [];
    for (const c of candles) {
      rsi.update(c.close, false);
      const val = rsi.getResult();
      if (val != null) {
        points.push({ date: c.date, value: r2(val) });
      }
    }
    indicators.rsi = points;
  }

  // MACD (short=12, long=26, signal=9)
  if (requested.includes('macd')) {
    const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
    const points: MACDPoint[] = [];
    for (const c of candles) {
      const result = macd.update(c.close, false);
      if (result != null) {
        points.push({
          date: c.date,
          macd: r2(result.macd),
          signal: r2(result.signal),
          histogram: r2(result.histogram),
        });
      }
    }
    indicators.macd = points;
  }

  // Bollinger Bands (20, 2)
  if (requested.includes('bollinger')) {
    const bb = new BollingerBands(20, 2);
    const points: BollingerPoint[] = [];
    for (const c of candles) {
      const result = bb.update(c.close, false);
      if (result != null) {
        points.push({
          date: c.date,
          upper: r2(result.upper),
          middle: r2(result.middle),
          lower: r2(result.lower),
        });
      }
    }
    indicators.bollingerBands = points;
  }

  // SMA 20, 50, 200
  for (const period of [20, 50, 200]) {
    const key = `sma${period}` as keyof AnalysisResult;
    if (requested.includes('sma') || requested.includes(key)) {
      const sma = new SMA(period);
      const points: IndicatorPoint[] = [];
      for (const c of candles) {
        const val = sma.update(c.close, false);
        if (val != null) {
          points.push({ date: c.date, value: r2(val) });
        }
      }
      (indicators as any)[key] = points;
    }
  }

  // EMA 12, 26
  for (const period of [12, 26]) {
    const key = `ema${period}` as keyof AnalysisResult;
    if (requested.includes('ema') || requested.includes(key)) {
      const ema = new EMA(period);
      const points: IndicatorPoint[] = [];
      for (const c of candles) {
        const val = ema.update(c.close, false);
        if (ema.isStable) {
          points.push({ date: c.date, value: r2(val) });
        }
      }
      (indicators as any)[key] = points;
    }
  }

  // Summary
  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  const lastRsi = indicators.rsi?.length ? indicators.rsi[indicators.rsi.length - 1].value : 50;
  const rsiSignal: AnalysisSummary['rsiSignal'] =
    lastRsi > 70 ? 'overbought' : lastRsi < 30 ? 'oversold' : 'neutral';

  const lastMacd = indicators.macd?.length ? indicators.macd[indicators.macd.length - 1] : null;
  const macdSignal: AnalysisSummary['macdSignal'] =
    lastMacd && lastMacd.histogram > 0 ? 'bullish' : 'bearish';

  const lastBB = indicators.bollingerBands?.length
    ? indicators.bollingerBands[indicators.bollingerBands.length - 1]
    : null;
  const bollingerPosition: AnalysisSummary['bollingerPosition'] = lastBB
    ? lastPrice > lastBB.upper
      ? 'upper'
      : lastPrice < lastBB.lower
        ? 'lower'
        : 'middle'
    : 'middle';

  // Trend based on SMA20 vs SMA50
  const lastSma20 = indicators.sma20?.length ? indicators.sma20[indicators.sma20.length - 1].value : null;
  const lastSma50 = indicators.sma50?.length ? indicators.sma50[indicators.sma50.length - 1].value : null;
  let trend: AnalysisSummary['trend'] = 'neutral';
  if (lastSma20 != null && lastSma50 != null) {
    trend = lastSma20 > lastSma50 ? 'bullish' : lastSma20 < lastSma50 ? 'bearish' : 'neutral';
  }

  return {
    indicators,
    summary: { trend, rsiSignal, macdSignal, bollingerPosition },
  };
}
