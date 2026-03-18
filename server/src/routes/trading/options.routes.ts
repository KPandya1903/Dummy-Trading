import { Router, Request, Response } from 'express';
import prisma from '../../prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { getCurrentPrices } from '../../services/market/priceService.js';
import { getOptionsChain } from '../../services/market/optionsChainService.js';
import {
  blackScholes,
  calculateGreeks,
  calculateOptionPnL,
  calculatePnLAtExpiry,
  calculateBreakeven,
  moneyness,
  timeToExpiryYears,
} from '../../services/trading/optionsService.js';
import {
  checkOptionBuyCash,
  checkCoveredCall,
  checkCashSecuredPut,
} from '../../services/trading/optionsValidation.js';

const router = Router();
router.use(authenticate);

const RISK_FREE_RATE = 0.045;

// ── GET /api/options/chain/:ticker ──────────────────────
router.get('/chain/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const expiration = req.query.expiration as string | undefined;
    const chain = await getOptionsChain(ticker, expiration);
    res.json(chain);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to fetch options chain' });
  }
});

// ── POST /api/options ───────────────────────────────────
// Open an option position (buy or sell/write)
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { portfolioId, ticker, optionType, side, strikePrice, expirationDate, quantity, premium, note } = req.body;

    if (!portfolioId || !ticker || !optionType || !side || !strikePrice || !expirationDate || !quantity || premium == null) {
      res.status(400).json({
        error: 'portfolioId, ticker, optionType, side, strikePrice, expirationDate, quantity, and premium are required',
      });
      return;
    }

    if (!['CALL', 'PUT'].includes(optionType)) {
      res.status(400).json({ error: 'optionType must be CALL or PUT' });
      return;
    }

    if (!['BUY', 'SELL'].includes(side)) {
      res.status(400).json({ error: 'side must be BUY or SELL' });
      return;
    }

    if (Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
      res.status(400).json({ error: 'quantity must be a positive integer' });
      return;
    }

    if (Number(premium) < 0) {
      res.status(400).json({ error: 'premium must be >= 0' });
      return;
    }

    const portfolio = await prisma.portfolio.findUnique({ where: { id: Number(portfolioId) } });
    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }
    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    const upperTicker = ticker.toUpperCase();
    const qty = Number(quantity);
    const prem = Number(premium);
    const strike = Number(strikePrice);

    // Fetch existing trades for validation
    const trades = await prisma.trade.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { executedAt: 'asc' },
      select: { ticker: true, side: true, quantity: true, price: true },
    });
    const tradeInputs = trades.map((t) => ({
      ticker: t.ticker,
      side: t.side as 'BUY' | 'SELL',
      quantity: t.quantity,
      price: t.price,
    }));

    // Validation based on side
    if (side === 'BUY') {
      const cashError = checkOptionBuyCash(tradeInputs, portfolio.startingCash, prem, qty);
      if (cashError) { res.status(400).json({ error: cashError }); return; }
    } else {
      // SELL (writing) — only covered calls and cash-secured puts allowed
      if (optionType === 'CALL') {
        const coveredError = checkCoveredCall(tradeInputs, upperTicker, qty);
        if (coveredError) { res.status(400).json({ error: coveredError }); return; }
      } else {
        const cashError = checkCashSecuredPut(tradeInputs, portfolio.startingCash, strike, qty);
        if (cashError) { res.status(400).json({ error: cashError }); return; }
      }
    }

    const contract = await prisma.optionContract.create({
      data: {
        portfolioId: portfolio.id,
        ticker: upperTicker,
        optionType: optionType as 'CALL' | 'PUT',
        side: side as 'BUY' | 'SELL',
        strikePrice: strike,
        expirationDate: new Date(expirationDate),
        quantity: qty,
        premium: prem,
        note: note || null,
      },
    });

    res.status(201).json(contract);
  } catch (err) {
    console.error('Failed to open option:', err);
    res.status(500).json({ error: 'Failed to open option position' });
  }
});

// ── GET /api/options?portfolioId=... ────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const portfolioId = Number(req.query.portfolioId);

    if (!portfolioId) {
      res.status(400).json({ error: 'portfolioId query param required' });
      return;
    }

    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio || portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    const contracts = await prisma.optionContract.findMany({
      where: { portfolioId },
      orderBy: { openedAt: 'desc' },
    });

    // Enrich with current Greeks and P&L
    const tickers = [...new Set(contracts.map((c) => c.ticker))];
    const prices = tickers.length > 0 ? await getCurrentPrices(tickers) : {};

    const enriched = contracts.map((c) => {
      const spot = prices[c.ticker] || 0;
      const T = timeToExpiryYears(c.expirationDate);
      const iv = 0.30; // approximate; real IV would come from chain data

      const currentPremium = c.status === 'OPEN' && spot > 0
        ? blackScholes(spot, c.strikePrice, T, iv, RISK_FREE_RATE, c.optionType as 'CALL' | 'PUT')
        : c.closePrice ?? 0;

      const greeks = c.status === 'OPEN' && spot > 0
        ? calculateGreeks(spot, c.strikePrice, T, iv, RISK_FREE_RATE, c.optionType as 'CALL' | 'PUT')
        : null;

      const pnl = calculateOptionPnL(
        c.side as 'BUY' | 'SELL',
        c.quantity,
        c.premium,
        currentPremium,
      );

      const status = moneyness(c.optionType as 'CALL' | 'PUT', c.strikePrice, spot);
      const breakeven = calculateBreakeven(c.optionType as 'CALL' | 'PUT', c.side as 'BUY' | 'SELL', c.strikePrice, c.premium);

      return {
        ...c,
        spotPrice: spot,
        currentPremium: Math.round(currentPremium * 100) / 100,
        greeks,
        pnl,
        moneyness: status,
        breakeven,
        daysToExpiry: Math.ceil(T * 365.25),
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Failed to list options:', err);
    res.status(500).json({ error: 'Failed to list options' });
  }
});

// ── PATCH /api/options/:id/close ────────────────────────
// Close an option position before expiry
router.patch('/:id/close', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const { closePrice } = req.body;

    if (closePrice == null || Number(closePrice) < 0) {
      res.status(400).json({ error: 'closePrice is required and must be >= 0' });
      return;
    }

    const contract = await prisma.optionContract.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!contract) {
      res.status(404).json({ error: 'Option contract not found' });
      return;
    }
    if (contract.portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your option' });
      return;
    }
    if (contract.status !== 'OPEN') {
      res.status(400).json({ error: 'Option is not open' });
      return;
    }

    const updated = await prisma.optionContract.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closePrice: Number(closePrice),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to close option' });
  }
});

// ── POST /api/options/:id/exercise ──────────────────────
// Exercise an option (buy shares for call, sell shares for put)
router.post('/:id/exercise', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const contract = await prisma.optionContract.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!contract) {
      res.status(404).json({ error: 'Option contract not found' });
      return;
    }
    if (contract.portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your option' });
      return;
    }
    if (contract.status !== 'OPEN') {
      res.status(400).json({ error: 'Option is not open' });
      return;
    }
    if (contract.side !== 'BUY') {
      res.status(400).json({ error: 'Only bought options can be exercised' });
      return;
    }

    // Check if ITM
    const prices = await getCurrentPrices([contract.ticker]);
    const spot = prices[contract.ticker];
    if (!spot) {
      res.status(400).json({ error: 'Could not fetch current price' });
      return;
    }

    const itm = contract.optionType === 'CALL'
      ? spot > contract.strikePrice
      : spot < contract.strikePrice;

    if (!itm) {
      res.status(400).json({ error: 'Option is out of the money — exercise not profitable' });
      return;
    }

    // Exercise: create stock trade at strike price
    const shares = contract.quantity * 100;
    const tradeSide = contract.optionType === 'CALL' ? 'BUY' : 'SELL';

    await prisma.$transaction([
      prisma.trade.create({
        data: {
          portfolioId: contract.portfolioId,
          ticker: contract.ticker,
          side: tradeSide,
          quantity: shares,
          price: contract.strikePrice,
          note: `Exercised ${contract.optionType} option (strike $${contract.strikePrice})`,
        },
      }),
      prisma.optionContract.update({
        where: { id },
        data: {
          status: 'EXERCISED',
          exercised: true,
          closedAt: new Date(),
        },
      }),
    ]);

    res.json({
      message: `Exercised: ${tradeSide} ${shares} shares of ${contract.ticker} at $${contract.strikePrice}`,
    });
  } catch (err) {
    console.error('Failed to exercise option:', err);
    res.status(500).json({ error: 'Failed to exercise option' });
  }
});

// ── GET /api/options/pnl-chart/:id ──────────────────────
// P&L at expiry chart data for a specific contract
router.get('/pnl-chart/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const contract = await prisma.optionContract.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!contract) {
      res.status(404).json({ error: 'Option contract not found' });
      return;
    }
    if (contract.portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your option' });
      return;
    }

    // Generate price range ±30% around strike
    const range: number[] = [];
    const low = contract.strikePrice * 0.7;
    const high = contract.strikePrice * 1.3;
    const step = (high - low) / 50;
    for (let p = low; p <= high; p += step) {
      range.push(Math.round(p * 100) / 100);
    }

    const pnlData = calculatePnLAtExpiry(
      contract.optionType as 'CALL' | 'PUT',
      contract.side as 'BUY' | 'SELL',
      contract.strikePrice,
      contract.premium,
      contract.quantity,
      range,
    );

    const breakeven = calculateBreakeven(
      contract.optionType as 'CALL' | 'PUT',
      contract.side as 'BUY' | 'SELL',
      contract.strikePrice,
      contract.premium,
    );

    res.json({
      contractId: id,
      ticker: contract.ticker,
      type: contract.optionType,
      side: contract.side,
      strike: contract.strikePrice,
      premium: contract.premium,
      breakeven,
      data: pnlData,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate P&L chart' });
  }
});

export default router;
