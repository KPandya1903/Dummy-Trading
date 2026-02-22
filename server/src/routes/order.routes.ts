import { Router, Request, Response } from 'express';
import prisma from '../prisma.js';
import { TradeSide, OrderType } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── POST /api/orders ─────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { portfolioId, ticker, side, quantity, orderType, targetPrice } = req.body;

    if (!portfolioId || !ticker || !side || !quantity || !orderType || targetPrice == null) {
      res.status(400).json({
        error: 'portfolioId, ticker, side, quantity, orderType, and targetPrice are required',
      });
      return;
    }

    if (!Object.values(TradeSide).includes(side)) {
      res.status(400).json({ error: 'side must be BUY or SELL' });
      return;
    }

    if (!['LIMIT', 'STOP'].includes(orderType)) {
      res.status(400).json({ error: 'orderType must be LIMIT or STOP' });
      return;
    }

    if (Number(targetPrice) <= 0) {
      res.status(400).json({ error: 'targetPrice must be > 0' });
      return;
    }

    // Verify portfolio ownership
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: Number(portfolioId) },
    });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    if (portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your portfolio' });
      return;
    }

    const order = await prisma.pendingOrder.create({
      data: {
        portfolioId: Number(portfolioId),
        ticker: ticker.toUpperCase(),
        side: side as TradeSide,
        quantity: Number(quantity),
        orderType: orderType as OrderType,
        targetPrice: Number(targetPrice),
      },
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ── GET /api/orders?portfolioId=... ──────────────────────
router.get('/', async (req: Request, res: Response) => {
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

    const orders = await prisma.pendingOrder.findMany({
      where: { portfolioId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

// ── DELETE /api/orders/:id (cancel) ──────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);

    const order = await prisma.pendingOrder.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.portfolio.userId !== userId) {
      res.status(403).json({ error: 'Not your order' });
      return;
    }

    if (order.status !== 'PENDING') {
      res.status(400).json({ error: 'Only pending orders can be cancelled' });
      return;
    }

    await prisma.pendingOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Order cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
