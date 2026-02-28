// ── Market Regime Detection ────────────────────────────────
// Classifies the current S&P 500 market regime using trend,
// realized volatility, and 20-day momentum.

import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const router = Router();

// ── Types ─────────────────────────────────────────────────

interface RegimeIndicator {
  label: string;
  value: number;           // 0–100 for LinearProgress bar
  displayValue: string;    // formatted human-readable string
  direction: 'positive' | 'negative' | 'neutral';
}

interface RegimeResult {
  regime: string;
  regimeColor: 'success' | 'error' | 'warning' | 'default';
  strategyImplication: string;
  indicators: {
    trend:      RegimeIndicator;
    volatility: RegimeIndicator;
    momentum:   RegimeIndicator;
  };
  currentSP500: number;
  sma200:       number;
  computedAt:   string;
}

// ── Cache (10 min) ────────────────────────────────────────

let regimeCache: { data: RegimeResult; fetchedAt: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
  );
}

// ── Regime Detection Algorithm ────────────────────────────

function detectRegime(closes: number[]): RegimeResult {
  const n = closes.length;
  const current = closes[n - 1];

  // SMA200: average of last min(200, n) closes
  const sma200Window = closes.slice(Math.max(0, n - 200));
  const sma200 = sma200Window.reduce((a, b) => a + b, 0) / sma200Window.length;
  const trendStrength = sma200 > 0 ? ((current - sma200) / sma200) * 100 : 0;
  const trend = current > sma200 ? 'bull' : 'bear';

  // 20-day realized volatility (annualized %)
  const volWindow = closes.slice(Math.max(0, n - 21));
  const dailyReturns: number[] = [];
  for (let i = 1; i < volWindow.length; i++) {
    if (volWindow[i - 1] > 0) {
      dailyReturns.push((volWindow[i] - volWindow[i - 1]) / volWindow[i - 1]);
    }
  }
  const vol20 = stddev(dailyReturns) * Math.sqrt(252) * 100;
  const volState = vol20 > 20 ? 'volatile' : 'quiet';

  // 20-day momentum
  const close20ago = n >= 21 ? closes[n - 21] : closes[0];
  const mom20 = close20ago > 0 ? ((current - close20ago) / close20ago) * 100 : 0;

  // Transition: near-threshold on all three indicators
  const isTransition =
    Math.abs(vol20 - 20) < 3 &&
    Math.abs(mom20) < 2 &&
    Math.abs(trendStrength) < 1;

  const REGIME_MAP: Record<string, { label: string; color: RegimeResult['regimeColor'] }> = {
    bull_quiet:    { label: 'Bull Quiet',    color: 'success' },
    bull_volatile: { label: 'Bull Volatile', color: 'warning' },
    bear_quiet:    { label: 'Bear Quiet',    color: 'warning' },
    bear_volatile: { label: 'Bear Volatile', color: 'error'   },
  };

  const STRATEGY: Record<string, string> = {
    'Bull Quiet':    'Trend-following favored. Low hedging cost. Growth and momentum stocks outperform.',
    'Bull Volatile': 'Uptrend intact but choppy. Reduce position sizes. Quality over speculative.',
    'Bear Quiet':    'Controlled decline. Capital preservation mode. Defensive sectors outperform.',
    'Bear Volatile': 'High risk environment. Cash and hedges valuable. Avoid leveraged positions.',
    'Transition':    'Regime change possible. Mixed signals — wait for confirmation before adding risk.',
  };

  let regime: string;
  let regimeColor: RegimeResult['regimeColor'];

  if (isTransition) {
    regime = 'Transition';
    regimeColor = 'default';
  } else {
    const mapped = REGIME_MAP[`${trend}_${volState}`] ?? { label: 'Transition', color: 'default' as const };
    regime = mapped.label;
    regimeColor = mapped.color;
  }

  // Indicator direction helpers
  const trendDir: RegimeIndicator['direction'] =
    trendStrength > 0.5 ? 'positive' : trendStrength < -0.5 ? 'negative' : 'neutral';
  const volDir: RegimeIndicator['direction'] =
    vol20 < 15 ? 'positive' : vol20 < 25 ? 'neutral' : 'negative'; // lower vol = positive
  const momDir: RegimeIndicator['direction'] =
    mom20 > 1 ? 'positive' : mom20 < -1 ? 'negative' : 'neutral';

  return {
    regime,
    regimeColor,
    strategyImplication: STRATEGY[regime] ?? '',
    indicators: {
      trend: {
        label:        '200-Day Trend (SMA)',
        value:        clamp(50 + trendStrength * 5, 0, 100),
        displayValue: `${trendStrength >= 0 ? '+' : ''}${trendStrength.toFixed(1)}% vs SMA200`,
        direction:    trendDir,
      },
      volatility: {
        label:        '20-Day Realized Volatility',
        value:        clamp(vol20 * 2, 0, 100),
        displayValue: `${vol20.toFixed(1)}% ann. (${volState === 'volatile' ? 'Volatile' : 'Quiet'})`,
        direction:    volDir,
      },
      momentum: {
        label:        '20-Day Momentum',
        value:        clamp(50 + mom20 * 2.5, 0, 100),
        displayValue: `${mom20 >= 0 ? '+' : ''}${mom20.toFixed(1)}% (20D)`,
        direction:    momDir,
      },
    },
    currentSP500: Math.round(current * 100) / 100,
    sma200:       Math.round(sma200 * 100) / 100,
    computedAt:   new Date().toISOString(),
  };
}

// ── GET /api/market/regime ────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    if (regimeCache && Date.now() - regimeCache.fetchedAt < CACHE_TTL) {
      res.json(regimeCache.data);
      return;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    const history = await yf.historical('^GSPC', {
      period1: startDate.toISOString().split('T')[0],
      period2: new Date().toISOString().split('T')[0],
    });

    if (!history || history.length < 30) {
      res.status(503).json({ error: 'Insufficient S&P 500 data for regime detection' });
      return;
    }

    const closes = (history as any[])
      .map((h) => ({ date: new Date(h.date).toISOString().split('T')[0], close: h.close ?? 0 }))
      .filter((h) => h.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((h) => h.close);

    const result = detectRegime(closes);
    regimeCache = { data: result, fetchedAt: Date.now() };

    res.json(result);
  } catch (err) {
    console.error('Market regime error:', err);
    res.status(500).json({ error: 'Failed to compute market regime' });
  }
});

export default router;
