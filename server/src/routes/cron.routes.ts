import { Router, Request, Response } from 'express';
import { checkPendingOrders } from '../services/trading/orderService.js';
import { checkAlerts } from '../services/social/alertService.js';
import { getMarketData, warmMarketCaps, warmFundamentals } from '../services/market/marketService.js';
import prisma from '../prisma.js';
import { getCurrentPrices } from '../services/market/priceService.js';

const router = Router();

function verifyCronSecret(req: Request, res: Response): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // skip in dev

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

router.get('/check-orders', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    await checkPendingOrders();
    res.json({ ok: true, task: 'check-orders' });
  } catch (err) {
    console.error('Cron check-orders failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/check-alerts', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    await checkAlerts();
    res.json({ ok: true, task: 'check-alerts' });
  } catch (err) {
    console.error('Cron check-alerts failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/refresh-market-data', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    await getMarketData();
    res.json({ ok: true, task: 'refresh-market-data' });
  } catch (err) {
    console.error('Cron refresh-market-data failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/warm-market-caps', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    await warmMarketCaps();
    await warmFundamentals();
    res.json({ ok: true, task: 'warm-market-caps' });
  } catch (err) {
    console.error('Cron warm-market-caps failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Options Expiration Check ────────────────────────────
router.get('/check-options-expiry', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    const now = new Date();
    const expired = await prisma.optionContract.findMany({
      where: { status: 'OPEN', expirationDate: { lte: now } },
    });

    if (expired.length === 0) {
      res.json({ ok: true, task: 'check-options-expiry', processed: 0 });
      return;
    }

    const tickers = [...new Set(expired.map((c) => c.ticker))];
    const prices = await getCurrentPrices(tickers);

    let exercised = 0;
    let worthless = 0;

    for (const contract of expired) {
      const spot = prices[contract.ticker];
      if (!spot) {
        // Can't determine — mark expired
        await prisma.optionContract.update({
          where: { id: contract.id },
          data: { status: 'EXPIRED', closedAt: now },
        });
        worthless++;
        continue;
      }

      const itm = contract.optionType === 'CALL'
        ? spot > contract.strikePrice
        : spot < contract.strikePrice;

      if (itm && contract.side === 'BUY') {
        // Auto-exercise ITM bought options
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
              note: `Auto-exercised ${contract.optionType} at expiration`,
            },
          }),
          prisma.optionContract.update({
            where: { id: contract.id },
            data: { status: 'EXERCISED', exercised: true, closedAt: now },
          }),
        ]);
        exercised++;
        console.log(`Option #${contract.id} auto-exercised: ${tradeSide} ${shares} × ${contract.ticker} @ $${contract.strikePrice}`);
      } else {
        // OTM or sold options — expire
        await prisma.optionContract.update({
          where: { id: contract.id },
          data: { status: 'EXPIRED', closedAt: now },
        });
        worthless++;
      }
    }

    res.json({ ok: true, task: 'check-options-expiry', processed: expired.length, exercised, worthless });
  } catch (err) {
    console.error('Cron check-options-expiry failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
