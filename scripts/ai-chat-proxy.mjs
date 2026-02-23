import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const AI_CHAT_TOKEN = (process.env.AI_CHAT_TOKEN || '').trim();
const RATE_LIMIT_MAX_REQUESTS = Math.max(
  1,
  Number.parseInt(process.env.AI_CHAT_RATE_LIMIT_MAX || '60', 10)
);
const RATE_LIMIT_WINDOW_MS = Math.max(
  5000,
  Number.parseInt(process.env.AI_CHAT_RATE_LIMIT_WINDOW_MS || '60000', 10)
);
const rateLimitStore = new Map();

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

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
};

const isRateLimited = (ip) => {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  entry.count += 1;
  rateLimitStore.set(ip, entry);
  return false;
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
  const coachProfile = payload.coachProfile && typeof payload.coachProfile === 'object' ? payload.coachProfile : {};
  const history = normalizeHistory(payload.history);
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const responseStyle = payload.responseStyle && typeof payload.responseStyle === 'object' ? payload.responseStyle : {};
  const tone = typeof responseStyle.tone === 'string' ? responseStyle.tone : 'coach';
  const structure =
    typeof responseStyle.structure === 'string' ? responseStyle.structure : 'adaptive-status-steps';
  const strictMode = responseStyle.strictMode === 'strict';
  const forceDirect = Boolean(responseStyle.forceDirect);
  const reviseReason =
    typeof responseStyle.reviseReason === 'string' ? responseStyle.reviseReason.trim() : '';
  const previousAnswer = typeof payload.previousAnswer === 'string' ? payload.previousAnswer.trim() : '';
  const previousAssistantReply =
    typeof payload.previousAssistantReply === 'string' ? payload.previousAssistantReply.trim() : '';
  const maxLength =
    Number.isFinite(Number(responseStyle.maxLength)) && Number(responseStyle.maxLength) > 0
      ? Math.min(1200, Math.max(180, Number(responseStyle.maxLength)))
      : 650;

  const system =
    typeof payload.systemPrompt === 'string' && payload.systemPrompt.trim()
      ? payload.systemPrompt.trim()
      : lang === 'sv'
        ? 'Du är en personlig träningscoach. Svara som en människa, tydligt och konkret, med fokus på progression.'
        : 'You are a personal training coach. Respond like a human, clear and concrete, focused on progression.';

  const styleRules =
    lang === 'sv'
      ? [
          'Använd endast data från contextSummary/context/recentHistory.',
          'Om coachProfile finns: använd det som mjuk kontext, inte som ett hårt krav.',
          'Anta inte att coachProfile betyder exklusivt fokus på en övningstyp.',
          'Om data saknas, säg det tydligt istället för att gissa.',
          'Följdfrågor ska kännas som en tydlig fortsättning på samtalet.',
          'Använd 0-2 datapunkter från användarens data endast när de är direkt relevanta för frågan.',
          'Tolka "mest loggad övning" som observerad historik, inte som användarens preferens eller favorit om det inte uttryckligen står.',
          'Om frågan är generell, håll svaret generellt och ge breda alternativ istället för att låsa till en enskild övning.',
          'Nämn inte en specifik övning om användaren inte själv har nämnt den, om det inte är nödvändigt för att svara korrekt.',
          'Hitta inte på preferenser (t.ex. favoritdag, övningsfokus, saker att undvika). Om det inte explicit finns i relevant coachProfile för frågan: nämn det inte.',
          'Skriv inte påståenden som "du föredrar X", "du tränar helst på Y" eller "du undviker Z" om det inte står explicit i requestens relevanta kontext.',
          'Om användaren vill ha råd/plan: ge 2-4 konkreta nästa steg.',
          'Första meningen ska alltid svara direkt på användarens exakta fråga.',
          'Svara i samma intention som frågan: fråga om plan => ge plan, fråga om förklaring => förklara, fråga om jämförelse => jämför.',
          'Om användaren ställer en öppen fråga, ge ett öppet men relevant svar med 2-3 alternativ istället för ett låst standardupplägg.',
          'Håll dig till det användaren frågar om; byt inte ämne och lägg inte till irrelevanta sidospår.',
          'Undvik att börja med allmän bakgrund eller svepande formuleringar.',
          'Börja inte svaret med fraser som "Bra fråga", "Toppen", eller "Vi håller det enkelt".',
          'Variera meningsstart mellan svar och undvik samma inledningsfraser i flera svar i rad.',
          'Om frågan är kort/öppen: ställ exakt en klargörande följdfråga i slutet.',
          'Undvik generiska standardsvar.',
        ]
      : [
          'Use only data from contextSummary/context/recentHistory.',
          'If coachProfile is present, use it as soft context, not a hard constraint.',
          'Do not assume coachProfile means exclusive focus on one exercise type.',
          'If data is missing, say so instead of guessing.',
          'Follow-ups should feel like a clear continuation of the conversation.',
          'Use 0-2 data points from user data only when they are directly relevant to the question.',
          'Treat "most logged exercise" as observed history, not user preference/favorite unless explicitly stated.',
          'If the question is general, keep the answer general and provide broad options instead of locking onto one exercise.',
          'Do not mention a specific exercise unless the user mentioned it, unless it is necessary to answer correctly.',
          'Do not invent preferences (e.g. favorite day, exercise focus, things to avoid). If it is not explicitly present in relevant coachProfile for the question: do not mention it.',
          'Do not write claims like "you prefer X", "you mainly train on Y", or "you avoid Z" unless explicitly present in relevant request context.',
          'If user asks for advice/plan: provide 2-4 concrete next steps.',
          'The first sentence must directly answer the user’s exact question.',
          'Match the user intent: if they ask for a plan => provide a plan, if explanation => explain, if comparison => compare.',
          'If the user asks an open question, provide an open but relevant answer with 2-3 options instead of one rigid template.',
          'Stay on the user’s asked topic; do not switch topics or add irrelevant side tracks.',
          'Avoid opening with generic background statements.',
          'Do not start with phrases like "Great question", "Nice", or "Let’s keep it simple".',
          'Vary sentence openings across responses and avoid repeating the same intro phrasing.',
          'If the question is short/ambiguous: ask exactly one clarifying question at the end.',
          'Avoid generic boilerplate.',
        ];

  const outputGuide =
    lang === 'sv'
      ? [
          'Svarsstil:',
          `- ton: ${tone}`,
          `- struktur: ${structure}`,
          `- max längd: cirka ${maxLength} tecken`,
          '- håll svaret kompakt men personligt',
          '- inga markdown-rubriker',
        ].join('\n')
      : [
          'Response style:',
          `- tone: ${tone}`,
          `- structure: ${structure}`,
          `- max length: around ${maxLength} chars`,
          '- keep it compact but personal',
          '- no markdown headings',
        ].join('\n');

  if (strictMode) {
    styleRules.push(
      lang === 'sv'
        ? 'Svara ultra-koncist: max 3 korta stycken och inga irrelevanta tillägg.'
        : 'Reply ultra-concisely: max 3 short paragraphs and no irrelevant additions.'
    );
  }
  if (forceDirect) {
    styleRules.push(
      lang === 'sv'
        ? 'Använd exakt första meningen till att direkt besvara användarens fråga utan inledning.'
        : 'Use the very first sentence to directly answer the user question without preamble.'
    );
  }
  if (previousAnswer) {
    styleRules.push(
      lang === 'sv'
        ? 'Du reviderar ett tidigare svar som inte träffade frågan. Svara annorlunda och mer direkt än tidigare, återanvänd inte samma formuleringar.'
        : 'You are revising a previous answer that missed the question. Answer differently and more directly, do not reuse the same phrasing.'
    );
  }
  if (previousAssistantReply) {
    styleRules.push(
      lang === 'sv'
        ? 'Undvik att upprepa formuleringar från föregående AI-svar om inte användaren uttryckligen ber om repetition.'
        : 'Avoid repeating phrasing from the previous AI answer unless the user explicitly asks for repetition.'
    );
  }

  const userParts = [
    `language: ${lang}`,
    `contextSummary: ${JSON.stringify(summary)}`,
    `coachProfile: ${JSON.stringify(coachProfile)}`,
    `recentHistory: ${JSON.stringify(history)}`,
    `userMessage: ${message}`,
    previousAnswer ? `previousAnswerToImprove: ${previousAnswer}` : null,
    previousAssistantReply ? `previousAssistantReply: ${previousAssistantReply}` : null,
    reviseReason ? `revisionReason: ${reviseReason}` : null,
  ];

  return {
    instructions: `${system}\n\n${styleRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n${outputGuide}`,
    input: userParts.filter(Boolean).join('\n\n'),
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

  if (AI_CHAT_TOKEN) {
    const providedToken = req.headers['x-ai-chat-token'];
    if (providedToken !== AI_CHAT_TOKEN) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    json(res, 429, { error: 'Too many requests' });
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
