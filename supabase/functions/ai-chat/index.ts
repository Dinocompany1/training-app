import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
const AI_CHAT_TOKEN = (Deno.env.get('AI_CHAT_TOKEN') || '').trim();
const AI_CHAT_JWT_SECRET = (Deno.env.get('AI_CHAT_JWT_SECRET') || '').trim();
const RATE_LIMIT_REDIS_URL = (Deno.env.get('AI_CHAT_RATE_LIMIT_REDIS_URL') || '').trim();
const RATE_LIMIT_REDIS_TOKEN = (Deno.env.get('AI_CHAT_RATE_LIMIT_REDIS_TOKEN') || '').trim();
const RATE_LIMIT_MAX_REQUESTS = Math.max(
  1,
  Number.parseInt(Deno.env.get('AI_CHAT_RATE_LIMIT_MAX') || '60', 10)
);
const RATE_LIMIT_WINDOW_MS = Math.max(
  5000,
  Number.parseInt(Deno.env.get('AI_CHAT_RATE_LIMIT_WINDOW_MS') || '60000', 10)
);

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();
type JwtPayload = { exp?: number; role?: string; sub?: string; [key: string]: unknown };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ai-chat-token',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });

const decodeBase64Url = (input: string): Uint8Array => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
};

const parseJwtSection = <T>(section: string): T | null => {
  try {
    const bytes = decodeBase64Url(section);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const getBearerToken = (authorization: string | null): string | null => {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const verifySupabaseJwt = async (token: string): Promise<JwtPayload | null> => {
  if (!AI_CHAT_JWT_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtSection<{ alg?: string; typ?: string }>(encodedHeader);
  if (!header || header.alg !== 'HS256') return null;
  const payload = parseJwtSection<JwtPayload>(encodedPayload);
  if (!payload) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(AI_CHAT_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!isValid) return null;
  if (typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
};

const isAuthorized = async (req: Request): Promise<boolean> => {
  if (AI_CHAT_JWT_SECRET) {
    const bearer = getBearerToken(req.headers.get('authorization'));
    if (!bearer) return false;
    const payload = await verifySupabaseJwt(bearer);
    return Boolean(payload?.sub);
  }
  if (AI_CHAT_TOKEN) {
    const providedToken = req.headers.get('x-ai-chat-token');
    return providedToken === AI_CHAT_TOKEN;
  }
  return true;
};

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
};

const redisHeaders = RATE_LIMIT_REDIS_TOKEN
  ? { Authorization: `Bearer ${RATE_LIMIT_REDIS_TOKEN}` }
  : {};

const redisRateLimit = async (ip: string): Promise<boolean | null> => {
  if (!RATE_LIMIT_REDIS_URL || !RATE_LIMIT_REDIS_TOKEN) return null;
  const key = `ai-chat:rl:${ip}`;
  try {
    const urlBase = RATE_LIMIT_REDIS_URL.replace(/\/$/, '');
    const [incrRes, ttlRes] = await Promise.all([
      fetch(`${urlBase}/incr/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: redisHeaders,
      }),
      fetch(`${urlBase}/pttl/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: redisHeaders,
      }),
    ]);
    if (!incrRes.ok || !ttlRes.ok) return null;
    const incrJson = (await incrRes.json()) as { result?: unknown };
    const ttlJson = (await ttlRes.json()) as { result?: unknown };
    const count = Number(incrJson.result);
    const ttlMs = Number(ttlJson.result);
    if (!Number.isFinite(count)) return null;
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      await fetch(
        `${urlBase}/pexpire/${encodeURIComponent(key)}/${encodeURIComponent(String(RATE_LIMIT_WINDOW_MS))}`,
        {
          method: 'POST',
          headers: redisHeaders,
        }
      );
    }
    return count > RATE_LIMIT_MAX_REQUESTS;
  } catch {
    return null;
  }
};

const memoryRateLimit = (ip: string) => {
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

const isRateLimited = async (ip: string) => {
  const redisLimited = await redisRateLimit(ip);
  if (redisLimited != null) return redisLimited;
  return memoryRateLimit(ip);
};

const normalizeHistory = (history: unknown) => {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        ('role' in item) &&
        ('text' in item) &&
        (((item as { role?: string }).role === 'user') || ((item as { role?: string }).role === 'assistant')) &&
        typeof (item as { text?: unknown }).text === 'string'
    )
    .slice(-12)
    .map((item) => ({
      role: (item as { role: 'user' | 'assistant' }).role,
      text: (item as { text: string }).text.trim(),
    }))
    .filter((item) => item.text.length > 0);
};

const buildPrompt = (payload: Record<string, unknown>) => {
  const lang = payload.lang === 'en' ? 'en' : 'sv';
  const summary =
    payload.contextSummary && typeof payload.contextSummary === 'object'
      ? payload.contextSummary
      : {};
  const coachProfile =
    payload.coachProfile && typeof payload.coachProfile === 'object'
      ? payload.coachProfile
      : {};
  const history = normalizeHistory(payload.history);
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const responseStyle =
    payload.responseStyle && typeof payload.responseStyle === 'object'
      ? (payload.responseStyle as Record<string, unknown>)
      : {};
  const tone = typeof responseStyle.tone === 'string' ? responseStyle.tone : 'coach';
  const structure =
    typeof responseStyle.structure === 'string'
      ? responseStyle.structure
      : 'adaptive-status-steps';
  const strictMode = responseStyle.strictMode === 'strict';
  const forceDirect = Boolean(responseStyle.forceDirect);
  const reviseReason =
    typeof responseStyle.reviseReason === 'string'
      ? responseStyle.reviseReason.trim()
      : '';
  const previousAnswer =
    typeof payload.previousAnswer === 'string' ? payload.previousAnswer.trim() : '';
  const previousAssistantReply =
    typeof payload.previousAssistantReply === 'string'
      ? payload.previousAssistantReply.trim()
      : '';
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

const callOpenAI = async (payload: Record<string, unknown>) => {
  const prompt = buildPrompt(payload);
  const isGpt5Family = /^gpt-5/i.test(OPENAI_MODEL);

  const requestBody: Record<string, unknown> = {
    model: OPENAI_MODEL,
    max_output_tokens: 450,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: prompt.instructions }] },
      { role: 'user', content: [{ type: 'input_text', text: prompt.input }] },
    ],
  };

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

  const data = (await response.json()) as Record<string, unknown>;
  let text = typeof data.output_text === 'string' ? data.output_text.trim() : '';

  if (!text && Array.isArray(data.output)) {
    const chunks: string[] = [];
    for (const item of data.output) {
      if (!item || typeof item !== 'object') continue;
      if ((item as { type?: string }).type !== 'message') continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        if ((part as { type?: string }).type === 'output_text' && typeof (part as { text?: unknown }).text === 'string') {
          chunks.push(((part as { text: string }).text || '').trim());
        }
      }
    }
    text = chunks.filter(Boolean).join('\n').trim();
  }

  if (!text) {
    throw new Error('No text in OpenAI response');
  }
  return text;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(404, { error: 'Not found' });
  }

  if (!OPENAI_API_KEY) {
    return json(500, { error: 'Missing OPENAI_API_KEY' });
  }

  if (!(await isAuthorized(req))) {
    return json(401, { error: 'Unauthorized' });
  }

  const ip = getClientIp(req);
  if (await isRateLimited(ip)) {
    return json(429, { error: 'Too many requests' });
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    if (!payload || typeof payload.message !== 'string' || !payload.message.trim()) {
      return json(400, { error: 'message is required' });
    }
    const reply = await callOpenAI(payload);
    return json(200, { reply });
  } catch (error) {
    return json(500, {
      error: 'AI request failed',
      details: error instanceof Error ? error.message : 'unknown error',
    });
  }
});
