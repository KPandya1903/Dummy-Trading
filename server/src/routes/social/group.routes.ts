import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { computeSummary, TradeInput } from '../../services/trading/portfolioService.js';
import { getCurrentPrices } from '../../services/market/priceService.js';

const router = Router();
router.use(authenticate);

function generateJoinCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();
}

// ── POST /api/groups — Create a group ─────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, startingCash, startDate, endDate, maxTradesPerDay, allowedTickers } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const cash = Number(startingCash);
    if (!startingCash || isNaN(cash) || cash <= 0) {
      res.status(400).json({ error: 'Starting cash must be a positive number' });
      return;
    }

    // Generate unique join code (retry on collision)
    let joinCode = generateJoinCode();
    for (let i = 0; i < 3; i++) {
      const existing = await prisma.group.findUnique({ where: { joinCode } });
      if (!existing) break;
      joinCode = generateJoinCode();
    }

    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          name: name.trim(),
          startingCash: cash,
          joinCode,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
          ...(maxTradesPerDay != null && { maxTradesPerDay: Number(maxTradesPerDay) }),
          ...(allowedTickers && { allowedTickers: allowedTickers }),
        },
      });

      await tx.groupMembership.create({
        data: { groupId: g.id, userId, role: 'OWNER' },
      });

      await tx.portfolio.create({
        data: {
          userId,
          name: `${g.name}`,
          startingCash: cash,
          groupId: g.id,
        },
      });

      return g;
    });

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// ── POST /api/groups/join — Join a group by code ──────────
router.post('/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { joinCode } = req.body;

    if (!joinCode || !joinCode.trim()) {
      res.status(400).json({ error: 'Join code is required' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { joinCode: joinCode.trim().toUpperCase() },
    });

    if (!group) {
      res.status(404).json({ error: 'Invalid join code' });
      return;
    }

    const existing = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });

    if (existing) {
      res.status(409).json({ error: 'You are already a member of this group' });
      return;
    }

    const portfolio = await prisma.$transaction(async (tx) => {
      await tx.groupMembership.create({
        data: { groupId: group.id, userId },
      });

      return tx.portfolio.create({
        data: {
          userId,
          name: `${group.name}`,
          startingCash: group.startingCash,
          groupId: group.id,
        },
      });
    });

    res.json({
      id: group.id,
      name: group.name,
      startingCash: group.startingCash,
      joinCode: group.joinCode,
      portfolioId: portfolio.id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// ── GET /api/groups — List user's groups ──────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const memberships = await prisma.groupMembership.findMany({
      where: { userId },
      include: {
        group: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      startingCash: m.group.startingCash,
      joinCode: m.group.joinCode,
      role: m.role,
      memberCount: m.group._count.members,
      createdAt: m.group.createdAt,
    }));

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

// ── GET /api/groups/:id — Group detail ────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const groupId = Number(req.params.id);

    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Find this user's portfolio in the group
    const myPortfolio = await prisma.portfolio.findFirst({
      where: { groupId, userId },
    });

    res.json({
      id: group.id,
      name: group.name,
      startingCash: group.startingCash,
      joinCode: group.joinCode,
      startDate: group.startDate,
      endDate: group.endDate,
      maxTradesPerDay: group.maxTradesPerDay,
      allowedTickers: group.allowedTickers,
      createdAt: group.createdAt,
      myPortfolioId: myPortfolio?.id ?? null,
      members: group.members.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group details' });
  }
});

// ── GET /api/groups/:id/leaderboard — Group leaderboard ───
router.get('/:id/leaderboard', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const groupId = Number(req.params.id);

    // Verify membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const portfolios = await prisma.portfolio.findMany({
      where: { groupId },
      include: {
        trades: { orderBy: { executedAt: 'asc' } },
        user: { select: { email: true } },
      },
    });

    // Collect all unique tickers
    const allTickers = new Set<string>();
    for (const p of portfolios) {
      for (const t of p.trades) {
        allTickers.add(t.ticker);
      }
    }

    const currentPrices =
      allTickers.size > 0
        ? await getCurrentPrices([...allTickers])
        : {};

    const entries = portfolios.map((p) => {
      const trades: TradeInput[] = p.trades.map((t) => ({
        ticker: t.ticker,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
      }));

      const summary = computeSummary(trades, p.startingCash, currentPrices);
      const returnPct =
        ((summary.totalValue - p.startingCash) / p.startingCash) * 100;

      return {
        portfolioId: p.id,
        userEmail: p.user.email,
        totalValue: summary.totalValue,
        startingCash: p.startingCash,
        returnPct: Math.round(returnPct * 100) / 100,
      };
    });

    entries.sort((a, b) => b.returnPct - a.returnPct);

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute group leaderboard' });
  }
});

export default router;
