import { Router, Request, Response } from 'express';
import { getStockNews, isGeminiConfigured } from '../../services/ai/geminiService.js';

const router = Router();

// Simple in-memory cache (5-min TTL per ticker)
const newsCache = new Map<string, { data: any; fetchedAt: number }>();
const NEWS_CACHE_TTL = 5 * 60 * 1000;

// ── GET /api/news/:ticker ───────────────────────────────────
router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // Check cache
    const cached = newsCache.get(ticker);
    if (cached && Date.now() - cached.fetchedAt < NEWS_CACHE_TTL) {
      res.json(cached.data);
      return;
    }

    if (!isGeminiConfigured()) {
      res.json({
        ticker,
        aiSummary: 'Gemini API key not configured. Set GEMINI_API_KEY in your .env file to enable AI-powered news.',
        aiSentiment: 'neutral',
        sources: [],
        articles: [],
      });
      return;
    }

    const result = await getStockNews(ticker);

    if (!result) {
      res.json({
        ticker,
        aiSummary: 'Unable to fetch news at this time.',
        aiSentiment: 'neutral',
        sources: [],
        articles: [],
      });
      return;
    }

    const response = {
      ticker,
      aiSummary: result.summary,
      aiSentiment: result.sentiment,
      sources: result.sources,
      articles: [], // Finnhub integration can be added later
    };

    newsCache.set(ticker, { data: response, fetchedAt: Date.now() });
    res.json(response);
  } catch (err) {
    console.error(`News error for ${req.params.ticker}:`, err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

export default router;
