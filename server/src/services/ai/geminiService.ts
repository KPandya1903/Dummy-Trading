// ── AI Insights & News Service (powered by Groq) ──────────
// Drop-in replacement for the original Gemini-based service.
// Exports identical function signatures so routes need zero changes.

import { callGroq, isGroqConfigured } from './groqService.js';

// ── Stock Analysis (Technical / Fundamental / Prediction / News) ──

export async function analyzeStock(
  ticker: string,
  context: string,
  data?: string,
): Promise<{ text: string; sources: { title: string; url: string }[] } | null> {
  if (!isGroqConfigured()) return null;

  const prompts: Record<string, string> = {
    technical: `You are a financial analyst. Analyze the technical indicators for ${ticker} stock.${data ? ` Here is the current data: ${data}` : ''} Provide a concise 2-3 paragraph analysis covering trend direction, momentum, and key support/resistance levels. Be specific with numbers.`,
    fundamental: `You are a financial analyst. Analyze the fundamental metrics for ${ticker} stock.${data ? ` Here is the current data: ${data}` : ''} Provide a concise 2-3 paragraph analysis covering valuation, growth prospects, and key risks.`,
    prediction: `You are a financial analyst. Based on available data for ${ticker} stock, provide your assessment of the short-term outlook (1-4 weeks).${data ? ` Here are model predictions: ${data}` : ''} Discuss factors that could influence the price. Be balanced and mention both bull and bear cases.`,
    news: `You are a financial analyst. Summarize the latest news and market sentiment for ${ticker} stock based on your training data. Focus on the most impactful recent developments, earnings, analyst ratings, and market-moving events. Organize by importance.`,
  };

  const userPrompt = prompts[context] ?? prompts.news;

  const text = await callGroq([
    {
      role: 'system',
      content:
        'You are a professional financial analyst. Provide concise, data-driven insights. Be specific with numbers and avoid generic commentary.',
    },
    { role: 'user', content: userPrompt },
  ]);

  if (!text) return null;

  // Groq doesn't provide live grounding sources — return empty array
  return { text, sources: [] };
}

// ── Stock News Summary ───────────────────────────────────

export async function getStockNews(ticker: string): Promise<{
  summary: string;
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  sources: { title: string; url: string }[];
} | null> {
  if (!isGroqConfigured()) return null;

  const text = await callGroq([
    {
      role: 'system',
      content:
        'You are a financial news analyst. Summarize stock news clearly and concisely. Always end your response with a sentiment label on its own line.',
    },
    {
      role: 'user',
      content: `Provide a comprehensive news summary for ${ticker} stock. Include:
1. Latest earnings and financial results
2. Recent analyst upgrades/downgrades
3. Major company announcements
4. Market sentiment and trends
5. Any regulatory or industry developments

At the very end, on a new line, write exactly one of these sentiment labels: SENTIMENT: positive, SENTIMENT: negative, SENTIMENT: mixed, or SENTIMENT: neutral`,
    },
  ]);

  if (!text) return null;

  // Parse sentiment
  let sentiment: 'positive' | 'negative' | 'mixed' | 'neutral' = 'neutral';
  const match = text.match(/SENTIMENT:\s*(positive|negative|mixed|neutral)/i);
  if (match) sentiment = match[1].toLowerCase() as typeof sentiment;

  // Strip sentiment line from summary
  const summary = text.replace(/SENTIMENT:\s*(positive|negative|mixed|neutral)/i, '').trim();

  return { summary, sentiment, sources: [] };
}

// ── Configuration Check ──────────────────────────────────
// Kept as `isGeminiConfigured` so news.routes.ts and gemini.routes.ts
// need zero changes.

export function isGeminiConfigured(): boolean {
  return isGroqConfigured();
}
