import crypto from 'crypto';
import YahooFinance from 'yahoo-finance2';
import prisma from '../prisma.js';
import { scrapeForDimension } from './webScraperService.js';
import {
  analyzeArticles,
  refineAnalysis,
  synthesizeExecutiveSummary,
  isOllamaAvailable,
  type ParsedNarrative,
} from './ollamaService.js';

const yf = new YahooFinance();

// ── Types ────────────────────────────────────────────────

interface PricePoint {
  date: string;
  close: number;
}

interface PriceCorrelation {
  priceBefore: number | null;
  priceAfter: number | null;
  changePct: number | null;
  window: PricePoint[];
}

export type ProgressCallback = (progress: number, step: string) => void;

// ── Research Dimensions ──────────────────────────────────

interface Dimension {
  key: string;
  label: string;
}

const DIMENSIONS: Dimension[] = [
  { key: 'earnings', label: 'Analyzing earnings & fundamentals' },
  { key: 'product_launches', label: 'Researching product launches & announcements' },
  { key: 'sector_trends', label: 'Analyzing sector & industry trends' },
  { key: 'macro_factors', label: 'Evaluating macroeconomic factors' },
  { key: 'competitive_landscape', label: 'Analyzing competitive landscape' },
  { key: 'supply_chain', label: 'Evaluating supply chain & commodity impacts' },
  { key: 'regulatory', label: 'Researching regulatory & legal developments' },
  { key: 'social_sentiment', label: 'Analyzing social media sentiment' },
  { key: 'analyst_ratings', label: 'Reviewing analyst ratings & price targets' },
  { key: 'geopolitical', label: 'Evaluating geopolitical factors' },
];

// ── Helpers (preserved) ──────────────────────────────────

function narrativeHash(title: string, eventDate: string | null): string {
  return crypto
    .createHash('sha256')
    .update(`${title.toLowerCase().trim()}|${eventDate || 'none'}`)
    .digest('hex')
    .slice(0, 32);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Price Correlation (preserved) ────────────────────────

function correlateWithPrice(
  narrative: ParsedNarrative,
  priceHistory: PricePoint[],
): PriceCorrelation {
  if (!narrative.eventDate || priceHistory.length === 0) {
    return { priceBefore: null, priceAfter: null, changePct: null, window: [] };
  }

  const eventDate = narrative.eventDate;
  let beforeIdx = -1;
  for (let i = 0; i < priceHistory.length; i++) {
    if (priceHistory[i].date >= eventDate) {
      beforeIdx = i;
      break;
    }
  }
  if (beforeIdx < 0) beforeIdx = priceHistory.length - 1;

  const priceBefore =
    beforeIdx > 0
      ? priceHistory[beforeIdx - 1].close
      : priceHistory[beforeIdx]?.close ?? null;

  const afterIdx = Math.min(beforeIdx + 5, priceHistory.length - 1);
  const priceAfter = priceHistory[afterIdx]?.close ?? null;

  const changePct =
    priceBefore && priceAfter
      ? Math.round(((priceAfter - priceBefore) / priceBefore) * 10000) / 100
      : null;

  const windowStart = Math.max(0, beforeIdx - 15);
  const windowEnd = Math.min(priceHistory.length, beforeIdx + 15);
  const window = priceHistory.slice(windowStart, windowEnd);

  return { priceBefore, priceAfter, changePct, window };
}

// ── Price History Fetch (preserved) ──────────────────────

async function fetchPriceHistory(ticker: string): Promise<PricePoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);

  const history = await yf.historical(ticker, {
    period1: startDate.toISOString().split('T')[0],
    period2: new Date().toISOString().split('T')[0],
  });

  return (history as any[])
    .map((h) => ({
      date: new Date(h.date).toISOString().split('T')[0],
      close: Math.round((h.close ?? 0) * 100) / 100,
    }))
    .filter((p) => p.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Fallback Narrative Builder (when Ollama is down) ─────

function buildFallbackNarrative(
  dimension: string,
  articles: { title: string; url: string; sourceName: string; publishedDate: string | null; contentSnippet: string; sentimentLabel: string }[],
  ticker: string,
  companyName: string,
): ParsedNarrative | null {
  if (articles.length === 0) return null;

  const primary = articles[0];
  const dimensionLabel = dimension.replace(/_/g, ' ');

  // Build multi-paragraph analysis from article content
  const paragraphs: string[] = [];

  // Lead paragraph from primary article
  const sentences = primary.contentSnippet.match(/[^.!?]+[.!?]+/g) || [primary.title];
  paragraphs.push(
    sentences
      .filter((s) => s.trim().length > 20)
      .slice(0, 4)
      .join(' ')
      .trim() || primary.title,
  );

  // Supporting evidence from other articles
  if (articles.length > 1) {
    const supporting = articles
      .slice(1, 4)
      .map((a) => {
        const firstSentence = (a.contentSnippet.match(/[^.!?]+[.!?]/)?.[0] || a.title).trim();
        return `${a.sourceName} reported: ${firstSentence}`;
      })
      .join(' ');
    if (supporting) paragraphs.push(supporting);
  }

  // Sentiment summary
  const posCount = articles.filter((a) => a.sentimentLabel === 'positive').length;
  const negCount = articles.filter((a) => a.sentimentLabel === 'negative').length;
  paragraphs.push(
    `Across ${articles.length} analyzed sources covering ${dimensionLabel}, sentiment for ${companyName} (${ticker}) is ` +
      `predominantly ${posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'mixed or neutral'}.`,
  );

  // Determine sentiment
  let sentiment = 'neutral';
  if (posCount > negCount) sentiment = 'positive';
  else if (negCount > posCount) sentiment = 'negative';
  else if (posCount > 0 && negCount > 0) sentiment = 'mixed';

  return {
    dimension,
    title: primary.title.slice(0, 80),
    subtitle: (sentences[0] || primary.title).trim().slice(0, 120),
    sentiment,
    impactScore: sentiment === 'positive' ? 0.3 : sentiment === 'negative' ? -0.3 : 0,
    summary: sentences.slice(0, 3).join(' ').trim() || primary.title,
    fullAnalysis: paragraphs.join('\n\n'),
    eventDate: primary.publishedDate,
    correlationNote: primary.publishedDate
      ? `Based on news from ${primary.publishedDate}, ${ticker} price movement analyzed.`
      : 'No specific event date identified for price correlation.',
    sources: articles.map((a) => ({ title: a.sourceName || a.title, url: a.url })),
  };
}

// ── Analyze One Dimension (Scrape → Ollama → Refine) ─────

async function analyzeOneDimension(
  ticker: string,
  companyName: string,
  _sector: string,
  dim: Dimension,
  existingTitles: string[],
  ollamaUp: boolean,
): Promise<ParsedNarrative | null> {
  try {
    // Step 1: Scrape articles for this dimension
    const scrapeResult = await scrapeForDimension(
      ticker,
      companyName,
      dim.key,
      existingTitles,
    );

    if (scrapeResult.articles.length === 0) {
      console.log(`No articles found for ${ticker}/${dim.key}`);
      return null;
    }

    // Map scraped articles to the format Ollama expects
    const ollamaArticles = scrapeResult.articles.map((a) => ({
      title: a.title,
      url: a.url,
      sourceName: a.sourceName,
      publishedDate: a.publishedDate,
      contentSnippet: a.contentSnippet,
      fullContent: a.fullContent,
      sentimentLabel: a.sentimentLabel,
    }));

    if (!ollamaUp) {
      // Fallback: build narrative from scraped content without AI
      return buildFallbackNarrative(dim.key, ollamaArticles, ticker, companyName);
    }

    // Step 2: Pass 1 — Analyze with Ollama
    const initial = await analyzeArticles(
      ollamaArticles,
      dim.key,
      ticker,
      companyName,
    );

    if (!initial) {
      // Ollama call failed — use fallback
      return buildFallbackNarrative(dim.key, ollamaArticles, ticker, companyName);
    }

    // Step 3: Pass 2 — Refine with deeper reasoning
    const refined = await refineAnalysis(initial, ollamaArticles, dim.key, ticker);

    return refined;
  } catch (err) {
    console.error(`Dimension analysis failed for ${ticker}/${dim.key}:`, err);
    return null;
  }
}

// ── Main Pipeline ────────────────────────────────────────

async function runResearchPipeline(
  researchId: number,
  ticker: string,
  companyName: string,
  sector: string,
  existingTitles: string[],
  onProgress: ProgressCallback,
): Promise<void> {
  await prisma.research.update({
    where: { id: researchId },
    data: { status: 'IN_PROGRESS' },
  });

  // Check if Ollama is available
  const ollamaUp = await isOllamaAvailable();
  if (!ollamaUp) {
    console.warn('Ollama is not available — using fallback narrative builder');
  } else {
    console.log('Ollama connected — using DeepSeek-R1 for analysis');
  }

  // Step 1: Fetch price history
  onProgress(5, 'Fetching historical price data...');
  let priceHistory: PricePoint[];
  try {
    priceHistory = await fetchPriceHistory(ticker);
  } catch (err) {
    priceHistory = [];
    console.error(`Price history fetch failed for ${ticker}:`, err);
  }

  await prisma.research.update({
    where: { id: researchId },
    data: {
      priceHistory: JSON.stringify(priceHistory),
      completedSteps: 1,
      progress: 8,
      currentStep: 'Fetching historical price data...',
    },
  });

  // Step 2: Scrape + analyze in batches of 2
  const batches = chunk(DIMENSIONS, 2);
  let completedDimensions = 0;
  let newNarrativeCount = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    // Small delay between batches for politeness
    if (batchIdx > 0) {
      await new Promise((r) => setTimeout(r, 2_000));
    }

    const results = await Promise.allSettled(
      batch.map((dim) =>
        analyzeOneDimension(ticker, companyName, sector, dim, existingTitles, ollamaUp),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      completedDimensions++;
      const progressPct = Math.round(
        8 + (completedDimensions / DIMENSIONS.length) * 80,
      );

      if (results[i].status === 'fulfilled') {
        const narrative = (
          results[i] as PromiseFulfilledResult<ParsedNarrative | null>
        ).value;
        if (narrative && narrative.title && narrative.fullAnalysis) {
          // Correlate with price data
          const priceCorr = correlateWithPrice(narrative, priceHistory);

          // Enhance correlation note with actual price data
          if (priceCorr.changePct !== null) {
            narrative.correlationNote = `${ticker} ${priceCorr.changePct >= 0 ? 'rose' : 'fell'} ${Math.abs(priceCorr.changePct).toFixed(1)}% in the trading days following this event.`;
          }

          const hash = narrativeHash(narrative.title, narrative.eventDate);

          try {
            await prisma.researchNarrative.create({
              data: {
                researchId,
                dimension: narrative.dimension,
                title: narrative.title,
                subtitle: narrative.subtitle,
                sentiment: narrative.sentiment,
                impactScore: narrative.impactScore,
                summary: narrative.summary,
                fullAnalysis: narrative.fullAnalysis,
                eventDate: narrative.eventDate
                  ? new Date(narrative.eventDate)
                  : null,
                priceBeforeEvent: priceCorr.priceBefore,
                priceAfterEvent: priceCorr.priceAfter,
                priceChangePct: priceCorr.changePct,
                correlationNote: narrative.correlationNote,
                priceWindow: JSON.stringify(priceCorr.window),
                sources: JSON.stringify(narrative.sources),
                contentHash: hash,
                sortOrder: completedDimensions,
              },
            });
            newNarrativeCount++;
          } catch (err: any) {
            if (err.code !== 'P2002') {
              console.error(
                `Failed to save narrative for ${ticker}/${narrative.dimension}:`,
                err,
              );
            }
          }
        }
      }

      const dimLabel = batch[i % batch.length]?.label || 'Processing...';
      onProgress(progressPct, dimLabel);
      await prisma.research.update({
        where: { id: researchId },
        data: {
          completedSteps: completedDimensions + 1,
          progress: progressPct,
          currentStep: dimLabel,
        },
      });
    }
  }

  // Step 3: Generate executive summary
  onProgress(92, 'Generating executive summary...');
  await prisma.research.update({
    where: { id: researchId },
    data: { progress: 92, currentStep: 'Generating executive summary...' },
  });

  const allNarratives = await prisma.researchNarrative.findMany({
    where: { researchId },
    select: { dimension: true, title: true, sentiment: true, summary: true },
  });

  let summaryResult = { summary: '', sentiment: 'neutral', confidence: 0.5 };
  try {
    summaryResult = await synthesizeExecutiveSummary(
      allNarratives,
      ticker,
      companyName,
    );
  } catch (err) {
    console.error(
      `Executive summary failed for ${ticker}, using algorithmic fallback:`,
      err,
    );
  }

  // Step 4: Mark complete
  const totalNarratives = await prisma.researchNarrative.count({
    where: { researchId },
  });
  await prisma.research.update({
    where: { id: researchId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      currentStep: 'Complete',
      completedSteps: DIMENSIONS.length + 2,
      executiveSummary: summaryResult.summary,
      overallSentiment: summaryResult.sentiment,
      confidenceScore: summaryResult.confidence,
      narrativeCount: totalNarratives,
    },
  });

  onProgress(100, 'Complete');
}

// ── Public API (preserved) ───────────────────────────────

export async function initiateResearch(
  ticker: string,
  onProgress: ProgressCallback,
): Promise<{
  researchId: number;
  cached: boolean;
  existingNarrativeCount: number;
}> {
  const normalizedTicker = ticker.toUpperCase();

  // Check for an in-progress research
  const inProgress = await prisma.research.findFirst({
    where: { ticker: normalizedTicker, status: 'IN_PROGRESS' },
  });
  if (inProgress) {
    return {
      researchId: inProgress.id,
      cached: false,
      existingNarrativeCount: 0,
    };
  }

  // Check for existing completed research
  const existing = await prisma.research.findFirst({
    where: { ticker: normalizedTicker, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    include: { narratives: { select: { title: true } } },
  });

  if (existing) {
    const existingTitles = existing.narratives.map((n) => n.title);

    // Kick off incremental run to find NEW stories
    const newResearch = await prisma.research.create({
      data: {
        ticker: normalizedTicker,
        companyName: existing.companyName,
        sector: existing.sector,
        status: 'PENDING',
        priceAtResearch: existing.priceAtResearch,
        marketCap: existing.marketCap,
        totalSteps: DIMENSIONS.length + 2,
      },
    });

    // Copy existing narratives to new research (appear immediately)
    const existingNarratives = await prisma.researchNarrative.findMany({
      where: { researchId: existing.id },
    });
    for (const n of existingNarratives) {
      try {
        await prisma.researchNarrative.create({
          data: {
            researchId: newResearch.id,
            dimension: n.dimension,
            title: n.title,
            subtitle: n.subtitle,
            sentiment: n.sentiment,
            impactScore: n.impactScore,
            summary: n.summary,
            fullAnalysis: n.fullAnalysis,
            eventDate: n.eventDate,
            priceBeforeEvent: n.priceBeforeEvent,
            priceAfterEvent: n.priceAfterEvent,
            priceChangePct: n.priceChangePct,
            correlationNote: n.correlationNote,
            priceWindow: n.priceWindow,
            sources: n.sources,
            contentHash: n.contentHash,
            sortOrder: n.sortOrder,
          },
        });
      } catch {
        /* skip duplicates */
      }
    }

    // Run incremental pipeline in background
    runResearchPipeline(
      newResearch.id,
      normalizedTicker,
      existing.companyName,
      existing.sector || 'Unknown',
      existingTitles,
      onProgress,
    ).catch((err) => {
      console.error(`Incremental research failed for ${ticker}:`, err);
      prisma.research
        .update({
          where: { id: newResearch.id },
          data: { status: 'FAILED', errorMessage: String(err) },
        })
        .catch(() => {});
    });

    return {
      researchId: newResearch.id,
      cached: true,
      existingNarrativeCount: existingNarratives.length,
    };
  }

  // No existing research → full pipeline
  let companyName = normalizedTicker;
  let sector = 'Unknown';
  let priceAtResearch: number | null = null;
  let marketCap: number | null = null;

  try {
    const quote = await yf.quote(normalizedTicker);
    companyName =
      (quote as any).shortName || (quote as any).longName || normalizedTicker;
    sector = (quote as any).sector || 'Unknown';
    priceAtResearch = (quote as any).regularMarketPrice ?? null;
    marketCap = (quote as any).marketCap
      ? (quote as any).marketCap / 1e9
      : null;
  } catch {
    /* proceed with defaults */
  }

  const research = await prisma.research.create({
    data: {
      ticker: normalizedTicker,
      companyName,
      sector,
      status: 'PENDING',
      priceAtResearch,
      marketCap,
      totalSteps: DIMENSIONS.length + 2,
    },
  });

  // Run full pipeline in background
  runResearchPipeline(
    research.id,
    normalizedTicker,
    companyName,
    sector,
    [],
    onProgress,
  ).catch((err) => {
    console.error(`Research pipeline failed for ${ticker}:`, err);
    prisma.research
      .update({
        where: { id: research.id },
        data: { status: 'FAILED', errorMessage: String(err) },
      })
      .catch(() => {});
  });

  return { researchId: research.id, cached: false, existingNarrativeCount: 0 };
}
