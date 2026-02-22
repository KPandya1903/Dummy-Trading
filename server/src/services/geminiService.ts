import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (ai) return ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  ai = new GoogleGenAI({ apiKey: key });
  return ai;
}

export async function analyzeStock(
  ticker: string,
  context: string,
  data?: string,
): Promise<{ text: string; sources: { title: string; url: string }[] } | null> {
  const client = getClient();
  if (!client) return null;

  const prompts: Record<string, string> = {
    technical: `You are a financial analyst. Analyze the technical indicators for ${ticker} stock. ${data ? `Here is the current data: ${data}` : ''} Provide a concise 2-3 paragraph analysis covering trend direction, momentum, and key support/resistance levels. Be specific with numbers.`,
    fundamental: `You are a financial analyst. Analyze the fundamental metrics for ${ticker} stock. ${data ? `Here is the current data: ${data}` : ''} Provide a concise 2-3 paragraph analysis covering valuation, growth prospects, and key risks.`,
    prediction: `You are a financial analyst. Based on available data for ${ticker} stock, provide your assessment of the short-term outlook (1-4 weeks). ${data ? `Here are model predictions: ${data}` : ''} Discuss factors that could influence the price. Be balanced and mention both bull and bear cases.`,
    news: `Summarize the latest news and market sentiment for ${ticker} stock. Focus on the most impactful recent developments, earnings, analyst ratings, and market-moving events from the past week. Organize by importance.`,
  };

  const prompt = prompts[context] || prompts.news;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text ?? '';

    // Extract grounding sources if available
    const sources: { title: string; url: string }[] = [];
    const candidate = response.candidates?.[0];
    if (candidate) {
      const grounding = (candidate as any).groundingMetadata;
      if (grounding?.groundingChunks) {
        for (const chunk of grounding.groundingChunks) {
          if (chunk.web) {
            sources.push({
              title: chunk.web.title || 'Source',
              url: chunk.web.uri || '',
            });
          }
        }
      }
    }

    return { text, sources };
  } catch (err) {
    console.error(`Gemini analysis error for ${ticker}:`, err);
    return null;
  }
}

export async function getStockNews(
  ticker: string,
): Promise<{
  summary: string;
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  sources: { title: string; url: string }[];
} | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Provide a comprehensive news summary for ${ticker} stock. Include:
1. Latest earnings and financial results
2. Recent analyst upgrades/downgrades
3. Major company announcements
4. Market sentiment and trends
5. Any regulatory or industry developments

At the very end, on a new line, write exactly one of these sentiment labels: SENTIMENT: positive, SENTIMENT: negative, SENTIMENT: mixed, or SENTIMENT: neutral`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text ?? '';

    // Parse sentiment from response
    let sentiment: 'positive' | 'negative' | 'mixed' | 'neutral' = 'neutral';
    const sentimentMatch = text.match(/SENTIMENT:\s*(positive|negative|mixed|neutral)/i);
    if (sentimentMatch) {
      sentiment = sentimentMatch[1].toLowerCase() as typeof sentiment;
    }

    // Remove the sentiment line from the summary
    const summary = text.replace(/SENTIMENT:\s*(positive|negative|mixed|neutral)/i, '').trim();

    // Extract sources
    const sources: { title: string; url: string }[] = [];
    const candidate = response.candidates?.[0];
    if (candidate) {
      const grounding = (candidate as any).groundingMetadata;
      if (grounding?.groundingChunks) {
        for (const chunk of grounding.groundingChunks) {
          if (chunk.web) {
            sources.push({
              title: chunk.web.title || 'Source',
              url: chunk.web.uri || '',
            });
          }
        }
      }
    }

    return { summary, sentiment, sources };
  } catch (err) {
    console.error(`Gemini news error for ${ticker}:`, err);
    return null;
  }
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
