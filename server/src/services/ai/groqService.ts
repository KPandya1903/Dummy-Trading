// ── Groq Cloud LLM Service ─────────────────────────────────
// Free-tier wrapper around Groq's OpenAI-compatible chat API.
// Model: llama-3.3-70b-versatile (free, 14,400 req/day)
// Used by both geminiService.ts (Insights/News) and ollamaService.ts (Research)

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ── Core Groq Call ───────────────────────────────────────

export async function callGroq(
  messages: GroqMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  },
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 55_000, // stay under Vercel's 60s limit
  );

  try {
    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Groq API error ${response.status}:`, errText);
      return null;
    }

    const json = await response.json() as {
      choices?: { message?: { content?: string } }[];
    };

    return json.choices?.[0]?.message?.content ?? null;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error('Groq call timed out');
    } else {
      console.error('Groq request failed:', err.message);
    }
    return null;
  }
}

// ── Availability Check ───────────────────────────────────

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}
