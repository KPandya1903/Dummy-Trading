import { Router, Request, Response } from 'express';
import prisma from '../../prisma.js';
import { TradeSide } from '@prisma/client';
import { authenticate } from '../../middleware/auth.js';
import { getCurrentPrices } from '../../services/market/priceService.js';
import { checkBadges } from '../../services/social/badgeService.js';
import { checkAllowedTicker, checkCompetitionWindow, checkDailyTradeLimit, checkSufficientShares, checkSufficientCash } from '../../services/trading/tradeValidation.js';
import { replayLotsAndGains, detectWashSales, estimateTax, type TaxTradeInput } from '../../services/trading/taxService.js';

const router = Router();
router.use(authenticate);

// ── POST /api/trades ─────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { portfolioId, ticker, side, quantity } = req.body;

    if (!portfolioId || !ticker || !side || !quantity) {
      res.status(400).json({
        error: 'portfolioId, ticker, side, and quantity are required',
      });
      return;
    }

    if (!Object.values(TradeSide).includes(side)) {
      res.status(400).json({ error: 'side must be BUY or SELL' });
      return;
    }

    // Verify portfolio exists and belongs to user
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: Number(portfolioId) },
      include: { group: true },
    });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    // ── Enforce group rules ────────────────────────────
    const upperTicker = ticker.toUpperCase();
    if (portfolio.group) {
      const g = portfolio.group;

      const windowError = checkCompetitionWindow(g.startDate, g.endDate, new Date());
      if (windowError) { res.status(400).json({ error: windowError }); return; }

      const tickerError = checkAllowedTicker(g.allowedTickers, upperTicker);
      if (tickerError) { res.status(400).json({ error: tickerError }); return; }

      if (g.maxTradesPerDay != null) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await prisma.trade.count({
          where: { portfolioId: portfolio.id, executedAt: { gte: todayStart } },
        });
        const limitError = checkDailyTradeLimit(g.maxTradesPerDay, todayCount);
        if (limitError) { res.status(400).json({ error: limitError }); return; }
      }
    }
    const prices = await getCurrentPrices([upperTicker]);
    const price = prices[upperTicker];

    if (!price) {
      res.status(400).json({ error: `Could not fetch price for ${upperTicker}` });
      return;
    }

    // ── Validate sufficient shares / cash ────────────
    const existingTrades = await prisma.trade.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { executedAt: 'asc' },
      select: { ticker: true, side: true, quantity: true, price: true },
    });

    const tradeInputs = existingTrades.map((t) => ({
      ticker: t.ticker,
      side: t.side as 'BUY' | 'SELL',
      quantity: t.quantity,
      price: t.price,
    }));

    if (side === 'SELL') {
      const sharesError = checkSufficientShares(tradeInputs, upperTicker, Number(quantity));
      if (sharesError) { res.status(400).json({ error: sharesError }); return; }
    } else {
      const cashError = checkSufficientCash(tradeInputs, portfolio.startingCash, price, Number(quantity));
      if (cashError) { res.status(400).json({ error: cashError }); return; }
    }

    const trade = await prisma.trade.create({
      data: {
        portfolioId: Number(portfolioId),
        ticker: upperTicker,
        side: side as TradeSide,
        quantity: Number(quantity),
        price,
      },
    });

    // Check for newly unlocked badges
    const newBadges = await checkBadges(userId).catch(() => [] as string[]);

    // Compute tax impact for SELL trades
    let taxImpact = undefined;
    if (side === 'SELL') {
      try {
        const allTrades = await prisma.trade.findMany({
          where: { portfolioId: Number(portfolioId) },
          orderBy: { executedAt: 'asc' },
        });
        const taxTrades: TaxTradeInput[] = allTrades.map((t) => ({
          ticker: t.ticker,
          side: t.side as 'BUY' | 'SELL',
          quantity: t.quantity,
          price: t.price,
          executedAt: t.executedAt,
        }));
        // Gains before this sell vs after
        const tradesBeforeSell = taxTrades.filter((t) => t.executedAt < trade.executedAt);
        const { gains: gainsBefore } = replayLotsAndGains(tradesBeforeSell);
        const { gains: gainsAfter } = replayLotsAndGains(taxTrades);
        const newGains = gainsAfter.slice(gainsBefore.length);
        const washSales = detectWashSales(taxTrades, newGains);

        let shortTermGain = 0;
        let longTermGain = 0;
        for (const g of newGains) {
          if (g.isLongTerm) longTermGain += g.gain;
          else shortTermGain += g.gain;
        }

        taxImpact = {
          lotsConsumed: newGains.map((g) => ({
            buyDate: g.buyDate.toISOString().slice(0, 10),
            quantity: g.quantity,
            holdingDays: g.holdingDays,
            isLongTerm: g.isLongTerm,
            gain: g.gain,
          })),
          estimatedTax: estimateTax(
            shortTermGain > 0 ? shortTermGain : 0,
            longTermGain > 0 ? longTermGain : 0,
          ),
          washSaleWarning: washSales.length > 0,
        };
      } catch { /* tax enrichment is best-effort */ }
    }

    res.status(201).json({ ...trade, newBadges, taxImpact });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// ── GET /api/trades?portfolioId=... ──────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const portfolioId = Number(req.query.portfolioId);

    if (!portfolioId) {
      res.status(400).json({ error: 'portfolioId query param required' });
      return;
    }

    // Verify ownership
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio || portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    const trades = await prisma.trade.findMany({
      where: { portfolioId },
      orderBy: { executedAt: 'desc' },
    });

    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list trades' });
  }
});

// ── GET /api/trades/export?portfolioId=... ────────────────
router.get('/export', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const portfolioId = Number(req.query.portfolioId);

    if (!portfolioId) {
      res.status(400).json({ error: 'portfolioId query param required' });
      return;
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio || portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    const trades = await prisma.trade.findMany({
      where: { portfolioId },
      orderBy: { executedAt: 'desc' },
    });

    const csvField = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = 'Date,Ticker,Side,Quantity,Price,Total';
    const rows = trades.map((t) => {
      const date = t.executedAt.toISOString().split('T')[0];
      const total = (t.quantity * t.price).toFixed(2);
      return [date, t.ticker, t.side, t.quantity, t.price.toFixed(2), total]
        .map(csvField)
        .join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trades-portfolio-${portfolioId}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export trades' });
  }
});

// ── PATCH /api/trades/:id/review ──────────────────────────
router.patch('/:id/review', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const { reviewNote } = req.body;

    if (!reviewNote || !reviewNote.trim()) {
      res.status(400).json({ error: 'reviewNote is required' });
      return;
    }

    const trade = await prisma.trade.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!trade) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }

    if (trade.portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your trade' });
      return;
    }

    const updated = await prisma.trade.update({
      where: { id },
      data: {
        reviewNote: reviewNote.trim(),
        reviewedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// ── DELETE /api/trades/:id ────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const trade = await prisma.trade.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!trade) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }

    if (trade.portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your trade' });
      return;
    }

    await prisma.trade.delete({ where: { id } });
    res.json({ message: 'Trade deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

export default router;
