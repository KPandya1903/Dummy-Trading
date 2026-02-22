import { Router, Request, Response } from 'express';
import prisma from '../prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── GET /api/alerts ──────────────────────────────────────
// Returns triggered alerts for the authenticated user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const triggered = await prisma.watchlistItem.findMany({
      where: {
        userId,
        alertTriggered: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(triggered);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ── POST /api/alerts/:id/dismiss ─────────────────────────
// Resets the alert so it can trigger again
router.post('/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const item = await prisma.watchlistItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) {
      res.status(403).json({ error: 'Not your alert' });
      return;
    }

    await prisma.watchlistItem.update({
      where: { id },
      data: { alertTriggered: false },
    });

    res.json({ message: 'Alert dismissed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

export default router;
