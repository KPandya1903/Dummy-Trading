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

// Weinstein Stage Analysis (Weinstein 1988)
// Stage 1 = Base/Accumulation: price below or at SMA150, slope flat
// Stage 2 = Advance:           price above rising SMA150
// Stage 3 = Top/Distribution:  price above but SMA150 losing slope
// Stage 4 = Decline:           price below falling SMA150
export type WeinsteinStage = '1' | '2' | '3' | '4';

export interface AnalysisSummary {
  trend: 'bullish' | 'bearish' | 'neutral';
  rsiSignal: 'overbought' | 'oversold' | 'neutral';
  macdSignal: 'bullish' | 'bearish';
  bollingerPosition: 'upper' | 'middle' | 'lower';
  weinsteinStage: WeinsteinStage | null;
  weinsteinLabel: string;
  sma150Last: number | null;
}

export interface AnalysisResult {
  rsi?: IndicatorPoint[];
  macd?: MACDPoint[];
  bollingerBands?: BollingerPoint[];
  sma20?: IndicatorPoint[];
  sma50?: IndicatorPoint[];
  sma150?: IndicatorPoint[];
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

  // SMA 20, 50, 150 (30-week Weinstein MA), 200
  for (const period of [20, 50, 150, 200]) {
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

  // ── Weinstein Stage Analysis (30-week / SMA150) ─────────────
  // Always compute SMA150 for stage detection regardless of requested indicators
  let sma150Points: IndicatorPoint[] = (indicators as any).sma150 ?? [];
  if (sma150Points.length === 0 && candles.length >= 20) {
    const sma150inst = new SMA(150);
    for (const c of candles) {
      const val = sma150inst.update(c.close, false);
      if (val != null) sma150Points.push({ date: c.date, value: r2(val) });
    }
  }

  let weinsteinStage: WeinsteinStage | null = null;
  let weinsteinLabel = 'Insufficient data';
  let sma150Last: number | null = null;

  if (sma150Points.length >= 10) {
    const n = sma150Points.length;
    sma150Last = sma150Points[n - 1].value;

    // SMA slope: compare last value to value 10 periods ago
    const sma150Prev10 = sma150Points[Math.max(0, n - 11)].value;
    const slope = sma150Last - sma150Prev10;
    const slopeFlat = Math.abs(slope / sma150Last) < 0.005; // <0.5% change = flat

    const aboveSma150 = lastPrice > sma150Last;

    if (aboveSma150 && slope > 0 && !slopeFlat) {
      weinsteinStage = '2';
      weinsteinLabel = 'Stage 2 — Advance';
    } else if (aboveSma150 && (slopeFlat || slope <= 0)) {
      weinsteinStage = '3';
      weinsteinLabel = 'Stage 3 — Distribution / Top';
    } else if (!aboveSma150 && slope < 0 && !slopeFlat) {
      weinsteinStage = '4';
      weinsteinLabel = 'Stage 4 — Decline';
    } else {
      weinsteinStage = '1';
      weinsteinLabel = 'Stage 1 — Base / Accumulation';
    }
  }

  return {
    indicators,
    summary: { trend, rsiSignal, macdSignal, bollingerPosition, weinsteinStage, weinsteinLabel, sma150Last },
  };
}
