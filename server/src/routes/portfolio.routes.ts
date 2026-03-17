import { Router, Request, Response } from 'express';
import prisma from '../prisma.js';
import { computeSummary, computeHistory, TradeInput, HistoryTradeInput } from '../services/portfolioService.js';
import { getCurrentPrices } from '../services/priceService.js';
import { authenticate } from '../middleware/auth.js';
import { getSector } from '../services/tickerMetadata.js';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
const router = Router();
router.use(authenticate);

// ── GET /api/portfolios ──────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const portfolios = await prisma.portfolio.findMany({
      where: { userId, groupId: null },
      orderBy: { createdAt: 'desc' },
    });

    res.json(portfolios);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list portfolios' });
  }
});

// ── POST /api/portfolios ─────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, startingCash } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const portfolio = await prisma.portfolio.create({
      data: {
        userId,
        name,
        ...(startingCash != null && { startingCash: Number(startingCash) }),
      },
    });

    res.status(201).json(portfolio);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

// ── GET /api/portfolios/:id/summary ──────────────────────
router.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    // Map DB trades → pure TradeInput[]
    const trades: TradeInput[] = portfolio.trades.map((t) => ({
      ticker: t.ticker,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
    }));

    // Collect unique tickers that have open positions or any trades
    const tickers = [...new Set(portfolio.trades.map((t) => t.ticker))];
    const currentPrices = await getCurrentPrices(tickers);

    const summary = computeSummary(trades, portfolio.startingCash, currentPrices);

    // Enrich positions with sector data
    const positionsWithSector = summary.positions.map((p) => ({
      ...p,
      sector: getSector(p.ticker),
    }));

    res.json({
      portfolioId: id,
      name: portfolio.name,
      startingCash: portfolio.startingCash,
      currentPrices,
      ...summary,
      positions: positionsWithSector,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

// ── GET /api/portfolios/:id/history ───────────────────────
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    const trades: HistoryTradeInput[] = portfolio.trades.map((t) => ({
      ticker: t.ticker,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
      executedAt: t.executedAt,
    }));

    const history = computeHistory(trades, portfolio.startingCash);

    // Fetch S&P 500 benchmark for the same date range
    let benchmark: { date: string; value: number }[] = [];
    if (history.length > 0) {
      try {
        const startDate = history[0].date;
        const spData = (await yf.chart('^GSPC', { period1: startDate, interval: '1d' as const })).quotes.filter((q: any) => q.close !== null);
        if (spData.length >= 2) {
          // Normalize to same starting value as portfolio
          const startValue = portfolio.startingCash;
          const spStart = (spData[0] as any).close;
          benchmark = spData.map((d: any) => ({
            date: new Date(d.date).toISOString().slice(0, 10),
            value: Math.round((d.close / spStart) * startValue * 100) / 100,
          }));
        }
      } catch {
        // S&P data optional — continue without it
      }
    }

    res.json({
      portfolioId: id,
      startingCash: portfolio.startingCash,
      history,
      benchmark,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute history' });
  }
});

// ── GET /api/portfolios/:id/risk ─────────────────────────
// Sharpe Ratio, Max Drawdown, Beta vs S&P 500, Win Rate

router.get('/:id/risk', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }
    if (portfolio.userId !== userId) { res.status(403).json({ error: 'Not your portfolio' }); return; }

    // No trades → return all nulls
    if (portfolio.trades.length === 0) {
      res.json({
        sharpeRatio: null, maxDrawdownPct: null, beta: null, winRatePct: null,
        tradeCount: 0, dataPointCount: 0,
        note: 'No trades recorded yet.',
      });
      return;
    }

    const histTrades: HistoryTradeInput[] = portfolio.trades.map((t) => ({
      ticker: t.ticker, side: t.side, quantity: t.quantity, price: t.price, executedAt: t.executedAt,
    }));

    const history = computeHistory(histTrades, portfolio.startingCash);

    // ── Sharpe Ratio ───────────────────────────────────────
    let sharpeRatio: number | null = null;
    if (history.length >= 2) {
      const rets: number[] = [];
      for (let i = 1; i < history.length; i++) {
        if (history[i - 1].totalValue > 0) {
          rets.push((history[i].totalValue - history[i - 1].totalValue) / history[i - 1].totalValue);
        }
      }
      if (rets.length >= 2) {
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
        const sd = Math.sqrt(variance);
        sharpeRatio = sd > 0 ? Math.round((mean / sd) * Math.sqrt(252) * 100) / 100 : null;
      }
    }

    // ── Max Drawdown ───────────────────────────────────────
    let maxDrawdownPct: number | null = null;
    {
      let peak = portfolio.startingCash;
      let maxDD = 0;
      for (const pt of history) {
        if (pt.totalValue > peak) peak = pt.totalValue;
        const dd = peak > 0 ? (peak - pt.totalValue) / peak : 0;
        if (dd > maxDD) maxDD = dd;
      }
      maxDrawdownPct = Math.round(maxDD * 10000) / 100; // percentage, 2dp
    }

    // ── Beta vs S&P 500 ────────────────────────────────────
    let beta: number | null = null;
    if (history.length >= 2) {
      try {
        const startDate = history[0].date;
        const spData = (await yf.chart('^GSPC', { period1: startDate, interval: '1d' as const })).quotes.filter((q: any) => q.close !== null);
        const spMap = new Map<string, number>();
        for (let i = 1; i < (spData as any[]).length; i++) {
          const prev = (spData as any[])[i - 1];
          const cur  = (spData as any[])[i];
          const date = new Date(cur.date).toISOString().slice(0, 10);
          if (prev.close > 0) spMap.set(date, (cur.close - prev.close) / prev.close);
        }

        const pairs: Array<[number, number]> = [];
        for (let i = 1; i < history.length; i++) {
          const date = history[i].date;
          const spRet = spMap.get(date);
          if (spRet != null && history[i - 1].totalValue > 0) {
            const portRet = (history[i].totalValue - history[i - 1].totalValue) / history[i - 1].totalValue;
            pairs.push([portRet, spRet]);
          }
        }

        if (pairs.length >= 5) {
          const meanP = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
          const meanM = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
          let cov = 0, varM = 0;
          for (const [p, m] of pairs) {
            cov  += (p - meanP) * (m - meanM);
            varM += (m - meanM) ** 2;
          }
          cov  /= pairs.length;
          varM /= pairs.length;
          if (varM > 0) {
            beta = Math.round(Math.max(-3, Math.min(3, cov / varM)) * 100) / 100;
          }
        }
      } catch {
        // S&P data optional — beta stays null
      }
    }

    // ── Win Rate ───────────────────────────────────────────
    // Replay trades chronologically, tracking avgCost per ticker.
    // A SELL is a win if sellPrice > avgCost at time of sale.
    let winRatePct: number | null = null;
    let wins = 0;
    let sellCount = 0;
    {
      const positions = new Map<string, { shares: number; avgCost: number }>();
      for (const t of portfolio.trades) {
        const pos = positions.get(t.ticker) ?? { shares: 0, avgCost: 0 };
        if (t.side === 'BUY') {
          const newShares = pos.shares + t.quantity;
          pos.avgCost = newShares > 0
            ? (pos.avgCost * pos.shares + t.price * t.quantity) / newShares
            : t.price;
          pos.shares = newShares;
        } else {
          if (t.price > pos.avgCost) wins++;
          sellCount++;
          pos.shares = Math.max(0, pos.shares - t.quantity);
        }
        positions.set(t.ticker, pos);
      }
      winRatePct = sellCount > 0
        ? Math.round((wins / sellCount) * 1000) / 10
        : null;
    }

    res.json({
      sharpeRatio,
      maxDrawdownPct,
      beta,
      winRatePct,
      tradeCount:     sellCount,
      dataPointCount: history.length,
      note: `Metrics based on ${history.length} trade-date equity point${history.length !== 1 ? 's' : ''}. Sharpe annualized (risk-free = 0).`,
    });
  } catch (err) {
    console.error(`Portfolio risk error for ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to compute risk metrics' });
  }
});

// ── GET /api/portfolios/:id/kelly ─────────────────────────
// Kelly Criterion: optimal position size given historical win rate + avg W/L ratio.
// Full Kelly, Half Kelly, and Quarter Kelly variants returned.

router.get('/:id/kelly', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }
    if (portfolio.userId !== userId) { res.status(403).json({ error: 'Not your portfolio' }); return; }

    const sells = portfolio.trades.filter((t) => t.side === 'SELL');

    if (sells.length < 3) {
      res.json({
        winRate: null, avgWin: null, avgLoss: null, wlRatio: null,
        fullKelly: null, halfKelly: null, quarterKelly: null, suggestedPct: null,
        sellCount: sells.length,
        note: `Need at least 3 completed trades to compute Kelly fraction (have ${sells.length}).`,
      });
      return;
    }

    // Replay all trades to track avg cost basis at time of each sell
    const positions = new Map<string, { shares: number; avgCost: number }>();
    const outcomes: { won: boolean; gainPct: number }[] = [];

    for (const t of portfolio.trades) {
      const pos = positions.get(t.ticker) ?? { shares: 0, avgCost: 0 };
      if (t.side === 'BUY') {
        const newShares = pos.shares + t.quantity;
        pos.avgCost = newShares > 0
          ? (pos.avgCost * pos.shares + t.price * t.quantity) / newShares
          : t.price;
        pos.shares = newShares;
      } else {
        if (pos.avgCost > 0) {
          const gainPct = (t.price - pos.avgCost) / pos.avgCost;
          outcomes.push({ won: t.price > pos.avgCost, gainPct });
        }
        pos.shares = Math.max(0, pos.shares - t.quantity);
      }
      positions.set(t.ticker, pos);
    }

    if (outcomes.length === 0) {
      res.json({
        winRate: null, avgWin: null, avgLoss: null, wlRatio: null,
        fullKelly: null, halfKelly: null, quarterKelly: null, suggestedPct: null,
        sellCount: 0, note: 'No completed sell trades with cost basis data.',
      });
      return;
    }

    const wins   = outcomes.filter((o) => o.won);
    const losses = outcomes.filter((o) => !o.won);

    const winRate  = wins.length / outcomes.length;
    const lossRate = 1 - winRate;
    const avgWin   = wins.length   > 0 ? wins.reduce((s, o) => s + o.gainPct, 0)               / wins.length   : 0;
    const avgLoss  = losses.length > 0 ? Math.abs(losses.reduce((s, o) => s + o.gainPct, 0))   / losses.length : 0;
    const wlRatio  = avgLoss > 0 ? avgWin / avgLoss : null;

    // Kelly: f* = (p × b - q) / b
    let fullKelly: number | null = null;
    if (wlRatio !== null && wlRatio > 0) {
      fullKelly = Math.max(0, (winRate * wlRatio - lossRate) / wlRatio);
    }

    const halfKelly    = fullKelly !== null ? fullKelly * 0.5  : null;
    const quarterKelly = fullKelly !== null ? fullKelly * 0.25 : null;
    const suggestedPct = halfKelly !== null ? Math.round(halfKelly * 1000) / 10 : null;

    res.json({
      winRate:      Math.round(winRate * 1000) / 10,
      avgWin:       Math.round(avgWin  * 10000) / 100,
      avgLoss:      Math.round(avgLoss * 10000) / 100,
      wlRatio:      wlRatio !== null ? Math.round(wlRatio * 100) / 100 : null,
      fullKelly:    fullKelly    !== null ? Math.round(fullKelly    * 1000) / 10 : null,
      halfKelly:    halfKelly    !== null ? Math.round(halfKelly    * 1000) / 10 : null,
      quarterKelly: quarterKelly !== null ? Math.round(quarterKelly * 1000) / 10 : null,
      suggestedPct,
      sellCount: outcomes.length,
      note: `Based on ${outcomes.length} closed position${outcomes.length !== 1 ? 's' : ''}. Half Kelly recommended to reduce variance.`,
    });
  } catch (err) {
    console.error(`Kelly error for ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to compute Kelly fraction' });
  }
});

// ── GET /api/portfolios/:id/behavior ──────────────────────
// Behavioral bias analysis: disposition effect, overtrading,
// loss aversion, concentration, and holding time asymmetry.
// Inspired by Kahneman (2011) and Thaler (2015).

router.get('/:id/behavior', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { trades: { orderBy: { executedAt: 'asc' } } },
    });

    if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }
    if (portfolio.userId !== userId) { res.status(403).json({ error: 'Not your portfolio' }); return; }

    const trades = portfolio.trades;

    if (trades.length < 2) {
      res.json({
        dispositionScore: null, overtradingScore: null, concentrationScore: null,
        avgHoldDaysWinners: null, avgHoldDaysLosers: null, holdingTimeRatio: null,
        uniqueTickers: 0, tradeCount: trades.length,
        biases: [],
        note: 'Need more trades for behavioral analysis.',
      });
      return;
    }

    // ── Disposition Effect ─────────────────────────────────
    // Do winners get sold faster than losers?
    // Track: for each sell, what was the open date and was it a winner?
    const openDates = new Map<string, Date>();   // ticker → first BUY date for this position
    const holdTimes: { days: number; won: boolean }[] = [];
    const positionsTrack = new Map<string, { shares: number; avgCost: number; firstBuyAt: Date }>();

    for (const t of trades) {
      const pos = positionsTrack.get(t.ticker) ?? { shares: 0, avgCost: 0, firstBuyAt: t.executedAt };
      if (t.side === 'BUY') {
        if (pos.shares === 0) pos.firstBuyAt = t.executedAt;
        const newShares = pos.shares + t.quantity;
        pos.avgCost = newShares > 0
          ? (pos.avgCost * pos.shares + t.price * t.quantity) / newShares
          : t.price;
        pos.shares = newShares;
      } else {
        const holdMs   = t.executedAt.getTime() - pos.firstBuyAt.getTime();
        const holdDays = holdMs / (1000 * 60 * 60 * 24);
        const won      = t.price > pos.avgCost;
        holdTimes.push({ days: holdDays, won });
        pos.shares = Math.max(0, pos.shares - t.quantity);
        if (pos.shares === 0) pos.firstBuyAt = t.executedAt; // reset for next position
      }
      positionsTrack.set(t.ticker, pos);
    }

    const winnerHolds = holdTimes.filter((h) => h.won);
    const loserHolds  = holdTimes.filter((h) => !h.won);
    const avgHoldDaysWinners = winnerHolds.length > 0 ? winnerHolds.reduce((s, h) => s + h.days, 0) / winnerHolds.length : null;
    const avgHoldDaysLosers  = loserHolds.length  > 0 ? loserHolds.reduce((s, h) => s + h.days, 0)  / loserHolds.length  : null;

    // Holding time ratio > 1 means holding losers longer (disposition effect)
    const holdingTimeRatio =
      avgHoldDaysWinners !== null && avgHoldDaysLosers !== null && avgHoldDaysWinners > 0
        ? Math.round((avgHoldDaysLosers / avgHoldDaysWinners) * 100) / 100
        : null;

    // Disposition score 0-100: 50 = neutral, >50 = selling winners too early
    const dispositionScore = holdingTimeRatio !== null
      ? Math.min(100, Math.max(0, Math.round(50 + (holdingTimeRatio - 1) * 25)))
      : null;

    // ── Overtrading ────────────────────────────────────────
    // Trades per week vs. a "disciplined" baseline (2/week = 100)
    if (trades.length >= 2) {
      const firstDate = trades[0].executedAt.getTime();
      const lastDate  = trades[trades.length - 1].executedAt.getTime();
      const weeksActive = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7));
      const tradesPerWeek = trades.length / weeksActive;
      // Score: 0 = very active (high churn), 100 = very disciplined
      var overtradingScore = Math.max(0, Math.min(100, Math.round(100 - (tradesPerWeek / 10) * 100)));
      var tradesPerWeekRounded = Math.round(tradesPerWeek * 10) / 10;
    } else {
      var overtradingScore = 100;
      var tradesPerWeekRounded = 0;
    }

    // ── Concentration ─────────────────────────────────────
    // How many unique tickers? Fewer = more concentrated (higher risk)
    const uniqueTickers = new Set(trades.map((t) => t.ticker)).size;
    const concentrationScore = Math.min(100, Math.round((uniqueTickers / 20) * 100));

    // ── Bias Signals ──────────────────────────────────────
    const biases: { id: string; label: string; severity: 'low' | 'medium' | 'high'; description: string }[] = [];

    if (dispositionScore !== null && dispositionScore > 60) {
      biases.push({
        id: 'disposition',
        label: 'Disposition Effect',
        severity: dispositionScore > 75 ? 'high' : 'medium',
        description: `You hold losers ${holdingTimeRatio?.toFixed(1)}× longer than winners. This is the disposition effect — selling winners too early and riding losers too long.`,
      });
    }
    if (overtradingScore < 40) {
      biases.push({
        id: 'overtrading',
        label: 'Overtrading',
        severity: overtradingScore < 20 ? 'high' : 'medium',
        description: `${tradesPerWeekRounded} trades/week on average. High turnover increases transaction costs and often reflects emotional decision-making.`,
      });
    }
    if (concentrationScore < 30) {
      biases.push({
        id: 'concentration',
        label: 'High Concentration',
        severity: 'medium',
        description: `Only ${uniqueTickers} unique ticker${uniqueTickers !== 1 ? 's' : ''} traded. Diversification across 10–20+ positions reduces idiosyncratic risk.`,
      });
    }

    res.json({
      dispositionScore,
      overtradingScore,
      concentrationScore,
      avgHoldDaysWinners: avgHoldDaysWinners !== null ? Math.round(avgHoldDaysWinners * 10) / 10 : null,
      avgHoldDaysLosers:  avgHoldDaysLosers  !== null ? Math.round(avgHoldDaysLosers  * 10) / 10 : null,
      holdingTimeRatio,
      tradesPerWeek: tradesPerWeekRounded,
      uniqueTickers,
      tradeCount: trades.length,
      biases,
      note: `Behavioral analysis based on ${holdTimes.length} closed position${holdTimes.length !== 1 ? 's' : ''}.`,
    });
  } catch (err) {
    console.error(`Behavior error for ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to analyze behavior' });
  }
});

// ── DELETE /api/portfolios/:id ────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const portfolio = await prisma.portfolio.findUnique({ where: { id } });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    if (portfolio.groupId) {
      res.status(403).json({ error: 'Cannot delete a group portfolio' });
      return;
    }

    await prisma.portfolio.delete({ where: { id } });
    res.json({ message: 'Portfolio deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete portfolio' });
  }
});

export default router;
