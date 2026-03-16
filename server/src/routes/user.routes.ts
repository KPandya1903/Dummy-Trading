import { Router, Request, Response } from 'express';
import prisma from '../prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ── GET /api/users/me ────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as number;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        badges: true,
        portfolios: { include: { trades: { select: { id: true } } } },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const totalTrades = user.portfolios.reduce((sum, p) => sum + p.trades.length, 0);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      hasGoogleConnected: !!user.googleId,
      createdAt: user.createdAt,
      stats: {
        portfolioCount: user.portfolios.length,
        tradeCount: totalTrades,
        badgeCount: user.badges.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── PATCH /api/users/me ──────────────────────────────────
router.patch('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as number;
    const { name, bio, location } = req.body as { name?: string; bio?: string; location?: string };

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(location !== undefined && { location }),
      },
    });

    res.json({ id: user.id, name: user.name, bio: user.bio, location: user.location });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
