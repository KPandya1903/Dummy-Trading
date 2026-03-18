import { Router, Request, Response } from 'express';
import { analyzeStock, isGeminiConfigured } from '../../services/ai/geminiService.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Simple rate limiter: 10 requests per minute per user
const rateLimits = new Map<number, { count: number; resetAt: number }>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// ── POST /api/gemini/analyze ────────────────────────────────
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    if (!isGeminiConfigured()) {
      res.json({
        text: 'Gemini API key not configured. Set GEMINI_API_KEY in your .env file to enable AI analysis.',
        sources: [],
      });
      return;
    }

    const userId = req.user!.userId;
    if (!checkRateLimit(userId)) {
      res.status(429).json({ error: 'Rate limit exceeded. Max 10 requests per minute.' });
      return;
    }

    const { ticker, context, data } = req.body as {
      ticker: string;
      context: 'technical' | 'fundamental' | 'prediction' | 'news';
      data?: string;
    };

    if (!ticker || !context) {
      res.status(400).json({ error: 'ticker and context are required' });
      return;
    }

    const result = await analyzeStock(ticker.toUpperCase(), context, data);

    if (!result) {
      res.json({ text: 'Unable to generate analysis at this time.', sources: [] });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('Gemini analyze error:', err);
    res.status(500).json({ error: 'Failed to generate AI analysis' });
  }
});

export default router;
