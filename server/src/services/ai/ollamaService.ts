// ── Research LLM Service (powered by Groq) ────────────────
// Drop-in replacement for the original Ollama/DeepSeek-R1 service.
// Uses Groq's free API (llama-3.3-70b-versatile) for the same
// two-pass reasoning pipeline: Analyze → Refine → Synthesize.
// All exported function signatures are identical so researchService.ts
// needs zero changes.

import { callGroq, isGroqConfigured } from './groqService.js';

// ── Types ────────────────────────────────────────────────

export interface ScrapedArticle {
  title: string;
  url: string;
  sourceName: string;
  publishedDate: string | null;
  contentSnippet: string;
  fullContent: string;
  sentimentLabel: string;
}

export interface ParsedNarrative {
  dimension: string;
  title: string;
  subtitle: string;
  sentiment: string;
  impactScore: number;
  summary: string;
  fullAnalysis: string;
  eventDate: string | null;
  correlationNote: string;
  sources: { title: string; url: string }[];
}

// ── Availability Check ───────────────────────────────────
// Kept as isOllamaAvailable() so researchService.ts needs zero changes.

export async function isOllamaAvailable(): Promise<boolean> {
  return isGroqConfigured();
}

// ── Field Parsing ─────────────────────────────────────────

function parseField(text: string, field: string): string {
  const regex = new RegExp(
    `${field}:\\s*(.+?)(?=\\n(?:TITLE|SUBTITLE|SENTIMENT|IMPACT_SCORE|EVENT_DATE|SUMMARY|FULL_ANALYSIS|CORRELATION):|$)`,
    's',
  );
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function parseStructuredResponse(
  text: string,
  dimension: string,
  sources: { title: string; url: string }[],
): ParsedNarrative | null {
  const title = parseField(text, 'TITLE');
  if (!title) return null;

  const sentiment = parseField(text, 'SENTIMENT').toLowerCase();
  const impactStr = parseField(text, 'IMPACT_SCORE');
  const eventDateStr = parseField(text, 'EVENT_DATE');

  return {
    dimension,
    title: title.slice(0, 80),
    subtitle: parseField(text, 'SUBTITLE') || title,
    sentiment: ['positive', 'negative', 'neutral', 'mixed'].includes(sentiment)
      ? sentiment
      : 'neutral',
    impactScore: parseFloat(impactStr) || 0,
    summary: parseField(text, 'SUMMARY') || '',
    fullAnalysis: parseField(text, 'FULL_ANALYSIS') || '',
    eventDate:
      eventDateStr &&
        eventDateStr !== 'unknown' &&
        /^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)
        ? eventDateStr
        : null,
    correlationNote: parseField(text, 'CORRELATION') || '',
    sources,
  };
}

// ── Dimension Labels ──────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  earnings: 'quarterly earnings, revenue, EPS, guidance, and financial results',
  product_launches: 'product launches, service announcements, and major feature releases',
  sector_trends: 'sector and industry trends, peer performance, and market dynamics',
  macro_factors: 'macroeconomic factors including interest rates, inflation, tariffs, and fiscal policy',
  competitive_landscape: 'competitive dynamics, market share shifts, M&A activity, and disruption risks',
  supply_chain: 'supply chain conditions, commodity prices, semiconductor supply, and logistics',
  regulatory: 'regulatory developments, legal proceedings, SEC filings, and compliance matters',
  social_sentiment: 'social media sentiment, Reddit discussions, viral trends, and public perception',
  analyst_ratings: 'Wall Street analyst ratings, price targets, upgrades, and downgrades',
  geopolitical: 'geopolitical events, trade policies, sanctions, conflicts, and their market impact',
};

// ── Pass 1: Analyze Scraped Articles ─────────────────────

export async function analyzeArticles(
  articles: ScrapedArticle[],
  dimension: string,
  ticker: string,
  companyName: string,
): Promise<ParsedNarrative | null> {
  if (articles.length === 0) return null;

  const dimensionDesc = DIMENSION_LABELS[dimension] || dimension.replace(/_/g, ' ');
  const sources = articles.map((a) => ({ title: a.sourceName || a.title, url: a.url }));

  const articleSummaries = articles
    .slice(0, 5)
    .map(
      (a, i) =>
        `Article ${i + 1}: "${a.title}" (${a.sourceName}, ${a.publishedDate || 'recent'})\n${a.contentSnippet}`,
    )
    .join('\n\n');

  const systemPrompt = `You are a senior equity research analyst specializing in ${dimensionDesc}. You produce precise, data-driven analysis with specific numbers and dates. Your analysis considers both direct and indirect market effects.`;

  const userPrompt = `Analyze these recent articles about ${companyName} (${ticker}) regarding ${dimensionDesc}.

ARTICLES:
${articleSummaries}

Based on these articles, identify the SINGLE most significant event or development and provide a structured research narrative.

You MUST format your response EXACTLY as follows (each field on its own line, do not skip any field):

TITLE: [Short event title, max 60 characters]
SUBTITLE: [One-sentence summary]
SENTIMENT: [exactly one of: positive, negative, neutral, mixed]
IMPACT_SCORE: [number from -1.0 to 1.0, where -1.0 is extremely negative and 1.0 is extremely positive]
EVENT_DATE: [YYYY-MM-DD of the key event, or "unknown" if unclear]
SUMMARY: [2-3 sentences describing the event and its significance for a preview card]
FULL_ANALYSIS: [4-6 detailed paragraphs analyzing the event, its context, market implications, indirect effects on related sectors/companies, and forward-looking assessment. Include specific numbers and data points from the articles.]
CORRELATION: [One sentence describing how this event likely affected ${ticker}'s stock price]`;

  const response = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.5, maxTokens: 2048 },
  );

  if (!response) return null;

  return parseStructuredResponse(response, dimension, sources);
}

// ── Pass 2: Reason & Refine ──────────────────────────────

export async function refineAnalysis(
  initial: ParsedNarrative,
  articles: ScrapedArticle[],
  dimension: string,
  ticker: string,
): Promise<ParsedNarrative> {
  const dimensionDesc = DIMENSION_LABELS[dimension] || dimension.replace(/_/g, ' ');

  const articleContext = articles
    .slice(0, 3)
    .map((a) => `- "${a.title}" (${a.sourceName}): ${a.contentSnippet.slice(0, 200)}`)
    .join('\n');

  const systemPrompt = `You are a critical equity research reviewer. Your job is to improve an analyst's draft research narrative by deepening the reasoning, adding nuance, and considering indirect market effects. You must maintain the exact same output format.`;

  const userPrompt = `Review and improve this research narrative about ${ticker}'s ${dimensionDesc}.

ORIGINAL ANALYSIS:
Title: ${initial.title}
Sentiment: ${initial.sentiment}
Impact Score: ${initial.impactScore}
Event Date: ${initial.eventDate || 'unknown'}
Summary: ${initial.summary}
Full Analysis: ${initial.fullAnalysis}
Correlation: ${initial.correlationNote}

SOURCE ARTICLES:
${articleContext}

IMPROVEMENT INSTRUCTIONS:
1. Deepen the reasoning — explain WHY this event matters, not just WHAT happened
2. Add indirect effects — how does this ripple through supply chains, competitors, or related sectors?
3. Strengthen the price correlation — be specific about expected magnitude and duration
4. Add forward-looking assessment — what should investors watch for next?
5. Ensure the impact score (-1.0 to 1.0) is justified by the evidence
6. If the original sentiment seems wrong based on the articles, correct it

Respond with the IMPROVED narrative using the EXACT same format:

TITLE: [Keep or improve the title, max 60 chars]
SUBTITLE: [Keep or improve]
SENTIMENT: [exactly one of: positive, negative, neutral, mixed]
IMPACT_SCORE: [number from -1.0 to 1.0]
EVENT_DATE: [YYYY-MM-DD or "unknown"]
SUMMARY: [Improved 2-3 sentence summary]
FULL_ANALYSIS: [Improved 4-6 paragraphs with deeper reasoning, indirect effects, and forward-looking view]
CORRELATION: [Improved price correlation explanation with expected magnitude]`;

  const response = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.4, maxTokens: 2048 },
  );

  if (!response) return initial;

  const refined = parseStructuredResponse(response, dimension, initial.sources);
  if (!refined || !refined.title || !refined.fullAnalysis) return initial;

  return refined;
}

// ── Executive Summary Synthesis ──────────────────────────

export async function synthesizeExecutiveSummary(
  narratives: { dimension: string; title: string; sentiment: string; summary: string }[],
  ticker: string,
  companyName: string,
): Promise<{ summary: string; sentiment: string; confidence: number }> {
  if (narratives.length === 0) {
    return {
      summary: `Insufficient data to generate an executive summary for ${companyName} (${ticker}).`,
      sentiment: 'neutral',
      confidence: 0,
    };
  }

  const narrativeSummaries = narratives
    .map((n) => `[${n.dimension.replace(/_/g, ' ')}] ${n.title} (${n.sentiment}): ${n.summary}`)
    .join('\n');

  const systemPrompt = `You are a senior equity research director writing an executive summary that synthesizes findings across multiple research dimensions into a coherent investment thesis.`;

  const userPrompt = `Write an executive summary for ${companyName} (${ticker}) based on these research findings:

${narrativeSummaries}

Your executive summary must:
1. Synthesize all findings into a coherent 3-4 paragraph investment thesis
2. Highlight the most significant risks and opportunities
3. Consider how different factors interact (e.g., macro conditions amplifying company-specific events)
4. Provide a forward-looking outlook

At the END, on separate lines, provide:
SENTIMENT: [exactly one of: bullish, bearish, neutral, mixed]
CONFIDENCE: [a number from 0.0 to 1.0 indicating confidence in your assessment]`;

  const response = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.5, maxTokens: 1500 },
  );

  if (!response) {
    return algorithmicSummary(narratives, ticker, companyName);
  }

  let sentiment = 'neutral';
  const sentimentMatch = response.match(/SENTIMENT:\s*(bullish|bearish|neutral|mixed)/i);
  if (sentimentMatch) sentiment = sentimentMatch[1].toLowerCase();

  let confidence = 0.5;
  const confMatch = response.match(/CONFIDENCE:\s*([\d.]+)/);
  if (confMatch) confidence = Math.min(1, Math.max(0, parseFloat(confMatch[1])));

  const summary = response
    .replace(/SENTIMENT:\s*(bullish|bearish|neutral|mixed)/i, '')
    .replace(/CONFIDENCE:\s*[\d.]+/, '')
    .trim();

  return { summary, sentiment, confidence };
}

// ── Algorithmic Fallback (if Groq key not set) ────────────

function algorithmicSummary(
  narratives: { dimension: string; title: string; sentiment: string; summary: string }[],
  ticker: string,
  companyName: string,
): { summary: string; sentiment: string; confidence: number } {
  const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  for (const n of narratives) {
    const s = n.sentiment as keyof typeof counts;
    if (s in counts) counts[s]++;
  }
  const total = narratives.length;

  let sentiment: string;
  if (counts.positive > counts.negative && counts.positive >= total * 0.4) {
    sentiment = 'bullish';
  } else if (counts.negative > counts.positive && counts.negative >= total * 0.4) {
    sentiment = 'bearish';
  } else if (counts.positive > 0 && counts.negative > 0) {
    sentiment = 'mixed';
  } else {
    sentiment = 'neutral';
  }

  const maxCount = Math.max(counts.positive, counts.negative, counts.neutral);
  const confidence = Math.round((maxCount / total) * 100) / 100;

  const paragraphs: string[] = [];

  paragraphs.push(
    `Analysis of ${companyName} (${ticker}) across ${total} research dimensions reveals ` +
    `a ${sentiment} outlook. ` +
    `${counts.positive} dimension${counts.positive !== 1 ? 's show' : ' shows'} positive signals, ` +
    `${counts.negative} ${counts.negative !== 1 ? 'are' : 'is'} negative, ` +
    `and ${counts.neutral + counts.mixed} ${counts.neutral + counts.mixed !== 1 ? 'are' : 'is'} neutral or mixed.`,
  );

  const positiveNarratives = narratives.filter((n) => n.sentiment === 'positive');
  if (positiveNarratives.length > 0) {
    const keyPositives = positiveNarratives
      .slice(0, 3)
      .map((n) => `${n.dimension.replace(/_/g, ' ')}: ${n.title}`)
      .join('; ');
    paragraphs.push(`Key positive drivers include: ${keyPositives}.`);
  }

  const negativeNarratives = narratives.filter((n) => n.sentiment === 'negative');
  if (negativeNarratives.length > 0) {
    const keyNegatives = negativeNarratives
      .slice(0, 3)
      .map((n) => `${n.dimension.replace(/_/g, ' ')}: ${n.title}`)
      .join('; ');
    paragraphs.push(`Key risk factors include: ${keyNegatives}.`);
  }

  paragraphs.push(
    `This analysis is based on publicly available news sources, social media sentiment, ` +
    `and market data. Investors should conduct their own due diligence before making investment decisions.`,
  );

  return { summary: paragraphs.join('\n\n'), sentiment, confidence };
}
