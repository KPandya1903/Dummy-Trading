import { Router, Request, Response } from 'express';
import prisma from '../../prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { BADGE_DESCRIPTIONS } from '../../services/social/badgeService.js';
import { Badge } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ── GET /api/badges ──────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const earned = await prisma.userBadge.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'asc' },
    });

    const earnedSet = new Set(earned.map((b) => b.badge));

    const allBadges = Object.values(Badge).map((badge) => ({
      badge,
      description: BADGE_DESCRIPTIONS[badge],
      earned: earnedSet.has(badge),
      unlockedAt: earned.find((e) => e.badge === badge)?.unlockedAt ?? null,
    }));

    res.json(allBadges);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

export default router;
