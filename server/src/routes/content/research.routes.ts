import { Router, Request, Response } from 'express';
import prisma from '../../prisma.js';
import { initiateResearch } from '../../services/ai/researchService.js';

const router = Router();

// ── POST /api/research — Initiate or retrieve research ────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { ticker } = req.body as { ticker?: string };
    if (!ticker) {
      res.status(400).json({ error: 'ticker is required' });
      return;
    }

    const result = await initiateResearch(
      ticker,
      () => {}, // Progress is written to DB; SSE reads from DB
    );

    res.json({
      researchId: result.researchId,
      status: result.cached ? 'COMPLETED' : 'PENDING',
      cached: result.cached,
      existingNarrativeCount: result.existingNarrativeCount,
      sseUrl: `/api/research/${result.researchId}/stream`,
    });
  } catch (err) {
    console.error('Research initiation error:', err);
    res.status(500).json({ error: 'Failed to initiate research' });
  }
});

// ── GET /api/research/:id — Retrieve full research ────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid research ID' });
      return;
    }

    const research = await prisma.research.findUnique({
      where: { id },
      include: {
        narratives: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!research) {
      res.status(404).json({ error: 'Research not found' });
      return;
    }

    res.json({
      ...research,
      priceHistory: research.priceHistory ? JSON.parse(research.priceHistory) : [],
      narratives: research.narratives.map((n) => ({
        ...n,
        sources: JSON.parse(n.sources),
        priceWindow: n.priceWindow ? JSON.parse(n.priceWindow) : [],
      })),
    });
  } catch (err) {
    console.error('Research fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch research' });
  }
});

// ── GET /api/research/:id/stream — SSE progress updates ──────
router.get('/:id/stream', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid research ID' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let lastProgress = -1;
  const intervalId = setInterval(async () => {
    try {
      const research = await prisma.research.findUnique({
        where: { id },
        select: {
          status: true,
          progress: true,
          currentStep: true,
          completedSteps: true,
          totalSteps: true,
          narrativeCount: true,
        },
      });

      if (!research) {
        res.write(`data: ${JSON.stringify({ error: 'Research not found' })}\n\n`);
        clearInterval(intervalId);
        res.end();
        return;
      }

      // Count current narratives (may grow during pipeline)
      const narrativeCount = await prisma.researchNarrative.count({ where: { researchId: id } });

      if (research.progress !== lastProgress || narrativeCount !== research.narrativeCount) {
        lastProgress = research.progress;
        res.write(`data: ${JSON.stringify({
          status: research.status,
          progress: research.progress,
          currentStep: research.currentStep,
          completedSteps: research.completedSteps,
          totalSteps: research.totalSteps,
          narrativeCount,
        })}\n\n`);
      }

      if (research.status === 'COMPLETED' || research.status === 'FAILED') {
        clearInterval(intervalId);
        res.write(`data: ${JSON.stringify({ done: true, status: research.status })}\n\n`);
        res.end();
      }
    } catch (err) {
      console.error('SSE poll error:', err);
    }
  }, 2000);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// ── GET /api/research/ticker/:ticker — Latest for a ticker ───
router.get('/ticker/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    const research = await prisma.research.findFirst({
      where: { ticker, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: {
        narratives: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!research) {
      res.status(404).json({ error: 'No research found for this ticker' });
      return;
    }

    res.json({
      ...research,
      priceHistory: research.priceHistory ? JSON.parse(research.priceHistory) : [],
      narratives: research.narratives.map((n) => ({
        ...n,
        sources: JSON.parse(n.sources),
        priceWindow: n.priceWindow ? JSON.parse(n.priceWindow) : [],
      })),
    });
  } catch (err) {
    console.error('Research ticker fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch research' });
  }
});

export default router;
