// ── Web Scraper Service ──────────────────────────────────
// Scrapes free data sources (Google News RSS, Reddit, Finviz)
// No API keys required. Uses cheerio for HTML/XML parsing
// and the sentiment npm package as a fallback scorer.

import * as cheerio from 'cheerio';
import Sentiment from 'sentiment';

// ── Types ────────────────────────────────────────────────

export interface ScrapedArticle {
  title: string;
  url: string;
  sourceName: string;
  publishedDate: string | null;
  contentSnippet: string;
  fullContent: string;
  sentimentScore: number;
  sentimentLabel: 'positive' | 'negative' | 'neutral' | 'mixed';
  relevanceScore: number;
}

export interface DimensionResult {
  dimension: string;
  articles: ScrapedArticle[];
  aggregateSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  aggregateImpactScore: number;
}

interface RSSItem {
  title: string;
  link: string;
  pubDate: string | undefined;
  source: string;
}

interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  subreddit: string;
  url: string;
  created: string;
}

// ── Sentiment Analyzer with Financial Extras ─────────────

const financialExtras: Record<string, number> = {
  bullish: 3, bearish: -3, upgrade: 2, downgrade: -2,
  beat: 2, miss: -2, outperform: 2, underperform: -2,
  rally: 2, plunge: -3, surge: 3, crash: -4,
  bankruptcy: -5, dividend: 1, buyback: 1,
  overweight: 2, underweight: -2, reiterate: 0,
  exceeds: 2, disappoints: -2, warns: -2, soars: 3,
  tumbles: -3, slumps: -3, jumps: 2, drops: -2,
};

const sentimentAnalyzer = new Sentiment();

function analyzeSentiment(text: string): { score: number; label: 'positive' | 'negative' | 'neutral' | 'mixed' } {
  const result = sentimentAnalyzer.analyze(text, { extras: financialExtras });
  const comparative = result.comparative;

  let label: 'positive' | 'negative' | 'neutral' | 'mixed';
  if (comparative > 0.05) label = 'positive';
  else if (comparative < -0.05) label = 'negative';
  else label = 'neutral';

  if (result.positive.length >= 3 && result.negative.length >= 3) {
    label = 'mixed';
  }

  return { score: comparative, label };
}

// ── Dimension Keyword Dictionaries ───────────────────────

const DIMENSION_KEYWORDS: Record<string, { searchTerms: string[]; classifyKeywords: string[] }> = {
  earnings: {
    searchTerms: ['earnings quarterly results', 'revenue EPS guidance', 'financial results profit'],
    classifyKeywords: [
      'earnings', 'revenue', 'eps', 'quarterly', 'guidance', 'profit', 'loss',
      'beat', 'miss', 'fiscal', 'income', 'margin', 'year-over-year', 'yoy',
      'financial results', 'operating income', 'net income', 'ebitda', 'cash flow',
    ],
  },
  product_launches: {
    searchTerms: ['product launch announcement', 'new product release', 'technology innovation'],
    classifyKeywords: [
      'launch', 'product', 'release', 'announce', 'unveil', 'introduce',
      'feature', 'update', 'version', 'rollout', 'debut', 'innovation',
      'patent', 'prototype', 'platform',
    ],
  },
  sector_trends: {
    searchTerms: ['industry trends sector', 'market sector performance', 'industry outlook growth'],
    classifyKeywords: [
      'sector', 'industry', 'trend', 'peer', 'market share', 'growth',
      'rotation', 'benchmark', 'index', 'etf', 'outperform', 'underperform',
      'cyclical', 'defensive', 'momentum',
    ],
  },
  macro_factors: {
    searchTerms: ['federal reserve interest rate', 'inflation tariff trade policy', 'economic outlook GDP'],
    classifyKeywords: [
      'fed', 'federal reserve', 'interest rate', 'inflation', 'tariff',
      'trade war', 'gdp', 'unemployment', 'fiscal', 'monetary', 'dollar',
      'treasury', 'yield', 'cpi', 'stimulus', 'recession', 'budget',
    ],
  },
  competitive_landscape: {
    searchTerms: ['competitor market share', 'acquisition merger', 'competitive threat disruption'],
    classifyKeywords: [
      'competitor', 'competition', 'market share', 'merger', 'acquisition',
      'm&a', 'rival', 'disrupt', 'pricing', 'antitrust', 'monopoly',
      'moat', 'barrier', 'takeover',
    ],
  },
  supply_chain: {
    searchTerms: ['supply chain shortage', 'commodity prices oil semiconductor', 'manufacturing logistics'],
    classifyKeywords: [
      'supply chain', 'supply', 'shipping', 'logistics', 'semiconductor',
      'chip', 'shortage', 'commodity', 'oil', 'lithium', 'copper', 'steel',
      'manufacturing', 'factory', 'inventory', 'backlog',
    ],
  },
  regulatory: {
    searchTerms: ['regulation SEC lawsuit', 'legal compliance antitrust', 'government policy ruling'],
    classifyKeywords: [
      'regulation', 'regulatory', 'sec', 'lawsuit', 'legal', 'compliance',
      'fine', 'penalty', 'investigation', 'subpoena', 'antitrust', 'privacy',
      'ftc', 'doj', 'epa', 'fda', 'ban', 'ruling',
    ],
  },
  social_sentiment: {
    searchTerms: ['reddit stock discussion', 'social media sentiment trending', 'retail investor buzz'],
    classifyKeywords: [
      'reddit', 'twitter', 'social media', 'viral', 'meme stock',
      'wallstreetbets', 'wsb', 'trending', 'sentiment', 'retail investor',
      'crowd', 'hype', 'glassdoor', 'boycott', 'public opinion',
    ],
  },
  analyst_ratings: {
    searchTerms: ['analyst rating price target', 'upgrade downgrade Wall Street', 'analyst consensus estimate'],
    classifyKeywords: [
      'analyst', 'rating', 'upgrade', 'downgrade', 'price target',
      'buy', 'sell', 'hold', 'overweight', 'underweight', 'outperform',
      'consensus', 'estimate', 'coverage', 'initiate',
    ],
  },
  geopolitical: {
    searchTerms: ['geopolitical risk sanctions', 'trade war China tariff', 'global conflict election'],
    classifyKeywords: [
      'geopolitical', 'sanctions', 'trade war', 'conflict', 'war',
      'election', 'tariff', 'embargo', 'nato', 'china', 'russia', 'eu',
      'export control', 'national security', 'diplomacy',
    ],
  },
};

// ── Rate Limiter ─────────────────────────────────────────

let lastFetchTime = 0;
const MIN_FETCH_INTERVAL_MS = 500;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastFetchTime;
  if (elapsed < MIN_FETCH_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_FETCH_INTERVAL_MS - elapsed));
  }
  lastFetchTime = Date.now();

  return fetch(url, {
    ...options,
    signal: options?.signal || AbortSignal.timeout(10_000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...((options?.headers as Record<string, string>) || {}),
    },
  });
}

// ── Google News RSS ──────────────────────────────────────

async function fetchGoogleNewsRSS(query: string, maxResults = 10): Promise<RSSItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await rateLimitedFetch(url, {
      headers: { Accept: 'application/rss+xml,application/xml,text/xml' },
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const items: RSSItem[] = [];
    $('item').each((_, el) => {
      items.push({
        title: $(el).find('title').text().trim(),
        link: $(el).find('link').text().trim(),
        pubDate: $(el).find('pubDate').text().trim() || undefined,
        source: $(el).find('source').text().trim() || 'Google News',
      });
    });

    return items.slice(0, maxResults);
  } catch (err) {
    console.error(`Google News RSS fetch failed for "${query}":`, err);
    return [];
  }
}

// ── Article Content Extraction ───────────────────────────

async function extractArticleContent(
  url: string,
): Promise<{ text: string; date: string | null }> {
  try {
    const response = await rateLimitedFetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { text: '', date: null };

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise elements
    $(
      'script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar, ' +
      '.comments, .social-share, [role="navigation"], .cookie-banner, .popup, ' +
      '.newsletter-signup, iframe, .related-articles',
    ).remove();

    // Try structured article selectors first
    let text = '';
    const selectors = [
      'article',
      '[role="main"]',
      '.article-body',
      '.article-content',
      '.story-body',
      '.post-content',
      '.entry-content',
      '.caas-body',           // Yahoo Finance
      '.article__body',
      'main',
    ];
    for (const selector of selectors) {
      const found = $(selector).text().trim();
      if (found.length > 200) {
        text = found;
        break;
      }
    }

    // Fallback: grab all <p> tags
    if (!text || text.length < 200) {
      text = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 30)
        .join('\n\n');
    }

    // Extract date from meta tags or time elements
    let date: string | null = null;
    const dateMeta =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('meta[name="pubdate"]').attr('content') ||
      $('meta[name="publish-date"]').attr('content') ||
      $('time[datetime]').first().attr('datetime');
    if (dateMeta) {
      const parsed = new Date(dateMeta);
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().split('T')[0];
      }
    }

    // Clean whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return { text: text.slice(0, 5000), date }; // Cap at 5000 chars
  } catch (err) {
    // Silently fail — single article failures are expected
    return { text: '', date: null };
  }
}

// ── Reddit JSON API ──────────────────────────────────────

async function fetchRedditPosts(ticker: string, limit = 20): Promise<RedditPost[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(
      `${ticker} stock`,
    )}&sort=relevance&t=month&limit=${limit}`;

    const response = await rateLimitedFetch(url);
    if (!response.ok) return [];

    const json = (await response.json()) as any;
    return (
      json.data?.children?.map((child: any) => ({
        title: child.data.title || '',
        selftext: (child.data.selftext || '').slice(0, 500),
        score: child.data.score || 0,
        subreddit: child.data.subreddit || '',
        url: `https://www.reddit.com${child.data.permalink || ''}`,
        created: new Date((child.data.created_utc || 0) * 1000).toISOString().split('T')[0],
      })) || []
    );
  } catch (err) {
    console.error('Reddit fetch failed:', err);
    return [];
  }
}

// ── Finviz News Scraper ──────────────────────────────────

interface FinvizNewsItem {
  title: string;
  url: string;
  dateStr: string;
  source: string;
}

async function fetchFinvizNews(ticker: string): Promise<FinvizNewsItem[]> {
  try {
    const url = `https://finviz.com/quote.ashx?t=${ticker}&p=d`;
    const response = await rateLimitedFetch(url);
    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    const items: FinvizNewsItem[] = [];
    $('#news-table tr').each((_, el) => {
      const dateCell = $(el).find('td:first-child').text().trim();
      const link = $(el).find('a');
      if (link.length) {
        items.push({
          title: link.text().trim(),
          url: link.attr('href') || '',
          dateStr: dateCell,
          source: $(el).find('span').last().text().replace(/[()]/g, '').trim() || 'Finviz',
        });
      }
    });

    return items.slice(0, 20);
  } catch (err) {
    console.error('Finviz fetch failed:', err);
    return [];
  }
}

// ── Dimension Keyword Classification ─────────────────────

function classifyArticleToDimension(
  article: { title: string; content: string },
  targetDimension: string,
): number {
  const keywords = DIMENSION_KEYWORDS[targetDimension]?.classifyKeywords || [];
  const text = `${article.title} ${article.content}`.toLowerCase();

  let matchCount = 0;
  for (const kw of keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) matchCount += matches.length;
  }
  return matchCount;
}

// ── Helper: Parse RSS Date ───────────────────────────────

function parseRSSDate(rssDate: string | undefined): string | null {
  if (!rssDate) return null;
  try {
    const d = new Date(rssDate);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// ── Main Export: Scrape for One Dimension ─────────────────

export async function scrapeForDimension(
  ticker: string,
  companyName: string,
  dimension: string,
  existingTitles: string[],
): Promise<DimensionResult> {
  const dimConfig = DIMENSION_KEYWORDS[dimension];
  if (!dimConfig) {
    return { dimension, articles: [], aggregateSentiment: 'neutral', aggregateImpactScore: 0 };
  }

  // Step 1: Build search queries (ticker + dimension-specific terms)
  const queries = dimConfig.searchTerms.map((term) => `${ticker} ${companyName} ${term}`);

  // Step 2: Fetch from Google News RSS (parallel) + Finviz
  const [rssResults, finvizNews] = await Promise.all([
    Promise.allSettled(queries.map((q) => fetchGoogleNewsRSS(q, 8))),
    fetchFinvizNews(ticker),
  ]);

  // Collect all RSS items
  let allRSSItems: RSSItem[] = [];
  for (const r of rssResults) {
    if (r.status === 'fulfilled') allRSSItems.push(...r.value);
  }

  // Add Finviz news as RSS-like items
  for (const fn of finvizNews) {
    allRSSItems.push({
      title: fn.title,
      link: fn.url,
      pubDate: fn.dateStr,
      source: fn.source,
    });
  }

  // Step 3: Deduplicate by normalized title
  const seen = new Set<string>();
  allRSSItems = allRSSItems.filter((item) => {
    const key = item.title.toLowerCase().trim().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Step 4: Filter out articles matching existing narrative titles
  const existingSet = new Set(existingTitles.map((t) => t.toLowerCase().trim()));
  allRSSItems = allRSSItems.filter(
    (item) => !existingSet.has(item.title.toLowerCase().trim()),
  );

  // Step 5: Score by dimension keyword relevance
  const scored = allRSSItems.map((item) => ({
    ...item,
    relevance: classifyArticleToDimension({ title: item.title, content: '' }, dimension),
  }));
  scored.sort((a, b) => b.relevance - a.relevance);

  // Step 6: Take top 5 most relevant, fetch full content
  const topArticles = scored.slice(0, 5);
  const fullArticles: ScrapedArticle[] = [];

  const contentResults = await Promise.allSettled(
    topArticles.map(async (item) => {
      const { text, date } = await extractArticleContent(item.link);
      const content = text || item.title;
      const sentiment = analyzeSentiment(content);
      const publishedDate = date || parseRSSDate(item.pubDate);

      return {
        title: item.title,
        url: item.link,
        sourceName: item.source,
        publishedDate,
        contentSnippet: content.slice(0, 500),
        fullContent: content,
        sentimentScore: sentiment.score,
        sentimentLabel: sentiment.label,
        relevanceScore: classifyArticleToDimension(
          { title: item.title, content },
          dimension,
        ),
      } as ScrapedArticle;
    }),
  );

  for (const r of contentResults) {
    if (r.status === 'fulfilled' && r.value.title) {
      fullArticles.push(r.value);
    }
  }

  // Step 7: For social_sentiment, also fetch Reddit posts
  if (dimension === 'social_sentiment') {
    try {
      const redditPosts = await fetchRedditPosts(ticker, 15);
      for (const post of redditPosts.slice(0, 5)) {
        const text = `${post.title} ${post.selftext}`;
        const sentiment = analyzeSentiment(text);
        fullArticles.push({
          title: post.title,
          url: post.url,
          sourceName: `r/${post.subreddit}`,
          publishedDate: post.created,
          contentSnippet: text.slice(0, 500),
          fullContent: text,
          sentimentScore: sentiment.score,
          sentimentLabel: sentiment.label,
          relevanceScore: 10,
        });
      }
    } catch (err) {
      console.error('Reddit fetch failed, continuing without it:', err);
    }
  }

  // Step 8: Sort by relevance × |sentiment| (highest impact first)
  fullArticles.sort(
    (a, b) =>
      b.relevanceScore * Math.abs(b.sentimentScore + 0.01) -
      a.relevanceScore * Math.abs(a.sentimentScore + 0.01),
  );

  // Step 9: Compute aggregate sentiment
  if (fullArticles.length === 0) {
    return { dimension, articles: [], aggregateSentiment: 'neutral', aggregateImpactScore: 0 };
  }

  const avgSentiment =
    fullArticles.reduce((sum, a) => sum + a.sentimentScore, 0) / fullArticles.length;

  const posCount = fullArticles.filter((a) => a.sentimentLabel === 'positive').length;
  const negCount = fullArticles.filter((a) => a.sentimentLabel === 'negative').length;

  let aggregateSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  if (posCount > 0 && negCount > 0 && Math.abs(posCount - negCount) <= 1) {
    aggregateSentiment = 'mixed';
  } else if (avgSentiment > 0.05) {
    aggregateSentiment = 'positive';
  } else if (avgSentiment < -0.05) {
    aggregateSentiment = 'negative';
  } else {
    aggregateSentiment = 'neutral';
  }

  const aggregateImpactScore = Math.max(
    -1,
    Math.min(1, Math.round(avgSentiment * 100) / 100),
  );

  return { dimension, articles: fullArticles, aggregateSentiment, aggregateImpactScore };
}
