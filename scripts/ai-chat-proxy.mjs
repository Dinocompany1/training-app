import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const json = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
};

const normalizeHistory = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
    .slice(-12)
    .map((item) => ({ role: item.role, text: item.text.trim() }))
    .filter((item) => item.text.length > 0);
};

const buildPrompt = (payload) => {
  const lang = payload.lang === 'en' ? 'en' : 'sv';
  const summary = payload.contextSummary || {};
  const history = normalizeHistory(payload.history);
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';

  const system =
    typeof payload.systemPrompt === 'string' && payload.systemPrompt.trim()
      ? payload.systemPrompt.trim()
      : lang === 'sv'
        ? 'Du är en personlig träningscoach. Svara naturligt och mänskligt, men fortfarande konkret och datadrivet.'
        : 'You are a personal training coach. Respond naturally and human-like, while still concrete and data-driven.';

  const styleRules =
    lang === 'sv'
      ? [
          'Använd endast data från contextSummary/context.',
          'Om data saknas, säg det tydligt istället för att gissa.',
          'Anpassa ton och längd efter frågan. Följdfrågor ska kännas som en fortsättning på samtalet.',
          'Ge konkreta nästa steg när användaren ber om råd eller plan.',
          'Undvik generiska svar.',
        ]
      : [
          'Use only data from contextSummary/context.',
          'If data is missing, say so instead of guessing.',
          'Adapt tone and length to the question. Follow-ups should feel like a continuation of the conversation.',
          'Provide concrete next steps when the user asks for advice or planning.',
          'Avoid generic answers.',
        ];

  const userParts = [
    `language: ${lang}`,
    `contextSummary: ${JSON.stringify(summary)}`,
    `recentHistory: ${JSON.stringify(history)}`,
    `userMessage: ${message}`,
  ];

  return {
    instructions: `${system}\n\n${styleRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
    input: userParts.join('\n\n'),
  };
};

const callOpenAI = async (payload) => {
  const prompt = buildPrompt(payload);
  const isGpt5Family = /^gpt-5/i.test(OPENAI_MODEL);

  const requestBody = {
    model: OPENAI_MODEL,
    max_output_tokens: 450,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: prompt.instructions }] },
      { role: 'user', content: [{ type: 'input_text', text: prompt.input }] },
    ],
  };

  // GPT-5 models do not support `temperature` on this endpoint.
  if (!isGpt5Family) {
    requestBody.temperature = 0.4;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${body.slice(0, 800)}`);
  }

  const data = await response.json();

  // Prefer top-level output_text when available.
  let text = typeof data.output_text === 'string' ? data.output_text.trim() : '';

  // Fallback: parse nested response content.
  if (!text && Array.isArray(data.output)) {
    const chunks = [];
    for (const item of data.output) {
      if (!item || item.type !== 'message' || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (part?.type === 'output_text' && typeof part.text === 'string') {
          chunks.push(part.text.trim());
        }
      }
    }
    text = chunks.filter(Boolean).join('\n').trim();
  }

  if (!text) {
    const summary = {
      id: data?.id,
      model: data?.model,
      status: data?.status,
      incomplete_details: data?.incomplete_details,
      error: data?.error,
    };
    throw new Error(`No text in OpenAI response: ${JSON.stringify(summary)}`);
  }
  return text;
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/ai-chat') {
    json(res, 404, { error: 'Not found' });
    return;
  }

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 1_000_000) req.destroy();
  });

  req.on('end', async () => {
    try {
      const payload = raw ? JSON.parse(raw) : {};
      if (!payload || typeof payload.message !== 'string' || !payload.message.trim()) {
        json(res, 400, { error: 'message is required' });
        return;
      }

      const reply = await callOpenAI(payload);
      json(res, 200, { reply });
    } catch (error) {
      json(res, 500, {
        error: 'AI request failed',
        details: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`AI chat proxy running on http://localhost:${PORT}/ai-chat`);
});
