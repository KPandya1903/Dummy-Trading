import { Router, Request, Response } from 'express';
import prisma from '../../prisma.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── GET /api/watchlist ───────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const items = await prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list watchlist' });
  }
});

// ── POST /api/watchlist ──────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { ticker } = req.body;

    if (!ticker) {
      res.status(400).json({ error: 'ticker is required' });
      return;
    }

    const item = await prisma.watchlistItem.create({
      data: {
        userId,
        ticker: ticker.toUpperCase(),
      },
    });

    res.status(201).json(item);
  } catch (err: any) {
    // Prisma unique constraint violation
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'Ticker already in watchlist' });
      return;
    }
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// ── PATCH /api/watchlist/:id (set alerts) ─────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const { alertAbove, alertBelow } = req.body;

    const item = await prisma.watchlistItem.findUnique({ where: { id } });
    if (!item) {
      res.status(404).json({ error: 'Watchlist item not found' });
      return;
    }
    if (item.userId !== userId) {
      res.status(403).json({ error: 'Not your watchlist item' });
      return;
    }

    const updated = await prisma.watchlistItem.update({
      where: { id },
      data: {
        alertAbove: alertAbove != null ? Number(alertAbove) : null,
        alertBelow: alertBelow != null ? Number(alertBelow) : null,
        alertTriggered: false, // reset when thresholds change
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// ── DELETE /api/watchlist/:id ─────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const item = await prisma.watchlistItem.findUnique({ where: { id } });

    if (!item) {
      res.status(404).json({ error: 'Watchlist item not found' });
      return;
    }

    if (item.userId !== userId) {
      res.status(403).json({ error: 'Not your watchlist item' });
      return;
    }

    await prisma.watchlistItem.delete({ where: { id } });
    res.json({ message: 'Removed from watchlist' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

export default router;
