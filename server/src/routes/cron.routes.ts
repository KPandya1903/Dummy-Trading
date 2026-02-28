import { Router, Request, Response } from 'express';
import { checkPendingOrders } from '../services/orderService.js';
import { checkAlerts } from '../services/alertService.js';
import { getMarketData, warmMarketCaps, warmFundamentals } from '../services/marketService.js';

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

export default router;
