// ── Stock Factor Scorecard ─────────────────────────────────
// Computes 5 factor scores (Value, Momentum, Volatility,
// Technical Strength, Quality) for a given ticker.
// Uses 1-year OHLCV history + trailing P/E from Yahoo Finance.

import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import { RSI, MACD, EMA } from 'trading-signals';

const yf = new YahooFinance();
const router = Router();

// ── Types ─────────────────────────────────────────────────

interface FactorDetail {
  score: number;       // 0–100
  label: string;       // human label
  rawValue: string;    // formatted raw metric
}

interface FactorScores {
  ticker: string;
  value:            FactorDetail;
  momentum:         FactorDetail;
  volatility:       FactorDetail;
  technicalStrength: FactorDetail;
  quality:          FactorDetail;
  composite: number;
  compositeLabelText: string;
  computedAt: string;
}

// ── Cache (5 min per ticker) ──────────────────────────────

const factorCache = new Map<string, { data: FactorScores; fetchedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
  );
}

// Linear regression: returns R² and slope for a 1-D array
function linearRegressionR2(values: number[]): { r2: number; slope: number } {
  const n = values.length;
  if (n < 2) return { r2: 0, slope: 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (i - meanX) * (values[i] - meanY);
    ssXX += (i - meanX) ** 2;
    ssYY += (values[i] - meanY) ** 2;
  }
  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const r2 = ssXX > 0 && ssYY > 0 ? (ssXY ** 2) / (ssXX * ssYY) : 0;
  return { r2, slope };
}

// RSI → 0-100 score (peaks at RSI 55, penalizes overbought/oversold)
function rsiToScore(rsi: number): number {
  if (rsi < 30)  return 20;
  if (rsi < 55)  return 20 + ((rsi - 30) / 25) * 65; // 20→85 as RSI 30→55
  if (rsi < 70)  return 85 - ((rsi - 55) / 15) * 25; // 85→60 as RSI 55→70
  return Math.max(20, 60 - ((rsi - 70) / 20) * 40);   // 60→20 as RSI 70→90
}

function scoreLabel(score: number, positiveLabels: [string, string, string]): string {
  return score >= 70 ? positiveLabels[0] : score >= 45 ? positiveLabels[1] : positiveLabels[2];
}

// ── Factor Computation ────────────────────────────────────

interface OHLCV { date: string; close: number; }

function computeFactorScores(candles: OHLCV[], trailingPE: number | null): FactorScores {
  const closes = candles.map((c) => c.close);
  const n = closes.length;
  const last = closes[n - 1];

  // ── 1. VALUE — P/E vs S&P 500 long-run median (22) ────
  const PE_BENCHMARK = 22;
  let valueScore = 50; // neutral default if no P/E
  let valueRaw = 'P/E N/A';
  if (trailingPE != null && trailingPE > 0) {
    const ratio = trailingPE / PE_BENCHMARK;
    valueScore = clamp(100 - ratio * 50, 0, 100);
    valueRaw = `P/E ${trailingPE.toFixed(1)}`;
  }

  // ── 2. MOMENTUM — composite 3M / 6M / 12M returns ────
  const close3m  = n >= 63  ? closes[n - 63]  : closes[0];
  const close6m  = n >= 126 ? closes[n - 126] : closes[0];
  const close12m = closes[0];
  const mom3m  = close3m  > 0 ? (last - close3m)  / close3m  : 0;
  const mom6m  = close6m  > 0 ? (last - close6m)  / close6m  : 0;
  const mom12m = close12m > 0 ? (last - close12m) / close12m : 0;
  const momComposite = (mom3m + mom6m + mom12m) / 3;
  const momentumScore = clamp(50 + momComposite * 100, 0, 100);
  const dominantMom = mom12m > 0 ? '+' : '';
  const momentumRaw = `${dominantMom}${(mom12m * 100).toFixed(1)}% (12M avg)`;

  // ── 3. VOLATILITY — inverse of annualized 20d vol ─────
  const dailyReturns: number[] = [];
  for (let i = Math.max(1, n - 21); i < n; i++) {
    if (closes[i - 1] > 0) {
      dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  const vol20 = stddev(dailyReturns) * Math.sqrt(252);
  const volatilityScore = clamp(100 - ((vol20 - 0.10) / 0.70) * 100, 0, 100);
  const volatilityRaw = `Ann. Vol ${(vol20 * 100).toFixed(1)}%`;

  // ── 4. TECHNICAL STRENGTH — RSI(14) + MACD(12,26,9) ──
  let rsiVal = 50;
  let macdHistogram = 0;
  const macdHistoricals: number[] = [];

  const rsi  = new RSI(14);
  const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));

  for (const close of closes) {
    rsi.update(close, false);
    const macdResult = macd.update(close, false);
    if (macdResult != null) macdHistoricals.push(macdResult.histogram);
  }

  const rsiResult = rsi.getResult();
  if (rsiResult != null) rsiVal = Number(rsiResult);

  if (macdHistoricals.length > 0) {
    macdHistogram = macdHistoricals[macdHistoricals.length - 1];
  }

  const rsiScore = rsiToScore(rsiVal);

  // MACD: normalize histogram against its own recent range
  const recentMacd = macdHistoricals.slice(-50);
  const macdRange = recentMacd.length > 0
    ? Math.max(...recentMacd.map(Math.abs)) || 1
    : 1;
  const macdScore = clamp(50 + (macdHistogram / macdRange) * 50, 0, 100);

  const technicalScore = rsiScore * 0.5 + macdScore * 0.5;
  const technicalRaw = `RSI ${rsiVal.toFixed(0)}, MACD ${macdHistogram >= 0 ? '+' : ''}${macdHistogram.toFixed(3)}`;

  // ── 5. QUALITY — R² of 60-day linear regression ───────
  const qualWindow = closes.slice(Math.max(0, n - 60));
  const { r2, slope } = linearRegressionR2(qualWindow);
  const qualityScore = slope > 0 ? r2 * 100 : (1 - r2) * 50;
  const qualityRaw = `R² ${r2.toFixed(2)} (${slope >= 0 ? 'uptrend' : 'downtrend'})`;

  // ── Composite ─────────────────────────────────────────
  const composite = round1(
    valueScore      * 0.20 +
    momentumScore   * 0.25 +
    volatilityScore * 0.20 +
    technicalScore  * 0.20 +
    qualityScore    * 0.15,
  );

  const compositeLabelText = composite >= 70 ? 'Strong' : composite >= 45 ? 'Moderate' : 'Weak';

  return {
    ticker: '',
    value: {
      score:    round1(valueScore),
      label:    scoreLabel(valueScore,    ['Undervalued', 'Fair Value', 'Overvalued']),
      rawValue: valueRaw,
    },
    momentum: {
      score:    round1(momentumScore),
      label:    scoreLabel(momentumScore, ['Strong',       'Moderate',   'Weak']),
      rawValue: momentumRaw,
    },
    volatility: {
      score:    round1(volatilityScore),
      label:    scoreLabel(volatilityScore, ['Low Risk',   'Moderate',   'High Risk']),
      rawValue: volatilityRaw,
    },
    technicalStrength: {
      score:    round1(technicalScore),
      label:    scoreLabel(technicalScore, ['Bullish',     'Neutral',    'Bearish']),
      rawValue: technicalRaw,
    },
    quality: {
      score:    round1(qualityScore),
      label:    scoreLabel(qualityScore,  ['Consistent',  'Moderate',   'Inconsistent']),
      rawValue: qualityRaw,
    },
    composite,
    compositeLabelText,
    computedAt: new Date().toISOString().split('T')[0],
  };
}

// ── GET /api/factors/:ticker ──────────────────────────────

router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    const cached = factorCache.get(ticker);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      res.json(cached.data);
      return;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    // Fetch history and quote in parallel
    const [history, quote] = await Promise.all([
      yf.chart(ticker, {
        period1: startDate.toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        interval: '1d' as const,
      }).then((r: any) => r.quotes.filter((q: any) => q.close !== null)),
      yf.quote(ticker).catch(() => null),
    ]);

    if (!history || history.length < 50) {
      res.status(404).json({ error: `Insufficient data for ${ticker}` });
      return;
    }

    const candles: OHLCV[] = (history as any[])
      .map((h) => ({
        date:  new Date(h.date).toISOString().split('T')[0],
        close: h.close ?? 0,
      }))
      .filter((c) => c.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    const trailingPE = (quote as any)?.trailingPE ?? null;

    const scores = computeFactorScores(candles, trailingPE);
    scores.ticker = ticker;

    factorCache.set(ticker, { data: scores, fetchedAt: Date.now() });
    res.json(scores);
  } catch (err) {
    console.error(`Factor score error for ${req.params.ticker}:`, err);
    res.status(500).json({ error: 'Failed to compute factor scores' });
  }
});

export default router;
